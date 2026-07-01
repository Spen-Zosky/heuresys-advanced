/**
 * apps/api/test/hrms-plenipotentiary.integration.test.ts
 *
 * I21 (ADR-0027 §2.7) — HRMS_MANAGER is plenipotentiary over BUSINESS DATA, the
 * non-technological counterpart of PLATFORM_ADMIN. Migration 000169 granted the
 * data-business write/delete/admin perms it lacked; this proves the grant end-to-end
 * (DB → RBAC cache → requirePermission) on a REAL persona, AND proves the boundary
 * held: the technological plane (role/tenant/mfa/blueprint/brownfield/seed) is NOT
 * granted.
 *
 * GRANT FIXTURE (same pattern as the F3 *-scope tests): transiently grant HRMS_MANAGER
 * to antonio.parisi (a real RTL plain USER) so his JWT carries the role, exercise the
 * gate on real endpoints with throwaway ids (no destructive writes — the ids don't
 * exist, so a granted call reaches the handler and 404s, an ungranted one 403s at the
 * permission gate), then revoke in afterAll. tommaso (plain USER, no grant) is the
 * negative control isolating that it is the HRMS_MANAGER grant doing the work.
 *
 * Live login + live RTL DB. CSRF is enforced before the permission check, so every
 * state-changing call carries a valid csrf cookie+token; a residual 403 is therefore a
 * permission denial (requirePermission → code FORBIDDEN), never a CSRF failure.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
// A syntactically-valid RFC-4122 v4 uuid that does not exist → a granted call 404s at
// the handler (past the permission gate); an ungranted call 403s at the gate.
const GHOST = "00000000-0000-4000-8000-0000000000ff";

// The 9 data-business perms migration 000169 grants to HRMS_MANAGER (I21 design contract).
const I21_GRANTS = [
  "compensation_intelligence:update", "user:delete", "organization_unit:delete",
  "enterprise_typing:create", "enterprise_typing:update", "notification:create",
  "bpm_process:update", "capability:admin", "matching:admin",
] as const;

interface Session { cookies: Map<string, string>; csrfToken: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(app: TestApp, email: string): Promise<Session> {
  const r = await loginRaw(app.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}
/** state-changing call with a valid CSRF token so the flow reaches requirePermission. */
function del(app: TestApp, s: Session, url: string) {
  return app.app.inject({ method: "DELETE", url, headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrfToken } });
}
const codeOf = (r: { json: () => unknown }) => (r.json() as { error?: { code?: string } }).error?.code;

let suite: TestApp;
let hrms: Session;    // antonio + HRMS_MANAGER(fixture) — the plenipotentiary
let plain: Session;   // tommaso, plain USER (no HRMS) — negative control
let antonioId = "";
let antonioTenant = "";
let hrmsRoleId = "";

beforeAll(async () => {
  suite = await buildTestApp();

  const u = await pool.query<{ user_id: string; user_email: string; user_tenant_id: string }>(
    `SELECT user_id, user_email, user_tenant_id FROM sys.sys_users
      WHERE user_email IN ('antonio.parisi@rtl-bank.org','tommaso.fiore@rtl-bank.org')`);
  const antonio = u.rows.find((r) => r.user_email === "antonio.parisi@rtl-bank.org");
  if (!antonio) throw new Error("antonio.parisi not found — run pnpm db:seed-test-admin");
  antonioId = antonio.user_id;
  antonioTenant = antonio.user_tenant_id;

  const role = await pool.query<{ auth_role_id: string }>(
    `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'HRMS_MANAGER'`);
  hrmsRoleId = role.rows[0]?.auth_role_id ?? "";
  if (!hrmsRoleId) throw new Error("HRMS_MANAGER role missing");

  // Defensive pre-clean of a leftover fixture grant from a crashed prior run.
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = $1::uuid AND user_auth_role_role_id = $2::uuid`,
    [antonioId, hrmsRoleId]);
  // Grant HRMS_MANAGER to antonio BEFORE login so the JWT (roles resolved at login) carries it.
  await pool.query(
    `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid)`,
    [antonioId, hrmsRoleId, antonioTenant]);

  hrms = await login(suite, "antonio.parisi@rtl-bank.org");
  plain = await login(suite, "tommaso.fiore@rtl-bank.org");
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = $1::uuid AND user_auth_role_role_id = $2::uuid`,
    [antonioId, hrmsRoleId]);
  await suite.app.close();
});

describe("I21 — HRMS_MANAGER data plenipotentiary (ADR-0027 §2.7)", () => {
  it("GRANTED business-data: user:delete passes the permission gate (404, not 403)", async () => {
    const r = await del(suite, hrms, `/v1/users/${GHOST}`);
    expect(r.statusCode).not.toBe(403);       // permission gate passed
    expect(codeOf(r)).not.toBe("FORBIDDEN");
    expect(r.statusCode).toBe(404);           // reached the handler; ghost id → not found
  });

  it("negative control: a plain USER (no HRMS grant) is DENIED user:delete (403 FORBIDDEN)", async () => {
    const r = await del(suite, plain, `/v1/users/${GHOST}`);
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("FORBIDDEN");
  });

  it("GRANTED business-data: organization_unit:delete passes the permission gate (404, not 403)", async () => {
    const r = await del(suite, hrms, `/v1/organization-units/${GHOST}`);
    expect(r.statusCode).not.toBe(403);
    expect(codeOf(r)).not.toBe("FORBIDDEN");
    expect(r.statusCode).toBe(404);
  });

  it("BOUNDARY: HRMS_MANAGER is NOT granted the technological plane — role:assign is DENIED (403)", async () => {
    // role:assign lives on the PLATFORM_ADMIN plane (I21 grants DATA, not technology).
    const r = await del(suite, hrms, `/v1/users/${GHOST}/roles/${GHOST}`);
    expect(r.statusCode).toBe(403);
    expect(codeOf(r)).toBe("FORBIDDEN");
  });

  it("design contract: all 9 I21 data-business perms are mapped to HRMS_MANAGER in the DB", async () => {
    const res = await pool.query<{ code: string }>(
      `SELECT p.auth_permission_code AS code
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id AND r.auth_role_code = 'HRMS_MANAGER'
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE p.auth_permission_code = ANY($1)`,
      [[...I21_GRANTS]]);
    const present = new Set(res.rows.map((r) => r.code));
    for (const g of I21_GRANTS) expect(present.has(g), `HRMS_MANAGER must hold ${g}`).toBe(true);
  });

  it("BOUNDARY: the technological perms stayed OFF HRMS_MANAGER", async () => {
    const TECH = ["mfa_policy:manage", "tenant:update", "role:assign", "auth:revoke_user", "seed_acquisition:trigger"];
    const res = await pool.query<{ code: string }>(
      `SELECT p.auth_permission_code AS code
         FROM sys.sys_auth_role_permissions rp
         JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id AND r.auth_role_code = 'HRMS_MANAGER'
         JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
        WHERE p.auth_permission_code = ANY($1)`,
      [TECH]);
    expect(res.rows.map((r) => r.code)).toEqual([]);
  });
});
