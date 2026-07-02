/**
 * apps/api/test/successor-candidates-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the SUCCESSOR-CANDIDATES module (ADR-0027, D-50
 * sibling-coverage: the S1013 batch gated successor-readiness but left its parent
 * candidate resource tenant-only).
 *
 * A successor candidate is EVALUATION-class SENSITIVE per-person data (readiness level,
 * pool membership of `successor_candidate_user_id`). Today the module gates reads by
 * ROLE + TENANT only (`visible()` + `listCandidates` filtering solely on tenant id), so
 * ANY holder of `career_succession:read` can read ANOTHER user's succession standing
 * tenant-wide — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                 `successor_candidate_user_id = ANY($n::uuid[])`.
 *   - GET-by-id → canReadOrgTarget(pool, actor, target.userId, target.tenantId),
 *                 NotFoundError (404, not 403) when false to avoid existence enumeration.
 *   - /readiness-distribution stays TENANT-wide: counts only, no per-person data
 *     (aggregates doctrine, F3 capability precedent) — asserted as a 200 sanity below.
 *
 * Writes (create/update/delete) need no org gate: `career_succession:create/update` are
 * held only by HR-mandated / platform roles, which pass the org axis by mandate.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider rows absent / outsider
 * get-by-id blocked), never hardcoded data counts — every user id is taken from the live
 * login response and every fixture id is created here and cleaned up.
 *
 * Real RTL personas (password Admin#PassW0rd!) + their real org relationships:
 *   - paolo.caputo@rtl-bank.org       MANAGER      → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER         → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER         → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN → HR-mandated, tenant-wide (I20)
 *   - admin@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SCSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** One succession pool on `anchorUserId`'s real ACTIVE position (any same-tenant position
 *  works — candidate gating is by the CANDIDATE user, not the pool's position). */
async function seedPool(anchorUserId: string): Promise<string> {
  const res = await pool.query<{ succession_pool_id: string }>(
    `INSERT INTO sys.sys_succession_pools (
        succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
        succession_pool_name, succession_pool_status, succession_pool_metadata, created_by
      )
      SELECT u.user_tenant_id, upa.user_position_assignment_position_id,
             $2, $3, 'ACTIVE', $4::jsonb, u.user_id
        FROM sys.sys_users u
        JOIN sys.sys_user_position_assignments upa
          ON upa.user_position_assignment_user_id = u.user_id
         AND upa.user_position_assignment_status = 'ACTIVE'
       WHERE u.user_id = $1
       LIMIT 1
      RETURNING succession_pool_id`,
    [
      anchorUserId,
      `${SUITE_PREFIX}_POOL`,
      `${SUITE_PREFIX} scope-suite pool`,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.succession_pool_id;
}

/** Add `userId` as a candidate of `poolId` (tenant inherited from the user). */
async function seedCandidate(poolId: string, userId: string): Promise<string> {
  const res = await pool.query<{ successor_candidate_id: string }>(
    `INSERT INTO sys.sys_successor_candidates (
        successor_candidate_pool_id, successor_candidate_tenant_id,
        successor_candidate_user_id, successor_candidate_status,
        successor_candidate_readiness_level, successor_candidate_metadata
      )
      SELECT $1, u.user_tenant_id, u.user_id, 'CANDIDATE', 'READY_NOW', $3::jsonb
        FROM sys.sys_users u WHERE u.user_id = $2
      RETURNING successor_candidate_id`,
    [poolId, userId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.successor_candidate_id;
}

interface Listed {
  items: Array<{ successorCandidateId: string; userId: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoCandidateId: string; // candidate = tommaso (report)   → paolo MAY read
let antonioCandidateId: string; // candidate = antonio (outsider) → paolo MUST NOT read

describe("/v1/successor-candidates — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
    antonio = await login(suite, "antonio.parisi@rtl-bank.org");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "admin@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    const poolId = await seedPool(tommaso.userId);
    tommasoCandidateId = await seedCandidate(poolId, tommaso.userId);
    antonioCandidateId = await seedCandidate(poolId, antonio.userId);
  });

  afterAll(async () => {
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

  it("paolo (MANAGER) CAN read his report tommaso's candidacy via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates/${tommasoCandidateId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { userId: string }).userId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST filtered to his report tommaso → tommaso's row is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates?userId=${tommaso.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.successorCandidateId === tommasoCandidateId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's candidacy via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates/${antonioCandidateId}`,
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
      url: `/v1/successor-candidates?userId=${antonio.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface.
    // Pre-fix (tenant-only filter) antonio's rows leak through; post-fix (userIdAllowList
    // = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.successorCandidateId === antonioCandidateId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — career_succession:read denied → 403", async () => {
    // USER holds only career_succession:read:self (ESS /me/*), not :read — the strongest
    // self-floor: a plain user can enumerate NO other user's succession standing here.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/successor-candidates",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Aggregate stays tenant-wide (counts only) ===================== */

  it("paolo (MANAGER) readiness-distribution stays reachable → 200 (counts only, no per-person data)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/successor-candidates/readiness-distribution",
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ readinessLevel: string; count: number }> };
    // Aggregates doctrine (F3): grouped counts expose no per-person field.
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual(["count", "readinessLevel"]);
    }
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's candidacy tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates/${antonioCandidateId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates?userId=${antonio.userId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect(
      (list.json() as Listed).items.some((i) => i.successorCandidateId === antonioCandidateId),
    ).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's candidacy cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/successor-candidates/${antonioCandidateId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
