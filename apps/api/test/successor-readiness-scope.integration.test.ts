/**
 * apps/api/test/successor-readiness-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the SUCCESSOR-READINESS module
 * (resource `career_succession`, EVALUATION-class SENSITIVE — ADR-0027, closes D-50).
 *
 * A readiness sample's subject person is its PARENT candidate
 * (`sys.sys_successor_candidates.successor_candidate_user_id`); the readiness row itself
 * only carries `candidate_id` + `tenant_id`. Today the module gates reads by ROLE + TENANT
 * only (service.ts `visible()` checks nothing but `tenantId`; repository `listReadiness`
 * filters solely on `successor_readiness_tenant_id`), so ANY holder of
 * `career_succession:read` can read ANOTHER user's succession readiness tenant-wide,
 * regardless of their org-chart position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST     → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters readiness
 *                whose parent candidate's subject user ∈ the allow-list.
 *   - GET-by-id→ resolve the readiness' parent candidate, then
 *                canReadOrgTarget(pool, actor, candidate.userId, target.tenantId);
 *                NotFoundError (404, not 403) when false to avoid existence enumeration.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts (Enzo's rule) — every user id is taken
 * from the live login response and every fixture id is created here and cleaned up.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships:
 *   - paolo.caputo@rtl-bank.org       MANAGER       → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER          → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER          → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN  → HR-mandated, tenant-wide (I20)
 *   - admin@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `career_succession:read` is held by CEO / HRMS_MANAGER / MANAGER / PLATFORM_ADMIN /
 * TENANT_ADMIN. A plain USER (tommaso/antonio) has NO career_succession:read at all — the
 * strongest possible self-floor: no cross-user read surface exists for them (asserted 403).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SRSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** A real RTL position owned by paolo → the pool's required position FK + its tenant. */
async function paoloPosition(paoloUserId: string): Promise<{ positionId: string; tenantId: string }> {
  const res = await pool.query<{ position_id: string; position_tenant_id: string }>(
    `SELECT position_id, position_tenant_id
       FROM sys.sys_positions
      WHERE position_owner_user_id = $1
      LIMIT 1`,
    [paoloUserId],
  );
  const row = res.rows[0];
  if (!row) throw new Error("fixture precondition failed: paolo owns no position");
  return { positionId: row.position_id, tenantId: row.position_tenant_id };
}

/** Deterministic succession pool anchored to `positionId` in `tenantId`. */
async function seedPool(positionId: string, tenantId: string): Promise<string> {
  const res = await pool.query<{ succession_pool_id: string }>(
    `INSERT INTO sys.sys_succession_pools (
        succession_pool_tenant_id, succession_pool_position_id,
        succession_pool_code, succession_pool_name, succession_pool_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING succession_pool_id`,
    [tenantId, positionId, `${SUITE_PREFIX}_POOL`, "F3 scope pool", JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.succession_pool_id;
}

/** Candidate = the subject person of the readiness sample (the org-scope axis). */
async function seedCandidate(poolId: string, tenantId: string, subjectUserId: string): Promise<string> {
  const res = await pool.query<{ successor_candidate_id: string }>(
    `INSERT INTO sys.sys_successor_candidates (
        successor_candidate_pool_id, successor_candidate_tenant_id,
        successor_candidate_user_id, successor_candidate_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING successor_candidate_id`,
    [poolId, tenantId, subjectUserId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.successor_candidate_id;
}

/** One readiness sample for a candidate. */
async function seedReadiness(candidateId: string, tenantId: string): Promise<string> {
  const res = await pool.query<{ successor_readiness_id: string }>(
    `INSERT INTO sys.sys_successor_readiness (
        successor_readiness_candidate_id, successor_readiness_tenant_id,
        successor_readiness_score, successor_readiness_horizon, successor_readiness_payload
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING successor_readiness_id`,
    [candidateId, tenantId, 72.5, "READY_6_MONTHS", JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.successor_readiness_id;
}

interface Listed {
  items: Array<{ successorReadinessId: string; candidateId: string; tenantId: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoCandidateId: string; // subject = tommaso (report)   → paolo MAY read
let antonioCandidateId: string; // subject = antonio (outsider) → paolo MUST NOT read
let tommasoReadinessId: string;
let antonioReadinessId: string;

describe("/v1/successor-readiness — F3 org-axis isolation (ADR-0027, D-50)", () => {
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
    admin = await login(suite, "admin@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    // paolo, tommaso, antonio all live in the same RTL tenant (the pool's position tenant).
    const { positionId, tenantId } = await paoloPosition(paolo.userId);
    const poolId = await seedPool(positionId, tenantId);

    tommasoCandidateId = await seedCandidate(poolId, tenantId, tommaso.userId);
    antonioCandidateId = await seedCandidate(poolId, tenantId, antonio.userId);
    tommasoReadinessId = await seedReadiness(tommasoCandidateId, tenantId);
    antonioReadinessId = await seedReadiness(antonioCandidateId, tenantId);
  });

  afterAll(async () => {
    // Child-first (FK order); ON DELETE CASCADE would also cover it via the pool.
    await pool.query(
      `DELETE FROM sys.sys_successor_readiness WHERE successor_readiness_payload->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_successor_candidates WHERE successor_candidate_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's readiness via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness/${tommasoReadinessId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { candidateId: string }).candidateId).toBe(tommasoCandidateId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso's candidate → tommaso's row present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness?candidateId=${tommasoCandidateId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.successorReadinessId === tommasoReadinessId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's readiness via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness/${antonioReadinessId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): visible() passes on same-tenant → 200. Post-fix: the parent
    // candidate's subject (antonio) fails canReadOrgTarget → NotFoundError. 404 hides
    // existence across the org boundary.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's row MUST NOT appear in paolo's (MANAGER) LIST response", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness?candidateId=${antonioCandidateId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single readiness sample whose parent candidate is
    // the outsider may surface, regardless of counts. Pre-fix (tenant-only filter)
    // antonio's row leaks through; post-fix (userIdAllowList = paolo's sub-tree, which
    // excludes antonio) the set is empty.
    expect(body.items.some((i) => i.successorReadinessId === antonioReadinessId)).toBe(false);
    expect(body.items.some((i) => i.candidateId === antonioCandidateId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — career_succession:read denied → 403", async () => {
    // In this module USER holds no career_succession:read at all: the strongest self-floor —
    // a plain user can enumerate NO other user's readiness (not even a scoped list).
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/successor-readiness",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's readiness tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness/${antonioReadinessId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness?candidateId=${antonioCandidateId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect(
      (list.json() as Listed).items.some((i) => i.successorReadinessId === antonioReadinessId),
    ).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's readiness cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-readiness/${antonioReadinessId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
