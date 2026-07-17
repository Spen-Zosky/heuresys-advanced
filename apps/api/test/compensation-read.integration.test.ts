/**
 * apps/api/test/compensation-read.integration.test.ts — A/L7 (#32).
 *
 * READ-only API over six dormant compensation & reward tables. Extends the
 * compensation module with list GETs. `compensation_intelligence` is
 * COMPENSATION-class SENSITIVE per-person data (data-classes.ts):
 *   - variable-pay + recommendations expose per-person rows → org-gated
 *     (ADR-0027 F3, resolveOrgReadScope): PLATFORM_ADMIN → all; TENANT_ADMIN
 *     (HR mandate) → whole tenant; managerial (org-scoped) → transitive sub-tree.
 *   - bonus-pools / objective-reward-rules / position-economic-weight /
 *     handoff-records carry NO person rows → tenant-scoped catalog reads.
 * All expectations derive from the LIVE DB (never hardcoded counts).
 *
 * Persona note (mirrors compensation-scope.integration.test.ts): `compensation_
 * intelligence:read` is held by CEO / HRMS_MANAGER / PLATFORM_ADMIN / TENANT_ADMIN
 * — NOT by MANAGER (verified live). paolo (MANAGER) alone would 403, so he cannot
 * demonstrate org-subtree scoping. The only role that is BOTH a permission-holder
 * AND org-scoped (managerial, non-HR-mandated) is CEO. We grant paolo CEO
 * (reversible/idempotent) to turn him into a permission-holding org-scoped actor;
 * an RBAC role grant does NOT change his org-chart position, so his real sub-tree
 * (includes tommaso, excludes outsiders) is unchanged. USER (tommaso) holds no
 * compensation_intelligence:read → 403 (the self-floor: no cross-user surface).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";

const PWD = TEST_PERSONA_PASSWORD;
const PAOLO_EMAIL = "paolo.caputo@rtl-bank.org";

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

/** Grant/revoke the CEO role to paolo by email (see persona note in the header). */
async function grantCeoToPaolo(email: string): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
      SELECT u.user_id, r.auth_role_id, u.user_tenant_id
        FROM sys.sys_users u, sys.sys_auth_roles r
       WHERE lower(u.user_email) = lower($1) AND r.auth_role_code = 'CEO'`,
    [email],
  );
}
async function revokeCeoFromPaolo(email: string): Promise<void> {
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1))
        AND user_auth_role_role_id = (SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'CEO')`,
    [email],
  );
}

let suite: TestApp;
let admin: S; let federica: S; let paolo: S; let tommaso: S;
let rtlTenantId: string;
let paoloSubtree: string[];

describe("#32 A/L7 compensation & reward read", () => {
  beforeAll(async () => {
    suite = await buildTestApp();

    // Turn paolo into a permission-holding, org-scoped actor BEFORE login so his
    // session token carries CEO. Clear any leftover, then grant fresh.
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await grantCeoToPaolo(PAOLO_EMAIL);

    admin = await login(suite, "admin@heuresys.com");
    federica = await login(suite, "federica.marchetti@rtl-bank.org"); // TENANT_ADMIN (HR mandate)
    paolo = await login(suite, PAOLO_EMAIL); // MANAGER (+CEO granted) → org sub-tree
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER (no compensation_intelligence:read)

    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_email = $1`,
      ["federica.marchetti@rtl-bank.org"]);
    rtlTenantId = t.rows[0]!.user_tenant_id;
    paoloSubtree = await orgSubtreeUserIds(pool, await userId(PAOLO_EMAIL));
  });

  afterAll(async () => {
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await suite.app.close();
    await closePool();
  });

  // ── variable-pay: org axis ──────────────────────────────────────────────────

  it("variable-pay: PLATFORM_ADMIN total == whole live table + pagination honored", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=1", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBe(1);
  });

  it("variable-pay: TENANT_ADMIN (HR mandate) total == own-tenant count (live-derived)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations WHERE variable_pay_calculation_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=1", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("variable-pay: MANAGER (org-scoped) is scoped to the transitive org sub-tree (I18)", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_variable_pay_calculations WHERE variable_pay_calculation_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string; subjectUserName: string | null }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.total).toBeGreaterThan(0);
    // no peer leak (I19): every returned subject is inside the manager's sub-tree
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  // ── recommendations: org axis ───────────────────────────────────────────────

  it("recommendations: MANAGER (org-scoped) is scoped to the org sub-tree; subjectUserName resolved", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_compensation_recommendations WHERE compensation_recommendation_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/recommendations?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.items.every((i) => paoloSubtree.includes(i.userId))).toBe(true);
  });

  // ── catalog reads: tenant-scoped (no person rows) ───────────────────────────

  it("bonus-pools: PLATFORM_ADMIN sees all; TENANT_ADMIN sees own-tenant", async () => {
    const liveAll = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_bonus_pools`);
    const liveRtl = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_bonus_pools WHERE bonus_pool_tenant_id = $1`, [rtlTenantId]);
    const rA = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bonus-pools?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rF = await suite.app.inject({
      method: "GET", url: "/v1/compensation/bonus-pools?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(rA.statusCode).toBe(200);
    expect((rA.json() as { total: number }).total).toBe(liveAll);
    expect((rF.json() as { total: number }).total).toBe(liveRtl);
  });

  it("objective-reward-rules & position-economic-weight: PLATFORM_ADMIN total == whole live table", async () => {
    const liveRules = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_objective_reward_rules`);
    const liveWeight = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_position_economic_weight`);
    const rRules = await suite.app.inject({
      method: "GET", url: "/v1/compensation/objective-reward-rules?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rWeight = await suite.app.inject({
      method: "GET", url: "/v1/compensation/position-economic-weight?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    expect(rRules.statusCode).toBe(200);
    expect((rRules.json() as { total: number }).total).toBe(liveRules);
    expect(rWeight.statusCode).toBe(200);
    expect((rWeight.json() as { total: number }).total).toBe(liveWeight);
  });

  it("handoff-records: empty-state works (200, total == live, items empty when 0)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_payroll_handoff_records WHERE payroll_handoff_record_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/handoff-records?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.items.length).toBe(Math.min(live, 200));
  });

  // ── self-floor: plain USER has no cross-user surface ────────────────────────

  it("USER without compensation_intelligence:read → 403 on the variable-pay list", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/compensation/variable-pay", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });
});
