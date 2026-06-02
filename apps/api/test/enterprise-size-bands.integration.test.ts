/**
 * apps/api/test/enterprise-size-bands.integration.test.ts
 *
 * Module: enterprise-size-bands — GLOBAL fixed-domain catalog.
 *   Routes (apps/api/src/modules/enterprise-size-bands/routes.ts):
 *     GET    /v1/enterprise-size-bands      requirePermission('enterprise_typing:read')
 *     GET    /v1/enterprise-size-bands/:id  requirePermission('enterprise_typing:read')
 *     PUT    /v1/enterprise-size-bands      verifyCsrf + requirePermission('enterprise_typing:update')  (upsert-by-code, 200)
 *     DELETE /v1/enterprise-size-bands/:id  verifyCsrf + requirePermission('enterprise_typing:update')  (204)
 *   Visibility model (service.ts): list/getById are global (permission-only, no actor scope);
 *     upsert/delete require PLATFORM_ADMIN (isPlatform) → ForbiddenError("PLATFORM_ADMIN required")
 *     which maps to 403 with the DEFAULT code "FORBIDDEN" (no custom SCREAMING_SNAKE code is passed).
 *
 * IMPORTANT — why no "create new row" / no "409 conflict" / no DELETE test:
 *   The natural key `enterprise_size_band_code` is CHECK-constrained to exactly
 *   ('XS','S','M','L','XL') and UNIQUE, and all 5 codes are pre-seeded (migration 000021).
 *   The PUT is ON CONFLICT(code) DO UPDATE, so there is NO way to insert a uniquely-prefixed
 *   throw-away row, and DELETE/overwrite of a seeded band would corrupt shared state that other
 *   tests + CI depend on (and cascade onto FK references in blueprints / enterprise-typing).
 *   The happy-path write therefore uses a NON-DESTRUCTIVE read-modify-RESTORE pattern: GET an
 *   existing seeded band, capture its exact field values, PUT them straight back (idempotent
 *   upsert producing no net data change), assert 200 + shape, and re-restore in afterAll for safety.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface Band {
  enterpriseSizeBandId: string;
  code: string;
  name: string;
  minEmployees: number | null;
  maxEmployees: number | null;
  minRevenueEur: number | null;
  maxRevenueEur: number | null;
  description: string | null;
  metadata: Record<string, unknown>;
}
interface ListBody { items: Band[]; total: number }
interface ErrBody { error: { code: string; message: string } }

let suite: TestApp;
let platformS: S;   // admin@heuresys.com — PLATFORM_ADMIN
let tenantS: S;     // federica.marchetti@rtl-bank.org — TENANT_ADMIN (lacks enterprise_typing:update / not platform)

/** Snapshot of one seeded band, captured before any write so afterAll can restore it verbatim. */
let original: Band | null = null;

/** PUT a band's full field set (used by both the happy-path test and afterAll restore). */
function upsertPayload(b: Band) {
  return {
    code: b.code,
    name: b.name,
    minEmployees: b.minEmployees,
    maxEmployees: b.maxEmployees,
    minRevenueEur: b.minRevenueEur,
    maxRevenueEur: b.maxRevenueEur,
    description: b.description,
    metadata: b.metadata,
  };
}

describe("/v1/enterprise-size-bands integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    // Restore the captured band verbatim (idempotent — its values were never changed,
    // but this guards against partial-write surprises and keeps shared seed state intact).
    if (original) {
      try {
        await suite.app.inject({
          method: "PUT", url: "/v1/enterprise-size-bands",
          headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
          payload: upsertPayload(original),
        });
      } catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/enterprise-size-bands" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as ErrBody).error.code).toBe("UNAUTHORIZED");
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe(body.items.length);
    // Capture one real band (if any seeded) for the GET /:id + write tests. No count/value assertion.
    if (body.items.length > 0) {
      original = body.items[0] ?? null;
      if (original) {
        expect(typeof original.enterpriseSizeBandId).toBe("string");
        expect(typeof original.code).toBe("string");
      }
    }
  });

  it("LIST is readable by TENANT_ADMIN (read perm is global, not platform-only) → 200", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect(Array.isArray((r.json() as ListBody).items)).toBe(true);
  });

  it("GET /:id existing → 200; random uuid → 404 NOT_FOUND", async () => {
    if (original) {
      const got = await suite.app.inject({
        method: "GET", url: `/v1/enterprise-size-bands/${original.enterpriseSizeBandId}`,
        headers: { cookie: ch(platformS.cookies) },
      });
      expect(got.statusCode).toBe(200);
      const b = got.json() as Band;
      expect(b.enterpriseSizeBandId).toBe(original.enterpriseSizeBandId);
      expect(b.code).toBe(original.code);
    }

    const miss = await suite.app.inject({
      method: "GET", url: `/v1/enterprise-size-bands/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(miss.statusCode).toBe(404);
    expect((miss.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });

  it("PUT (upsert) by non-PLATFORM_ADMIN (TENANT_ADMIN) → 403 FORBIDDEN", async () => {
    // Either requirePermission('enterprise_typing:update') denies (missing perm) OR the service's
    // isPlatform() guard rejects — both throw ForbiddenError with the DEFAULT code "FORBIDDEN".
    const payload = original
      ? upsertPayload(original)
      : { code: "M", name: "Medium" }; // valid enum code; rejected before any write by the guard
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload,
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("FORBIDDEN");
  });

  it("PUT (mutation) without x-csrf-token → 403 CSRF_FAIL", async () => {
    const payload = original ? upsertPayload(original) : { code: "M", name: "Medium" };
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" }, // no x-csrf-token
      payload,
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("CSRF_FAIL");
  });

  it("PUT (upsert) happy path as PLATFORM_ADMIN — idempotent restore of an existing band → 200", async () => {
    if (!original) {
      // No seeded bands to round-trip safely; nothing to assert without risking a destructive insert.
      return;
    }
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-size-bands",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: upsertPayload(original),
    });
    expect(r.statusCode).toBe(200);
    const b = r.json() as Band;
    expect(b.code).toBe(original.code);
    expect(b.enterpriseSizeBandId).toBe(original.enterpriseSizeBandId); // ON CONFLICT keeps same row id
    expect(typeof b.enterpriseSizeBandId).toBe("string");
  });
});
