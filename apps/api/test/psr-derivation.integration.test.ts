import { describe, it, expect, afterAll } from "vitest";
import { pool, closePool } from "../src/db/client.js";

// ② Fase 3 — PSR-population (mig 000096): sys.sys_position_skill_requirements derived via
// peer-group-prevalence-v1 (job_role→skill, tenant-local). These assertions lock the
// derivation invariants so a future schema/data change can't silently empty or corrupt it.

const MARKER = "peer-group-prevalence-v1";
const PROFS = ["NOVICE", "BASIC", "COMPETENT", "PROFICIENT", "EXPERT", "MASTER"];
const CRITS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

afterAll(async () => {
  await closePool();
});

describe("② Fase 3 PSR derivation (mig 000096)", () => {
  it("derived requirement rows exist and all carry the provenance marker", async () => {
    const { rows } = await pool.query<{ derived: string; total: string }>(
      `SELECT count(*) FILTER (WHERE position_skill_requirement_metadata->>'derived_by' = $1)::text AS derived,
              count(*)::text AS total
         FROM sys.sys_position_skill_requirements`,
      [MARKER],
    );
    expect(Number(rows[0]!.derived)).toBeGreaterThan(0);
    // in this DB every PSR row is derived (no manual authoring yet); allow manual rows in future.
    expect(Number(rows[0]!.total)).toBeGreaterThanOrEqual(Number(rows[0]!.derived));
  });

  it("every derived row has a valid proficiency, criticality, weight and >=2 holders", async () => {
    const { rows } = await pool.query<{
      bad_prof: string; bad_crit: string; bad_weight: string; bad_holders: string;
    }>(
      `SELECT
         count(*) FILTER (WHERE required_proficiency <> ALL($2))::text AS bad_prof,
         count(*) FILTER (WHERE criticality <> ALL($3))::text AS bad_crit,
         count(*) FILTER (WHERE weight < 0.34 OR weight > 1)::text AS bad_weight,
         count(*) FILTER (WHERE (position_skill_requirement_metadata->>'holders')::int < 2)::text AS bad_holders
       FROM sys.sys_position_skill_requirements
       WHERE position_skill_requirement_metadata->>'derived_by' = $1`,
      [MARKER, PROFS, CRITS],
    );
    expect(Number(rows[0]!.bad_prof)).toBe(0);
    expect(Number(rows[0]!.bad_crit)).toBe(0);
    expect(Number(rows[0]!.bad_weight)).toBe(0);
    expect(Number(rows[0]!.bad_holders)).toBe(0);
  });

  it("criticality band matches the weight (prevalence) it was derived from", async () => {
    const { rows } = await pool.query<{ mismatched: string }>(
      `SELECT count(*)::text AS mismatched
         FROM sys.sys_position_skill_requirements
         WHERE position_skill_requirement_metadata->>'derived_by' = $1
           AND criticality <> CASE WHEN weight >= 0.8 THEN 'CRITICAL' WHEN weight >= 0.6 THEN 'HIGH'
                                   WHEN weight >= 0.4 THEN 'MEDIUM' ELSE 'LOW' END`,
      [MARKER],
    );
    expect(Number(rows[0]!.mismatched)).toBe(0);
  });

  it("no duplicate (position, skill) pairs (UQ invariant)", async () => {
    const { rows } = await pool.query<{ dups: string }>(
      `SELECT count(*)::text AS dups FROM (
         SELECT position_id, skill_id FROM sys.sys_position_skill_requirements
         GROUP BY 1, 2 HAVING count(*) > 1) d`,
    );
    expect(Number(rows[0]!.dups)).toBe(0);
  });

  it("I5: every requirement's tenant equals its position's tenant (no cross-tenant leak)", async () => {
    const { rows } = await pool.query<{ leaked: string }>(
      `SELECT count(*)::text AS leaked
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_positions p ON p.position_id = r.position_id
        WHERE r.position_skill_requirement_tenant_id <> p.position_tenant_id`,
    );
    expect(Number(rows[0]!.leaked)).toBe(0);
  });

  it("the reconciliation registry resolves PSR to POPULATED", async () => {
    const { rows } = await pool.query<{ resolved: string }>(
      `SELECT resolved_status AS resolved FROM sys.v_reconciliation_status
        WHERE table_name = 'sys_position_skill_requirements'`,
    );
    expect(rows[0]!.resolved).toBe("POPULATED");
  });
});
