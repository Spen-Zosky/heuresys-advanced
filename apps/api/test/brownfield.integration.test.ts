/**
 * apps/api/test/brownfield.integration.test.ts
 * Smoke-test for brownfield viewer modules. The brownfield.* tables are
 * empty in CI; the test asserts that the API endpoints answer with
 * proper RBAC + empty-list shape, plus PLATFORM_ADMIN trigger semantics.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: S;
let runId: string | null = null;

describe("/v1/brownfield-* viewer", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
  });

  afterAll(async () => {
    if (runId) { try { await pool.query(`DELETE FROM brownfield.import_runs WHERE import_run_id = $1`, [runId]); } catch { /* ignore */ } }
    await suite.app.close();
    await closePool();
  });

  it("LIST source-exports with PLATFORM_ADMIN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield-source-exports",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(b.items)).toBe(true);
  });

  it("USER outsider lacks brownfield_adaptation:read → 403", async () => {
    const outsider = await login(suite, "antonio.parisi@rtl-bank.org");
    const r = await suite.app.inject({
      method: "GET", url: "/v1/brownfield-source-exports",
      headers: { cookie: ch(outsider.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PLATFORM_ADMIN triggers an import run", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/brownfield-import-runs",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { wave: 1, classificationScope: "DEMO" },
    });
    expect(r.statusCode).toBe(201);
    const b = r.json() as { importRunId: string; status: string };
    expect(b.status).toBe("RUNNING");
    runId = b.importRunId;
  });

  it("PATCH import run to SUCCESS sets finished_at", async () => {
    if (!runId) throw new Error("setup failure");
    const r = await suite.app.inject({
      method: "PATCH", url: `/v1/brownfield-import-runs/${runId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { status: "COMPLETED" },
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { status: string; finishedAt: string | null };
    expect(b.status).toBe("COMPLETED");
    expect(b.finishedAt).not.toBeNull();
  });

  it("GET non-existent mapping → 404", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/brownfield-table-mappings/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
  });
});
