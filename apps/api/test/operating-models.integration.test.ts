/**
 * apps/api/test/operating-models.integration.test.ts
 *
 * Integration tests for the /v1/operating-models module.
 * Module shape (verified against routes.ts / service.ts / repository.ts):
 *   GET    /v1/operating-models       requirePermission("enterprise_typing:read")
 *   GET    /v1/operating-models/:id   requirePermission("enterprise_typing:read")
 *   PUT    /v1/operating-models       verifyCsrf + requirePermission("enterprise_typing:update") + PLATFORM_ADMIN-only (service)
 *   DELETE /v1/operating-models/:id   verifyCsrf + requirePermission("enterprise_typing:update") + PLATFORM_ADMIN-only (service)
 *
 * upsert is idempotent on operating_model_code (ON CONFLICT DO UPDATE) → no 409 path.
 * Real DB (sys.sys_operating_model_catalog) via the SSH tunnel; no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_OM_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface OperatingModelDto {
  operatingModelId: string;
  code: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface ErrEnvelope { error: { code: string; message: string } }

let suite: TestApp;
let platformS: S;   // admin@heuresys.com           — PLATFORM_ADMIN
let userS: S;       // antonio.parisi@rtl-bank.org   — plain USER (lacks enterprise_typing perms)
const createdIds: string[] = [];

describe("/v1/operating-models/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    userS = await login(suite, "antonio.parisi@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_operating_model_catalog WHERE operating_model_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/operating-models" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as ErrEnvelope).error.code).toBe("UNAUTHORIZED");
  });

  it("USER lacking enterprise_typing:update on DELETE /:id → 403 FORBIDDEN", async () => {
    // enterprise_typing:read is granted to all 9 roles, so a 403-on-read is
    // impossible. Retarget to a write route the USER cannot use: DELETE takes
    // params only (no body), so a valid x-csrf-token passes app.verifyCsrf and
    // requirePermission("enterprise_typing:update") denies in the preHandler
    // (USER lacks that perm) before the handler runs.
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/operating-models/${randomUUID()}`,
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("GET / as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/operating-models",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: OperatingModelDto[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.items.length);
  });

  it("GET /:id with random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/operating-models/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("PUT / without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/operating-models",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, name: "No CSRF" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("CSRF_FAIL");
  });

  it("PUT / as non-PLATFORM_ADMIN → 403 FORBIDDEN", async () => {
    // antonio is a plain USER. Denied either at the RBAC layer (lacks
    // enterprise_typing:update) or at the service PLATFORM_ADMIN guard —
    // both surface as 403 / FORBIDDEN.
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/operating-models",
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_DENY`, name: "Denied" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("PUT / then GET /:id readback as PLATFORM_ADMIN happy path", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "PUT", url: "/v1/operating-models",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Happy Operating Model", description: "it test row", metadata: { suite: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(200);
    const om = created.json() as OperatingModelDto;
    expect(om.code).toBe(code);
    expect(om.name).toBe("Happy Operating Model");
    expect(typeof om.operatingModelId).toBe("string");
    createdIds.push(om.operatingModelId);

    const readback = await suite.app.inject({
      method: "GET", url: `/v1/operating-models/${om.operatingModelId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(readback.statusCode).toBe(200);
    const fetched = readback.json() as OperatingModelDto;
    expect(fetched.operatingModelId).toBe(om.operatingModelId);
    expect(fetched.code).toBe(code);
  });

  it("DELETE /:id as PLATFORM_ADMIN → 204, then GET /:id → 404", async () => {
    const code = `${SUITE_PREFIX}_DEL`;
    const created = await suite.app.inject({
      method: "PUT", url: "/v1/operating-models",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "To Delete" },
    });
    expect(created.statusCode).toBe(200);
    const id = (created.json() as OperatingModelDto).operatingModelId;

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/operating-models/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const gone = await suite.app.inject({
      method: "GET", url: `/v1/operating-models/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(gone.statusCode).toBe(404);
    expect((gone.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });
});
