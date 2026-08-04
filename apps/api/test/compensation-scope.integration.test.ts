/**
 * apps/api/test/compensation-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the COMPENSATION module (ADR-0027, closes D-50).
 *
 * `compensation_intelligence` is COMPENSATION-class SENSITIVE per-person data. The vulnerable
 * surface is the LIST endpoint GET /v1/compensation/reward-gates, which accepts a `userId`
 * filter. Today the module gates reads by ROLE + TENANT only (service.ts `listRewardGates`
 * → `tenantId = isPlatform(actor) ? undefined : requireTenant(actor)`; repository
 * `listRewardGates` filters solely on `reward_gate_tenant_id`), so ANY holder of
 * `compensation_intelligence:read` can list ANOTHER user's reward gates tenant-wide, regardless
 * of their org-chart position — the D-50 cross-user leak. There is NO get-by-id endpoint on
 * reward gates, so (unlike users/assessments) only the LIST filter matters here — no
 * canReadOrgTarget per-target gate is needed.
 *
 * The uniform fix (replicated from the F1 users module):
 *   - LIST → resolveOrgReadScope(pool, actor) → userIdAllowList → repo filters
 *            `reward_gate_user_id = ANY($n::uuid[])`; an explicit ?userId the actor may not
 *            read short-circuits to an empty page (canReadOrgTarget), never another user's data.
 *
 * ── Persona note (why this module needs a role fixture, unlike assessments) ──────────────────
 * `compensation_intelligence:read` is held by CEO / HRMS_MANAGER / PLATFORM_ADMIN / TENANT_ADMIN
 * — but NOT by MANAGER (verified live against sys_auth_role_permissions). So paolo (MANAGER)
 * would simply get 403 and could not demonstrate the org-subtree leak; and the only two loggable
 * personas that DO hold the permission are federica (TENANT_ADMIN → HR-mandated, legitimately
 * tenant-wide) and admin (PLATFORM_ADMIN → all) — for both of whom the fix is a no-op. The ONLY
 * role that is both a permission-holder AND org-scoped (managerial, non-HR-mandated) is CEO.
 * Paolo is already managerial (MANAGER role + manages 5 org units) with a real subtree that
 * INCLUDES his report tommaso and EXCLUDES the outsider antonio; an RBAC role grant does NOT
 * change his org-chart position/subtree. So the fixture grants paolo the CEO role (reversible,
 * idempotent, cleaned up in afterAll) to turn him into a permission-holding org-scoped actor —
 * the exact D-50 shape. Paolo has no seeded CEO grant, so the cleanup removes only what we add.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and PASSES
 * once the fix is applied. It asserts invariants (outsider rows absent from the actor's list),
 * never hardcoded data counts (Enzo's rule) — every user id is taken from the live login
 * response and every fixture row is created here and cleaned up.
 *
 * Real RTL personas (password <TEST_ADMIN_PASSWORD>) + their real org relationships:
 *   - paolo.caputo@rtl-bank.org      MANAGER (+CEO granted for the suite) → org sub-tree
 *   - tommaso.fiore@rtl-bank.org     USER    → IN paolo's sub-tree (report)
 *   - antonio.parisi@rtl-bank.org    USER    → OUTSIDER (peer, I19 — not in the sub-tree)
 *   - federica.marchetti@rtl-bank.org TENANT_ADMIN → HR-mandated, tenant-wide (I20)
 *   - admin@heuresys.com             PLATFORM_ADMIN → cross-tenant (sanity)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { idDi, unSottopostoOrganizzativo, unEstraneoOrganizzativo } from "./helpers/org-actors.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_CSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** Grant/revoke the CEO role to paolo by email (see persona note in the file header). */
async function grantCeoToPaolo(email: string): Promise<void> {
  await pool.query(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
      SELECT u.user_id, r.auth_role_id, u.user_tenant_id
        FROM sys.sys_users u, sys.sys_auth_roles r
       WHERE lower(u.user_email) = lower($1) AND r.auth_role_code = 'CEO'`,
    [email],
  );
}
async function revokeCeoFromPaolo(email: string): Promise<void> {
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1))
        AND user_auth_role_role_id = (SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'CEO')`,
    [email],
  );
}

