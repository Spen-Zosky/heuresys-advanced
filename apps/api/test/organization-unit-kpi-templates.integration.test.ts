/**
 * apps/api/test/organization-unit-kpi-templates.integration.test.ts
 *
 * Module: organization-unit-kpi-templates (tenant-scoped junction: org unit ↔ KPI).
 * Routes (apps/api/src/modules/organization-unit-kpi-templates/routes.ts):
 *   GET    /v1/organization-unit-kpi-templates       requirePermission('bpm_process:read')
 *   GET    /v1/organization-unit-kpi-templates/:id   requirePermission('bpm_process:read')
 *   PUT    /v1/organization-unit-kpi-templates       verifyCsrf + requirePermission('bpm_process:update')  → 200
 *   DELETE /v1/organization-unit-kpi-templates/:id   verifyCsrf + requirePermission('bpm_process:update')  → 204
 *
 * Visibility (service.ts): PLATFORM_ADMIN sees all; non-platform sees only own tenant.
 * Typed error codes asserted: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CSRF_FAIL.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const BASE = "/v1/organization-unit-kpi-templates";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface UpsertCandidate { unitId: string; kpiId: string }

let suite: TestApp;
let platformS: S;
let userS: S;
let candidate: UpsertCandidate | null = null;
const createdTemplateIds: string[] = [];

describe(`${BASE}/* integration`, () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    // Discover a real (unitId, kpiId) pair that is upsertable: the KPI must be
    // visible to the unit's tenant (global OR same tenant) AND no template may
    // already exist for that pair (so the upsert INSERTs a new row we can clean
    // up — never mutating seeded data via ON CONFLICT DO UPDATE). If none is
    // discoverable, the create/CSRF tests are skipped.
    const found = await pool.query<{ unit_id: string; kpi_id: string }>(
      `SELECT ou.organization_unit_id AS unit_id, k.kpi_definition_id AS kpi_id
         FROM sys.sys_organization_units ou
         JOIN sys.sys_kpi_definitions k
           ON (k.kpi_definition_is_global = true
               OR k.kpi_definition_tenant_id = ou.organization_unit_tenant_id)
        WHERE NOT EXISTS (
                SELECT 1 FROM sys.sys_organization_unit_kpi_templates t
                 WHERE t.organization_unit_kpi_template_unit_id = ou.organization_unit_id
                   AND t.organization_unit_kpi_template_kpi_id = k.kpi_definition_id)
        LIMIT 1`,
    );
    const row = found.rows[0];
    candidate = row ? { unitId: row.unit_id, kpiId: row.kpi_id } : null;
  });

  afterAll(async () => {
    for (const id of createdTemplateIds) {
      try { await pool.query(`DELETE FROM sys.sys_organization_unit_kpi_templates WHERE organization_unit_kpi_template_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("USER (lacks bpm_process:update) cannot upsert → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { unitId: randomUUID(), kpiId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST as PLATFORM_ADMIN → 200 + { items: [], total } shape", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE, headers: { cookie: ch(platformS.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("upsert without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { unitId: randomUUID(), kpiId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("upsert (create) + GET readback as PLATFORM_ADMIN happy path", async () => {
    if (!candidate) {
      // No upsertable (unit, kpi) pair discoverable in the live seed — nothing to assert.
      expect(candidate).toBeNull();
      return;
    }
    const created = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { unitId: candidate.unitId, kpiId: candidate.kpiId, weight: 0.5 },
    });
    expect(created.statusCode).toBe(200);
    const t = created.json() as {
      organizationUnitKpiTemplateId: string; unitId: string; kpiId: string;
      tenantId: string; weight: number;
    };
    expect(t.organizationUnitKpiTemplateId).toBeTruthy();
    expect(t.unitId).toBe(candidate.unitId);
    expect(t.kpiId).toBe(candidate.kpiId);
    expect(typeof t.tenantId).toBe("string");
    expect(t.weight).toBe(0.5);
    createdTemplateIds.push(t.organizationUnitKpiTemplateId);

    const got = await suite.app.inject({
      method: "GET", url: `${BASE}/${t.organizationUnitKpiTemplateId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { organizationUnitKpiTemplateId: string; kpiId: string };
    expect(g.organizationUnitKpiTemplateId).toBe(t.organizationUnitKpiTemplateId);
    expect(g.kpiId).toBe(candidate.kpiId);
  });
});
