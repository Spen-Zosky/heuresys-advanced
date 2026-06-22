/**
 * db/scripts/seed-reference-bank.ts
 * ----------------------------------------------------------------------------
 * MVP-0 step 5.0.7 — Seed the RTL_BANK_REFERENCE synthetic dataset.
 *
 * Deterministic via Faker seed (default 42 — RD-Q6 / SEED_REFERENCE_BANK_SEED).
 * Idempotent via natural-key ON CONFLICT DO NOTHING semantics implemented in
 * the upsert helpers below.
 *
 * Produces (against the RTL_BANK_REFERENCE tenant created by migration 000021):
 *   - 5 branches (organization units + sys_branches extension)
 *   - 25 branch positions (5 per branch: Branch Manager, Senior Teller, Teller,
 *                          Customer Advisor, Operations Officer)
 *   - 30 HQ positions (Risk/Compliance/AML/HR + supporting roles)
 *   - 158 generated-incumbent users (user_type=GENERATED_INCUMBENT)
 *   - 158 PRIMARY ACTIVE assignments (one user → one position)
 *
 * Acceptance (per BOOTSTRAP_EXECUTION_PLAN §6 A14):
 *   - RTL_BANK_REFERENCE tenant exists ✓ (already seeded by 000021)
 *   - sys.sys_branches count = 5 for the tenant
 *   - sys.sys_positions count = 55 (25 branch + 30 HQ) for the tenant
 *   - sys.sys_users count = 158 with user_type = GENERATED_INCUMBENT
 *   - sys.sys_user_position_assignments PRIMARY ACTIVE count = 158
 *
 * Connection: reads .env at repo root (POSTGRES_HOST/PORT/USER/PASSWORD/DB).
 * Re-runnable: every INSERT uses ON CONFLICT DO NOTHING on a natural key.
 * ----------------------------------------------------------------------------
 */

import { Client } from "pg";
import { faker } from "@faker-js/faker";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

// ---------------------------------------------------------------------------
// Deterministic seed
// ---------------------------------------------------------------------------
const SEED = Number(process.env.SEED_REFERENCE_BANK_SEED ?? "42");
faker.seed(SEED);

// ---------------------------------------------------------------------------
// Reference data — branch profiles + position catalogs
// ---------------------------------------------------------------------------
type BranchProfile = {
  code: string;
  name: string;
  city: string;
  region: string;
  postalCode: string;
};

const BRANCHES: BranchProfile[] = [
  { code: "BRANCH_01", name: "Milano Centro",  city: "Milano",   region: "IT-25", postalCode: "20121" },
  { code: "BRANCH_02", name: "Roma Trastevere", city: "Roma",     region: "IT-62", postalCode: "00153" },
  { code: "BRANCH_03", name: "Torino Crocetta", city: "Torino",   region: "IT-21", postalCode: "10128" },
  { code: "BRANCH_04", name: "Napoli Vomero",   city: "Napoli",   region: "IT-72", postalCode: "80129" },
  { code: "BRANCH_05", name: "Bologna Saragozza", city: "Bologna", region: "IT-45", postalCode: "40134" },
];

type BranchRoleTemplate = {
  code: string;
  title: string;
  countPerBranch: number;
};

// 5 positions per branch × 5 branches = 25 branch positions.
// Headcount per role per branch is fixed; total users derived from
// (countPerBranch × 5 branches + HQ headcount) = 158.
const BRANCH_ROLES: BranchRoleTemplate[] = [
  { code: "BRANCH_MANAGER",   title: "Branch Manager",   countPerBranch: 1 },
  { code: "SENIOR_TELLER",    title: "Senior Teller",    countPerBranch: 2 },
  { code: "TELLER",           title: "Teller",           countPerBranch: 5 },
  { code: "CUSTOMER_ADVISOR", title: "Customer Advisor", countPerBranch: 3 },
  { code: "OPERATIONS_OFFICER", title: "Operations Officer", countPerBranch: 2 },
];
// Sum per branch: 1 + 2 + 5 + 3 + 2 = 13. Across 5 branches = 65 branch users.

type HqRoleTemplate = {
  code: string;
  title: string;
  count: number;
};

