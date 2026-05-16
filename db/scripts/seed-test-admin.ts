/**
 * db/scripts/seed-test-admin.ts
 * MVP-1 test fixtures seed — idempotent, deterministic. Creates the personas
 * needed to exercise all four scope tiers in the AUTH §6 matrix at runtime
 * (not just unit-style):
 *
 *   ┌────────────────────┬──────────────┬───────────────────────────────┐
 *   │ persona            │ email        │ role / scope                  │
 *   ├────────────────────┼──────────────┼───────────────────────────────┤
 *   │ admin              │ admin@...    │ PLATFORM_ADMIN (tenant NULL)  │
 *   │ tenant_admin_test  │ ta_test@...  │ TENANT_ADMIN  (RTL tenant)    │
 *   │ manager_test       │ mgr_test@... │ MANAGER       (incumbent of   │
 *   │                    │              │   test_mgr_position)          │
 *   │ employee_test      │ emp_test@... │ USER          (incumbent of   │
 *   │                    │              │   test_sub_position which     │
 *   │                    │              │   reports_to test_mgr_position)│
 *   │ outsider_test      │ out_test@... │ USER          (incumbent of a │
 *   │                    │              │   ROOT position NOT in        │
 *   │                    │              │   manager's team)             │
 *   └────────────────────┴──────────────┴───────────────────────────────┘
 *
 * Test positions created (in RTL_BANK_REFERENCE tenant, code prefix TEST_):
 *   TEST_MGR_POS         (root, manager's seat)
 *   TEST_SUB_POS         (reports_to TEST_MGR_POS, employee's seat)
 *   TEST_OUTSIDER_POS    (root, outsider's seat — separate hierarchy)
 *
 * Idempotent: every row is checked before INSERT; re-run reports EXISTS.
 *
 * Run: pnpm db:seed-test-admin
 */

import { Client } from "pg";
import argon2 from "argon2";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

const DEFAULT_PASSWORD = "Admin#PassW0rd!";

interface PersonaSpec {
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  roleCode: "PLATFORM_ADMIN" | "TENANT_ADMIN" | "MANAGER" | "USER";
  isPlatformGrant: boolean;
}

const PERSONAS: PersonaSpec[] = [
  {
    email: "admin@heuresys.com",
    displayName: "Heuresys Test Admin",
    firstName: "Test",
    lastName: "Admin",
    roleCode: "PLATFORM_ADMIN",
    isPlatformGrant: true,
  },
  {
    email: "tenant_admin_test@rtl-bank.test",
    displayName: "RTL Tenant Admin Test",
    firstName: "Tenant",
    lastName: "AdminTest",
    roleCode: "TENANT_ADMIN",
    isPlatformGrant: false,
  },
  {
    email: "manager_test@rtl-bank.test",
    displayName: "RTL Manager Test",
    firstName: "Manager",
    lastName: "Test",
    roleCode: "MANAGER",
    isPlatformGrant: false,
  },
  {
    email: "employee_test@rtl-bank.test",
    displayName: "RTL Employee Test",
    firstName: "Employee",
    lastName: "Test",
    roleCode: "USER",
    isPlatformGrant: false,
  },
  {
    email: "outsider_test@rtl-bank.test",
    displayName: "RTL Outsider Test",
    firstName: "Outsider",
    lastName: "Test",
    roleCode: "USER",
    isPlatformGrant: false,
  },
];

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

async function findOrInsertUser(
  client: Client,
  tenantId: string,
  persona: PersonaSpec,
  password: string,
  wantsReset: boolean,
): Promise<{ userId: string; created: { user: boolean; identity: boolean; credential: boolean } }> {
  const existing = await client.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users
      WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
    [tenantId, persona.email],
  );
  let userId: string;
  let userCreated = false;
  if (existing.rows.length > 0) {
    userId = existing.rows[0]!.user_id;
  } else {
    const ins = await client.query<{ user_id: string }>(
      `INSERT INTO sys.sys_users (
          user_tenant_id, user_email, user_display_name,
          user_first_name, user_last_name,
          user_status, user_type, user_is_synthetic, user_metadata
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 'STANDARD', false,
                  '{"seed":"test-fixtures"}'::jsonb)
        RETURNING user_id`,
      [tenantId, persona.email, persona.displayName, persona.firstName, persona.lastName],
    );
    userId = ins.rows[0]!.user_id;
    userCreated = true;
  }

  const idtExisting = await client.query<{ auth_identity_id: string }>(
    `SELECT auth_identity_id FROM sys.sys_auth_identities
      WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`,
    [userId],
  );
  let identityId: string;
  let identityCreated = false;
  if (idtExisting.rows.length > 0) {
    identityId = idtExisting.rows[0]!.auth_identity_id;
  } else {
    const ins = await client.query<{ auth_identity_id: string }>(
      `INSERT INTO sys.sys_auth_identities
          (auth_identity_user_id, auth_identity_provider,
           auth_identity_email_verified, auth_identity_is_active)
        VALUES ($1, 'LOCAL', true, true)
        RETURNING auth_identity_id`,
      [userId],
    );
    identityId = ins.rows[0]!.auth_identity_id;
    identityCreated = true;
  }

  const credExisting = await client.query<{ auth_credential_id: string }>(
    `SELECT auth_credential_id FROM sys.sys_auth_credentials
      WHERE auth_credential_identity_id = $1 AND auth_credential_is_current = true`,
    [identityId],
  );
  let credentialCreated = false;
  if (credExisting.rows.length === 0 || wantsReset) {
    if (credExisting.rows.length > 0) {
      await client.query(
        `UPDATE sys.sys_auth_credentials
            SET auth_credential_is_current = false, rotated_at = now()
          WHERE auth_credential_id = $1`,
        [credExisting.rows[0]!.auth_credential_id],
      );
    }
    const hash = await argon2.hash(password, ARGON2_PARAMS);
    await client.query(
      `INSERT INTO sys.sys_auth_credentials
          (auth_credential_identity_id, auth_credential_algorithm,
           auth_credential_hash, auth_credential_is_current,
           auth_credential_must_rotate)
        VALUES ($1, 'ARGON2ID', $2, true, false)`,
      [identityId, hash],
    );
    credentialCreated = true;
  }

  return {
    userId,
    created: { user: userCreated, identity: identityCreated, credential: credentialCreated },
  };
}

