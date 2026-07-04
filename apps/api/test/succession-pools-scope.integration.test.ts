/**
 * apps/api/test/succession-pools-scope.integration.test.ts
 *
 * F3 organizational-axis isolation for the SUCCESSION-POOLS module (ADR-0027, D-50
 * sibling-coverage: the S1013 batch gated successor-readiness but left the pool
 * resource tenant-only).
 *
 * A succession pool is POSITION-centric (I1) — its person subject is the position's
 * ACTIVE INCUMBENT: "a succession pool exists for the position held by X" is
 * EVALUATION-class information about X (their replacement is being planned). Today the
 * module gates reads by ROLE + TENANT only, so ANY holder of `career_succession:read`
 * can see succession planning for ANY position tenant-wide — the D-50 leak.
 *
 * The fix (goals' NULL-subject precedent, adapted to the position axis):
 *   - LIST      → resolveOrgReadScope → allow rows whose position has NO active incumbent
 *                 (vacant → no person subject → tenant-visible) OR an incumbent in the
 *                 actor's allow-list.
 *   - GET-by-id → vacant position → tenant check only; otherwise at least one ACTIVE
 *                 incumbent must pass canReadOrgTarget (404 when none, no enumeration).
 *
 * Writes need no org gate: `career_succession:create/update` are held only by
 * HR-mandated / platform roles, which pass the org axis by mandate.
 *
 * This suite encodes the isolation INVARIANT so it FAILS on the current (leaky) code and
 * PASSES once the fix is applied. It asserts invariants (outsider-position pool absent /
 * blocked), never hardcoded data counts — fixtures are created here and cleaned up.
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
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SPSCOPE_${randomUUID().slice(0, 8).toUpperCase()}`;

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

/** Pool on `incumbentUserId`'s real ACTIVE position — that user is the pool's person subject. */
async function seedPoolOnUsersPosition(incumbentUserId: string, codeSuffix: string): Promise<string> {
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
      incumbentUserId,
      `${SUITE_PREFIX}_${codeSuffix}`,
      `${SUITE_PREFIX} pool ${codeSuffix}`,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.succession_pool_id;
}

