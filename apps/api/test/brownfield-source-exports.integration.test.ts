/**
 * apps/api/test/brownfield-source-exports.integration.test.ts
 *
 * Integration suite for the read-only brownfield-source-exports module.
 * Module exposes 2 endpoints (routes.ts):
 *   GET /v1/brownfield-source-exports        -> list  (requirePermission brownfield_adaptation:read)
 *   GET /v1/brownfield-source-exports/:id    -> getById (requirePermission brownfield_adaptation:read)
 *
 * No mutations -> no CSRF / create / conflict tests, and nothing to clean up.
 *
 * RBAC (db/migrations/000005_auth_foundation.sql): brownfield_adaptation:read is
 * granted to PLATFORM_ADMIN and TENANT_ADMIN, but NOT to the USER role. So a USER
 * persona is the correct denied actor for the 403 case.
 *
 * Error codes asserted come from rbac.ts (requirePermission throws ForbiddenError
 * with the DEFAULT code "FORBIDDEN" — no custom code at the missing-permission
 * branch) and errors/index.ts (UnauthorizedError -> "UNAUTHORIZED", NotFoundError
 * -> "NOT_FOUND"). These are verified, not assumed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const BASE = "/v1/brownfield-source-exports";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface SourceExport {
  sourceExportId: string;
  name: string;
  fileHash: string | null;
  retrievedAt: string;
  sizeBytes: number | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
interface ListBody { items: SourceExport[]; total: number }
interface ErrBody { error: { code: string; message: string; requestId?: string } }

let suite: TestApp;
let platformS: S;
let userS: S;

describe(`${BASE}/* integration`, () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST -> 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE });
    expect(r.statusCode).toBe(401);
    expect((r.json() as ErrBody).error.code).toBe("UNAUTHORIZED");
  });

  it("USER lacking brownfield_adaptation:read -> 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "GET", url: BASE,
      headers: { cookie: ch(userS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("FORBIDDEN");
  });

  it("PLATFORM_ADMIN LIST -> 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: BASE,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("PLATFORM_ADMIN LIST honors limit query param -> 200, bounded items", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}?limit=1&offset=0`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(1);
  });

  it("PLATFORM_ADMIN GET /:id for a random uuid -> 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });

  it("PLATFORM_ADMIN GET /:id for an existing row (if any) -> 200 matching schema shape", async () => {
    const list = await suite.app.inject({
      method: "GET", url: `${BASE}?limit=1`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as ListBody;
    const first = body.items[0];
    // Read-only module: cannot create a row. If the live DB has no exports,
    // there is nothing deterministic to fetch by id — assert nothing and return.
    if (!first) return;

    const r = await suite.app.inject({
      method: "GET", url: `${BASE}/${first.sourceExportId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const exp = r.json() as SourceExport;
    expect(exp.sourceExportId).toBe(first.sourceExportId);
    expect(typeof exp.name).toBe("string");
    expect(["AVAILABLE", "INGESTED", "ARCHIVED", "CORRUPTED"]).toContain(exp.status);
    expect(exp.fileHash === null || typeof exp.fileHash === "string").toBe(true);
    expect(exp.sizeBytes === null || typeof exp.sizeBytes === "number").toBe(true);
    expect(typeof exp.retrievedAt).toBe("string");
    expect(typeof exp.createdAt).toBe("string");
    expect(typeof exp.metadata).toBe("object");
  });
});
