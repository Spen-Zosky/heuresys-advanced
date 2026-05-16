/**
 * apps/api/test/kpi-definitions.integration.test.ts
 * Integration tests for /v1/kpi-definitions/*.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_KPI_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
const createdIds: string[] = [];

describe("/v1/kpi-definitions/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE tenant KPI as TENANT_ADMIN; LIST returns it", async () => {
    const code = `${SUITE_PREFIX}_TENANT`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Tenant KPI", polarity: "HIGHER_IS_BETTER", unit: "%" },
    });
    expect(created.statusCode).toBe(201);
    const k = created.json() as { kpiDefinitionId: string; isGlobal: boolean };
    expect(k.isGlobal).toBe(false);
    createdIds.push(k.kpiDefinitionId);
  });

  it("CREATE global KPI as PLATFORM_ADMIN; visible to tenant admin", async () => {
    const code = `${SUITE_PREFIX}_GLOBAL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Global KPI", isGlobal: true, polarity: "TARGET_RANGE" },
    });
    expect(created.statusCode).toBe(201);
    const k = created.json() as { kpiDefinitionId: string; isGlobal: boolean };
    expect(k.isGlobal).toBe(true);
    createdIds.push(k.kpiDefinitionId);

    const visible = await suite.app.inject({
      method: "GET", url: `/v1/kpi-definitions/${k.kpiDefinitionId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(visible.statusCode).toBe(200);
  });

  it("PATCH global as TENANT_ADMIN → 403 GLOBAL_KPI_EDIT_FORBIDDEN", async () => {
    const code = `${SUITE_PREFIX}_LOCKED`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Locked Global", isGlobal: true },
    });
    const { kpiDefinitionId } = created.json() as { kpiDefinitionId: string };
    createdIds.push(kpiDefinitionId);

    const blocked = await suite.app.inject({
      method: "PATCH", url: `/v1/kpi-definitions/${kpiDefinitionId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Try Rename" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe("GLOBAL_KPI_EDIT_FORBIDDEN");
  });

  it("DELETE tenant KPI as TENANT_ADMIN → 204", async () => {
    const code = `${SUITE_PREFIX}_DEL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Delete Me" },
    });
    const { kpiDefinitionId } = created.json() as { kpiDefinitionId: string };
    createdIds.push(kpiDefinitionId);

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/kpi-definitions/${kpiDefinitionId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });

  it("Duplicate code in same scope → 409 KPI_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup A" },
    });
    createdIds.push((first.json() as { kpiDefinitionId: string }).kpiDefinitionId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup B" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("KPI_CODE_CONFLICT");
  });
});