/** Pool on a freshly-created VACANT position (no active incumbent → no person subject). */
async function seedPoolOnVacantPosition(tenantUserId: string): Promise<string> {
  const pos = await pool.query<{ position_id: string }>(
    `INSERT INTO sys.sys_positions (
        position_tenant_id, position_code, position_title, position_metadata
      )
      SELECT u.user_tenant_id, $2, $3, $4::jsonb
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING position_id`,
    [
      tenantUserId,
      `${SUITE_PREFIX}_VACANT_POS`,
      `${SUITE_PREFIX} vacant position`,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  const res = await pool.query<{ succession_pool_id: string }>(
    `INSERT INTO sys.sys_succession_pools (
        succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
        succession_pool_name, succession_pool_status, succession_pool_metadata, created_by
      )
      SELECT u.user_tenant_id, $2, $3, $4, 'ACTIVE', $5::jsonb, u.user_id
        FROM sys.sys_users u WHERE u.user_id = $1
      RETURNING succession_pool_id`,
    [
      tenantUserId,
      pos.rows[0]!.position_id,
      `${SUITE_PREFIX}_VACANT`,
      `${SUITE_PREFIX} pool vacant`,
      JSON.stringify({ suitePrefix: SUITE_PREFIX }),
    ],
  );
  return res.rows[0]!.succession_pool_id;
}

interface Listed {
  items: Array<{ successionPoolId: string; code: string }>;
  total: number;
}

let suite: TestApp;
let paolo: S; // MANAGER — org sub-tree scope
let tommaso: S; // USER — paolo's report (in sub-tree)
let antonio: S; // USER — OUTSIDER (peer)
let federica: S; // TENANT_ADMIN — HR-mandated tenant-wide
let admin: S; // PLATFORM_ADMIN — cross-tenant

let tommasoPoolId: string; // incumbent = tommaso (report)   → paolo MAY read
let antonioPoolId: string; // incumbent = antonio (outsider) → paolo MUST NOT read
let vacantPoolId: string; // no incumbent → tenant-visible

describe("/v1/succession-pools — F3 org-axis isolation (ADR-0027, D-50)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    paolo = await login(suite, "paolo.caputo@rtl-bank.org");
    tommaso = await login(suite, "tommaso.fiore@rtl-bank.org");
    antonio = await login(suite, "antonio.parisi@rtl-bank.org");
    federica = await login(suite, "federica.marchetti@rtl-bank.org");
    admin = await login(suite, "admin@heuresys.com");

    // Deterministic fixtures (self-contained; do not rely on pre-existing seed rows).
    tommasoPoolId = await seedPoolOnUsersPosition(tommaso.userId, "REPORT");
    antonioPoolId = await seedPoolOnUsersPosition(antonio.userId, "OUTSIDER");
    vacantPoolId = await seedPoolOnVacantPosition(tommaso.userId);
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_succession_pools WHERE succession_pool_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await pool.query(
      `DELETE FROM sys.sys_positions WHERE position_metadata->>'suitePrefix' = $1`,
      [SUITE_PREFIX],
    );
    await suite.app.close();
    await closePool();
  });

  /* ============================ POSITIVE (in sub-tree) ============================ */

  it("paolo (MANAGER) CAN read the pool on his report tommaso's position via GET-by-id → 200", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools/${tommasoPoolId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { successionPoolId: string }).successionPoolId).toBe(tommasoPoolId);
  });

  it("paolo (MANAGER) LIST → the pool on tommaso's position is present", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    expect(body.items.some((i) => i.successionPoolId === tommasoPoolId)).toBe(true);
  });

  /* ===================== ANTI-LEAK core invariant (outsider) ===================== */

  it("LEAK: paolo (MANAGER) MUST NOT read the pool on OUTSIDER antonio's position via GET-by-id → 404", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools/${antonioPoolId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    // Pre-fix (leaky): visible() passes on same-tenant → 200. Post-fix: no ACTIVE incumbent
    // of the position passes canReadOrgTarget → NotFoundError. 404 hides existence.
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("LEAK: the pool on OUTSIDER antonio's position MUST NOT appear in paolo's (MANAGER) LIST", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as Listed;
    // Core anti-leak invariant: succession planning for a position held by someone outside
    // paolo's sub-tree may NOT surface. Pre-fix (tenant-only) it leaks; post-fix the
    // incumbent-vs-allow-list filter excludes it.
    expect(body.items.some((i) => i.successionPoolId === antonioPoolId)).toBe(false);
  });

  /* ===================== Vacant position = no person subject ===================== */

  it("a pool on a VACANT position stays tenant-visible to paolo (no person subject) → 200 + listed", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools/${vacantPoolId}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(paolo.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.successionPoolId === vacantPoolId)).toBe(
      true,
    );
  });

  /* ===================== Self-floor: plain USER (I17) ===================== */

  it("plain USER (tommaso) has NO cross-user read surface — career_succession:read denied → 403", async () => {
    // USER holds only career_succession:read:self (ESS /me/*), not :read — the strongest
    // self-floor: a plain user can enumerate NO succession planning here.
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/succession-pools",
      headers: { cookie: ch(tommaso.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  /* ===================== Mandate preserved (HR / platform) ===================== */

  it("federica (TENANT_ADMIN, HR-mandated) CAN read the pool on antonio's position tenant-wide → 200", async () => {
    const byId = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools/${antonioPoolId}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(byId.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(federica.cookies) },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as Listed).items.some((i) => i.successionPoolId === antonioPoolId)).toBe(
      true,
    );
  });

  it("admin (PLATFORM_ADMIN) CAN read the pool on antonio's position cross-tenant → 200 (sanity)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/succession-pools/${antonioPoolId}`,
      headers: { cookie: ch(admin.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });
});
