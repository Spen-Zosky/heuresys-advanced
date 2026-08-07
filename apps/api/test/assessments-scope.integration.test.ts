/**
 * apps/api/test/assessments-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the ASSESSMENTS module (ADR-0027, closes D-50).
 *
 * Assessment is EVALUATION-class SENSITIVE per-person data (assessment_subject_user_id).
 * Today the module gates reads by ROLE + TENANT only (service.ts `visible()` + repository
 * `listAssessments` filtering solely on assessment_tenant_id), so ANY holder of
 * `assessment:read` can read ANOTHER user's sensitive assessment tenant-wide, regardless of
 * their org-chart position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST     → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                `assessment_subject_user_id = ANY($n::uuid[])`.
 *   - GET-by-id→ canReadOrgTarget(pool, actor, target.subjectUserId, target.tenantId),
 *                NotFoundError (404, not 403) when false to avoid existence enumeration.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts (Enzo's rule) — every user id is taken
 * from the live login response and every fixture id is created here and cleaned up.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships:
 *   - paolo.caputo@rtl-bank.org      MANAGER      → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org     USER         → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org    USER         → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN→ HR-mandated, tenant-wide (I20)
 *   - enzo.spenuso@heuresys.com             PLATFORM_ADMIN→ cross-tenant (sanity)
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
const SUITE_PREFIX = `IT_ASCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** Create a deterministic assessment row for `subjectUserId` in that user's own tenant. */
async function seedAssessment(subjectUserId: string): Promise<string> {
  const res = await pool.query<{ assessment_id: string }>(
    `INSERT INTO sys.sys_assessments (
        assessment_tenant_id, assessment_subject_user_id,
        assessment_kind, assessment_status, assessment_metadata, created_by
      )
      SELECT u.user_tenant_id, u.user_id, 'SELF', 'OPEN', $2::jsonb, u.user_id
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING assessment_id`,
    [subjectUserId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.assessment_id;
}

interface Listed {
  items: Array<{ assessmentId: string; subjectUserId: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoAssessmentId: string; // subject = tommaso (report)     → paolo MAY read
let antonioAssessmentId: string; // subject = antonio (outsider)   → paolo MUST NOT read

describe("/v1/assessments — F3 org-axis isolation (ADR-0027, D-50)", () => {
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
    admin = await login(suite, "enzo.spenuso@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    tommasoAssessmentId = await seedAssessment(tommaso.userId);
    antonioAssessmentId = await seedAssessment(antonio.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_assessments WHERE assessment_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's assessment via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments/${tommasoAssessmentId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { subjectUserId: string }).subjectUserId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso → tommaso's row is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments?subjectUserId=${tommaso.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.assessmentId === tommasoAssessmentId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's assessment via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments/${antonioAssessmentId}`,
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
      url: `/v1/assessments?subjectUserId=${antonio.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface,
    // regardless of counts. Pre-fix (tenant-only filter) antonio's rows leak through;
    // post-fix (userIdAllowList = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.subjectUserId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.assessmentId === antonioAssessmentId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — assessment:read denied → 403", async () => {
    // In this module USER holds no assessment:read at all: the strongest self-floor —
    // a plain user can enumerate NO other user's assessments (not even a scoped list).
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/assessments",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's assessment tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments/${antonioAssessmentId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments?subjectUserId=${antonio.userId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.assessmentId === antonioAssessmentId)).toBe(
      true,
    );
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's assessment cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/assessments/${antonioAssessmentId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
