/**
 * apps/api/test/brownfield-import-runs.integration.test.ts
 *
 * Module: brownfield-import-runs (/v1/brownfield-import-runs)
 * - GET  /        requirePermission('brownfield_adaptation:read')
 * - GET  /:id     requirePermission('brownfield_adaptation:read')
 * - POST /        app.verifyCsrf + requirePermission('brownfield_adaptation:trigger') + service PLATFORM_ADMIN gate
 * - PATCH /:id    app.verifyCsrf + requirePermission('brownfield_adaptation:trigger') + service PLATFORM_ADMIN gate
 *
 * Persistence target = brownfield.import_runs (NOT sys.sys_*), PK import_run_id.
 * Created rows are cleaned up in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_BIR_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;   // admin@heuresys.com — PLATFORM_ADMIN
let tenantS: S;     // federica.marchetti@rtl-bank.org — TENANT_ADMIN (has perms, but NOT platform-only service gate)
let userS: S;       // tommaso.fiore@rtl-bank.org — USER (lacks brownfield_adaptation:read)
const createdRunIds: string[] = [];

describe("/v1/brownfield-import-runs/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdRunIds) {
      try { await pool.query(`DELETE FROM brownfield.import_runs WHERE import_run_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/brownfield-import-runs" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("USER lacking brownfield_adaptation:read → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield-import-runs",
      headers: { cookie: ch(userS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield-import-runs?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/brownfield-import-runs/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN holds the perm but the platform-only service gate blocks trigger → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield-import-runs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { classificationScope: `${SUITE_PREFIX}_BLK`, metadata: { suite: SUITE_PREFIX } },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("trigger (POST) without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield-import-runs",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { metadata: { suite: SUITE_PREFIX } },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("PLATFORM_ADMIN trigger → 201, GET /:id readback → 200, PATCH status → 200", async () => {
    // trigger (create) — status defaults to RUNNING in the repository
    const created = await suite.app.inject({
      method: "POST", url: "/v1/brownfield-import-runs",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { wave: 1, classificationScope: `${SUITE_PREFIX}_HP`, metadata: { suite: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(201);
    const run = created.json() as { importRunId: string; status: string; classificationScope: string | null };
    expect(typeof run.importRunId).toBe("string");
    expect(run.status).toBe("RUNNING");
    expect(run.classificationScope).toBe(`${SUITE_PREFIX}_HP`);
    createdRunIds.push(run.importRunId);

    // readback by id
    const got = await suite.app.inject({
      method: "GET", url: `/v1/brownfield-import-runs/${run.importRunId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    expect((got.json() as { importRunId: string }).importRunId).toBe(run.importRunId);

    // patch status -> COMPLETED (terminal status sets finished_at server-side)
    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/brownfield-import-runs/${run.importRunId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { status: "COMPLETED" },
    });
    expect(patched.statusCode).toBe(200);
    const p = patched.json() as { status: string; finishedAt: string | null };
    expect(p.status).toBe("COMPLETED");
    expect(p.finishedAt).not.toBeNull();
  });
});
