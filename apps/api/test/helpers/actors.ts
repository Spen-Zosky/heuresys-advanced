/**
 * apps/api/test/helpers/actors.ts
 * Gli attori dei test si scelgono per CARATTERISTICA, non per nome.
 *
 * Perché (S1033). I test nominavano cinque utenti letterali — 631 occorrenze in
 * 170 file. Quei nomi non erano identità qualsiasi: erano RUOLI DI SCENA (un
 * amministratore di piattaforma, un manager CON riporti, un suo riporto, un
 * estraneo alla linea gerarchica). Il difetto non è il nome in sé: è che la
 * CARATTERISTICA veniva data per scontata e mai verificata. Quando il dato è
 * cambiato sotto i test — Z-262 ha assegnato un secondo fattore a ogni utente —
 * la premessa è caduta e sono usciti 158 file rossi con un messaggio che
 * parlava d'altro (`login <persona>: 400`).
 *
 * Qui la caratteristica si INTERROGA sul dato reale e, se non esiste più, si
 * fallisce subito dicendo che cosa manca. Un cambiamento nella popolazione
 * rompe un test con un messaggio esplicito invece di centinaia con uno oscuro.
 * Coerente con la regola "niente dati di test che duplicano una fonte di
 * verità": l'atteso si deriva dal DB, non si ricopia.
 *
 * Le persone fisiche sono escluse per costruzione: la loro password la scelgono
 * loro e non è derivabile, quindi non sono impersonabili (Z-262).
 */
import { pool } from "../../src/db/client.js";
import { isRealPerson } from "../../scripts/derive-access.mjs";

export interface Actor {
  userId: string;
  email: string;
  tenantId: string;
}

interface Row {
  user_id: string;
  user_email: string;
  user_tenant_id: string;
}

const toActor = (r: Row): Actor => ({
  userId: r.user_id,
  email: r.user_email,
  tenantId: r.user_tenant_id,
});

/** Gli utenti impersonabili: attivi e non persone fisiche. */
const IMPERSONABLE = `u.user_status = 'ACTIVE'`;

function requireRow(rows: Row[], what: string, how: string): Actor {
  const usable = rows.find((r) => !isRealPerson(r.user_email));
  if (!usable) {
    throw new Error(
      `Nessun utente impersonabile con questa caratteristica: ${what}.\n` +
        `I test la richiedono e il dato attuale non la offre più. ${how}`,
    );
  }
  return toActor(usable);
}

const cache = new Map<string, Actor>();
async function once(key: string, load: () => Promise<Actor>): Promise<Actor> {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = await load();
  cache.set(key, v);
  return v;
}

/**
 * Un utente che detiene il ruolo indicato (concessione non revocata).
 * `tenantId` vincola la scelta a un tenant: serve quando il test contrappone due
 * attori e la contrapposizione ha senso solo DENTRO lo stesso perimetro — un
 * "ruolo fuori dallo scope della policy" preso da un altro tenant proverebbe
 * l'isolamento fra tenant, non lo scoping per ruolo.
 */
export async function userWithRole(
  roleCode: string,
  opts: { tenantId?: string } = {},
): Promise<Actor> {
  const { tenantId } = opts;
  return once(`role:${roleCode}:${tenantId ?? "*"}`, async () => {
    const { rows } = await pool.query<Row>(
      `SELECT u.user_id, u.user_email, u.user_tenant_id
         FROM sys.sys_user_auth_roles ur
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
         JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
        WHERE r.auth_role_code = $1
          AND ur.user_auth_role_revoked_at IS NULL
          AND ($2::uuid IS NULL OR u.user_tenant_id = $2::uuid)
          AND ${IMPERSONABLE}
        ORDER BY u.user_email`,
      [roleCode, tenantId ?? null],
    );
    return requireRow(
      rows,
      `ruolo ${roleCode}${tenantId ? " nel tenant indicato" : ""}`,
      `Assegna ${roleCode} a un utente attivo, oppure aggiorna il test se il ruolo è stato ritirato.`,
    );
  });
}

export const platformAdmin = (opts: { tenantId?: string } = {}): Promise<Actor> =>
  userWithRole("PLATFORM_ADMIN", opts);
export const tenantAdmin = (opts: { tenantId?: string } = {}): Promise<Actor> =>
  userWithRole("TENANT_ADMIN", opts);

/**
 * Una coppia gerarchica REALE: chi possiede una posizione con almeno un riporto,
 * e chi possiede quella posizione subordinata. È la relazione su cui poggia
 * l'asse organizzativo (I16/I18): senza una coppia vera non si può provare che
 * un manager veda i dati dei suoi e non quelli altrui.
 */
