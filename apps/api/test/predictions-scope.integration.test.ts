/**
 * apps/api/test/predictions-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the PREDICTIONS module (resource `predictions`,
 * ADR-0027, closes D-50).
 *
 * A PredictionsML row is EVALUATION-class SENSITIVE per-person data (prediction_subject_user_id
 * — the subject of an ML flight-risk/performance/turnover score). Today the module gates reads
 * by ROLE + TENANT only: service.ts `assertVisible()` checks tenant match, and repository
 * `listPredictions` filters solely on prediction_tenant_id (+ the optional subjectUserId query
 * param the *caller* supplies). So ANY holder of `predictions:read` can read ANOTHER user's
 * predictions tenant-wide, regardless of their org-chart position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                 `prediction_subject_user_id = ANY($n::uuid[])`
 *                 (empty allow-list ⇒ empty result).
 *   - GET-by-id → canReadOrgTarget(pool, actor, p.subjectUserId, p.tenantId),
 *                 NotFoundError (404, not 403) when false to avoid existence enumeration.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts (Enzo's rule) — every user id is taken
 * from the live login response and every prediction row asserted is a fixture created +
 * cleaned up here (real RTL predictions already exist for these subjects; the fixtures give
 * the suite deterministic, self-contained ids to assert on).
 *
 * Real RTL personas (password Admin#PassW0rd!) + their real org relationships (the same
 * reports-to chain the sibling F3 suites verify — paolo's transitive sub-tree contains
 * tommaso and NOT antonio):
 *   - paolo.caputo@rtl-bank.org       MANAGER       → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER          → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER          → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN  → HR-mandated, tenant-wide (I20)
 *   - admin@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `predictions:read` is held by BLUEPRINT_MANAGER / HRMS_MANAGER / MANAGER / PLATFORM_ADMIN /
 * PROCESS_OWNER / TENANT_ADMIN. A plain USER (tommaso/antonio) has NO predictions:read at all —
 * the strongest possible self-floor: no cross-user read surface exists for them (asserted as a
 * 403 below).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_PREDSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  userId: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string } };
  return { cookies, userId: body.user.userId };
}

/** Create a deterministic prediction row whose subject is `subjectUserId`, in that user's own
 *  tenant. Unique natural_key (per the (tenant, natural_key) unique index) + suitePrefix in
 *  metadata for idempotent cleanup. */
async function seedPrediction(subjectUserId: string): Promise<string> {
  const res = await pool.query<{ prediction_id: string }>(
    `INSERT INTO sys.sys_model_predictions (
        prediction_tenant_id, prediction_subject_user_id,
        prediction_natural_key, prediction_type, prediction_metadata
      )
      SELECT u.user_tenant_id, u.user_id, $2, 'GENERIC', $3::jsonb
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING prediction_id`,
    [subjectUserId, `${SUITE_PREFIX}-${randomUUID()}`, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.prediction_id;
}

interface Listed {
  items: Array<{ predictionId: string; subjectUserId: string | null }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoPredictionId: string; // subject = tommaso (report)   → paolo MAY read
let antonioPredictionId: string; // subject = antonio (outsider) → paolo MUST NOT read

describe("/v1/predictions — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
    antonio = await login(suite, "antonio.parisi@rtl-bank.org");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "admin@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    tommasoPredictionId = await seedPrediction(tommaso.userId);
    antonioPredictionId = await seedPrediction(antonio.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_model_predictions WHERE prediction_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's prediction via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions/${tommasoPredictionId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { subjectUserId: string }).subjectUserId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso → tommaso's row is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions?subjectUserId=${tommaso.userId}&limit=500`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.predictionId === tommasoPredictionId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's prediction via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions/${antonioPredictionId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): assertVisible passes on same-tenant → 200. Post-fix: canReadOrgTarget
    // false → NotFoundError. 404 hides existence across the org boundary.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's rows MUST NOT appear in paolo's (MANAGER) LIST response", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions?subjectUserId=${antonio.userId}&limit=500`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface,
    // regardless of counts. Pre-fix (tenant-only filter) antonio's rows leak through;
    // post-fix (userIdAllowList = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.subjectUserId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.predictionId === antonioPredictionId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — predictions:read denied → 403", async () => {
    // In this module USER holds no predictions:read at all: the strongest self-floor —
    // a plain user can enumerate NO other user's predictions (not even a scoped list).
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/predictions",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's prediction tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions/${antonioPredictionId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions?subjectUserId=${antonio.userId}&limit=500`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.predictionId === antonioPredictionId)).toBe(
      true,
    );
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's prediction cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/predictions/${antonioPredictionId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
