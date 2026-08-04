/**
 * apps/api/test/assessment-results-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the ASSESSMENT-RESULTS module (ADR-0027, D-50
 * sibling-coverage: the S1013 batch gated `assessments` but left its child resource
 * tenant-only).
 *
 * An assessment RESULT is EVALUATION-class SENSITIVE per-person data: its subject is the
 * PARENT assessment's `assessment_subject_user_id`. Today the module gates reads by
 * ROLE + TENANT only (`visible()` + `listResults` filtering solely on tenant id), so ANY
 * holder of `assessment:read` can read ANOTHER user's scoring rows tenant-wide — the same
 * D-50 cross-user leak the parent module had.
 *
 * The uniform fix (replicated from successor-readiness, which gates via its parent
 * candidate):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters via
 *                 EXISTS on the parent assessment's subject user.
 *   - GET-by-id → canReadOrgTarget(pool, actor, parent.subjectUserId, target.tenantId),
 *                 NotFoundError (404, not 403) when false to avoid existence enumeration.
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
 *   - admin@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `assessment:read` is held by CEO / HRMS_MANAGER / MANAGER / PLATFORM_ADMIN / TENANT_ADMIN.
 * A plain USER (tommaso/antonio) has NO assessment:read at all — the strongest possible
 * self-floor: no cross-user read surface exists for them (asserted as a 403 below).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { idDi, unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_ARSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** Create a parent assessment for `subjectUserId` plus one attached result row. */
async function seedResult(
  subjectUserId: string,
): Promise<{ assessmentId: string; resultId: string }> {
  const a = await pool.query<{ assessment_id: string; assessment_tenant_id: string }>(
    `INSERT INTO sys.sys_assessments (
        assessment_tenant_id, assessment_subject_user_id,
        assessment_kind, assessment_status, assessment_metadata, created_by
      )
      SELECT u.user_tenant_id, u.user_id, 'SELF', 'OPEN', $2::jsonb, u.user_id
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING assessment_id, assessment_tenant_id`,
    [subjectUserId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  const parent = a.rows[0]!;
  const r = await pool.query<{ assessment_result_id: string }>(
    `INSERT INTO sys.sys_assessment_results (
        assessment_result_assessment_id, assessment_result_tenant_id,
        assessment_result_dimension, assessment_result_score, assessment_result_metadata
      ) VALUES ($1, $2, 'OVERALL', 3.5, $3::jsonb)
      RETURNING assessment_result_id`,
    [parent.assessment_id, parent.assessment_tenant_id, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return { assessmentId: parent.assessment_id, resultId: r.rows[0]!.assessment_result_id };
}

interface Listed {
  items: Array<{ assessmentResultId: string; assessmentId: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoFx: { assessmentId: string; resultId: string }; // subject = tommaso → paolo MAY read
let antonioFx: { assessmentId: string; resultId: string }; // subject = antonio → paolo MUST NOT read

describe("/v1/assessment-results — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    // [S1043] Il sottoposto e l'estraneo si derivano dall'albero delle UNITA', non
    // dai due indirizzi che stavano qui: la ricostruzione dell'organigramma ha
    // invertito quei ruoli (tommaso.fiore dirige oggi un'altra filiale, antonio.parisi
    // e' finito dentro la divisione di paolo). Vedi helpers/org-actors.ts.
    const paoloId = await idDi(pool, "paolo.caputo@rtl-bank.org");
    const sottoposto = await unSottopostoOrganizzativo(pool, paoloId);
    const estraneo = await unEstraneoOrganizzativo(pool, paoloId);
    tommaso = await login(suite, sottoposto.email);
    antonio = await login(suite, estraneo.email);
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "admin@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    tommasoFx = await seedResult(tommaso.userId);
    antonioFx = await seedResult(antonio.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_assessment_results WHERE assessment_result_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_assessments WHERE assessment_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's result via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results/${tommasoFx.resultId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { assessmentId: string }).assessmentId).toBe(tommasoFx.assessmentId);
  });

  it("paolo (MANAGER) LIST filtered to tommaso's assessment → tommaso's result is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results?assessmentId=${tommasoFx.assessmentId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.assessmentResultId === tommasoFx.resultId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's result via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results/${antonioFx.resultId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): visible() passes on same-tenant → 200. Post-fix: canReadOrgTarget
    // on the PARENT assessment's subject is false → NotFoundError. 404 hides existence.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's results MUST NOT appear in paolo's (MANAGER) LIST response", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results?assessmentId=${antonioFx.assessmentId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row attached to the outsider's assessment may
    // surface. Pre-fix (tenant-only filter) antonio's rows leak through; post-fix
    // (EXISTS on parent subject ∈ paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.assessmentResultId === antonioFx.resultId)).toBe(false);
    expect(body.items.some((i) => i.assessmentId === antonioFx.assessmentId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — assessment:read denied → 403", async () => {
    // In this module USER holds no assessment:read at all: the strongest self-floor —
    // a plain user can enumerate NO other user's assessment results.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/assessment-results",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's result tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results/${antonioFx.resultId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results?assessmentId=${antonioFx.assessmentId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect(
      (list.json() as Listed).items.some((i) => i.assessmentResultId === antonioFx.resultId),
    ).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's result cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessment-results/${antonioFx.resultId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
