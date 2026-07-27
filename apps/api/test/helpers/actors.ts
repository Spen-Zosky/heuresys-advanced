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

/**
 * Due colleghi dello STESSO team fra cui NON esiste alcun legame gerarchico, in
 * nessuna delle due direzioni e a nessuna profondità.
 *
 * È il profilo che prova l'invariante I18 — l'appartenenza funzionale non
 * sblocca MAI dati sensibili — e finora nessun attore lo rappresentava: la
 * verifica poggiava su coppie legate anche gerarchicamente, dove un permesso
 * concesso dall'asse organizzativo può mascherare un asse funzionale troppo
 * generoso. L'esclusione è transitiva di proposito: un legame di secondo
 * livello renderebbe il caso non probante.
 */
export async function functionalPeers(): Promise<{ a: Actor; b: Actor }> {
  const { rows } = await pool.query<Row & { b_id: string; b_email: string; b_tenant: string }>(
    `WITH RECURSIVE membri AS (
       SELECT team_member_team_id AS team, team_member_user_id AS uid
         FROM sys.sys_team_members WHERE team_member_is_active
     ),
     sottoalbero AS (
       SELECT p.position_owner_user_id AS radice, p.position_id
         FROM sys.sys_positions p WHERE p.position_owner_user_id IS NOT NULL
       UNION ALL
       SELECT s.radice, c.position_id
         FROM sys.sys_positions c JOIN sottoalbero s ON c.position_reports_to_position_id = s.position_id
     )
     SELECT u1.user_id, u1.user_email, u1.user_tenant_id,
            u2.user_id AS b_id, u2.user_email AS b_email, u2.user_tenant_id AS b_tenant
       FROM membri m1
       JOIN membri m2 ON m1.team = m2.team AND m1.uid < m2.uid
       JOIN sys.sys_users u1 ON u1.user_id = m1.uid AND u1.user_status = 'ACTIVE'
       JOIN sys.sys_users u2 ON u2.user_id = m2.uid AND u2.user_status = 'ACTIVE'
      WHERE NOT EXISTS (
              SELECT 1 FROM sottoalbero s JOIN sys.sys_positions p ON p.position_id = s.position_id
               WHERE s.radice = m1.uid AND p.position_owner_user_id = m2.uid)
        AND NOT EXISTS (
              SELECT 1 FROM sottoalbero s JOIN sys.sys_positions p ON p.position_id = s.position_id
               WHERE s.radice = m2.uid AND p.position_owner_user_id = m1.uid)
      ORDER BY u1.user_email, u2.user_email`,
  );
  const pair = rows.find((r) => !isRealPerson(r.user_email) && !isRealPerson(r.b_email));
  if (!pair) {
    throw new Error(
      "Nessuna coppia di colleghi di team priva di legame gerarchico.\n" +
        "Serve un team con almeno due membri attivi che non riportino l'uno all'altro.",
    );
  }
  return {
    a: toActor(pair),
    b: { userId: pair.b_id, email: pair.b_email, tenantId: pair.b_tenant },
  };
}

/**
 * Una catena gerarchica di TRE livelli: chi sta in cima, chi sta in mezzo, chi
 * sta sotto. Serve a provare la transitività che I20 dichiara (`reports-to`
 * transitivo): con la sola coppia diretta, una risalita che si ferma al primo
 * livello — o che al contrario abbraccia troppo — passa inosservata.
 */
export async function hierarchyChain(): Promise<{ top: Actor; middle: Actor; bottom: Actor }> {
  const { rows } = await pool.query<{
    t_id: string; t_email: string; t_tenant: string;
    m_id: string; m_email: string; m_tenant: string;
    b_id: string; b_email: string; b_tenant: string;
  }>(
    `SELECT tu.user_id AS t_id, tu.user_email AS t_email, tu.user_tenant_id AS t_tenant,
            mu.user_id AS m_id, mu.user_email AS m_email, mu.user_tenant_id AS m_tenant,
            bu.user_id AS b_id, bu.user_email AS b_email, bu.user_tenant_id AS b_tenant
       FROM sys.sys_positions a
       JOIN sys.sys_positions b ON b.position_reports_to_position_id = a.position_id
       JOIN sys.sys_positions c ON c.position_reports_to_position_id = b.position_id
       JOIN sys.sys_users tu ON tu.user_id = a.position_owner_user_id AND tu.user_status='ACTIVE'
       JOIN sys.sys_users mu ON mu.user_id = b.position_owner_user_id AND mu.user_status='ACTIVE'
       JOIN sys.sys_users bu ON bu.user_id = c.position_owner_user_id AND bu.user_status='ACTIVE'
      WHERE tu.user_id <> mu.user_id AND mu.user_id <> bu.user_id AND tu.user_id <> bu.user_id
        -- Una persona puo' possedere piu' posizioni: se chi sta in fondo riporta
        -- ANCHE direttamente al vertice, la catena non prova piu' la
        -- transitivita' (il legame sarebbe spiegabile senza risalire). Si scarta.
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_positions dc
            JOIN sys.sys_positions dp ON dc.position_reports_to_position_id = dp.position_id
           WHERE dp.position_owner_user_id = tu.user_id AND dc.position_owner_user_id = bu.user_id)
      ORDER BY tu.user_email, mu.user_email, bu.user_email`,
  );
  const chain = rows.find(
    (r) => !isRealPerson(r.t_email) && !isRealPerson(r.m_email) && !isRealPerson(r.b_email),
  );
  if (!chain) {
    throw new Error(
      "Nessuna catena gerarchica di tre livelli con titolari attivi distinti.\n" +
        "Serve una posizione con una subordinata che a sua volta ne abbia una.",
    );
  }
  return {
    top: { userId: chain.t_id, email: chain.t_email, tenantId: chain.t_tenant },
    middle: { userId: chain.m_id, email: chain.m_email, tenantId: chain.m_tenant },
    bottom: { userId: chain.b_id, email: chain.b_email, tenantId: chain.b_tenant },
  };
}

/**
 * Un utente SENZA alcuna posizione assegnata.
 *
 * Non è la popolazione normale — è un caso singolo (l'account di servizio), e
 * proprio per questo non era rappresentato. Serve perché il codice non deve
 * dare per scontato che ogni utente stia nell'organigramma: chi non ha
 * posizione non ha asse organizzativo, e gli resta il solo piano ESS (I17).
 */
export async function actorWithoutPosition(): Promise<Actor> {
  const { rows } = await pool.query<Row>(
    `SELECT u.user_id, u.user_email, u.user_tenant_id
       FROM sys.sys_users u
      WHERE ${IMPERSONABLE}
        AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_user_id = u.user_id)
      ORDER BY u.user_email`,
  );
  return requireRow(
    rows,
    "utente senza alcuna posizione assegnata",
    "Se ogni utente ha ricevuto una posizione, questo caso non esiste più: il test va aggiornato, non il dato.",
  );
}

/** Solo per i test che devono ripartire da capo (la cache è per-file). */
export function resetActorCache(): void {
  cache.clear();
}
