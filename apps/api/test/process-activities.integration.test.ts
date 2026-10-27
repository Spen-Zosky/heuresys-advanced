/**
 * apps/api/test/process-activities.integration.test.ts
 *
 * ADR-0049 — le attività appartengono a un processo, e l'owner del processo le vede: le
 * attività in ordine con l'unità che le esegue, e quante richieste di approvazione vi
 * appartengono. Solo conteggi: nessun titolo, nessun corpo, nessuna persona (I18).
 *
 * L'oracolo è scritto sulle tabelle di base, senza `PARTECIPANTI_OGGI_SQL`, e gira su TUTTI
 * gli owner del dato più quello della scena.
 *
 * Come può fallire (ciascun punto è stato pensato per diventare rosso):
 *  - l'innesco della regola sparisse → le richieste nuove della scena nascono senza processo;
 *  - l'innesco scavalcasse un valore indicato → la richiesta con l'attività scelta a mano cambia;
 *  - il controllo del possesso sparisse → un partecipante non owner ottiene le attività;
 *  - la risposta portasse il titolo di una richiesta → la prova del testo lo vede;
 *  - i conteggi guardassero un altro processo o un altro tenant → l'oracolo non coincide;
 *  - qualcuno allargasse `functionalScopeUserIds` con il processo → la prova dell'asse lo vede.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { listProcessActivities } from "../src/modules/me/repository.js";
import { functionalScopeUserIds } from "../src/lib/scope/functional.js";
import { isRealPerson } from "../scripts/derive-access.mjs";

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

const SEGRETO = "RISERVATO-ADR0049-73519";
const TIPO_PROVA = "ADR0049_PROVA";
const TIPO_SENZA_REGOLA = "ADR0049_SENZA_REGOLA";

const RESPONSE_KEYS = ["activities", "organizationUnitProcessId", "processName", "requestTotal", "requests", "tenantProcessId"].sort();
const ACTIVITY_KEYS = ["code", "isOwnerUnit", "name", "ordinal", "organizationUnitName", "requestCount", "stepId"].sort();
const REQUEST_KEYS = ["count", "resourceType", "status", "stepCode"].sort();

interface Possesso { user_id: string; tenant_id: string; oup_id: string }
interface Scena {
  user_id: string; email: string; tenant_id: string; oup_id: string; unit_id: string;
  process_id: string; step_mia: string; step_altra: string;
  richieste_regola: string[]; richiesta_a_mano: string; richiesta_senza_regola: string;
  ambito_prima: string[];
}

let t: TestApp;
let scena: Scena;
let possessi: Possesso[] = [];

async function cookieDi(email: string): Promise<string> {
  const login = await loginRaw(t.app, email);
  return (login.cookies as { name: string; value: string }[]).map((c) => `${c.name}=${c.value}`).join("; ");
}

/** L'oracolo: le attività del processo del tenant e le richieste che gli appartengono. */
async function oracolo(p: Possesso): Promise<{ passi: { id: string; n: number }[]; totale: number } | null> {
  const tp = (
    await pool.query<{ tp: string | null }>(
      `SELECT org_unit_process_tenant_process_id AS tp FROM sys.sys_organization_unit_processes
        WHERE organization_unit_process_id = $1`,
      [p.oup_id],
    )
  ).rows[0]?.tp;
  if (!tp) return null;
  const passi = (
    await pool.query<{ id: string; n: string }>(
      `SELECT s.tenant_process_step_id AS id,
              (SELECT count(*) FROM sys.sys_approval_requests a
                WHERE a.approval_request_tenant_process_step_id = s.tenant_process_step_id
                  AND a.approval_request_tenant_id = $2) AS n
         FROM sys.sys_tenant_process_steps s
        WHERE s.tenant_process_step_process_id = $1
        ORDER BY s.tenant_process_step_ordinal, s.tenant_process_step_code`,
      [tp, p.tenant_id],
    )
  ).rows.map((r) => ({ id: r.id, n: Number(r.n) }));
  const totale = Number(
    (
      await pool.query<{ n: string }>(
        `SELECT count(*) AS n FROM sys.sys_approval_requests
          WHERE approval_request_tenant_process_id = $1 AND approval_request_tenant_id = $2`,
        [tp, p.tenant_id],
      )
    ).rows[0]!.n,
  );
  return { passi, totale };
}

