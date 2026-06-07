import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F1 of the reconciliation-closure cycle. Asserts the registry + view shipped by
// migration 000058 + seed 04_registry.sql. Hits the live DB via the tunnel (no mocks),
// consistent with the rest of the integration suite. The pool is shared across the
// suite (singleThread) so this file does NOT close it.

describe('reconciliation registry (F1)', () => {
  it('registry holds exactly 84 rows with the signed-off bucket split A19/B16/C23/D26', async () => {
    const { rows } = await pool.query<{ b: string; n: number }>(
      `SELECT reconciliation_registry_bucket AS b, count(*)::int AS n
         FROM sys.sys_reconciliation_registry GROUP BY 1`,
    );
    const m = Object.fromEntries(rows.map((r: { b: string; n: number }) => [r.b, r.n]));
    // S960 baseline was 65 (A5/B16/C23/D21). S961 registered 9 new sys.* tables introduced
    // after the F1 snapshot, each recorded to keep the registry 0-UNCLASSIFIED:
    //   +4 bucket-D EXCLUDE — D7-P0 pgvector embedding tables (mig 000062)
    //   +1 bucket-A IMPORT  — D4 sys_organization_unit_templates (mig 000064)
    //   +4 bucket-A IMPORT  — D6 SDBI perf/feedback tables (mig 000065)
    //   +4 bucket-A IMPORT  — S970 mentorship m1: programs/pairings/sessions/match_scores (mig 000072 + seed 45)
    //   +3 bucket-A IMPORT  — S973 surveys m2: engagement survey templates/surveys/responses (mig 000077 + seed 46)
    //   +2 bucket-A IMPORT  — S973 predictionsml m3: predictive models + model predictions (mig 000079 + seed 47)
    //   +1 bucket-D EXCLUDE — S974 MVP-4 sys_auth_mfa_otp_challenges (EMAIL_OTP infra, mig 000081)
    expect(m).toEqual({ A: 19, B: 16, C: 23, D: 26 });
  });

  it('the v_reconciliation_status view leaves zero UNCLASSIFIED tables', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('every B (wall) row names a structural wall', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket = 'B' AND reconciliation_registry_wall IS NULL`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('every A/B row carries a legacy_source (a real importable source)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket IN ('A', 'B') AND reconciliation_registry_legacy_source IS NULL`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('the registry table is excluded from its own view (no self-classification)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status
        WHERE table_name = 'sys_reconciliation_registry'`,
    );
    expect(rows[0]?.n).toBe(0);
  });
});

// B-50 terminal-annotation close (S972, mig 000076): the 7 residual-wall tables that
// used to RESOLVE to NEEDS_DECISION in the view were moved to explicit terminal/deferred
// states. 4 -> NO_SOURCE (no usable 1:1 populated source), 3 -> kept NEEDS_DECISION with
// an explicit DEFER rationale (legacy source EXISTS but blocked on a PM bridge / Wave-2).
// NO sys.* business table was populated — this is registry bookkeeping only.
describe('reconciliation registry — B-50 residual-wall terminal close (S972)', () => {
  const TERMINAL_NO_SOURCE = [
    'sys_payout_curves',
    'sys_reward_gate_results',
    'sys_successor_readiness',
    'sys_user_target_positions',
  ] as const;
  const DEFER_NEEDS_DECISION = [
    'sys_branches',
    'sys_succession_pools',
    'sys_successor_candidates',
  ] as const;

  it('view-wide NEEDS_DECISION dropped to exactly 3 (was 7 before B-50)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'NEEDS_DECISION'`,
    );
    expect(rows[0]?.n).toBe(3);
  });

  it('the 4 terminal tables resolve to NO_SOURCE in the view', async () => {
    const { rows } = await pool.query<{ table_name: string; resolved_status: string }>(
      `SELECT table_name, resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1::text[]) ORDER BY table_name`,
      [TERMINAL_NO_SOURCE as unknown as string[]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...TERMINAL_NO_SOURCE].sort());
    expect(rows.every((r) => r.resolved_status === 'NO_SOURCE')).toBe(true);
  });

  it('the 4 terminal tables carry declared_status NO_SOURCE + a B-50 TERMINAL rationale', async () => {
    const { rows } = await pool.query<{ table_name: string; declared: string; marked: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              reconciliation_registry_declared_status AS declared,
              (reconciliation_registry_rationale LIKE '%[B-50 TERMINAL S972]%') AS marked
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [TERMINAL_NO_SOURCE as unknown as string[]],
    );
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.declared === 'NO_SOURCE')).toBe(true);
    expect(rows.every((r) => r.marked === true)).toBe(true);
  });

  it('the 3 defer tables remain NEEDS_DECISION in the view', async () => {
    const { rows } = await pool.query<{ table_name: string; resolved_status: string }>(
      `SELECT table_name, resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1::text[]) ORDER BY table_name`,
      [DEFER_NEEDS_DECISION as unknown as string[]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...DEFER_NEEDS_DECISION].sort());
    expect(rows.every((r) => r.resolved_status === 'NEEDS_DECISION')).toBe(true);
  });

  it('the 3 defer tables carry a non-empty explicit DEFER rationale (PM-bridge / Wave-2 blocker)', async () => {
    const { rows } = await pool.query<{ table_name: string; rationale: string; marked: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              reconciliation_registry_rationale AS rationale,
              (reconciliation_registry_rationale LIKE '%[B-50 DEFER S972]%') AS marked
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [DEFER_NEEDS_DECISION as unknown as string[]],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.marked === true)).toBe(true);
    expect(rows.every((r) => (r.rationale?.trim().length ?? 0) > 0)).toBe(true);
    // each DEFER rationale must reference the PM semantic authority / Wave-2 blocker
    expect(rows.every((r) => /PM semantic authority|Wave-2|bridge/i.test(r.rationale))).toBe(true);
  });

  it('all 7 residual-wall tables remain EMPTY (no data fabricated by the terminal close)', async () => {
    const all = [...TERMINAL_NO_SOURCE, ...DEFER_NEEDS_DECISION];
    for (const t of all) {
      const { rows } = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM sys.${t}`,
      );
      expect(rows[0]?.n, `${t} must be empty`).toBe(0);
    }
  });
});
