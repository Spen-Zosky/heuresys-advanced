/**
 * apps/api/test/process-coordination.integration.test.ts
 *
 * ADR-0036 §8 — l'owner di un processo vede chi vi lavora in TUTTE le unità collaboranti
 * (scelta B di Enzo, 2026-10-27): nome, posto, unità, ruoli RACI. Niente competenze, niente
 * dati privati, economici o valutativi (I18), e l'asse delle attività NON si allarga.
 *
 * La prova gira persona per persona su TUTTI gli owner del dato, non su un campione, e il
 * suo oracolo è scritto sulle tabelle di base, senza `PARTECIPANTI_OGGI_SQL`: se il frammento
 * condiviso perdesse una clausola, codice e oracolo smetterebbero di coincidere.
 *
 * Come può fallire (ciascun punto è stato pensato per diventare rosso):
 *  - il codice tornasse a guardare la sola unità di governo → manca chi sta nelle altre;
 *  - il controllo del possesso sparisse → un CONTRIBUTOR otterrebbe la lista;
 *  - qualcuno allargasse `functionalScopeUserIds` per «dare le attività» → la prova del
 *    perimetro delle attività lo vede;
 *  - il contratto acquistasse un campo → la prova delle chiavi lo vede.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { listProcessCollaborators } from "../src/modules/me/repository.js";
import { functionalScopeUserIds } from "../src/lib/scope/functional.js";
import { activeDomainsOf } from "../src/lib/scope/domains.js";
import { isRealPerson, REAL_PERSON_EMAILS } from "../scripts/derive-access.mjs";

/** Chi occupa OGGI ciascun posto: scritto qui da capo, non preso dal frammento condiviso. */
const OCCUPANTI_OGGI = `
  SELECT pp.process_participant_id                  AS participant_id,
         pp.process_participant_tenant_id           AS tenant_id,
         pp.process_participant_org_unit_process_id AS oup_id,
         pp.process_participant_role                AS role,
         upa.user_position_assignment_user_id       AS user_id
    FROM sys.sys_process_participants pp
    JOIN sys.sys_positions pos
      ON pos.position_id = pp.process_participant_position_id AND pos.position_is_active
    JOIN sys.sys_user_position_assignments upa
      ON upa.user_position_assignment_position_id = pp.process_participant_position_id
     AND upa.user_position_assignment_tenant_id = pp.process_participant_tenant_id
     AND upa.user_position_assignment_status = 'ACTIVE'
     AND upa.user_position_assignment_start_date <= current_date
     AND coalesce(upa.user_position_assignment_end_date, current_date) >= current_date
   WHERE pp.process_participant_is_active`;

interface Possesso {
  user_id: string;
  tenant_id: string;
  oup_id: string;
  unit_id: string;
  blueprint_process_id: string;
}

const ITEM_KEYS = [
  "organizationUnitName", "organizationUnitProcessId", "participantRole", "participationId",
  "personName", "positionId", "positionTitle", "unitRole", "userId",
].sort();

let t: TestApp;
let possessi: Possesso[] = [];

/** L'oracolo: le partecipazioni attive di ogni unità-processo dello stesso modello. */
async function attesi(p: Possesso): Promise<string[]> {
  const r = await pool.query<{ participant_id: string }>(
    `SELECT o.participant_id
       FROM (${OCCUPANTI_OGGI}) o
       JOIN sys.sys_organization_unit_processes oup ON oup.organization_unit_process_id = o.oup_id
      WHERE o.tenant_id = $1
        AND oup.org_unit_process_tenant_id = $1
        AND oup.org_unit_process_blueprint_process_id = $2`,
    [p.tenant_id, p.blueprint_process_id],
  );
  return r.rows.map((x) => x.participant_id).sort();
}

