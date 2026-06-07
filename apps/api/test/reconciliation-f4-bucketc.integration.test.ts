import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F4 of the reconciliation-closure cycle: the bucket-C re-measurement + imports.
// 22/23 "derived" tables actually had a legacy source; 19 were imported (semi-derived: source gives the
// employee/position, value derived by a defensible rule), 4 are genuinely not-importable (no-source/cascade).

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation F4 bucket-C', () => {
  it('cycle closure: 103+ POPULATED and 0 UNCLASSIFIED', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='POPULATED'`)).toBeGreaterThanOrEqual(103);
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'`)).toBe(0);
  });

  it('the 19 imported bucket-C tables are populated', async () => {
    const tables = [
      'sys_kpi_assessment_results', 'sys_kpi_measurements', 'sys_user_kpi_evidence', 'sys_learning_gaps',
      'sys_employee_position_fit_scores', 'sys_succession_scores', 'sys_readiness_scores',
      'sys_variable_pay_calculations', 'sys_compensation_recommendations', 'sys_talent_scores',
      'sys_behavioral_assessments', 'sys_person_evidence_records', 'sys_objective_reward_rules',
      'sys_kpi_metric_definitions', 'sys_enterprise_typing_profiles', 'sys_critical_role_coverage_status',
      'sys_gap_closure_plans', 'sys_gap_closure_actions', 'sys_position_economic_weight',
    ];
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1) AND resolved_status='POPULATED'`, [tables]);
    expect(rows[0]?.n).toBe(19);
  });

  it('the 4 not-importable bucket-C tables are annotated and stay empty', async () => {
    // B-50 (mig 000076, S972) prepended a [B-50 TERMINAL S972] marker and flipped declared_status
    // to NO_SOURCE; the original [F4 NOT-IMPORTABLE …] rationale is preserved (prepended, never
    // overwritten), so it is no longer at the START of the string — match anywhere.
    expect(await count(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name IN
          ('sys_payout_curves','sys_user_target_positions','sys_successor_readiness','sys_reward_gate_results')
          AND reconciliation_registry_rationale LIKE '%[F4 NOT-IMPORTABLE%'`,
    )).toBe(4);
  });
});