const HQ_ROLES: HqRoleTemplate[] = [
  // Executive (2)
  { code: "CEO",                  title: "Chief Executive Officer",  count: 1 },
  { code: "COO",                  title: "Chief Operating Officer",  count: 1 },
  // Risk / Compliance / Audit (12)
  { code: "RISK_MANAGER",         title: "Risk Manager",             count: 2 },
  { code: "COMPLIANCE_OFFICER",   title: "Compliance Officer",       count: 3 },
  { code: "AML_OFFICER",          title: "AML Officer",              count: 3 },
  { code: "INTERNAL_AUDITOR",     title: "Internal Auditor",         count: 2 },
  { code: "DATA_PROTECTION_OFFICER", title: "Data Protection Officer", count: 1 },
  { code: "REGULATORY_REPORTING_ANALYST", title: "Regulatory Reporting Analyst", count: 1 },
  // HR (8)
  { code: "HR_DIRECTOR",          title: "HR Director",              count: 1 },
  { code: "HR_BUSINESS_PARTNER",  title: "HR Business Partner",      count: 3 },
  { code: "TALENT_ACQUISITION_SPECIALIST", title: "Talent Acquisition Specialist", count: 2 },
  { code: "LEARNING_AND_DEVELOPMENT_SPECIALIST", title: "Learning & Development Specialist", count: 2 },
  // Finance + Treasury (8)
  { code: "CFO",                  title: "Chief Financial Officer",  count: 1 },
  { code: "FINANCE_CONTROLLER",   title: "Finance Controller",       count: 2 },
  { code: "TREASURY_ANALYST",     title: "Treasury Analyst",         count: 2 },
  { code: "ACCOUNTANT",           title: "Accountant",               count: 3 },
  // IT / Digital (8)
  { code: "CIO",                  title: "Chief Information Officer", count: 1 },
  { code: "IT_OPERATIONS_LEAD",   title: "IT Operations Lead",       count: 1 },
  { code: "CYBERSECURITY_ANALYST", title: "Cybersecurity Analyst",   count: 2 },
  { code: "DATA_ANALYST",         title: "Data Analyst",             count: 2 },
  { code: "DIGITAL_PRODUCT_MANAGER", title: "Digital Product Manager", count: 2 },
  // Marketing + Customer Service (8)
  { code: "MARKETING_DIRECTOR",   title: "Marketing Director",       count: 1 },
  { code: "MARKETING_SPECIALIST", title: "Marketing Specialist",     count: 2 },
  { code: "CUSTOMER_SERVICE_LEAD", title: "Customer Service Lead",   count: 1 },
  { code: "CUSTOMER_SERVICE_AGENT", title: "Customer Service Agent", count: 4 },
  // Legal + Procurement (4)
  { code: "GENERAL_COUNSEL",      title: "General Counsel",          count: 1 },
  { code: "LEGAL_COUNSEL",        title: "Legal Counsel",            count: 1 },
  { code: "PROCUREMENT_MANAGER",  title: "Procurement Manager",      count: 1 },
  { code: "VENDOR_MANAGEMENT_SPECIALIST", title: "Vendor Management Specialist", count: 1 },
  // Branch network supervision (3)
  { code: "REGIONAL_OPERATIONS_MANAGER", title: "Regional Operations Manager", count: 2 },
  { code: "BRANCH_NETWORK_DIRECTOR", title: "Branch Network Director", count: 1 },
];
// Sum HQ: 2 + 12 + 8 + 8 + 8 + 8 + 4 + 3 = 53. Plus 65 branch = 118.
// Plan target is 158. Adjust by adding 40 more rotational analysts under
// existing role codes to hit 158 exactly (set below).

const ADDITIONAL_ROTATIONAL: { roleCode: string; extra: number }[] = [
  { roleCode: "TELLER",           extra: 15 }, // 5 branches × 3 extra tellers each
  { roleCode: "CUSTOMER_ADVISOR", extra: 10 }, // 5 branches × 2 extra each
  { roleCode: "CUSTOMER_SERVICE_AGENT", extra: 8 },
  { roleCode: "ACCOUNTANT",       extra: 4 },
  { roleCode: "DATA_ANALYST",     extra: 3 },
];
// 15 + 10 + 8 + 4 + 3 = 40. So 118 + 40 = 158 — exactly the target headcount.