/** Create a deterministic reward gate for `userId` in that user's own tenant (marker in payload). */
async function seedRewardGate(userId: string, catalogId: string): Promise<string> {
  const res = await pool.query<{ reward_gate_id: string }>(
    `INSERT INTO sys.sys_reward_gates (
        reward_gate_tenant_id, reward_gate_user_id, reward_gate_position_id,
        reward_gate_catalog_id, reward_gate_period_start, reward_gate_period_end,
        reward_gate_payload
      )
      SELECT u.user_tenant_id, u.user_id, NULL, $2, '2026-01-01', '2026-03-31', $3::jsonb
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING reward_gate_id`,
    [userId, catalogId, JSON.stringify({ suitePrefix: SUITE_PREFIX })],
  );
  return res.rows[0]!.reward_gate_id;
}

interface Listed {
  items: Array<{ rewardGateId: string; userId: string | null }>;
  total: number;
}

const PAOLO_EMAIL = "paolo.caputo@rtl-bank.org";

let suite: TestApp;
let paolo: S; // MANAGER + CEO (granted for suite) — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoGateId: string; // subject = tommaso (report)   → paolo MAY see
let antonioGateId: string; // subject = antonio (outsider) → paolo MUST NOT see

describe("/v1/compensation/reward-gates — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();

    // Turn paolo into a permission-holding, org-scoped actor BEFORE login so his session
    // token carries CEO. Clear any leftover from a crashed prior run, then grant fresh.
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await grantCeoToPaolo(PAOLO_EMAIL);

    paolo = await login(suite, PAOLO_EMAIL);
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

    // Reuse any existing reward-gate catalog (FK target); avoids the blueprint FK chain.
    const cat = await pool.query<{ reward_gate_catalog_id: string }>(
      `SELECT reward_gate_catalog_id FROM sys.sys_reward_gate_catalog LIMIT 1`,
    );
    const catalogId = cat.rows[0]!.reward_gate_catalog_id;

    // Deterministic fixtures (self-contained; do not rely on pre-existing rows).
    tommasoGateId = await seedRewardGate(tommaso.userId, catalogId);
    antonioGateId = await seedRewardGate(antonio.userId, catalogId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_reward_gates WHERE reward_gate_payload->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await revokeCeoFromPaolo(PAOLO_EMAIL);
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (org-scoped) LIST filtered to his report tommaso → tommaso's gate is present → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?userId=${tommaso.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.rewardGateId === tommasoGateId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: OUTSIDER antonio's reward gate MUST NOT appear in paolo's LIST response", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?userId=${antonio.userId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: NOT a single row belonging to the outsider may surface,
    // regardless of counts. Pre-fix (tenant-only filter) antonio's gate leaks through;
    // post-fix (userIdAllowList = paolo's sub-tree, excludes antonio) the set is empty.
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
    expect(body.items.some((i) => i.rewardGateId === antonioGateId)).toBe(false);
  });

  it("LEAK: paolo's UNFILTERED LIST (large page) MUST NOT contain the outsider's gate", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?limit=200`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Belt-and-suspenders on the unfiltered surface: even without a userId filter, no
    // outsider row may appear in a same-tenant manager's list. tommaso (in sub-tree) may;
    // antonio (outsider) may not.
    expect(body.items.some((i) => i.rewardGateId === antonioGateId)).toBe(false);
    expect(body.items.some((i) => i.userId === antonio.userId)).toBe(false);
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — compensation_intelligence:read denied → 403", async () => {
    // In this module USER holds no compensation_intelligence:read at all: the strongest
    // self-floor — a plain user can enumerate NO other user's reward gates.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/compensation/reward-gates",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN list antonio's reward gate tenant-wide → present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?userId=${antonio.userId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as Listed).items.some((i) => i.rewardGateId === antonioGateId)).toBe(true);
  });

  it("admin (PLATFORM_ADMIN) CAN list antonio's reward gate cross-tenant → present (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/compensation/reward-gates?userId=${antonio.userId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as Listed).items.some((i) => i.rewardGateId === antonioGateId)).toBe(true);
  });
});
