/**
 * apps/api/test/process-kpi-templates.integration.test.ts
 *
 * Module: process-kpi-templates — global junction (blueprint process ↔ KPI definition).
 * Routes (apps/api/src/modules/process-kpi-templates/routes.ts):
 *   GET    /v1/process-kpi-templates       requirePermission('bpm_process:read')
 *   GET    /v1/process-kpi-templates/:id   requirePermission('bpm_process:read')
 *   PUT    /v1/process-kpi-templates       verifyCsrf + requirePermission('bpm_process:update') -> 200 (upsert)
 *   DELETE /v1/process-kpi-templates/:id   verifyCsrf + requirePermission('bpm_process:update') -> 204
 *
 * Visibility model (service.ts): list/getById open to any 'bpm_process:read' holder;
 * upsert/delete are PLATFORM_ADMIN-only via isPlatform() — non-platform actors that
 * still hold 'bpm_process:update' (e.g. TENANT_ADMIN) get ForbiddenError("PLATFORM_ADMIN required").
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_PKT_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;     // enzo.spenuso@heuresys.com — PLATFORM_ADMIN
let tenantS: S;       // federica.marchetti@rtl-bank.org — TENANT_ADMIN (has bpm_process:update but NOT platform)
let userS: S;         // tommaso.fiore@rtl-bank.org — USER (read-only on bpm_process)

// FK seed ids fetched live from the real DB (not hard-coded). If either catalogue
// is empty the upsert-dependent assertions are softened (status-only / skipped).
let processId: string | null = null;
let kpiId: string | null = null;
const createdTemplateIds: string[] = [];

describe("/v1/process-kpi-templates/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    const proc = await pool.query<{ id: string }>(
      `SELECT blueprint_process_id AS id FROM sys.sys_blueprint_process_registry LIMIT 1`,
    );
    processId = proc.rows[0]?.id ?? null;
    const kpi = await pool.query<{ id: string }>(
      `SELECT kpi_definition_id AS id FROM sys.sys_kpi_definitions LIMIT 1`,
    );
    kpiId = kpi.rows[0]?.id ?? null;
  });

  afterAll(async () => {
    for (const id of createdTemplateIds) {
      try { await pool.query(`DELETE FROM sys.sys_process_kpi_templates WHERE process_kpi_template_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET list → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/process-kpi-templates" });
    expect(r.statusCode).toBe(401);
  });

  it("GET list as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /:id with random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/process-kpi-templates/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN PUT (has bpm_process:update, not PLATFORM_ADMIN) → 403 FORBIDDEN", async () => {
    // RBAC passes (TENANT_ADMIN holds bpm_process:update) but the service platform-only
    // gate throws ForbiddenError("PLATFORM_ADMIN required") -> default code FORBIDDEN.
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { processId: randomUUID(), kpiId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("USER PUT (lacks bpm_process:update) → 403", async () => {
    // RBAC requirePermission('bpm_process:update') denies before the service runs.
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { processId: randomUUID(), kpiId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PLATFORM_ADMIN PUT without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { processId: randomUUID(), kpiId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("PLATFORM_ADMIN PUT upsert then GET /:id readback happy path (200)", async () => {
    if (!processId || !kpiId) {
      // Catalogues empty in this DB snapshot — cannot satisfy the FK preconditions.
      // Skip rather than assert a misleading result (no hard-coded ids allowed).
      return;
    }
    const upsert = await suite.app.inject({
      method: "PUT", url: "/v1/process-kpi-templates",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { processId, kpiId, defaultWeight: 0.5, defaultTarget: { suite: SUITE_PREFIX }, metadata: { suite: SUITE_PREFIX } },
    });
    expect(upsert.statusCode).toBe(200);
    const created = upsert.json() as {
      processKpiTemplateId: string; processId: string; kpiId: string; defaultWeight: number;
    };
    expect(created.processKpiTemplateId).toBeTruthy();
    expect(created.processId).toBe(processId);
    expect(created.kpiId).toBe(kpiId);
    createdTemplateIds.push(created.processKpiTemplateId);

    const get = await suite.app.inject({
      method: "GET", url: `/v1/process-kpi-templates/${created.processKpiTemplateId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(get.statusCode).toBe(200);
    const got = get.json() as { processKpiTemplateId: string };
    expect(got.processKpiTemplateId).toBe(created.processKpiTemplateId);
  });
});