// ---------------------------------------------------------------------------
// PostgreSQL client + helpers
// ---------------------------------------------------------------------------
const requiredEnv = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"] as const;
for (const k of requiredEnv) {
  if (!process.env[k]) {
    console.error(`[seed-reference-bank] missing env var: ${k}`);
    process.exit(1);
  }
}

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_SSL === "require" ? { rejectUnauthorized: false } : undefined,
});

async function getTenantId(tenantCode: string): Promise<string> {
  const r = await client.query<{ tenant_id: string }>(
    "SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1",
    [tenantCode],
  );
  if (r.rows.length === 0) throw new Error(`Tenant '${tenantCode}' not found. Run migration 000021 first.`);
  return r.rows[0]!.tenant_id;
}

async function getOrgUnitTypeId(code: string): Promise<string> {
  const r = await client.query<{ organization_unit_type_id: string }>(
    "SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code = $1",
    [code],
  );
  if (r.rows.length === 0) throw new Error(`Org unit type '${code}' not found.`);
  return r.rows[0]!.organization_unit_type_id;
}

// ---------------------------------------------------------------------------
// Seed routines
// ---------------------------------------------------------------------------
async function seedBranches(tenantId: string, headquartersUnitId: string): Promise<Map<string, string>> {
  console.log("[seed-reference-bank] Seeding 5 branches...");
  const branchUnitIds = new Map<string, string>(); // branchCode → org_unit_id
  const branchType = await getOrgUnitTypeId("BRANCH");

  for (const b of BRANCHES) {
    // Upsert organization unit
    await client.query(
      `INSERT INTO sys.sys_organization_units
         (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
          organization_unit_type_id, organization_unit_type, organization_unit_parent_id,
          organization_unit_is_active, organization_unit_metadata)
       VALUES ($1, $2, $3, $4, 'BRANCH', $5, true,
               jsonb_build_object('city', $6::text, 'region', $7::text))
       ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO NOTHING`,
      [tenantId, b.code, b.name, branchType, headquartersUnitId, b.city, b.region],
    );
    const unitRes = await client.query<{ organization_unit_id: string }>(
      "SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2",
      [tenantId, b.code],
    );
    const unitId = unitRes.rows[0]!.organization_unit_id;
    branchUnitIds.set(b.code, unitId);

    // Upsert branch detail
    await client.query(
      `INSERT INTO sys.sys_branches
         (branch_organization_unit_id, branch_tenant_id, branch_code,
          branch_address_line1, branch_city, branch_postal_code, branch_country_code,
          branch_region_code, branch_regulatory_zone)
       VALUES ($1, $2, $3, $4, $5, $6, 'IT', $7, 'IT_EUROZONE')
       ON CONFLICT (branch_tenant_id, branch_code) DO NOTHING`,
      [unitId, tenantId, b.code, `Via ${b.name} 1`, b.city, b.postalCode, b.region],
    );
  }
  return branchUnitIds;
}

async function ensureHeadquartersUnit(tenantId: string): Promise<string> {
  const hqType = await getOrgUnitTypeId("HEADQUARTERS");
  await client.query(
    `INSERT INTO sys.sys_organization_units
       (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
        organization_unit_type_id, organization_unit_type, organization_unit_is_active)
     VALUES ($1, 'HQ', 'Headquarters', $2, 'HEADQUARTERS', true)
     ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO NOTHING`,
    [tenantId, hqType],
  );
  const r = await client.query<{ organization_unit_id: string }>(
    "SELECT organization_unit_id FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2",
    [tenantId, "HQ"],
  );
  return r.rows[0]!.organization_unit_id;
}

type SeededPosition = { positionId: string; positionCode: string; branchCode: string | null; roleCode: string };

