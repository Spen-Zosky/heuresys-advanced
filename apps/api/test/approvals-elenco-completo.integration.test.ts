/**
 * apps/api/test/approvals-elenco-completo.integration.test.ts
 *
 * V-1 e V-3 del piano interfacce (docs/piani/PIANO_interfacce_20261103.md; D-27 del giro V12).
 *
 * V-1. La lista delle approvazioni si fermava a 200 righe su 741 e dichiarava come totale la
 * lunghezza della pagina: chi la leggeva credeva di avere tutto. Qui si prova che `total` e'
 * il conteggio dell'insieme filtrato e che, sfogliando, si arriva all'ultima riga senza buchi
 * ne' doppioni. Per non dipendere da quante richieste ci sono oggi, se ne aggiungono 210 nella
 * transazione del file (D-52): il totale supera comunque la pagina massima.
 *
 * V-3. Ogni richiesta dice processo e attivita' (ADR-0049); il filtro per processo e per
 * attivita' restituisce solo quelle, e l'elenco dei processi presenti alimenta il filtro.
 *
 * PERCHE' PUO' FALLIRE. Un servizio che tornasse a `total: items.length` darebbe 200 alla
 * prima asserzione; un filtro ignorato restituirebbe righe di altri processi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { attoriDiScena } from "./helpers/attori-di-scena.js";

const ATTORI = await attoriDiScena();
const TAG = `V1-${randomUUID().slice(0, 8).toUpperCase()}`;
const AGGIUNTE = 210;

interface Riga { approvalRequestId: string; title: string; processId: string | null; processName: string | null; processStepId: string | null; processStepName: string | null }
interface Lista { items: Riga[]; total: number; processes: Array<{ processId: string; processName: string; count: number; steps: Array<{ processStepId: string; count: number }> }> }

let t: TestApp;
let cookie: string;
let tenantId: string;
let attivita: { processId: string; processName: string; stepId: string; stepName: string } | null = null;

async function lista(qs: string): Promise<Lista> {
  const r = await t.app.inject({ method: "GET", url: `/v1/approvals?${qs}`, headers: { cookie } });
  expect(r.statusCode, r.body.slice(0, 300)).toBe(200);
  return r.json() as Lista;
}

describe("V-1, V-3 — la lista delle approvazioni e' intera, e dice processo e attivita'", () => {
  beforeAll(async () => {
    t = await buildTestApp();
    const r = await loginRaw(t.app, ATTORI.hr.email);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const tt = await pool.query<{ id: string }>(`SELECT user_tenant_id AS id FROM sys.sys_users WHERE user_id = $1`, [ATTORI.hr.userId]);
    tenantId = tt.rows[0]!.id;

    const a = await pool.query<{ pid: string; pname: string; sid: string; sname: string }>(
      `SELECT tp.tenant_process_id AS pid, tp.tenant_process_name AS pname,
              st.tenant_process_step_id AS sid, st.tenant_process_step_name AS sname
         FROM sys.sys_tenant_process_steps st
         JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = st.tenant_process_step_process_id
        WHERE tp.tenant_process_tenant_id = $1
        ORDER BY tp.tenant_process_code, st.tenant_process_step_ordinal LIMIT 1`,
      [tenantId],
    );
    const x = a.rows[0];
    attivita = x ? { processId: x.pid, processName: x.pname, stepId: x.sid, stepName: x.sname } : null;

    // 210 richieste dell'HR stesso: tutte nel suo perimetro. L'ultima porta l'attivita'.
    await pool.query(
      `INSERT INTO sys.sys_approval_requests
         (approval_request_tenant_id, approval_request_title, approval_request_decision_policy,
          approval_request_priority, created_by)
       SELECT $1, $2 || ' ' || g, 'ALL_OF', 'MEDIUM', $3 FROM generate_series(1, $4::int) g`,
      [tenantId, TAG, ATTORI.hr.userId, AGGIUNTE],
    );
    if (attivita) {
      await pool.query(
        `INSERT INTO sys.sys_approval_requests
           (approval_request_tenant_id, approval_request_title, approval_request_decision_policy,
            approval_request_priority, created_by, approval_request_tenant_process_id, approval_request_tenant_process_step_id)
         VALUES ($1, $2, 'ALL_OF', 'MEDIUM', $3, $4, $5)`,
        [tenantId, `${TAG} con attivita`, ATTORI.hr.userId, attivita.processId, attivita.stepId],
      );
    }
  }, 60_000);
  afterAll(async () => {
    await t.app.close();
  });

  it("total e' il conteggio dell'insieme, non la lunghezza della pagina", async () => {
    const atteso = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_approval_requests WHERE approval_request_tenant_id = $1`,
      [tenantId],
    );
    const l = await lista("limit=200");
    expect(l.items.length).toBe(200);
    expect(l.total).toBe(Number(atteso.rows[0]!.n));
    expect(l.total).toBeGreaterThan(200);
  });

  it("sfogliando si arriva all'ultima riga, senza buchi ne' doppioni", async () => {
    const primo = await lista(`status=PENDING&limit=200`);
    const visti = new Set<string>();
    for (let offset = 0; offset < primo.total; offset += 200) {
      const p = await lista(`status=PENDING&limit=200&offset=${offset}`);
      expect(p.total).toBe(primo.total);
      for (const r of p.items) visti.add(r.approvalRequestId);
    }
    expect(visti.size).toBe(primo.total);
    const nostre = await lista(`status=PENDING&limit=1&offset=${primo.total}`);
    expect(nostre.items).toEqual([]);
    expect(nostre.total, "oltre la fine il totale resta quello").toBe(primo.total);
  });

  it("il filtro per processo e per attivita' restituisce solo quelle, con i nomi", async () => {
    if (!attivita) {
      console.warn("[V-3] il tenant dell'HR di scena non ha attivita' di processo: prova non eseguita");
      return;
    }
    const perProcesso = await lista(`processId=${attivita.processId}&limit=200`);
    expect(perProcesso.items.length).toBeGreaterThan(0);
    expect(perProcesso.items.every((r) => r.processId === attivita!.processId)).toBe(true);

    const perAttivita = await lista(`processStepId=${attivita.stepId}&limit=200`);
    const nostra = perAttivita.items.find((r) => r.title === `${TAG} con attivita`);
    expect(nostra, "la richiesta con attivita' non torna dal filtro").toBeTruthy();
    expect(nostra!.processName).toBe(attivita.processName);
    expect(nostra!.processStepName).toBe(attivita.stepName);
    expect(perAttivita.items.every((r) => r.processStepId === attivita!.stepId)).toBe(true);

    const faccia = perAttivita.processes.find((p) => p.processId === attivita!.processId);
    expect(faccia, "il processo non compare fra quelli da filtrare").toBeTruthy();
    expect(faccia!.steps.some((s) => s.processStepId === attivita!.stepId)).toBe(true);
  });

  it("le mie approvazioni: APPLIED conta fra le approvate, e i conteggi tornano col totale", async () => {
    await pool.query(
      `INSERT INTO sys.sys_approval_requests
         (approval_request_tenant_id, approval_request_title, approval_request_decision_policy,
          approval_request_priority, approval_request_status, created_by)
       VALUES ($1, $2, 'ALL_OF', 'MEDIUM', 'APPLIED', $3)`,
      [tenantId, `${TAG} applicata`, ATTORI.hr.userId],
    );
    const atteso = await pool.query<{ ok: string }>(
      `SELECT count(*)::text AS ok FROM sys.sys_approval_requests
        WHERE created_by = $1 AND approval_request_status IN ('APPROVED', 'APPLIED')`,
      [ATTORI.hr.userId],
    );
    const r = await t.app.inject({ method: "GET", url: "/v1/me/approvals", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { total: number; byStatus: { pending: number; approved: number; rejected: number } };
    expect(b.byStatus.approved).toBe(Number(atteso.rows[0]!.ok));
    expect(b.byStatus.pending + b.byStatus.approved + b.byStatus.rejected).toBe(b.total);
  });
});
