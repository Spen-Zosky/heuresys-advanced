/**
 * apps/api/test/employee-centric-doctrine.integration.test.ts
 *
 * 1a PERMANENT CI GUARD (WS-1) — locks in the employee-centric ingestion doctrine
 * (ADR-0024 / I14, EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md §3.2 / §4).
 *
 * The canonical person crosswalk key is `sys_users.user_external_code = 'LEGACY_EMP::' || employees.id`.
 * The deprecated user-centric key `'LEGACY:' || users.id` (mig 000046 relabel) must NEVER reappear:
 * it imports the auth shell as if it were the person and drops account-less employees.
 *
 * This guard asserts, against the LIVE DB (raw pool, no HTTP — fast + ungated):
 *  (a) ZERO rows key persons on the deprecated 'LEGACY:%' scheme;
 *  (b) every 'LEGACY_EMP::%' external_code is distinct + well-formed (a real UUID after the '::');
 *  (c) FK + tenant integrity of the WS-1-populated sys_user_* satellites: every satellite's
 *      user_id exists in sys_users AND its tenant_id equals that user's tenant (tenant isolation = FK, I5).
 *
 * It must PASS now and forever guard against user-centric re-keying. No mocks, no fixtures —
 * the assertions are derived entirely from the real seeded state (S950 rebuild, re-keyed S954/WS-1).
 */

import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";

// The WS-1 employee-centric satellites + their (user_id, tenant_id) column pair.
// FK integrity + tenant isolation are checked uniformly across all of them; tables that are
// still legitimately empty (blocked/skipped) trivially pass (0 offending rows).
const SATELLITES: { table: string; userCol: string; tenantCol: string }[] = [
  { table: "sys_user_profiles", userCol: "user_profile_user_id", tenantCol: "user_profile_tenant_id" },
  { table: "sys_user_education_records", userCol: "user_education_record_user_id", tenantCol: "user_education_record_tenant_id" },
  { table: "sys_user_professional_experiences", userCol: "user_prof_exp_user_id", tenantCol: "user_prof_exp_tenant_id" },
  { table: "sys_user_learning_evidence", userCol: "user_learning_evidence_user_id", tenantCol: "user_learning_evidence_tenant_id" },
  { table: "sys_user_assessment_evidence", userCol: "user_assessment_evidence_user_id", tenantCol: "user_assessment_evidence_tenant_id" },
  { table: "sys_user_kpi_evidence", userCol: "user_kpi_evidence_user_id", tenantCol: "user_kpi_evidence_tenant_id" },
];

describe("employee-centric ingestion doctrine (ADR-0024 / I14) — permanent guard", () => {
  afterAll(async () => {
    await closePool();
  });

  it("(a) NO person is keyed on the deprecated user-centric 'LEGACY:%' scheme", async () => {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_external_code LIKE 'LEGACY:%'`,
    );
    expect(Number(rows[0]!.n)).toBe(0);
  });

  it("(b) every 'LEGACY_EMP::%' external_code is distinct and well-formed (UUID after '::')", async () => {
    // Distinctness: no two persons share the same legacy-employee crosswalk key.
    const dup = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM (
         SELECT user_external_code
         FROM sys.sys_users
         WHERE user_external_code LIKE 'LEGACY_EMP::%'
         GROUP BY user_external_code
         HAVING count(*) > 1
       ) d`,
    );
    expect(Number(dup.rows[0]!.n)).toBe(0);

    // Well-formedness: the suffix after 'LEGACY_EMP::' is a canonical UUID.
    const malformed = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n
       FROM sys.sys_users
       WHERE user_external_code LIKE 'LEGACY_EMP::%'
         AND substring(user_external_code FROM 13)
             !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`,
    );
    expect(Number(malformed.rows[0]!.n)).toBe(0);

    // There must be at least one such person (the crosswalk is live, not vacuously satisfied).
    const present = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_users WHERE user_external_code LIKE 'LEGACY_EMP::%'`,
    );
    expect(Number(present.rows[0]!.n)).toBeGreaterThan(0);
  });

  it("(c) every populated satellite row references a real sys_users row (FK integrity)", async () => {
    for (const s of SATELLITES) {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM sys.${s.table} sat
         LEFT JOIN sys.sys_users u ON u.user_id = sat.${s.userCol}
         WHERE u.user_id IS NULL`,
      );
      expect(Number(rows[0]!.n), `orphan ${s.table} rows (user_id not in sys_users)`).toBe(0);
    }
  });

  it("(c) every populated satellite row's tenant_id matches its user's tenant (isolation = FK, I5)", async () => {
    for (const s of SATELLITES) {
      const { rows } = await pool.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM sys.${s.table} sat
         JOIN sys.sys_users u ON u.user_id = sat.${s.userCol}
         WHERE sat.${s.tenantCol} IS DISTINCT FROM u.user_tenant_id`,
      );
      expect(Number(rows[0]!.n), `tenant mismatch in ${s.table} (satellite tenant != user tenant)`).toBe(0);
    }
  });
});
