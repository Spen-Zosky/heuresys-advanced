/**
 * apps/api/test/semantic-matching-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the SEMANTIC-MATCHING module (resource `matching`,
 * ADR-0027, closes D-50).
 *
 * `matching` is SKILL-class SENSITIVE per-person data (a user's ESCO occupation fit, position
 * fit, job-role fit and person↔person similarity are all derived from their skill profile).
 * Today the four per-target endpoints
 *
 *     GET /v1/matching/users/:userId/occupations
 *     GET /v1/matching/users/:userId/positions
 *     GET /v1/matching/users/:userId/job-roles
 *     GET /v1/matching/users/:userId/similar
 *
 * gate reads by ROLE-LADDER + TENANT only (service.ts: a self-only role may target only itself;
 * ANY "elevated" role may target ANY in-tenant user; `similar` additionally requires an elevated
 * role). There is NO org-chart check. So an elevated-but-non-mandated actor (e.g. a MANAGER) can
 * read the sensitive matching data of ANOTHER user anywhere in the tenant — including users OUTSIDE
 * their org sub-tree. That is the D-50 cross-user leak.
 *
 * The uniform fix (replicated from the F1 users module) is SERVICE-ONLY for this module — it has no
 * multi-subject list endpoint; every per-person read flows through `/users/:userId/*`, so each is
 * gated per-target:
 *   canReadOrgTarget(pool, actor, userId, targetTenant) → NotFoundError("User") (404, not 403)
 *   when false, hiding existence across the org boundary.
 *
 * Because there is no "list all persons" surface here, the anti-leak invariant is expressed as a
 * per-target 404 on EVERY one of the four endpoints for an outsider (rather than row-absence in a
 * list response). This suite encodes that invariant so it FAILS on the current (leaky) code — the
 * MANAGER→outsider reads return 200 today — and PASSES once the org gate is applied. Every user id
 * is taken from the live login response (never hardcoded); no data fixtures are needed because the
 * per-target endpoints return an honest 200 empty-state when the target has no embedding, so the
 * invariant is asserted purely on HTTP status (200-allowed vs 404-blocked), driven by the org gate.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships (verified live against
 * the reports-to chain in sys.sys_positions / sys.sys_user_position_assignments):
 *   - paolo.caputo@rtl-bank.org       MANAGER        → org sub-tree; tommaso IS in his sub-tree
 *   - tommaso.fiore@rtl-bank.org      USER           → IN paolo's sub-tree (report); self-only role
 *   - antonio.parisi@rtl-bank.org     USER           → OUTSIDER (peer, I19 — NOT in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN   → HR-mandated, tenant-wide (I20)
 *   - enzo.spenuso@heuresys.com              PLATFORM_ADMIN → cross-tenant (sanity)
 *
 * `matching:read` is held by plain USERs too (a self-only USER hitting a peer gets 404, not 403 —
 * the route permission passes, the service self-only ladder blocks), so the self-floor below is a
 * per-target 404-for-peer / 200-for-self assertion.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { pool } from "../src/db/client.js";
import { unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;

/** The four per-person read surfaces of the matching module — all org-gated by the F3 fix. */
const PER_TARGET_ENDPOINTS = ["occupations", "positions", "job-roles", "similar"] as const;

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

/** GET /v1/matching/users/:targetId/:suffix as `session`. */
function readMatch(app: TestApp["app"], session: S, targetId: string, suffix: string) {
  return app.inject({
    method: "GET",
    url: `/v1/matching/users/${targetId}/${suffix}`,
    headers: { cookie: ch(session.cookies) },
  });
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope (elevated, NOT HR-mandated)
let tommaso: S; // USER — paolo's report (in sub-tree); self-only
let antonio: S; // USER — OUTSIDER (peer); self-only
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

describe("/v1/matching — F3 org-axis isolation (ADR-0027, D-50)", () => {
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
  });

  afterAll(async () => {
    // No data fixtures were created (status-only invariant) → only release the Fastify instance.
    // The shared DB pool stays open for the rest of the serial suite.
    await suite.app.close();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read his report tommaso's matches on every per-target endpoint → 200", async () => {
    for (const suffix of PER_TARGET_ENDPOINTS) {
      const r = await readMatch(suite.app, paolo, tommaso.userId, suffix);
      expect(r.statusCode, `paolo → tommaso/${suffix}`).toBe(200);
    }
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read OUTSIDER antonio's matches — 404 on EVERY per-target endpoint", async () => {
    // Pre-fix (leaky): paolo is "elevated" and same-tenant, so the role-ladder + tenant check pass
    // and each endpoint returns 200 (antonio's sensitive matching data leaks across the org boundary).
    // Post-fix: canReadOrgTarget(paolo, antonio) is false (antonio ∉ paolo's sub-tree) → NotFoundError.
    // 404 (not 403) hides existence across the boundary.
    for (const suffix of PER_TARGET_ENDPOINTS) {
      const r = await readMatch(suite.app, paolo, antonio.userId, suffix);
      expect(r.statusCode, `paolo → antonio/${suffix} must be blocked`).toBe(404);
      expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
    }
  });

  /* ===================== Self-floor: plain USER sees only self (I17) ===================== */

  it("self-floor: a plain USER (tommaso) may read only ITSELF — peer antonio → 404, self → 200", async () => {
    // The matching module has no multi-subject list; "sees only self" = a plain user may target only
    // its own userId. tommaso holds matching:read, so a peer read is a 404 (service self-only ladder),
    // not a 403 (route permission). Self is always allowed (I17).
    const peer = await readMatch(suite.app, tommaso, antonio.userId, "occupations");
    expect(peer.statusCode).toBe(404);
    expect((peer.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");

    const self = await readMatch(suite.app, tommaso, tommaso.userId, "occupations");
    expect(self.statusCode).toBe(200);
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read OUTSIDER antonio's matches tenant-wide → 200", async () => {
    // I20: an HR-mandated role keeps tenant-wide sensitive access by explicit mandate (not via the axes),
    // so the org gate must NOT over-block it. antonio is out of any managerial sub-tree, yet visible to HR.
    for (const suffix of PER_TARGET_ENDPOINTS) {
      const r = await readMatch(suite.app, federica, antonio.userId, suffix);
      expect(r.statusCode, `federica → antonio/${suffix}`).toBe(200);
    }
  });

  it("admin (PLATFORM_ADMIN) CAN read antonio's matches → 200 (cross-boundary sanity)", async () => {
    const r = await readMatch(suite.app, admin, antonio.userId, "occupations");
    expect(r.statusCode).toBe(200);
  });
});
