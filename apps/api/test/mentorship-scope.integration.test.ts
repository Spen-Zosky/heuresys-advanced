/**
 * apps/api/test/mentorship-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the MENTORSHIP module (resource `mentorship`,
 * ADR-0027, closes D-50).
 *
 * A mentorship pairing / match-score is PERSONAL-class SENSITIVE per-person data: it names
 * TWO subjects (mentorUserId + menteeUserId). Today the module gates reads by ROLE + TENANT
 * only — `service.assertVisible()` checks tenant match, and the repository `listMentorships`
 * / `listMatchScores` filter solely on tenant. So ANY holder of `mentorship:read` (MANAGER
 * among them) can read ANOTHER user's pairing / match-score tenant-wide, regardless of their
 * org-chart position — the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST      → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *                 `(mentor_user_id = ANY($n::uuid[]) OR mentee_user_id = ANY($n::uuid[]))`
 *                 (a row is visible when AT LEAST ONE party is in scope; empty list ⇒ empty).
 *   - GET-by-id → BOTH parties must pass canReadOrgTarget(pool, actor, uid, tenantId);
 *                 NotFoundError (404, not 403) when either fails — hides the pairing AND the
 *                 unavailable counterpart (prevents leaking "X mentors <outsider>").
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (the pure-outsider row is absent from
 * a manager's list / outsider get-by-id blocked), never hardcoded data counts (Enzo's rule):
 * every user id comes from the live login response and every subject row is a fixture created
 * + cleaned up here (keyed on a unique suitePrefix in metadata).
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships — verified live
 * against the reports-to chain (paolo's transitive sub-tree contains tommaso and NOT antonio;
 * MANAGER holds mentorship:read; USER/TEAM_MEMBER do NOT):
 *   - paolo.caputo@rtl-bank.org       MANAGER       → org sub-tree; tommaso is his report
 *   - tommaso.fiore@rtl-bank.org      USER          → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org     USER          → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN  → HR-mandated, tenant-wide (I20)
 *   - admin@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `mentorship:read` is held by BLUEPRINT_MANAGER / HRMS_MANAGER / MANAGER / PLATFORM_ADMIN /
 * PROCESS_OWNER / TENANT_ADMIN. A plain USER (tommaso/antonio) holds none — the strongest
 * self-floor (I17): no cross-user read surface exists at all (asserted as a 403).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_MENTSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

let rtlTenantId: string;

/**
 * Create a deterministic mentorship pairing in the RTL tenant with the given parties.
 * The `<>` CHECK allows a NULL counterpart, so (antonio, null) is a valid pure-outsider row.
 * suitePrefix in metadata drives idempotent cleanup; sessions cascade-delete with the parent.
 */