export async function managerAndReport(): Promise<{ manager: Actor; report: Actor }> {
  const { rows } = await pool.query<Row & { r_user_id: string; r_user_email: string; r_tenant: string }>(
    `SELECT u.user_id, u.user_email, u.user_tenant_id,
            ru.user_id AS r_user_id, ru.user_email AS r_user_email, ru.user_tenant_id AS r_tenant
       FROM sys.sys_positions p
       JOIN sys.sys_positions cp ON cp.position_reports_to_position_id = p.position_id
       JOIN sys.sys_users u  ON u.user_id  = p.position_owner_user_id
       JOIN sys.sys_users ru ON ru.user_id = cp.position_owner_user_id
      WHERE ${IMPERSONABLE} AND ru.user_status = 'ACTIVE' AND ru.user_id <> u.user_id
      ORDER BY u.user_email, ru.user_email`,
  );
  const pair = rows.find((r) => !isRealPerson(r.user_email) && !isRealPerson(r.r_user_email));
  if (!pair) {
    throw new Error(
      "Nessuna coppia manager→riporto impersonabile nell'organigramma.\n" +
        "Serve una posizione con almeno una posizione subordinata, entrambe con un titolare attivo.",
    );
  }
  return {
    manager: toActor(pair),
    report: { userId: pair.r_user_id, email: pair.r_user_email, tenantId: pair.r_tenant },
  };
}

/**
 * Un utente dello stesso tenant che NON sta nel sotto-albero del manager: serve
 * a provare l'isolamento fra pari (I19), che un test fatto solo di "chi vede"
 * non dimostra.
 */
export async function outsiderOf(manager: Actor): Promise<Actor> {
  const { rows } = await pool.query<Row>(
    `WITH RECURSIVE sub AS (
       SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = $1
       UNION ALL
       SELECT p.position_id FROM sys.sys_positions p JOIN sub s ON p.position_reports_to_position_id = s.position_id
     )
     SELECT u.user_id, u.user_email, u.user_tenant_id
       FROM sys.sys_users u
      WHERE u.user_tenant_id = $2
        AND ${IMPERSONABLE}
        AND u.user_id <> $1
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_positions p
           WHERE p.position_owner_user_id = u.user_id AND p.position_id IN (SELECT position_id FROM sub)
        )
      ORDER BY u.user_email`,
    [manager.userId, manager.tenantId],
  );
  return requireRow(
    rows,
    `utente del tenant fuori dal sotto-albero di ${manager.email}`,
    "Serve almeno un utente attivo dello stesso tenant che non riporti a quel manager.",
  );
}

/**
 * Un utente SENZA secondo fattore verificato. Non lo si cerca: lo si PREPARA,
 * rimuovendo i fattori di un utente col ruolo indicato. Cercarne uno "già senza"
 * è ciò che si è rotto in S1032, quando il provisioning ne ha dato uno a tutti.
 * L'isolamento transazionale (D-52) annulla la rimozione a fine file.
 */
export async function actorWithoutMfaFactor(roleCode: string): Promise<Actor> {
  const a = await userWithRole(roleCode);
  await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
    a.userId,
  ]);
  return a;
}

/**
 * N attori DISTINTI e impersonabili, senza secondo fattore. Per i test che non
 * hanno bisogno di un profilo particolare ma solo di identità separate — dove il
 * nome proprio non aggiungeva nulla e legava il test a persone specifiche.
 */
export async function distinctImpersonableActors(count: number): Promise<Actor[]> {
  const { rows } = await pool.query<Row>(
    `SELECT u.user_id, u.user_email, u.user_tenant_id
       FROM sys.sys_users u
      WHERE ${IMPERSONABLE}
      ORDER BY u.user_email`,
  );
  const usable = rows.filter((r) => !isRealPerson(r.user_email)).slice(0, count);
  if (usable.length < count) {
    throw new Error(
      `Servono ${count} utenti impersonabili distinti, ne risultano ${usable.length}.`,
    );
  }
  return usable.map(toActor);
}

/** Come sopra, ma garantendo anche l'assenza di un secondo fattore. */
export async function distinctActorsWithoutMfaFactor(count: number): Promise<Actor[]> {
  const actors = await distinctImpersonableActors(count);
  await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = ANY($1)`, [
    actors.map((a) => a.userId),
  ]);
  return actors;
}

/** Solo per i test che devono ripartire da capo (la cache è per-file). */
export function resetActorCache(): void {
  cache.clear();
}
