/**
 * apps/api/test/capability-composition-scope.integration.test.ts
 *
 * F3 (ADR-0027, closes D-50) — ORGANIZATIONAL-AXIS ISOLATION for the capability
 * module. EMPLOYEE capability scores are per-person SENSITIVE (SKILL) data: a
 * `capability:read` holder must only read scores for users in their own org
 * sub-tree (self for a non-managerial actor); HR-mandated (TENANT_ADMIN /
 * HRMS_MANAGER) and PLATFORM_ADMIN keep their tenant-wide / cross-tenant mandate.
 *
 * WHY THE GRANT FIXTURE: `capability:read` is held ONLY by ORG_DIRECTOR /
 * HRMS_MANAGER / TENANT_ADMIN / PLATFORM_ADMIN — NOT by MANAGER or plain USER
 * (the RTL personas paolo/tommaso get 403 as-is). The role whose scope the F3
 * fix actually narrows is ORG_DIRECTOR (org-scoped, NOT HR-mandated). So this
 * test transiently grants ORG_DIRECTOR to two real personas to exercise the two
 * org-scope branches, then removes it in afterAll:
 *   - paolo.caputo (MANAGER + org-unit manager) -> resolveOrgReadScope = SUB-TREE
 *   - tommaso.fiore (TEAM_MEMBER/USER, no OU mgmt) -> resolveOrgReadScope = SELF
 * antonio.parisi is a real RTL user OUTSIDE paolo's org sub-tree (the outsider).
 *
 * RED (current leaky code): every `capability:read` holder reads ANY tenant
 * member's EMPLOYEE score (tenant-only filter). Post-fix: paolo's EMPLOYEE list
 * excludes antonio, GET EMPLOYEE/antonio -> 404, and tommaso (self scope) sees
 * only himself. federica (mandate) still sees the whole tenant.
 *
 * Live login + live RTL DB. Deterministic fixtures (ORG_DIRECTOR grants +
 * marker EMPLOYEE score rows) inserted in beforeAll, removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const FIXTURE_MODEL_VERSION = "f3-scope-fixture"; // marker → precise afterAll cleanup

const EMAILS = {
  admin: "admin@heuresys.com",
  federica: "federica.marchetti@rtl-bank.org",
  paolo: "paolo.caputo@rtl-bank.org",
  tommaso: "tommaso.fiore@rtl-bank.org",
  antonio: "antonio.parisi@rtl-bank.org",
} as const;

interface Session {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}
interface Score {
  subjectType: string;
  subjectId: string;
  tenantId: string;
  value: number;
  coverage: number;
}
interface ListBody {
  scope: { kind: string; tenantId: string | null };
  items: Score[];
  total: number;
}

function cookieHeader(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(app: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(app.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

/** GET /composition?subjectType=EMPLOYEE — the endpoint variant the F3 fix org-filters. */
async function listEmployees(app: TestApp, s: Session) {
  return app.app.inject({
    method: "GET",
    url: "/v1/capability/composition?subjectType=EMPLOYEE",
    headers: { cookie: cookieHeader(s.cookies) },
  });
}
async function getEmployee(app: TestApp, s: Session, subjectId: string) {
  return app.app.inject({
    method: "GET",
    url: `/v1/capability/composition/EMPLOYEE/${subjectId}`,
    headers: { cookie: cookieHeader(s.cookies) },
  });
}
function subjectIds(body: ListBody): Set<string> {
  return new Set(body.items.map((i) => i.subjectId));
}

/** Transitive org sub-tree user ids for a user (mirrors lib/scope/org.ts orgSubtreeUserIds). */
async function orgSubtree(userId: string): Promise<Set<string>> {
  const res = await pool.query<{ user_id: string }>(
    `WITH RECURSIVE my_pos AS (
       SELECT upa.user_position_assignment_position_id AS pid
         FROM sys.sys_user_position_assignments upa
        WHERE upa.user_position_assignment_user_id = $1
          AND upa.user_position_assignment_status = 'ACTIVE'
     ), subtree AS (
       SELECT pid FROM my_pos
       UNION
       SELECT p.position_id
         FROM sys.sys_positions p JOIN subtree s ON p.position_reports_to_position_id = s.pid
     )
     SELECT DISTINCT upa.user_position_assignment_user_id AS user_id
       FROM sys.sys_user_position_assignments upa
       JOIN subtree s ON s.pid = upa.user_position_assignment_position_id
      WHERE upa.user_position_assignment_status = 'ACTIVE'
     UNION SELECT $1::uuid`,
    [userId],
  );
  return new Set(res.rows.map((r) => r.user_id));
}