async function seedMentorship(mentorId: string | null, menteeId: string | null): Promise<string> {
  const res = await pool.query<{ mentorship_id: string }>(
    `INSERT INTO sys.sys_mentorships (
        mentorship_tenant_id, mentorship_natural_key, mentorship_mentor_user_id,
        mentorship_mentee_user_id, mentorship_status, mentorship_meeting_frequency, mentorship_metadata
      )
      VALUES ($1, $2, $3, $4, 'ACTIVE', 'BI_WEEKLY', $5::jsonb)
      RETURNING mentorship_id`,
    [
      rtlTenantId,
      `${SUITE_PREFIX}::${randomUUID()}`,
      mentorId,
      menteeId,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.mentorship_id;
}

/** Create a deterministic mentor match-score row in the RTL tenant with the given parties. */
async function seedMatchScore(mentorId: string | null, menteeId: string | null): Promise<string> {
  const res = await pool.query<{ match_id: string }>(
    `INSERT INTO sys.sys_mentor_match_scores (
        match_tenant_id, match_natural_key, match_mentor_user_id,
        match_mentee_user_id, match_score, match_metadata
      )
      VALUES ($1, $2, $3, $4, 0.9, $5::jsonb)
      RETURNING match_id`,
    [
      rtlTenantId,
      `${SUITE_PREFIX}::${randomUUID()}`,
      mentorId,
      menteeId,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.match_id;
}

interface ListedPairings {
  items: Array<{ mentorshipId: string; mentorUserId: string | null; menteeUserId: string | null }>;
  total: number;
}
interface ListedScores {
  items: Array<{ matchId: string; mentorUserId: string | null; menteeUserId: string | null }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

// Pairing fixtures
let bothReadableId: string; // mentor=paolo(self), mentee=tommaso(report)  → paolo MAY read
let outsiderOnlyId: string; // mentor=antonio(outsider), mentee=null        → paolo MUST NOT read/list
let mixedPartyId: string; // mentor=tommaso(report), mentee=antonio(outsider) → paolo get-by-id 404 (AND)
// Match-score fixtures
let scoreOutsiderId: string; // mentor=antonio(outsider), mentee=null        → paolo MUST NOT read/list

describe("/v1/mentorship — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
    antonio = await login(suite, "antonio.parisi@rtl-bank.org");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "admin@heuresys.com");

    const t = await pool.query<{ user_tenant_id: string }>(
      `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
      [tommaso.userId],
    );
    rtlTenantId = t.rows[0]!.user_tenant_id;

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    bothReadableId = await seedMentorship(paolo.userId, tommaso.userId);
    outsiderOnlyId = await seedMentorship(antonio.userId, null);
    mixedPartyId = await seedMentorship(tommaso.userId, antonio.userId);
    scoreOutsiderId = await seedMatchScore(antonio.userId, null);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_mentorships WHERE mentorship_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_mentor_match_scores WHERE match_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's pairing via GET-by-id → 200", async () => {
    // Both parties in scope: mentor=paolo (self, I17), mentee=tommaso (sub-tree, I18).
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings/${bothReadableId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { menteeUserId: string | null }).menteeUserId).toBe(tommaso.userId);
  });

  it("paolo (MANAGER) LIST contains the pairing with his report tommaso", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListedPairings;
    expect(body.items.some((i) => i.mentorshipId === bothReadableId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's pairing via GET-by-id → 404", async () => {
    // Pre-fix (leaky): assertVisible() passes on same-tenant → 200. Post-fix: canReadOrgTarget
    // on antonio is false → NotFoundError. 404 hides existence across the org boundary.
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings/${outsiderOnlyId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's pure pairing MUST NOT appear in paolo's (MANAGER) LIST", async () => {
    // The pure-outsider row (antonio mentor, no mentee) has NO party in paolo's scope, so post-fix
    // the userIdAllowList OR-filter excludes it entirely. Pre-fix the tenant-only filter leaks it in
    // (it sorts to page 1: created_at DESC, limit=200 over the whole tenant).
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListedPairings;
    // Core anti-leak invariant: not a single row belonging solely to the outsider may surface.
    expect(body.items.some((i) => i.mentorshipId === outsiderOnlyId)).toBe(false);
  });

  it("LEAK: paolo (MANAGER) get-by-id on a pairing whose COUNTERPART is the outsider → 404 (both-parties gate)", async () => {
    // mixedPartyId = mentor=tommaso (in sub-tree) but mentee=antonio (outsider). List OR-semantics
    // legitimately surfaces this via tommaso, but get-by-id requires BOTH parties readable — else it
    // would leak antonio's involvement. Pre-fix: tenant-only → 200 (leak). Post-fix: mentee gate → 404.
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings/${mixedPartyId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's match-score via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/match-scores/${scoreOutsiderId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: OUTSIDER antonio's match-score MUST NOT appear in paolo's (MANAGER) LIST", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/match-scores?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListedScores;
    expect(body.items.some((i) => i.matchId === scoreOutsiderId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — mentorship:read denied → 403", async () => {
    // In this module USER holds no mentorship:read at all: the strongest self-floor — a plain
    // user can enumerate NO other user's pairings (not even a scoped list).
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/mentorship/pairings",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read antonio's pairing tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings/${outsiderOnlyId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings?limit=200`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as ListedPairings).items.some((i) => i.mentorshipId === outsiderOnlyId)).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's pairing cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/mentorship/pairings/${outsiderOnlyId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
