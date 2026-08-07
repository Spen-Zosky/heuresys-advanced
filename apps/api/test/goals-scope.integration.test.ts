/**
 * apps/api/test/goals-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the GOALS module (resource `goal`, ADR-0027,
 * closes D-50).
 *
 * A goal is EVALUATION-class SENSITIVE per-person data (goal_subject_user_id). Today the
 * module gates reads by ROLE + TENANT only: service.ts `assertVisible()` checks tenant match,
 * and repository `listGoals` filters solely on goal_tenant_id (+ the optional subjectUserId
 * query param the *caller* supplies). So ANY holder of `goal:read` can read ANOTHER user's
 * goals tenant-wide, regardless of their org-chart position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                 `(goal_subject_user_id = ANY($n::uuid[]) OR goal_subject_user_id IS NULL)`
 *                 (empty allow-list ⇒ empty result; NULL-subject org goals stay tenant-visible).
 *   - GET-by-id → canReadOrgTarget(pool, actor, g.subjectUserId, g.tenantId),
 *   (+ update/    NotFoundError (404, not 403) when false to avoid existence enumeration.
 *      delete)
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts (Enzo's rule) — every user id is taken
 * from the live login response and every subject row is a fixture created + cleaned up here.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships (verified live
 * against the reports-to chain in sys.sys_positions / sys.sys_user_position_assignments —
 * paolo's transitive sub-tree contains tommaso and NOT antonio):
 *   - paolo.caputo@rtl-bank.org       MANAGER       → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER          → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER          → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN  → HR-mandated, tenant-wide (I20)
 *   - enzo.spenuso@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `goal:read` is held by BLUEPRINT_MANAGER / HRMS_MANAGER / MANAGER / PLATFORM_ADMIN /
 * PROCESS_OWNER / TENANT_ADMIN. A plain USER (tommaso/antonio) has NO goal:read at all — the
 * strongest possible self-floor: no cross-user read surface exists for them (asserted as a 403).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_GOALSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/**
 * Create a deterministic goal row whose subject is `subjectUserId`, in that user's own tenant.
 * natural_key is unique per (tenant, key); the suitePrefix in metadata drives idempotent cleanup.
 */
async function seedGoal(subjectUserId: string): Promise<string> {
  const res = await pool.query<{ goal_id: string }>(
    `INSERT INTO sys.sys_goals (
        goal_tenant_id, goal_natural_key, goal_subject_user_id,
        goal_title, goal_type, goal_priority, goal_status, goal_metadata
      )
      SELECT u.user_tenant_id, $2, u.user_id, $3, 'OBJECTIVE', 'HIGH', 'IN_PROGRESS', $4::jsonb
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING goal_id`,
    [
      subjectUserId,
      `${SUITE_PREFIX}::${subjectUserId}`,
      `${SUITE_PREFIX} goal`,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.goal_id;
}

interface Listed {
  items: Array<{ goalId: string; subjectUserId: string | null }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoGoalId: string; // subject = tommaso (report)   → paolo MAY read
let antonioGoalId: string; // subject = antonio (outsider) → paolo MUST NOT read

describe("/v1/goals — F3 org-axis isolation (ADR-0027, D-50)", () => {
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
    tommasoGoalId = await seedGoal(tommaso.userId);
    antonioGoalId = await seedGoal(antonio.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_goals WHERE goal_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's goal via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals/${tommasoGoalId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { subjectUserId: string | null }).subjectUserId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso → tommaso's row is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals?subjectUserId=${tommaso.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.goalId === tommasoGoalId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's goal via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals/${antonioGoalId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): assertVisible() passes on same-tenant → 200. Post-fix: canReadOrgTarget
    // false → NotFoundError. 404 hides existence across the org boundary.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's rows MUST NOT appear in paolo's (MANAGER) filtered LIST", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals?subjectUserId=${antonio.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface,
    // regardless of counts. Pre-fix (tenant-only filter) antonio's rows leak through;
    // post-fix (userIdAllowList = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.subjectUserId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.goalId === antonioGoalId)).toBe(false);
  });

  it("LEAK: OUTSIDER antonio's goal MUST NOT appear in paolo's (MANAGER) UNFILTERED LIST", async () => {
    // Belt-and-suspenders: even with no subjectUserId query filter, the fresh antonio fixture
    // (created_at = now(), so it sorts to the first page of a limit=200 DESC read) must be
    // absent from a manager's list. Pre-fix it leaks in via the tenant-only filter; post-fix
    // the userIdAllowList excludes the outsider entirely.
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.goalId === antonioGoalId)).toBe(false);
    expect(body.items.some((i) => i.subjectUserId === antonio.userId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — goal:read denied → 403", async () => {
    // In this module USER holds no goal:read at all: the strongest self-floor — a plain user
    // can enumerate NO other user's goals (not even a scoped list).
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/goals",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's goal tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/goals/${antonioGoalId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/goals?subjectUserId=${antonio.userId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.goalId === antonioGoalId)).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's goal cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/goals/${antonioGoalId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