async function findOrInsertRoleGrant(
  client: Client,
  userId: string,
  roleId: string,
  tenantId: string | null,
): Promise<boolean> {
  const where =
    tenantId === null
      ? `user_auth_role_tenant_id IS NULL`
      : `user_auth_role_tenant_id = $3`;
  const params = tenantId === null ? [userId, roleId] : [userId, roleId, tenantId];
  const existing = await client.query<{ user_auth_role_id: string }>(
    `SELECT user_auth_role_id FROM sys.sys_user_auth_roles
      WHERE user_auth_role_user_id = $1
        AND user_auth_role_role_id = $2
        AND ${where}
        AND user_auth_role_revoked_at IS NULL`,
    params,
  );
  if (existing.rows.length > 0) return false;
  await client.query(
    `INSERT INTO sys.sys_user_auth_roles
        (user_auth_role_user_id, user_auth_role_role_id,
         user_auth_role_tenant_id, user_auth_role_granted_by)
      VALUES ($1, $2, $3, NULL)`,
    [userId, roleId, tenantId],
  );
  return true;
}

async function findOrInsertPosition(
  client: Client,
  tenantId: string,
  code: string,
  title: string,
  reportsToId: string | null,
): Promise<{ positionId: string; created: boolean }> {
  const existing = await client.query<{ position_id: string }>(
    `SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id = $1 AND position_code = $2`,
    [tenantId, code],
  );
  if (existing.rows.length > 0) {
    return { positionId: existing.rows[0]!.position_id, created: false };
  }
  const ins = await client.query<{ position_id: string }>(
    `INSERT INTO sys.sys_positions
        (position_tenant_id, position_code, position_title,
         position_reports_to_position_id, position_metadata)
      VALUES ($1, $2, $3, $4, '{"seed":"test-fixtures"}'::jsonb)
      RETURNING position_id`,
    [tenantId, code, title, reportsToId],
  );
  return { positionId: ins.rows[0]!.position_id, created: true };
}

async function findOrInsertUpa(
  client: Client,
  tenantId: string,
  userId: string,
  positionId: string,
): Promise<boolean> {
  const existing = await client.query<{ id: string }>(
    `SELECT user_position_assignment_id AS id
       FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_user_id = $1
        AND user_position_assignment_position_id = $2
        AND user_position_assignment_kind = 'PRIMARY'
        AND user_position_assignment_status = 'ACTIVE'`,
    [userId, positionId],
  );
  if (existing.rows.length > 0) return false;
  await client.query(
    `INSERT INTO sys.sys_user_position_assignments
        (user_position_assignment_tenant_id, user_position_assignment_user_id,
         user_position_assignment_position_id, user_position_assignment_kind,
         user_position_assignment_fte, user_position_assignment_start_date,
         user_position_assignment_status, user_position_assignment_metadata)
      VALUES ($1, $2, $3, 'PRIMARY', 1.0, CURRENT_DATE, 'ACTIVE',
              '{"seed":"test-fixtures"}'::jsonb)`,
    [tenantId, userId, positionId],
  );
  return true;
}

