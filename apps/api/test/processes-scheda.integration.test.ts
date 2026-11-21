import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { TenantProcessListResponseSchema, TenantProcessMatrixResponseSchema, TenantProcessSchedaSchema } from "@heuresys/shared";

/**
 * V4 del piano processi e progetti — /v1/processes e /v1/processes/:id/scheda, letti dal vivo come
 * la persona reale TENANT_ADMIN di RTL Bank. Le attese si misurano sul database nello stesso test,
 * non si scrivono a mano: il numero dei processi deve coincidere con quello delle righe.
 */
const RTL = "86ba7a65-217f-48ba-8ce5-5c09b40a66b0";
const ADMIN = "federica.marchetti@rtl-bank.org";

let t: TestApp;
let cookie = "";

beforeAll(async () => {
  t = await buildTestApp();
  const r = await loginRaw(t.app, ADMIN, TEST_PERSONA_PASSWORD);
  cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
});
afterAll(async () => { await t?.app.close(); });

describe("/v1/processes", () => {
  it("senza sessione risponde 401", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/processes" });
    expect(r.statusCode).toBe(401);
  });

  it("elenca i processi di primo livello del tenant, con un solo numero coerente con il database", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/processes?level=1", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const body = TenantProcessListResponseSchema.parse(r.json());
    const db = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_tenant_processes
        WHERE tenant_process_tenant_id = $1 AND tenant_process_is_active AND tenant_process_level = 1`, [RTL]);
    expect(body.total).toBe(db.rows[0]!.n);
    expect(body.items.length).toBe(body.total);
    for (const p of body.items) { expect(p.tenantId).toBe(RTL); expect(p.level).toBe(1); }
    // L'ordine lo fa l'API (R1/R5): lo stesso che dà il database con la sua collazione.
    const ordine = await pool.query<{ id: string }>(
      `SELECT tenant_process_id AS id FROM sys.sys_tenant_processes
        WHERE tenant_process_tenant_id = $1 AND tenant_process_is_active AND tenant_process_level = 1
        ORDER BY tenant_process_name, tenant_process_code`, [RTL]);
    expect(body.items.map((p) => p.processId)).toEqual(ordine.rows.map((x) => x.id));
  });

  it("la scheda di un processo porta sottoprocessi e attività coerenti con i conteggi della sintesi", async () => {
    // Il database della CI può non avere processi di RTL: allora la prova se ne crea uno con un
    // sottoprocesso, nella transazione del file che torna indietro alla fine (tx-isolation).
    const ci = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_tenant_processes
        WHERE tenant_process_tenant_id = $1 AND tenant_process_is_active AND tenant_process_level = 1`, [RTL]);
    if (ci.rows[0]!.n === 0) {
      const padre = randomUUID();
      await pool.query(
        `INSERT INTO sys.sys_tenant_processes (tenant_process_id, tenant_process_tenant_id, tenant_process_code,
           tenant_process_name, tenant_process_level, tenant_process_parent_id)
         VALUES ($1, $2, 'PROVA-V4-P', 'Processo di prova V4', 1, NULL),
                ($3, $2, 'PROVA-V4-S', 'Sottoprocesso di prova V4', 2, $1)`, [padre, RTL, randomUUID()]);
    }
    const l = TenantProcessListResponseSchema.parse(
      (await t.app.inject({ method: "GET", url: "/v1/processes?level=1", headers: { cookie } })).json());
    const conSotto = l.items.find((p) => p.subprocessCount > 0) ?? l.items[0];
    expect(conSotto, "RTL deve avere almeno un processo").toBeDefined();
    const r = await t.app.inject({ method: "GET", url: `/v1/processes/${conSotto!.processId}/scheda`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const s = TenantProcessSchedaSchema.parse(r.json());
    expect(s.process.processId).toBe(conSotto!.processId);
    expect(s.subprocesses.length).toBe(conSotto!.subprocessCount);
    for (const sp of s.subprocesses) expect(sp.parentId).toBe(conSotto!.processId);
    const attese = conSotto!.activityCount + s.subprocesses.reduce((n, sp) => n + sp.activityCount, 0);
    expect(s.activities.length).toBe(attese);
    const ids = new Set([s.process.processId, ...s.subprocesses.map((x) => x.processId)]);
    for (const a of s.activities) expect(ids.has(a.processId)).toBe(true);
  });

  it("un processo che non esiste risponde 404", async () => {
    const r = await t.app.inject({ method: "GET", url: `/v1/processes/${randomUUID()}/scheda`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });

  it("un processo di un altro tenant risponde 404, senza dire che esiste (I5)", async () => {
    const altro = await pool.query<{ id: string }>(
      `SELECT tenant_process_id AS id FROM sys.sys_tenant_processes WHERE tenant_process_tenant_id <> $1 LIMIT 1`, [RTL]);
    if (!altro.rows[0]) return; // nessun processo fuori da RTL: il caso non si presenta
    const r = await t.app.inject({ method: "GET", url: `/v1/processes/${altro.rows[0].id}/scheda`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });
});

describe("/v1/processes/matrice", () => {
  it("senza sessione risponde 401", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/processes/matrice" });
    expect(r.statusCode).toBe(401);
  });

  it("le celle coincidono con le partecipazioni del database e ogni cella ha il suo processo e la sua unità", async () => {
    const r = await t.app.inject({ method: "GET", url: "/v1/processes/matrice", headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const body = TenantProcessMatrixResponseSchema.parse(r.json());
    expect(body.tenantId).toBe(RTL);
    const db = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM (
         SELECT DISTINCT oup.org_unit_process_tenant_process_id, oup.org_unit_process_org_unit_id
           FROM sys.sys_organization_unit_processes oup
           JOIN sys.sys_tenant_processes tp ON tp.tenant_process_id = oup.org_unit_process_tenant_process_id AND tp.tenant_process_is_active
          WHERE oup.org_unit_process_tenant_id = $1) x`, [RTL]);
    expect(body.cells.length).toBe(db.rows[0]!.n);
    const processi = new Set(body.processes.map((p) => p.processId));
    const unita = new Set(body.units.map((u) => u.unitId));
    for (const c of body.cells) { expect(processi.has(c.processId)).toBe(true); expect(unita.has(c.unitId)).toBe(true); }
    expect(new Set(body.cells.map((c) => `${c.processId}|${c.unitId}`)).size).toBe(body.cells.length);
  });
});
