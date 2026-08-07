/**
 * apps/api/test/user-career-plans-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the USER-CAREER-PLANS module (ADR-0027, D-50
 * sibling-coverage: the S1013 batch gated successor-readiness but left the career-plan
 * resource tenant-only).
 *
 * A user career plan is EVALUATION-class SENSITIVE per-person data (career trajectory,
 * target position, horizon of `user_career_plan_user_id`). Today the module gates reads
 * by ROLE + TENANT only (`visible()` + `listPlans` filtering solely on tenant id), so
 * ANY holder of `career_succession:read` can read ANOTHER user's career planning
 * tenant-wide — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                 `user_career_plan_user_id = ANY($n::uuid[])`.
 *   - GET-by-id → canReadOrgTarget(pool, actor, target.userId, target.tenantId),
 *                 NotFoundError (404, not 403) when false to avoid existence enumeration.
 *
 * Writes need no org gate: `career_succession:create/update` are held only by
 * HR-mandated / platform roles, which pass the org axis by mandate.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts — every user id is taken from the live
 * login response and every fixture id is created here and cleaned up.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships:
 *   - paolo.caputo@rtl-bank.org       MANAGER      → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER         → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER         → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN → HR-mandated, tenant-wide (I20)
 *   - enzo.spenuso@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_UCPSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

/** Create a deterministic career plan for `userId` in that user's own tenant. */
async function seedPlan(userId: string): Promise<string> {
  const res = await pool.query<{ user_career_plan_id: string }>(
    `INSERT INTO sys.sys_user_career_plans (
        user_career_plan_tenant_id, user_career_plan_user_id,
        user_career_plan_status, user_career_plan_metadata, created_by
      )
      SELECT u.user_tenant_id, u.user_id, 'ACTIVE', $2::jsonb, u.user_id
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING user_career_plan_id`,
    [userId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.user_career_plan_id;
}

interface Listed {
  items: Array<{ userCareerPlanId: string; userId: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoPlanId: string; // subject = tommaso (report)   → paolo MAY read
let antonioPlanId: string; // subject = antonio (outsider) → paolo MUST NOT read

describe("/v1/user-career-plans — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    // [S1045] Il sottoposto e l'estraneo non sono piu' due nomi scritti a mano:
    // li sceglie l'albero delle unita' di oggi (helpers/org-actors.ts). La
    // ricostruzione aveva INVERTITO i due ruoli, e i nomi fissi descrivevano
    // l'azienda di ieri.
    const sottoposto = await unSottopostoOrganizzativo(pool, paolo.userId);
    const estraneo = await unEstraneoOrganizzativo(pool, paolo.userId);
    tommaso = await login(suite, sottoposto.email);
    antonio = await login(suite, estraneo.email);
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "enzo.spenuso@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    tommasoPlanId = await seedPlan(tommaso.userId);
    antonioPlanId = await seedPlan(antonio.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_user_career_plans WHERE user_career_plan_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's career plan via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans/${tommasoPlanId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { userId: string }).userId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso → tommaso's row is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans?userId=${tommaso.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.userCareerPlanId === tommasoPlanId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's career plan via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans/${antonioPlanId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): visible() passes on same-tenant → 200. Post-fix: canReadOrgTarget
    // false → NotFoundError. 404 hides existence across the org boundary.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's rows MUST NOT appear in paolo's (MANAGER) LIST response", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans?userId=${antonio.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface.
    // Pre-fix (tenant-only filter) antonio's rows leak through; post-fix (userIdAllowList
    // = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.userCareerPlanId === antonioPlanId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — career_succession:read denied → 403", async () => {
    // USER holds only career_succession:read:self (ESS /me/*), not :read — the strongest
    // self-floor: a plain user can enumerate NO other user's career plans here.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/user-career-plans",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's career plan tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans/${antonioPlanId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans?userId=${antonio.userId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.userCareerPlanId === antonioPlanId)).toBe(
      true,
    );
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's career plan cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/user-career-plans/${antonioPlanId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