let suite: TestApp;
let admin: Session; // PLATFORM_ADMIN — all
let federica: Session; // TENANT_ADMIN (RTL) — HR-mandated, tenant-wide
let paolo: Session; // MANAGER + ORG_DIRECTOR(fixture) — sub-tree
let tommaso: Session; // USER + ORG_DIRECTOR(fixture) — self only
const ids = {} as Record<keyof typeof EMAILS, string>;
let rtlTenantId: string;
let orgDirectorRoleId: string;
let paoloSubtree: Set<string>;

beforeAll(async () => {
  suite = await buildTestApp();

  // Resolve real ids from the live DB (no hard-coded uuids).
  const usersRes = await pool.query<{ user_id: string; user_email: string; user_tenant_id: string }>(
    `SELECT user_id, user_email, user_tenant_id FROM sys.sys_users WHERE user_email = ANY($1)`,
    [Object.values(EMAILS)],
  );
  const byEmail = new Map(usersRes.rows.map((r) => [r.user_email, r]));
  for (const [key, email] of Object.entries(EMAILS) as [keyof typeof EMAILS, string][]) {
    const row = byEmail.get(email);
    if (!row) throw new Error(`Persona not found in DB: ${email} (run pnpm db:seed / db:seed-test-admin)`);
    ids[key] = row.user_id;
  }
  rtlTenantId = byEmail.get(EMAILS.paolo)!.user_tenant_id;

  const roleRes = await pool.query<{ auth_role_id: string }>(
    `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'ORG_DIRECTOR'`,
  );
  orgDirectorRoleId = roleRes.rows[0]?.auth_role_id ?? "";
  if (!orgDirectorRoleId) throw new Error("ORG_DIRECTOR role missing — cannot exercise capability:read scope");

  // Defensive pre-clean of any leftover fixtures from a crashed prior run.
  await pool.query(`DELETE FROM sys.sys_capability_scores WHERE capability_score_model_version = $1`, [
    FIXTURE_MODEL_VERSION,
  ]);
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = ANY($1::uuid[]) AND user_auth_role_role_id = $2::uuid`,
    [[ids.paolo, ids.tommaso], orgDirectorRoleId],
  );

  // FIXTURE 1 — grant ORG_DIRECTOR (holds capability:read) to paolo + tommaso so they can
  // call the endpoint at all. paolo stays managerial (sub-tree); tommaso stays non-managerial
  // (self). Idempotent: skip if a live grant already exists. Granted BEFORE login so the JWT
  // (roles resolved fresh from sys_user_auth_roles at login) carries the role.
  for (const uid of [ids.paolo, ids.tommaso]) {
    await pool.query(
      `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
       SELECT $1::uuid, $2::uuid, $3::uuid
        WHERE NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles
           WHERE user_auth_role_user_id = $1::uuid
             AND user_auth_role_role_id = $2::uuid
             AND user_auth_role_revoked_at IS NULL
        )`,
      [uid, orgDirectorRoleId, rtlTenantId],
    );
  }

  admin = await login(suite, EMAILS.admin);
  federica = await login(suite, EMAILS.federica);
  paolo = await login(suite, EMAILS.paolo);
  tommaso = await login(suite, EMAILS.tommaso);

  // FIXTURE 2 — deterministic EMPLOYEE score rows for tommaso (in paolo's sub-tree) and antonio
  // (outsider). computed_at in the future wins the DISTINCT-ON latest-cohort pick, so both are
  // guaranteed visible regardless of recompute state (no unique constraint on subject → safe).
  for (const uid of [ids.tommaso, ids.antonio]) {
    await pool.query(
      `INSERT INTO sys.sys_capability_scores
         (capability_score_tenant_id, capability_score_subject_type, capability_score_subject_id,
          capability_score_value, capability_score_coverage, capability_score_aggregation_mode,
          capability_score_model_version, capability_score_computed_at)
       VALUES ($1::uuid, 'EMPLOYEE', $2::uuid, 55.5, 60.0, 'WEIGHTED_AVG', $3, now() + interval '1 hour')`,
      [rtlTenantId, uid, FIXTURE_MODEL_VERSION],
    );
  }

  paoloSubtree = await orgSubtree(ids.paolo);
});

afterAll(async () => {
  // Precise fixture teardown — restore the shared prod-grade DB to its prior state.
  await pool.query(`DELETE FROM sys.sys_capability_scores WHERE capability_score_model_version = $1`, [
    FIXTURE_MODEL_VERSION,
  ]);
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = ANY($1::uuid[]) AND user_auth_role_role_id = $2::uuid`,
    [[ids.paolo, ids.tommaso], orgDirectorRoleId],
  );
  await suite.app.close();
});