async function cookieDi(email: string): Promise<string> {
  const login = await loginRaw(t.app, email);
  return (login.cookies as { name: string; value: string }[])
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

/**
 * Un owner e un collaboratore di un'ALTRA unità sullo stesso processo, scritti nella
 * transazione del file (D-52) se il dato non li ha già.
 *
 * Misurato alla prima corsa della CI (2026-10-27): il database di collaudo non ha nessuna
 * partecipazione OWNER con un posto occupato — il riempimento del passo 2 è uno script
 * passato sulla produzione, non una migrazione. Senza questa scena la prova non avrebbe
 * nessuno su cui girare. In produzione la scena non serve: gli owner veri ci sono, e la
 * prova li percorre tutti accanto a quello scritto qui.
 */
async function scenaSeManca(): Promise<void> {
  const gia = await pool.query(
    `SELECT 1 FROM (${OCCUPANTI_OGGI}) o
       JOIN sys.sys_organization_unit_processes mine ON mine.organization_unit_process_id = o.oup_id
       JOIN sys.sys_organization_unit_processes other
         ON other.org_unit_process_tenant_id = mine.org_unit_process_tenant_id
        AND other.org_unit_process_blueprint_process_id = mine.org_unit_process_blueprint_process_id
        AND other.org_unit_process_org_unit_id <> mine.org_unit_process_org_unit_id
       JOIN (${OCCUPANTI_OGGI}) c ON c.oup_id = other.organization_unit_process_id
      WHERE o.role = 'OWNER' LIMIT 1`,
  );
  if (gia.rowCount) return;

  // Due unità-processo dello stesso modello in due unità diverse, ciascuna con un posto
  // occupato oggi che su quella riga non ha ancora una partecipazione (indice unico).
  const posto = `
    SELECT oup.organization_unit_process_id AS oup_id,
           oup.org_unit_process_tenant_id   AS tenant_id,
           oup.org_unit_process_blueprint_process_id AS bp,
           oup.org_unit_process_org_unit_id AS unit_id,
           pos.position_id,
           upa.user_position_assignment_user_id AS user_id
      FROM sys.sys_organization_unit_processes oup
      JOIN sys.sys_positions pos
        ON pos.position_organization_unit_id = oup.org_unit_process_org_unit_id AND pos.position_is_active
      JOIN sys.sys_user_position_assignments upa
        ON upa.user_position_assignment_position_id = pos.position_id
       AND upa.user_position_assignment_tenant_id = oup.org_unit_process_tenant_id
       AND upa.user_position_assignment_status = 'ACTIVE'
       AND upa.user_position_assignment_start_date <= current_date
       AND coalesce(upa.user_position_assignment_end_date, current_date) >= current_date
      JOIN sys.sys_users u ON u.user_id = upa.user_position_assignment_user_id AND u.user_status = 'ACTIVE'
       -- le persone vere di Heuresys non si impersonano (Z-262): la scena entra come owner
       AND lower(u.user_email) <> ALL($1::text[])
     WHERE NOT EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                        WHERE pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
                          AND pp.process_participant_position_id = pos.position_id)`;
  const coppia = (
    await pool.query<{ a_oup: string; a_pos: string; b_oup: string; b_pos: string; tenant_id: string }>(
      `WITH p AS (${posto})
       SELECT a.oup_id AS a_oup, a.position_id AS a_pos, b.oup_id AS b_oup, b.position_id AS b_pos,
              a.tenant_id
         FROM p a
         JOIN p b ON b.tenant_id = a.tenant_id AND b.bp = a.bp
                 AND b.unit_id <> a.unit_id AND b.user_id <> a.user_id
        ORDER BY a.oup_id, a.position_id, b.oup_id, b.position_id
        LIMIT 1`,
      [REAL_PERSON_EMAILS],
    )
  ).rows[0];
  if (!coppia) throw new Error("nessun processo con due unità e posti occupati: fixture impossibile");
  const scrivi = (oup: string, pos: string, role: string) =>
    pool.query(
      `INSERT INTO sys.sys_process_participants
         (process_participant_tenant_id, process_participant_org_unit_process_id,
          process_participant_position_id, process_participant_role)
       VALUES ($1, $2, $3, $4)`,
      [coppia.tenant_id, oup, pos, role],
    );
  await scrivi(coppia.a_oup, coppia.a_pos, "OWNER");
  await scrivi(coppia.b_oup, coppia.b_pos, "CONTRIBUTOR");
}

beforeAll(async () => {
  t = await buildTestApp();
  await scenaSeManca();
  possessi = (
    await pool.query<Possesso>(
      `SELECT DISTINCT o.user_id, o.tenant_id, o.oup_id,
              oup.org_unit_process_org_unit_id          AS unit_id,
              oup.org_unit_process_blueprint_process_id AS blueprint_process_id
         FROM (${OCCUPANTI_OGGI}) o
         JOIN sys.sys_organization_unit_processes oup ON oup.organization_unit_process_id = o.oup_id
        WHERE o.role = 'OWNER'
        ORDER BY 1, 3`,
    )
  ).rows;
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("ADR-0036 §8 — l'owner vede chi lavora al processo in tutte le unità", () => {
  it("gira su un universo dove PUÒ fallire: owner reali con unità collaboranti", async () => {
    expect(possessi.length, "nessun owner nel dato").toBeGreaterThan(0);
    let conAltreUnita = 0;
    for (const p of possessi) {
      const r = await pool.query(
        `SELECT 1 FROM sys.sys_organization_unit_processes
          WHERE org_unit_process_tenant_id = $1
            AND org_unit_process_blueprint_process_id = $2
            AND org_unit_process_org_unit_id <> $3`,
        [p.tenant_id, p.blueprint_process_id, p.unit_id],
      );
      if (r.rowCount) conAltreUnita += 1;
    }
    expect(conAltreUnita, "nessun processo ha unità collaboranti: la prova non discrimina").toBeGreaterThan(0);
  });

  it("per OGNI owner la lista coincide con l'oracolo, nei due versi", async () => {
    let fuoriDallaPropriaUnita = 0;
    for (const p of possessi) {
      const out = await listProcessCollaborators(pool, p.user_id, p.tenant_id, p.oup_id);
      expect(out, `l'owner ${p.user_id} non ottiene la lista di ${p.oup_id}`).not.toBeNull();
      const visti = out!.items.map((i) => i.participationId).sort();
      expect(visti, `owner ${p.user_id}, processo ${p.oup_id}`).toEqual(await attesi(p));
      fuoriDallaPropriaUnita += out!.items.filter((i) => i.organizationUnitProcessId !== p.oup_id).length;
    }
    // Se il codice guardasse la sola unità di governo, questo numero sarebbe zero.
    expect(fuoriDallaPropriaUnita).toBeGreaterThan(0);
  });

  it("il contratto porta solo identità professionale e ruoli: nessun altro campo (I18)", async () => {
    for (const p of possessi) {
      const out = await listProcessCollaborators(pool, p.user_id, p.tenant_id, p.oup_id);
      for (const i of out!.items) expect(Object.keys(i).sort()).toEqual(ITEM_KEYS);
    }
  });

  it("chi non possiede quel processo non ottiene niente", async () => {
    // Un partecipante NON owner, sulla propria unità-processo.
    const nonOwner = (
      await pool.query<{ user_id: string; tenant_id: string; oup_id: string }>(
        `SELECT o.user_id, o.tenant_id, o.oup_id FROM (${OCCUPANTI_OGGI}) o
          WHERE o.role <> 'OWNER'
            AND NOT EXISTS (SELECT 1 FROM (${OCCUPANTI_OGGI}) m
                             WHERE m.user_id = o.user_id AND m.oup_id = o.oup_id AND m.role = 'OWNER')
          ORDER BY 1, 3 LIMIT 1`,
      )
    ).rows[0];
    expect(nonOwner, "nessun partecipante non owner nel dato").toBeDefined();
    expect(await listProcessCollaborators(pool, nonOwner!.user_id, nonOwner!.tenant_id, nonOwner!.oup_id)).toBeNull();

    // Un owner, su un'unità-processo che non possiede.
    const p = possessi[0]!;
    const altra = (
      await pool.query<{ id: string }>(
        `SELECT organization_unit_process_id AS id FROM sys.sys_organization_unit_processes
          WHERE org_unit_process_tenant_id = $1
            AND organization_unit_process_id <> ALL($2::uuid[])
          ORDER BY 1 LIMIT 1`,
        [p.tenant_id, possessi.filter((x) => x.user_id === p.user_id).map((x) => x.oup_id)],
      )
    ).rows[0];
    expect(altra).toBeDefined();
    expect(await listProcessCollaborators(pool, p.user_id, p.tenant_id, altra!.id)).toBeNull();
  });

  it("le attività NON si allargano: i collaboratori delle altre unità restano fuori dall'asse funzionale", async () => {
    // La scelta B dà la LISTA, non le attività delle persone: nessuna attività oggi porta il
    // suo processo, quindi allargare `functionalScopeUserIds` aprirebbe tutte le loro attività.
    let fuori = 0;
    for (const p of possessi) {
      const ambito = new Set(await functionalScopeUserIds(pool, p.user_id));
      const out = await listProcessCollaborators(pool, p.user_id, p.tenant_id, p.oup_id);
      const mieiOup = new Set(possessi.filter((x) => x.user_id === p.user_id).map((x) => x.oup_id));
      for (const i of out!.items) {
        if (!mieiOup.has(i.organizationUnitProcessId) && !ambito.has(i.userId)) fuori += 1;
      }
    }
    expect(fuori, "ogni collaboratore esterno è già nell'asse funzionale: la prova non discrimina").toBeGreaterThan(0);
  });

  it("il dominio `process_coordination` si accende esattamente sugli owner con unità collaboranti", async () => {
    const attesiDominio = new Set<string>();
    for (const p of possessi) {
      const r = await pool.query(
        `SELECT 1 FROM sys.sys_organization_unit_processes
          WHERE org_unit_process_tenant_id = $1
            AND org_unit_process_blueprint_process_id = $2
            AND org_unit_process_org_unit_id <> $3`,
        [p.tenant_id, p.blueprint_process_id, p.unit_id],
      );
      if (r.rowCount) attesiDominio.add(p.user_id);
    }
    const persone = (
      await pool.query<{ user_id: string }>(`SELECT user_id FROM sys.sys_users WHERE user_status = 'ACTIVE'`)
    ).rows;
    const visti = new Set<string>();
    for (const u of persone) {
      const d = await activeDomainsOf(pool, { userId: u.user_id, tenantId: null, roles: [] });
      if (d.has("process_coordination")) visti.add(u.user_id);
    }
    expect([...visti].sort()).toEqual([...attesiDominio].sort());
  });

  it("dal vivo: l'owner entra e la rotta gli risponde; un altro no", async () => {
    const r = await pool.query<{ email: string; user_id: string; tenant_id: string; oup_id: string }>(
      `SELECT u.user_email AS email, u.user_id, p.tenant_id, p.oup_id
         FROM unnest($1::uuid[], $2::uuid[], $3::uuid[]) AS p(user_id, tenant_id, oup_id)
         JOIN sys.sys_users u ON u.user_id = p.user_id AND u.user_status = 'ACTIVE'
        ORDER BY 1`,
      [possessi.map((p) => p.user_id), possessi.map((p) => p.tenant_id), possessi.map((p) => p.oup_id)],
    );
    // Le persone vere di Heuresys non si impersonano (Z-262): si entra come un owner di RTL.
    const owner = r.rows.find((x) => !isRealPerson(x.email));
    expect(owner, "nessun owner attivo con cui entrare").toBeDefined();
    const url = `/v1/me/processes/${owner!.oup_id}/participants`;

    const res = await t.app.inject({ method: "GET", url, headers: { cookie: await cookieDi(owner!.email) } });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as { items: { participationId: string }[]; total: number };
    const atteso = await attesi(possessi.find((p) => p.oup_id === owner!.oup_id && p.user_id === owner!.user_id)!);
    expect(body.items.map((i) => i.participationId).sort()).toEqual(atteso);
    expect(body.total).toBe(atteso.length);

    // Un'altra persona attiva dello stesso tenant che quel processo non lo possiede: 404.
    const altro = (
      await pool.query<{ email: string }>(
        `SELECT u.user_email AS email FROM sys.sys_users u
          WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id = $1
            AND u.user_type IS DISTINCT FROM 'SERVICE'
            AND u.user_id <> ALL($2::uuid[])
          ORDER BY 1`,
        [owner!.tenant_id, possessi.filter((p) => p.oup_id === owner!.oup_id).map((p) => p.user_id)],
      )
    ).rows.find((x) => !isRealPerson(x.email));
    expect(altro).toBeDefined();
    const neg = await t.app.inject({ method: "GET", url, headers: { cookie: await cookieDi(altro!.email) } });
    expect(neg.statusCode, neg.body).toBe(404);

    const anon = await t.app.inject({ method: "GET", url });
    expect(anon.statusCode).toBe(401);
  });
});
