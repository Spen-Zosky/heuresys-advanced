/**
 * apps/api/test/tenant-contracts.integration.test.ts
 * GET /v1/tenants/:id/contracts — la scheda «Contratti» del tenant (sola lettura, additiva).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

let suite: TestApp;
let cookie: string;

describe("/v1/tenants/:id/contracts", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    const r = await loginRaw(suite.app, "platform-test-admin@collaudo.invalid", TEST_PERSONA_PASSWORD);
    cookie = r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("senza accesso → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${randomUUID()}/contracts` });
    expect(r.statusCode).toBe(401);
  });

  it("tenant inesistente → 404", async () => {
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${randomUUID()}/contracts`, headers: { cookie } });
    expect(r.statusCode).toBe(404);
  });

  it("un tenant esistente → forma completa e conteggi coerenti con i livelli", async () => {
    const t = await pool.query<{ tenant_id: string }>(`SELECT tenant_id FROM sys.sys_tenancies ORDER BY tenant_code LIMIT 1`);
    const r = await suite.app.inject({ method: "GET", url: `/v1/tenants/${t.rows[0]!.tenant_id}/contracts`, headers: { cookie } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { contracts: { levels: { annualMinimumEur: string | null }[]; gapLevelCodes: string[] }[]; summary: Record<string, number> };
    expect(['ACTIVE', 'OTHER_VERSION']).toContain((b as unknown as { source: { kind: string } }).source.kind);
    expect(b.summary.contracts).toBe(b.contracts.length);
    expect(b.summary.levels).toBe(b.contracts.reduce((s, c) => s + c.levels.length, 0));
    expect(b.summary.levelsWithoutMinimum).toBe(b.contracts.reduce((s, c) => s + c.levels.filter((l) => l.annualMinimumEur === null).length, 0));
  });
});
