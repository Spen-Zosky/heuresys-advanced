/**
 * apps/api/test/landing-derivation.integration.test.ts
 *
 * #116 — the regression gate for where a login lands.
 *
 * The defect being nailed shut: for two generations the landing was decided
 * from the SET OF ROLE NAMES (an ADMIN_ROLES allowlist, then D-68's inversion),
 * and neither generation asked whether the role could actually SEE the page it
 * was sent to. Measured on the live map 2026-08-04: 6 of 13 roles hold
 * `dashboard:view`; the other 7 were being sent to /dashboard anyway — 28 of
 * the 45 people who land there, 27 of them unit managers who had just received
 * TEAM_LEADER from #113.
 *
 * Why this file lives in apps/api and not apps/web: the assertion is only worth
 * anything when the rule and the LIVE RBAC map are read in the same process.
 * A test that hardcodes "these roles land on the dashboard" would restate the
 * bug as its own expectation. Nothing here enumerates a role name.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { landingForPermissions, DASHBOARD_PERMISSION } from "@heuresys/shared";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { userPermissionCodes } from "../src/middleware/rbac.js";
import { pool, closePool } from "../src/db/client.js";

const ADMIN_EMAIL = "enzo.spenuso@heuresys.com";

interface RoleRow {
  role_code: string;
  grants_dashboard: boolean;
}

let t: TestApp;
let roles: RoleRow[] = [];

beforeAll(async () => {
  t = await buildTestApp();
  const { rows } = await pool.query<RoleRow>(
    `SELECT r.auth_role_code AS role_code,
            bool_or(p.auth_permission_code = $1) AS grants_dashboard
       FROM sys.sys_auth_roles r
       LEFT JOIN sys.sys_auth_role_permissions rp ON rp.auth_role_id = r.auth_role_id
       LEFT JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      GROUP BY r.auth_role_code
      ORDER BY r.auth_role_code`,
    [DASHBOARD_PERMISSION],
  );
  roles = rows;
});

afterEach(async () => {
  await t.app.close();
  t = await buildTestApp();
});

afterAll(async () => {
  await t.app.close();
  await closePool();
});

describe("#116 — the landing is derived from the permission", () => {
  /**
   * The guard on the guard. If every role held `dashboard:view` (or none did),
   * every assertion below would pass no matter what the rule said, and this
   * file would be decoration. Fail loudly instead of passing vacuously.
   */
  it("runs on a universe where it CAN fail", () => {
    const withPerm = roles.filter((r) => r.grants_dashboard);
    const without = roles.filter((r) => !r.grants_dashboard);
    expect(roles.length).toBeGreaterThan(0);
    expect(withPerm.length,
      "no role grants dashboard:view — the per-role assertion cannot distinguish a correct rule from a broken one",
    ).toBeGreaterThan(0);
    expect(without.length,
      "every role grants dashboard:view — re-hardcoding the old role set would pass this suite unnoticed",
    ).toBeGreaterThan(0);
  });

  it("sends a role to /dashboard if and only if that role may view it", () => {
    const wrong = roles.filter((r) => {
      const landing = landingForPermissions(userPermissionCodes({ roles: [r.role_code] }));
      return (landing === "/dashboard") !== r.grants_dashboard;
    });
    expect(
      wrong.map((r) => `${r.role_code} (grants=${r.grants_dashboard})`),
      "these roles land somewhere their grants do not justify",
    ).toEqual([]);
  });

  /**
   * The closure statement of #116, said about people rather than roles:
   * "nessuna persona atterra su una pagina per cui non ha il permesso".
   * Runs over every active user with at least one role — the population that
   * regressed when #113 handed TEAM_LEADER to 27 unit managers.
   */
  it("lands no active person on a dashboard they are denied", async () => {
    const { rows } = await pool.query<{ user_email: string; role_codes: string[] }>(
      `SELECT u.user_email, array_agg(r.auth_role_code ORDER BY r.auth_role_code) AS role_codes
         FROM sys.sys_users u
         JOIN sys.sys_user_auth_roles uar
           ON uar.user_auth_role_user_id = u.user_id
          AND uar.user_auth_role_revoked_at IS NULL
         JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
        WHERE u.user_status = 'ACTIVE'
        GROUP BY u.user_email`,
    );
    expect(rows.length, "no active user carries a role — nothing was actually checked").toBeGreaterThan(0);

    const stranded = rows
      .map((row) => ({ ...row, permissions: userPermissionCodes({ roles: row.role_codes }) }))
      .filter(
        (row) =>
          landingForPermissions(row.permissions) === "/dashboard" &&
          !row.permissions.includes(DASHBOARD_PERMISSION),
      )
      .map((row) => `${row.user_email} [${row.role_codes.join(",")}]`);

    expect(stranded, "these people land on a dashboard their permissions deny").toEqual([]);
  });

  it("puts the resolved permissions in the login response, matching the live map", async () => {
    const res = await loginRaw(t.app, ADMIN_EMAIL);
    const body = res.json() as { roles: string[]; permissions?: string[] };

    expect(Array.isArray(body.permissions), "login response carries no permissions array").toBe(true);
    // The contract is "the same codes the RBAC map resolves for these roles" —
    // compared as sets, not restated as a literal.
    expect([...(body.permissions ?? [])].sort()).toEqual(
      [...userPermissionCodes({ roles: body.roles })].sort(),
    );
    expect(landingForPermissions(body.permissions ?? [])).toBe("/dashboard");
  });
});
