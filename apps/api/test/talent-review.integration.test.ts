/**
 * apps/api/test/talent-review.integration.test.ts — A/L3 (#29).
 *
 * READ-only API over six dormant talent-intelligence tables. Talent = EVALUATION,
 * org-gated (ADR-0027 F3): PLATFORM_ADMIN → all; TENANT_ADMIN (HR mandate) → whole
 * tenant; MANAGER → transitive org sub-tree; USER → 403 (no self-view by product
 * decision). Critical positions/coverage are position-level (catalog, no org gate).
 * All expectations derive from the LIVE DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";

const PWD = TEST_PERSONA_PASSWORD;
const BANDS = new Set(["LOW", "MEDIUM", "HIGH"]);

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}
async function liveCount(sql: string, params: unknown[] = []): Promise<number> {
  const r = await pool.query<{ n: string }>(sql, params);
  return Number(r.rows[0]!.n);
}
async function userId(email: string): Promise<string> {
  const r = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE user_email = $1`, [email]);
  return r.rows[0]!.user_id;
}

let suite: TestApp;
let admin: S; let federica: S; let paolo: S; let tommaso: S;
let rtlTenantId: string;
let paoloSubtree: string[];

describe("#29 A/L3 talent-review 9-box read", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite, "enzo.spenuso@heuresys.com");
    federica = await login(suite, "federica.marchetti@rtl-bank.org"); // TENANT_ADMIN (HR mandate)
    paolo = await login(suite, "paolo.caputo@rtl-bank.org"); // MANAGER
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER (paolo's report, no talent:read)
    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["federica.marchetti@rtl-bank.org"]);
    rtlTenantId = t.rows[0]!.user_tenant_id;
    paoloSubtree = await orgSubtreeUserIds(pool, await userId("paolo.caputo@rtl-bank.org"));
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  // ── nine-box: org axis ──────────────────────────────────────────────────────

  it("PLATFORM_ADMIN nine-box total == whole live table + pagination honored", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_talent_scores`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/nine-box?limit=1", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBe(1);
  });

  it("TENANT_ADMIN (HR mandate) nine-box total == own-tenant count (live-derived)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_talent_scores WHERE talent_score_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/nine-box?limit=1", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("MANAGER nine-box is scoped to the transitive org sub-tree (I18)", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_talent_scores WHERE talent_score_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/nine-box?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.total).toBeGreaterThan(0); // meaningful scope (paolo has reports with talent scores)
    // every returned subject must be inside the manager's sub-tree — no peer leak (I19)
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  it("USER without talent:read → 403 on the nine-box list (no self-view)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/nine-box", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  it("nine-box rows carry potentialBand/performanceBand ∈ {LOW,MEDIUM,HIGH}", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/nine-box?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { potentialBand: string; performanceBand: string; potential: number | null }[] };
    expect(body.items.length).toBeGreaterThan(0);
    for (const row of body.items) {
      expect(BANDS.has(row.potentialBand)).toBe(true);
      expect(BANDS.has(row.performanceBand)).toBe(true);
    }
    // derivation sanity: the documented boundary (< 50 LOW, [50,75) MEDIUM, >= 75 HIGH; null → LOW)
    for (const row of body.items) {
      const p = row.potential;
      const expected = p === null ? "LOW" : p < 50 ? "LOW" : p < 75 ? "MEDIUM" : "HIGH";
      expect(row.potentialBand).toBe(expected);
    }
  });

  // ── fit / readiness / succession: org axis (PLATFORM_ADMIN == whole live table) ──

  it("fit/readiness/succession PLATFORM_ADMIN totals match the live tables", async () => {
    const cases: [string, string][] = [
      ["/v1/talent-review/fit", "sys.sys_employee_position_fit_scores"],
      ["/v1/talent-review/readiness", "sys.sys_readiness_scores"],
      ["/v1/talent-review/succession", "sys.sys_succession_scores"],
    ];
    for (const [url, table] of cases) {
      const live = await liveCount(`SELECT count(*)::text AS n FROM ${table}`);
      const r = await suite.app.inject({
        method: "GET", url: `${url}?limit=1`, headers: { cookie: ch(admin.cookies) },
      });
      expect(r.statusCode, url).toBe(200);
      expect((r.json() as { total: number }).total, url).toBe(live);
    }
  });

  it("readiness MANAGER is org-scoped to sub-tree subjects (I18)", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_readiness_scores WHERE readiness_score_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/readiness?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  // ── critical positions / coverage: catalog (tenant-only, no org gate) ───────

  it("critical-positions catalog: PLATFORM_ADMIN total == whole live table", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_critical_positions`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/critical-positions?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
  });

  it("critical-coverage catalog: PLATFORM_ADMIN all; TENANT_ADMIN own-tenant (live-derived)", async () => {
    const liveAll = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_critical_role_coverage_status`);
    const liveRtl = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_critical_role_coverage_status WHERE critical_role_coverage_status_tenant_id = $1`,
      [rtlTenantId]);
    const rA = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/critical-coverage?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rF = await suite.app.inject({
      method: "GET", url: "/v1/talent-review/critical-coverage?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(rA.statusCode).toBe(200);
    expect((rA.json() as { total: number }).total).toBe(liveAll);
    expect(rF.statusCode).toBe(200);
    expect((rF.json() as { total: number }).total).toBe(liveRtl);
  });
});