/**
 * La scena, nella transazione del file (D-52): un owner occupato da una persona non vera, il
 * processo del tenant sulla sua unità-processo (se il riempimento non l'ha già scritto), due
 * attività (una della sua unità, una di un'altra), una regola e cinque richieste.
 *
 * Il database di collaudo non riceve il riempimento (è fuori catena), quindi senza scena la
 * prova non avrebbe un processo con attività su cui girare.
 */
async function scrivi(): Promise<Scena> {
  // 1. L'owner: un posto occupato oggi da una persona non vera, in un'unità che ha un processo.
  const posti = (
    await pool.query<{ position_id: string; unit_id: string; tenant_id: string; user_id: string; email: string; oup_id: string }>(
      `SELECT a.user_position_assignment_position_id AS position_id, p.position_organization_unit_id AS unit_id,
              a.user_position_assignment_tenant_id AS tenant_id, a.user_position_assignment_user_id AS user_id,
              u.user_email AS email, oup.organization_unit_process_id AS oup_id
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id AND p.position_is_active
         JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id AND u.user_status = 'ACTIVE'
         JOIN sys.sys_organization_unit_processes oup
           ON oup.org_unit_process_org_unit_id = p.position_organization_unit_id
          AND oup.org_unit_process_tenant_id = a.user_position_assignment_tenant_id
        WHERE a.user_position_assignment_status = 'ACTIVE'
          AND a.user_position_assignment_start_date <= current_date
          AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= current_date)
          AND u.user_email IS NOT NULL
        ORDER BY 1, 6`,
    )
  ).rows;
  const o = posti.find((x) => !isRealPerson(x.email));
  if (!o) throw new Error(`nessun posto occupato da una persona non vera su un'unità con processi: fixture impossibile (posti=${posti.length})`);

  const acceso = await pool.query(
    `UPDATE sys.sys_process_participants
        SET process_participant_is_active = true, process_participant_role = 'OWNER'
      WHERE process_participant_org_unit_process_id = $1 AND process_participant_position_id = $2`,
    [o.oup_id, o.position_id],
  );
  if (!acceso.rowCount) {
    await pool.query(
      `INSERT INTO sys.sys_process_participants
         (process_participant_tenant_id, process_participant_org_unit_process_id, process_participant_position_id, process_participant_role)
       VALUES ($1, $2, $3, 'OWNER')`,
      [o.tenant_id, o.oup_id, o.position_id],
    );
  }
  const ambitoPrima = (await functionalScopeUserIds(pool, o.user_id)).slice().sort();

  // 2. Il processo del tenant, se la riga non ce l'ha già.
  let processId = (
    await pool.query<{ tp: string | null }>(
      `SELECT org_unit_process_tenant_process_id AS tp FROM sys.sys_organization_unit_processes WHERE organization_unit_process_id = $1`,
      [o.oup_id],
    )
  ).rows[0]?.tp ?? null;
  if (!processId) {
    processId = (
      await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_tenant_processes (tenant_process_tenant_id, tenant_process_code, tenant_process_name)
         VALUES ($1, 'ADR0049-PROVA', 'Processo della prova ADR-0049') RETURNING tenant_process_id AS id`,
        [o.tenant_id],
      )
    ).rows[0]!.id;
    await pool.query(
      `UPDATE sys.sys_organization_unit_processes o SET org_unit_process_tenant_process_id = $2
        WHERE o.org_unit_process_tenant_id = $3
          AND o.org_unit_process_blueprint_process_id =
              (SELECT org_unit_process_blueprint_process_id FROM sys.sys_organization_unit_processes WHERE organization_unit_process_id = $1)`,
      [o.oup_id, processId, o.tenant_id],
    );
  }

  // 3. Due attività: una della mia unità, una di un'altra unità dello stesso tenant.
  const altraUnita = (
    await pool.query<{ id: string }>(
      `SELECT organization_unit_id AS id FROM sys.sys_organization_units
        WHERE organization_unit_tenant_id = $1 AND organization_unit_id <> $2 ORDER BY 1 LIMIT 1`,
      [o.tenant_id, o.unit_id],
    )
  ).rows[0];
  if (!altraUnita) throw new Error("il tenant della scena ha una sola unità: fixture impossibile");
  const passo = async (codice: string, ordine: number, unita: string) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_tenant_process_steps
           (tenant_process_step_tenant_id, tenant_process_step_process_id, tenant_process_step_code,
            tenant_process_step_name, tenant_process_step_ordinal, tenant_process_step_org_unit_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING tenant_process_step_id AS id`,
        [o.tenant_id, processId, codice, `Attività ${codice}`, ordine, unita],
      )
    ).rows[0]!.id;
  const stepMia = await passo("ADR0049.1", 9001, o.unit_id);
  const stepAltra = await passo("ADR0049.2", 9002, altraUnita.id);

  // 4. La regola per il tipo della prova, e le richieste: tre dalla regola, una con l'attività
  //    indicata a mano, una di un tipo senza regola.
  await pool.query(
    `INSERT INTO sys.sys_tenant_process_activity_rules
       (tenant_process_activity_rule_tenant_id, tenant_process_activity_rule_resource_type,
        tenant_process_activity_rule_process_id, tenant_process_activity_rule_step_id, tenant_process_activity_rule_rationale)
     VALUES ($1, $2, $3, $4, 'prova ADR-0049')`,
    [o.tenant_id, TIPO_PROVA, processId, stepAltra],
  );
  const richiesta = async (tipo: string, stato: string, proc: string | null, step: string | null) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_approval_requests
           (approval_request_tenant_id, approval_request_title, approval_request_body, approval_request_resource_type,
            approval_request_status, approval_request_tenant_process_id, approval_request_tenant_process_step_id)
         VALUES ($1, $2, $7, $3, $4, $5, $6) RETURNING approval_request_id AS id`,
        // Titolo (varchar) e corpo (text) in due parametri: uno solo avrebbe due tipi (42P08).
        [o.tenant_id, `${SEGRETO} ${tipo}`, tipo, stato, proc, step, `${SEGRETO} ${tipo}`],
      )
    ).rows[0]!.id;
  const regola = [
    await richiesta(TIPO_PROVA, "PENDING", null, null),
    await richiesta(TIPO_PROVA, "PENDING", null, null),
    await richiesta(TIPO_PROVA, "APPROVED", null, null),
  ];
  const aMano = await richiesta(TIPO_PROVA, "REJECTED", processId, stepMia);
  const senzaRegola = await richiesta(TIPO_SENZA_REGOLA, "PENDING", null, null);

  return {
    user_id: o.user_id, email: o.email, tenant_id: o.tenant_id, oup_id: o.oup_id, unit_id: o.unit_id,
    process_id: processId, step_mia: stepMia, step_altra: stepAltra,
    richieste_regola: regola, richiesta_a_mano: aMano, richiesta_senza_regola: senzaRegola,
    ambito_prima: ambitoPrima,
  };
}

beforeAll(async () => {
  t = await buildTestApp();
  scena = await scrivi();
  possessi = (
    await pool.query<Possesso>(
      `SELECT DISTINCT o.user_id, o.tenant_id, o.oup_id FROM (${OCCUPANTI_OGGI}) o WHERE o.role = 'OWNER' ORDER BY 1, 3`,
    )
  ).rows;
}, 120_000);

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("ADR-0049 — le richieste nascono col processo della regola", () => {
  it("senza un valore indicato, la richiesta prende processo e attività della regola del tenant", async () => {
    const r = await pool.query<{ p: string | null; s: string | null }>(
      `SELECT approval_request_tenant_process_id AS p, approval_request_tenant_process_step_id AS s
         FROM sys.sys_approval_requests WHERE approval_request_id = ANY($1::uuid[])`,
      [scena.richieste_regola],
    );
    expect(r.rows).toHaveLength(3);
    for (const x of r.rows) expect(x).toEqual({ p: scena.process_id, s: scena.step_altra });
  });

  it("un valore indicato vince sulla regola, e un tipo senza regola resta senza processo", async () => {
    const r = await pool.query<{ id: string; p: string | null; s: string | null }>(
      `SELECT approval_request_id AS id, approval_request_tenant_process_id AS p, approval_request_tenant_process_step_id AS s
         FROM sys.sys_approval_requests WHERE approval_request_id = ANY($1::uuid[])`,
      [[scena.richiesta_a_mano, scena.richiesta_senza_regola]],
    );
    const per = new Map(r.rows.map((x) => [x.id, { p: x.p, s: x.s }]));
    expect(per.get(scena.richiesta_a_mano)).toEqual({ p: scena.process_id, s: scena.step_mia });
    expect(per.get(scena.richiesta_senza_regola)).toEqual({ p: null, s: null });
  });

  it("un'attività senza il suo processo non si può scrivere (step ⇒ processo)", async () => {
    // Ogni query del file gira nel proprio savepoint (D-52): l'errore non sporca la transazione.
    await expect(
      pool.query(
        `INSERT INTO sys.sys_approval_requests (approval_request_tenant_id, approval_request_title, approval_request_resource_type,
                                                approval_request_tenant_process_step_id)
         VALUES ($1, 'x', $2, $3)`,
        [scena.tenant_id, TIPO_SENZA_REGOLA, scena.step_mia],
      ),
    ).rejects.toThrow();
  });
});

describe("ADR-0049 — l'owner vede le attività del suo processo", () => {
  it("gira su un universo dove PUÒ fallire: owner con processo, attività e richieste", async () => {
    expect(possessi.some((p) => p.user_id === scena.user_id && p.oup_id === scena.oup_id), "l'owner della scena non è fra gli owner").toBe(true);
    const o = await oracolo(scena);
    expect(o!.passi.length).toBeGreaterThanOrEqual(2);
    expect(o!.totale).toBeGreaterThanOrEqual(4);
  });

  it("per OGNI owner attività e conteggi coincidono con l'oracolo", async () => {
    let conAttivita = 0;
    for (const p of possessi) {
      const out = await listProcessActivities(pool, p.user_id, p.tenant_id, p.oup_id);
      expect(out, `l'owner ${p.user_id} non ottiene le attività di ${p.oup_id}`).not.toBeNull();
      const o = await oracolo(p);
      if (!o) {
        expect(out!.tenantProcessId).toBeNull();
        expect(out!.activities).toEqual([]);
        expect(out!.requestTotal).toBe(0);
        continue;
      }
      expect(out!.activities.map((a) => ({ id: a.stepId, n: a.requestCount })), `owner ${p.user_id}, ${p.oup_id}`).toEqual(o.passi);
      expect(out!.requestTotal).toBe(o.totale);
      expect(out!.requests.reduce((t, r) => t + r.count, 0)).toBe(o.totale);
      if (o.passi.length) conAttivita += 1;
    }
    expect(conAttivita).toBeGreaterThan(0);
  });

  it("la scena: le attività dicono quale unità le esegue, e i conteggi stanno per tipo, stato e attività", async () => {
    const out = (await listProcessActivities(pool, scena.user_id, scena.tenant_id, scena.oup_id))!;
    const mia = out.activities.find((a) => a.stepId === scena.step_mia)!;
    const altra = out.activities.find((a) => a.stepId === scena.step_altra)!;
    expect(mia.isOwnerUnit).toBe(true);
    expect(altra.isOwnerUnit).toBe(false);
    expect(mia.requestCount).toBe(1);
    expect(altra.requestCount).toBe(3);
    const prova = out.requests.filter((r) => r.resourceType === TIPO_PROVA);
    expect(prova).toEqual([
      { resourceType: TIPO_PROVA, status: "APPROVED", stepCode: "ADR0049.2", count: 1 },
      { resourceType: TIPO_PROVA, status: "PENDING", stepCode: "ADR0049.2", count: 2 },
      { resourceType: TIPO_PROVA, status: "REJECTED", stepCode: "ADR0049.1", count: 1 },
    ]);
    expect(out.requests.some((r) => r.resourceType === TIPO_SENZA_REGOLA)).toBe(false);
  });

  it("il contratto porta solo conteggi: nessun altro campo, nessun titolo (I18)", async () => {
    for (const p of possessi) {
      const out = (await listProcessActivities(pool, p.user_id, p.tenant_id, p.oup_id))!;
      expect(Object.keys(out).sort()).toEqual(RESPONSE_KEYS);
      for (const a of out.activities) expect(Object.keys(a).sort()).toEqual(ACTIVITY_KEYS);
      for (const r of out.requests) expect(Object.keys(r).sort()).toEqual(REQUEST_KEYS);
      expect(JSON.stringify(out)).not.toContain(SEGRETO);
    }
  });

  it("chi non possiede quel processo non ottiene niente", async () => {
    const nonOwner = (
      await pool.query<Possesso>(
        `SELECT o.user_id, o.tenant_id, o.oup_id FROM (${OCCUPANTI_OGGI}) o
          WHERE o.role <> 'OWNER'
            AND NOT EXISTS (SELECT 1 FROM (${OCCUPANTI_OGGI}) m
                             WHERE m.user_id = o.user_id AND m.oup_id = o.oup_id AND m.role = 'OWNER')
          ORDER BY 1, 3 LIMIT 1`,
      )
    ).rows[0];
    expect(nonOwner, "nessun partecipante non owner nel dato").toBeDefined();
    expect(await listProcessActivities(pool, nonOwner!.user_id, nonOwner!.tenant_id, nonOwner!.oup_id)).toBeNull();

    const altra = (
      await pool.query<{ id: string }>(
        `SELECT organization_unit_process_id AS id FROM sys.sys_organization_unit_processes
          WHERE org_unit_process_tenant_id = $1 AND organization_unit_process_id <> ALL($2::uuid[])
          ORDER BY 1 LIMIT 1`,
        [scena.tenant_id, possessi.filter((x) => x.user_id === scena.user_id).map((x) => x.oup_id)],
      )
    ).rows[0];
    expect(altra).toBeDefined();
    expect(await listProcessActivities(pool, scena.user_id, scena.tenant_id, altra!.id)).toBeNull();
  });

  it("l'asse funzionale NON si allarga: il processo delle richieste non apre le attività delle persone", async () => {
    const dopo = (await functionalScopeUserIds(pool, scena.user_id)).slice().sort();
    expect(dopo).toEqual(scena.ambito_prima);
  });

  it("dal vivo: l'owner entra e la rotta gli risponde; un altro no", async () => {
    const url = `/v1/me/processes/${scena.oup_id}/activities`;
    const res = await t.app.inject({ method: "GET", url, headers: { cookie: await cookieDi(scena.email) } });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).not.toContain(SEGRETO);
    const body = res.json() as { tenantProcessId: string; activities: { stepId: string }[]; requestTotal: number };
    const o = (await oracolo(scena))!;
    expect(body.tenantProcessId).toBe(scena.process_id);
    expect(body.activities.map((a) => a.stepId)).toEqual(o.passi.map((p) => p.id));
    expect(body.requestTotal).toBe(o.totale);

    const altro = (
      await pool.query<{ email: string }>(
        `SELECT u.user_email AS email FROM sys.sys_users u
          WHERE u.user_status = 'ACTIVE' AND u.user_tenant_id = $1
            AND u.user_type IS DISTINCT FROM 'SERVICE'
            AND u.user_id <> ALL($2::uuid[])
          ORDER BY 1`,
        [scena.tenant_id, possessi.filter((p) => p.oup_id === scena.oup_id).map((p) => p.user_id)],
      )
    ).rows.find((x) => x.email && !isRealPerson(x.email));
    expect(altro).toBeDefined();
    const neg = await t.app.inject({ method: "GET", url, headers: { cookie: await cookieDi(altro!.email) } });
    expect(neg.statusCode, neg.body).toBe(404);

    const anon = await t.app.inject({ method: "GET", url });
    expect(anon.statusCode).toBe(401);
  });
});
