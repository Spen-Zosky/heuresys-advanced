/**
 * apps/api/test/time-off.integration.test.ts — A/L8 (#33).
 *
 * READ-only API over three dormant leave tables. Leave = PERSONAL, org-gated
 * (ADR-0027 F3): PLATFORM_ADMIN → all; TENANT_ADMIN (HR mandate) → whole tenant;
 * MANAGER → transitive org sub-tree; USER → self only (ESS). Accrual rules are
 * tenant policy (no org gate). All expectations derive from the LIVE DB.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { orgSubtreeUserIds } from "../src/lib/scope/org.js";

const PWD = TEST_PERSONA_PASSWORD;

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

describe("#33 A/L8 time-off / leave read", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite, "enzo.spenuso@heuresys.com");
    federica = await login(suite, "federica.marchetti@rtl-bank.org"); // TENANT_ADMIN (HR mandate)
    paolo = await login(suite, "paolo.caputo@rtl-bank.org"); // MANAGER
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER (paolo's report)
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

  // ── requests: org axis ──────────────────────────────────────────────────────

  it("PLATFORM_ADMIN requests total == whole live table + pagination honored", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_time_off_requests`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/requests?limit=1", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(body.total).toBe(live);
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.length).toBe(1);
  });

  it("TENANT_ADMIN (HR mandate) requests total == own-tenant count (live-derived)", async () => {
    const live = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_time_off_requests WHERE request_tenant_id = $1`,
      [rtlTenantId]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/requests?limit=1", headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { total: number }).total).toBe(live);
  });

  it("MANAGER requests are scoped to the transitive org sub-tree (I18)", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_time_off_requests WHERE request_subject_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/requests?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { subjectUserId: string }[]; total: number };
    expect(body.total).toBe(expected);
    // every returned subject must be inside the manager's sub-tree — no peer leak (I19)
    expect(body.items.every((i) => paoloSubtree.includes(i.subjectUserId))).toBe(true);
  });

  it("USER without leave:read → 403 on the admin requests list", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/requests", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });

  // ── accrual rules: tenant policy (no org gate) ──────────────────────────────

  it("accrual-rules: PLATFORM_ADMIN sees all; TENANT_ADMIN sees own-tenant", async () => {
    const liveAll = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_leave_accrual_rules`);
    const liveRtl = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_leave_accrual_rules WHERE accrual_rule_tenant_id = $1`,
      [rtlTenantId]);
    const rA = await suite.app.inject({
      method: "GET", url: "/v1/time-off/accrual-rules?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    const rF = await suite.app.inject({
      method: "GET", url: "/v1/time-off/accrual-rules?limit=200", headers: { cookie: ch(federica.cookies) },
    });
    expect(rA.statusCode).toBe(200);
    expect((rA.json() as { total: number }).total).toBe(liveAll);
    expect((rF.json() as { total: number }).total).toBe(liveRtl);
  });

  // ── balance transactions: org axis via the balance's subject user ───────────

  it("balance-transactions: PLATFORM_ADMIN total == whole live table; subjectUserId resolved", async () => {
    const live = await liveCount(`SELECT count(*)::text AS n FROM sys.sys_leave_balance_transactions`);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/balance-transactions?limit=200", headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { subjectUserId: string | null }[]; total: number };
    expect(body.total).toBe(live);
  });

  it("balance-transactions: MANAGER is org-scoped to sub-tree subjects", async () => {
    const expected = await liveCount(
      `SELECT count(*)::text AS n
         FROM sys.sys_leave_balance_transactions t
         JOIN sys.sys_time_off_balances b ON b.balance_id = t.transaction_balance_id
        WHERE b.balance_subject_user_id = ANY($1::uuid[])`,
      [paoloSubtree]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/time-off/balance-transactions?limit=200", headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { subjectUserId: string | null }[]; total: number };
    expect(body.total).toBe(expected);
    expect(body.items.every((i) => i.subjectUserId !== null && paoloSubtree.includes(i.subjectUserId))).toBe(true);
  });

  // ── ESS self view (I17) ─────────────────────────────────────────────────────

  it("ESS: USER reads OWN requests via /v1/me/time-off/requests (== own live count)", async () => {
    const own = await liveCount(
      `SELECT count(*)::text AS n FROM sys.sys_time_off_requests WHERE request_subject_user_id = $1`,
      [await userId("tommaso.fiore@rtl-bank.org")]);
    const r = await suite.app.inject({
      method: "GET", url: "/v1/me/time-off/requests", headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { subjectUserId: string }[]; total: number };
    expect(body.total).toBe(own);
    // never anyone else's rows
    const me = await userId("tommaso.fiore@rtl-bank.org");
    expect(body.items.every((i) => i.subjectUserId === me)).toBe(true);
  });
});