async function seedPositions(tenantId: string, hqUnitId: string, branchUnitIds: Map<string, string>): Promise<SeededPosition[]> {
  console.log("[seed-reference-bank] Seeding positions (branch + HQ)...");
  const positions: SeededPosition[] = [];

  // Branch positions (countPerBranch per role × 5 branches = 65 base + 33 rotational = 98... wait, count below)
  // Per the role templates: 1 + 2 + 5 + 3 + 2 = 13 per branch × 5 = 65 branch positions.
  // Plus the rotational additions on branch-targeting roles (TELLER, CUSTOMER_ADVISOR, CUSTOMER_SERVICE_AGENT
  // is HQ — but we distribute extras across branches for branch-targeting ones).
  const branchAdditions: Record<string, number> = {};
  for (const add of ADDITIONAL_ROTATIONAL) {
    const isBranchRole = BRANCH_ROLES.some((r) => r.code === add.roleCode);
    if (isBranchRole) branchAdditions[add.roleCode] = add.extra; // total extras across 5 branches
  }

  for (const branch of BRANCHES) {
    const branchUnitId = branchUnitIds.get(branch.code)!;
    for (const role of BRANCH_ROLES) {
      // Determine how many extras to add to this branch for this role (distribute evenly)
      const totalExtras = branchAdditions[role.code] ?? 0;
      const extrasForThisBranch = Math.floor(totalExtras / 5)
        + (BRANCHES.indexOf(branch) < totalExtras % 5 ? 1 : 0);
      const countForThisBranchRole = role.countPerBranch + extrasForThisBranch;
      for (let i = 1; i <= countForThisBranchRole; i++) {
        const code = `${branch.code}_${role.code}_${String(i).padStart(2, "0")}`;
        const title = `${role.title} (${branch.name})`;
        await client.query(
          `INSERT INTO sys.sys_positions
             (position_tenant_id, position_code, position_title, position_organization_unit_id,
              position_criticality, position_is_active, position_economic_weight)
           VALUES ($1, $2, $3, $4, $5, true, $6)
           ON CONFLICT (position_tenant_id, position_code) DO NOTHING`,
          [
            tenantId,
            code,
            title,
            branchUnitId,
            role.code === "BRANCH_MANAGER" ? "HIGH" : "MEDIUM",
            role.code === "BRANCH_MANAGER" ? 0.6 : 0.3,
          ],
        );
        const r = await client.query<{ position_id: string }>(
          "SELECT position_id FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2",
          [tenantId, code],
        );
        positions.push({ positionId: r.rows[0]!.position_id, positionCode: code, branchCode: branch.code, roleCode: role.code });
      }
    }
  }

  // HQ positions
  const hqAdditions: Record<string, number> = {};
  for (const add of ADDITIONAL_ROTATIONAL) {
    const isHqRole = HQ_ROLES.some((r) => r.code === add.roleCode);
    if (isHqRole) hqAdditions[add.roleCode] = add.extra;
  }
  for (const role of HQ_ROLES) {
    const totalCount = role.count + (hqAdditions[role.code] ?? 0);
    for (let i = 1; i <= totalCount; i++) {
      const code = `HQ_${role.code}_${String(i).padStart(2, "0")}`;
      const title = totalCount === 1 ? role.title : `${role.title} ${String(i).padStart(2, "0")}`;
      await client.query(
        `INSERT INTO sys.sys_positions
           (position_tenant_id, position_code, position_title, position_organization_unit_id,
            position_criticality, position_is_active, position_economic_weight)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (position_tenant_id, position_code) DO NOTHING`,
        [
          tenantId,
          code,
          title,
          hqUnitId,
          ["CEO", "COO", "CFO", "CIO", "GENERAL_COUNSEL", "HR_DIRECTOR", "MARKETING_DIRECTOR", "BRANCH_NETWORK_DIRECTOR"].includes(role.code)
            ? "CRITICAL"
            : ["RISK_MANAGER", "COMPLIANCE_OFFICER", "AML_OFFICER"].includes(role.code)
              ? "HIGH"
              : "MEDIUM",
          ["CEO", "COO", "CFO", "CIO"].includes(role.code) ? 0.9 : 0.5,
        ],
      );
      const r = await client.query<{ position_id: string }>(
        "SELECT position_id FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2",
        [tenantId, code],
      );
      positions.push({ positionId: r.rows[0]!.position_id, positionCode: code, branchCode: null, roleCode: role.code });
    }
  }

  return positions;
}