async function main() {
  const password = process.env.TEST_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const wantsReset = process.env.TEST_ADMIN_RESET_PASSWORD === "1";

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  console.log(
    `Connected to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  );

  try {
    await client.query("BEGIN");

    // 1. Anchor tenant.
    const tenantRes = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE'`,
    );
    if (tenantRes.rows.length === 0) {
      throw new Error("RTL_BANK_REFERENCE tenant not found — run pnpm db:seed first.");
    }
    const anchorTenantId = tenantRes.rows[0]!.tenant_id;

    // 2. Role-code → role-id map.
    const rolesRes = await client.query<{ code: string; id: string }>(
      `SELECT auth_role_code AS code, auth_role_id AS id FROM sys.sys_auth_roles`,
    );
    const roleByCode = new Map(rolesRes.rows.map((r) => [r.code, r.id]));
    for (const rc of ["PLATFORM_ADMIN", "TENANT_ADMIN", "MANAGER", "USER"]) {
      if (!roleByCode.has(rc)) {
        throw new Error(`Role ${rc} not found — migration 000005 seed missing.`);
      }
    }

    // 3. Test positions with hierarchy.
    const mgrPos = await findOrInsertPosition(
      client,
      anchorTenantId,
      "TEST_MGR_POS",
      "[TEST] Manager Position",
      null,
    );
    const subPos = await findOrInsertPosition(
      client,
      anchorTenantId,
      "TEST_SUB_POS",
      "[TEST] Subordinate Position",
      mgrPos.positionId,
    );
    const outsiderPos = await findOrInsertPosition(
      client,
      anchorTenantId,
      "TEST_OUTSIDER_POS",
      "[TEST] Outsider Position",
      null,
    );

    // 4. Personas.
    type ReportRow = {
      email: string;
      userId: string;
      created: { user: boolean; identity: boolean; credential: boolean };
      roleGranted: boolean;
      upa?: { positionCode: string; assigned: boolean };
    };
    const report: ReportRow[] = [];

    for (const persona of PERSONAS) {
      const u = await findOrInsertUser(client, anchorTenantId, persona, password, wantsReset);
      const roleId = roleByCode.get(persona.roleCode)!;
      const grantTenantId = persona.isPlatformGrant ? null : anchorTenantId;
      const granted = await findOrInsertRoleGrant(client, u.userId, roleId, grantTenantId);

      let upa: ReportRow["upa"] = undefined;
      if (persona.email === "manager_test@rtl-bank.test") {
        const assigned = await findOrInsertUpa(client, anchorTenantId, u.userId, mgrPos.positionId);
        upa = { positionCode: "TEST_MGR_POS", assigned };
      } else if (persona.email === "employee_test@rtl-bank.test") {
        const assigned = await findOrInsertUpa(client, anchorTenantId, u.userId, subPos.positionId);
        upa = { positionCode: "TEST_SUB_POS", assigned };
      } else if (persona.email === "outsider_test@rtl-bank.test") {
        const assigned = await findOrInsertUpa(client, anchorTenantId, u.userId, outsiderPos.positionId);
        upa = { positionCode: "TEST_OUTSIDER_POS", assigned };
      }

      report.push({
        email: persona.email,
        userId: u.userId,
        created: u.created,
        roleGranted: granted,
        upa,
      });
    }

    // 5. Owner backfill — set TEST_MGR_POS owner = manager_test so the
    //    "MANAGER can update own positions" scope test has a target.
    const mgrUserRow = report.find((r) => r.email === "manager_test@rtl-bank.test");
    if (mgrUserRow) {
      await client.query(
        `UPDATE sys.sys_positions
            SET position_owner_user_id = $1, updated_at = now()
          WHERE position_id = $2 AND (position_owner_user_id IS DISTINCT FROM $1)`,
        [mgrUserRow.userId, mgrPos.positionId],
      );
    }

    await client.query("COMMIT");

    console.log("─".repeat(76));
    console.log("Test fixtures seeded:");
    console.log(`  tenant   : RTL_BANK_REFERENCE (${anchorTenantId})`);
    console.log(`  positions: TEST_MGR_POS=${mgrPos.created ? "CREATED" : "EXISTS"}` +
      ` TEST_SUB_POS=${subPos.created ? "CREATED" : "EXISTS"}` +
      ` TEST_OUTSIDER_POS=${outsiderPos.created ? "CREATED" : "EXISTS"}`);
    for (const r of report) {
      const flags = [
        r.created.user ? "user=CREATED" : "user=EXISTS",
        r.created.identity ? "identity=CREATED" : "identity=EXISTS",
        r.created.credential ? "credential=CREATED" : "credential=EXISTS",
        `role=${r.roleGranted ? "GRANTED" : "EXISTS"}`,
      ];
      if (r.upa) flags.push(`upa(${r.upa.positionCode})=${r.upa.assigned ? "ASSIGNED" : "EXISTS"}`);
      console.log(`  ${r.email.padEnd(34)} ${flags.join(" ")}`);
    }
    console.log(`  password : ${password}` +
      (process.env.TEST_ADMIN_PASSWORD ? " (env)" : " (default — set TEST_ADMIN_PASSWORD env to override)"));
    console.log("─".repeat(76));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-test-admin FAILED:", err);
  process.exit(1);
});