describe("capability-composition — F3 organizational-axis isolation (ADR-0027 / D-50)", () => {
  it("precondition: subtree wiring + fixtures are live (tommaso∈paolo subtree, antonio∉)", () => {
    expect(paoloSubtree.has(ids.tommaso)).toBe(true); // real reports-to edge
    expect(paoloSubtree.has(ids.antonio)).toBe(false); // outsider
    expect(paoloSubtree.has(ids.paolo)).toBe(true); // self always present
  });

  it("precondition: PLATFORM_ADMIN sees BOTH tommaso and antonio EMPLOYEE scores (fixtures visible)", async () => {
    const r = await listEmployees(suite, admin);
    expect(r.statusCode).toBe(200);
    const seen = subjectIds(r.json() as ListBody);
    expect(seen.has(ids.tommaso)).toBe(true);
    expect(seen.has(ids.antonio)).toBe(true);
  });

  // ---- CORE ANTI-LEAK INVARIANT (RED pre-fix) ----
  it("MANAGER-scope actor's EMPLOYEE list excludes the outsider and stays within the org sub-tree", async () => {
    const r = await listEmployees(suite, paolo);
    expect(r.statusCode).toBe(200); // ORG_DIRECTOR grant → holds capability:read
    const body = r.json() as ListBody;
    const seen = subjectIds(body);

    // Legitimate access preserved: a direct report is visible.
    expect(seen.has(ids.tommaso)).toBe(true);
    // The leak: antonio (outside paolo's sub-tree) MUST NOT appear. FAILS on current code.
    expect(seen.has(ids.antonio)).toBe(false);
    // Strongest invariant: EVERY returned EMPLOYEE row is inside paolo's org sub-tree.
    for (const item of body.items) {
      expect(item.subjectType).toBe("EMPLOYEE");
      expect(paoloSubtree.has(item.subjectId)).toBe(true);
    }
  });

  it("MANAGER-scope actor CAN GET a direct report's EMPLOYEE score (200)", async () => {
    const r = await getEmployee(suite, paolo, ids.tommaso);
    expect(r.statusCode).toBe(200);
    expect((r.json() as Score).subjectId).toBe(ids.tommaso);
  });

  // ---- PER-TARGET LEAK (RED pre-fix: returns 200) ----
  it("MANAGER-scope actor GET on an OUTSIDER's EMPLOYEE score → 404 (no cross-subtree enumeration)", async () => {
    const r = await getEmployee(suite, paolo, ids.antonio);
    expect(r.statusCode).toBe(404);
  });

  // ---- NON-MANAGERIAL = SELF ONLY (RED pre-fix) ----
  it("non-managerial capability:read holder (tommaso) sees ONLY his own EMPLOYEE row", async () => {
    const r = await listEmployees(suite, tommaso);
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.subjectId).toBe(ids.tommaso); // self only — no other user's data
    }
    // The outsider is definitely not visible to a self-scoped actor.
    expect(subjectIds(body).has(ids.antonio)).toBe(false);
  });

  it("non-managerial actor GET on another user's EMPLOYEE score → 404", async () => {
    const r = await getEmployee(suite, tommaso, ids.antonio);
    expect(r.statusCode).toBe(404);
  });

  // ---- HR MANDATE PRESERVED (green pre- AND post-fix — the fix must NOT over-restrict) ----
  it("TENANT_ADMIN (HR-mandated) still reads the whole tenant — both tommaso and antonio", async () => {
    const listResp = await listEmployees(suite, federica);
    expect(listResp.statusCode).toBe(200);
    const seen = subjectIds(listResp.json() as ListBody);
    expect(seen.has(ids.tommaso)).toBe(true);
    expect(seen.has(ids.antonio)).toBe(true);

    const getResp = await getEmployee(suite, federica, ids.antonio);
    expect(getResp.statusCode).toBe(200);
    expect((getResp.json() as Score).subjectId).toBe(ids.antonio);
  });
});