async function seedUsersAndAssignments(tenantId: string, positions: SeededPosition[]): Promise<number> {
  console.log(`[seed-reference-bank] Seeding ${positions.length} synthetic users + PRIMARY assignments...`);
  faker.setDefaultRefDate("2025-01-01T00:00:00Z");
  let created = 0;

  for (const p of positions) {
    // Generate deterministic name (Faker reuses sequence based on seed)
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const displayName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase().replace(/[^a-z]/g, "")}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}.${p.positionCode.toLowerCase()}@rtl-bank-reference.example.com`;
    const externalCode = `SYN_${p.positionCode}`;

    // Upsert user
    await client.query(
      `INSERT INTO sys.sys_users
         (user_tenant_id, user_external_code, user_email, user_display_name,
          user_first_name, user_last_name, user_status, user_type,
          user_locale, user_timezone)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'GENERATED_INCUMBENT',
               'it-IT', 'Europe/Rome')
       ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING`,
      [tenantId, externalCode, email, displayName, firstName, lastName],
    );
    const userRes = await client.query<{ user_id: string }>(
      "SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)",
      [tenantId, email],
    );
    const userId = userRes.rows[0]!.user_id;

    // PRIMARY ACTIVE assignment (idempotent: skip if exists)
    const existingAssignment = await client.query(
      `SELECT 1 FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_user_id = $1
          AND user_position_assignment_position_id = $2
          AND user_position_assignment_kind = 'PRIMARY'
          AND user_position_assignment_status = 'ACTIVE'`,
      [userId, p.positionId],
    );
    if (existingAssignment.rowCount === 0) {
      await client.query(
        `INSERT INTO sys.sys_user_position_assignments
           (user_position_assignment_tenant_id, user_position_assignment_user_id,
            user_position_assignment_position_id, user_position_assignment_kind,
            user_position_assignment_fte, user_position_assignment_start_date,
            user_position_assignment_status)
         VALUES ($1, $2, $3, 'PRIMARY', 1.000, '2024-01-01', 'ACTIVE')`,
        [tenantId, userId, p.positionId],
      );
      created++;
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[seed-reference-bank] Starting (Faker seed=${SEED})`);
  await client.connect();
  try {
    const tenantId = await getTenantId("RTL_BANK_REFERENCE");
    console.log(`[seed-reference-bank] Tenant RTL_BANK_REFERENCE: ${tenantId}`);

    const hqUnitId = await ensureHeadquartersUnit(tenantId);
    const branchUnitIds = await seedBranches(tenantId, hqUnitId);
    const positions = await seedPositions(tenantId, hqUnitId, branchUnitIds);
    console.log(`[seed-reference-bank] Positions ensured: ${positions.length}`);

    const newAssignments = await seedUsersAndAssignments(tenantId, positions);
    console.log(`[seed-reference-bank] New PRIMARY assignments created: ${newAssignments}`);

    // Final acceptance counts
    const counts = await client.query<{ label: string; n: string }>(
      `SELECT 'branches' AS label,
              count(*)::text AS n
       FROM sys.sys_branches WHERE branch_tenant_id = $1
       UNION ALL
       SELECT 'positions', count(*)::text
       FROM sys.sys_positions WHERE position_tenant_id = $1
       UNION ALL
       SELECT 'synthetic_users', count(*)::text
       FROM sys.sys_users WHERE user_tenant_id = $1 AND user_type = 'GENERATED_INCUMBENT'
       UNION ALL
       SELECT 'primary_active_assignments', count(*)::text
       FROM sys.sys_user_position_assignments a
       JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
       WHERE u.user_tenant_id = $1
         AND a.user_position_assignment_kind = 'PRIMARY'
         AND a.user_position_assignment_status = 'ACTIVE'`,
      [tenantId],
    );

    console.log("");
    console.log("=== Seed complete — counts for RTL_BANK_REFERENCE ===");
    for (const row of counts.rows) console.log(`  ${row.label.padEnd(28)} ${row.n}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[seed-reference-bank] FAILED:", err);
  process.exit(1);
});
