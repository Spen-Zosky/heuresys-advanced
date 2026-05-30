/**
 * apps/api/test/bpm-kpi-templates.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_BPMK_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let famId: string;
let varId: string;
let procId: string;
let kpiId: string;
let unitId: string;
let pktId: string;
let ouKtId: string;

describe("/v1/process-kpi-templates + /v1/organization-unit-kpi-templates", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");

    const f = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "BPM test family" },
    });
    famId = (f.json() as { blueprintFamilyId: string }).blueprintFamilyId;

    const v = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId: famId, code: `${SUITE_PREFIX}_VAR`, name: "BPM test variant" },
    });
    varId = (v.json() as { blueprintVariantId: string }).blueprintVariantId;

    const p = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { variantId: varId, code: "BPM_PROC", name: "Test process", ordinal: 1 },
    });
    procId = (p.json() as { blueprintProcessId: string }).blueprintProcessId;

    const k = await suite.app.inject({
      method: "POST", url: "/v1/kpi-definitions",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_KPI`, name: "Test KPI", kpiType: "QUANTITATIVE", isGlobal: true },
    });
    kpiId = (k.json() as { kpiDefinitionId: string }).kpiDefinitionId;

    const u = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_UNIT`, name: "Test Unit", kind: "BRANCH" },
    });
    unitId = (u.json() as { organizationUnitId: string }).organizationUnitId;
  });

  afterAll(async () => {
    if (ouKtId) { try { await pool.query(`DELETE FROM sys.sys_organization_unit_kpi_templates WHERE organization_unit_kpi_template_id = $1`, [ouKtId]); } catch { /* ignore */ } }
    if (pktId) { try { await pool.query(`DELETE FROM sys.sys_process_kpi_templates WHERE process_kpi_template_id = $1`, [pktId]); } catch { /* ignore */ } }
    if (unitId) { try { await pool.query(`DELETE FROM sys.sys_organization_units WHERE organization_unit_id = $1`, [unitId]); } catch { /* ignore */ } }
    if (kpiId) { try { await pool.query(`DELETE FROM sys.sys_kpi_definitions WHERE kpi_definition_id = $1`, [kpiId]); } catch { /* ignore */ } }
    if (famId) { try { await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [famId]); } catch { /* ignore */ } }
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN upserts process-KPI template", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { processId: procId, kpiId, defaultWeight: 0.75 },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { processKpiTemplateId: string; defaultWeight: number };
    expect(body.defaultWeight).toBe(0.75);
    pktId = body.processKpiTemplateId;

    const r2 = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { processId: procId, kpiId, defaultWeight: 0.9 },
    });
    expect(r2.statusCode).toBe(200);
    expect((r2.json() as { processKpiTemplateId: string }).processKpiTemplateId).toBe(pktId);
    expect((r2.json() as { defaultWeight: number }).defaultWeight).toBe(0.9);
  });

  it("TENANT_ADMIN cannot upsert process-KPI template → 403", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { processId: procId, kpiId, defaultWeight: 0.5 },
    });
    expect(r.statusCode).toBe(403);
  });

  it("TENANT_ADMIN upserts org-unit-KPI template idempotently", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/organization-unit-kpi-templates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { unitId, kpiId, weight: 0.6 },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { organizationUnitKpiTemplateId: string; weight: number };
    expect(body.weight).toBe(0.6);
    ouKtId = body.organizationUnitKpiTemplateId;

    const r2 = await suite.app.inject({
      method: "PUT", url: "/v1/organization-unit-kpi-templates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { unitId, kpiId, weight: 0.4 },
    });
    expect(r2.statusCode).toBe(200);
    expect((r2.json() as { organizationUnitKpiTemplateId: string }).organizationUnitKpiTemplateId).toBe(ouKtId);
    expect((r2.json() as { weight: number }).weight).toBe(0.4);
  });
});
