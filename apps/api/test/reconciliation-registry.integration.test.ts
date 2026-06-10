import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F1 of the reconciliation-closure cycle. Asserts the registry + view shipped by
// migration 000058 + seed 04_registry.sql. Hits the live DB via the tunnel (no mocks),
// consistent with the rest of the integration suite. The pool is shared across the
// suite (singleThread) so this file does NOT close it.

describe('reconciliation registry (F1)', () => {
  it('registry holds exactly 100 rows with the signed-off bucket split A23/B16/C23/D38', async () => {
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
    //   +1 bucket-D EXCLUDE — cap③ sys_flight_risk_scores (in-platform-derived analytics, mig 000082)
    //   +3 bucket-D EXCLUDE — cap④ CMS sys_content_{categories,documents,versions} (app-authored, mig 000086)
    //   +2 bucket-D EXCLUDE — cap③ P2 sys_{succession_readiness,skill_gap}_scores (in-platform-derived, mig 000092)
    //   +4 bucket-A IMPORT  — S978 m2b normalized cluster: sys_surveys/_questions/_responses/sys_pulse_checks (mig 000097 + seed 48)
    //   +1 bucket-D EXCLUDE — S978 MVP-4 §2.5 sys_auth_mfa_recovery_codes (app-generated, mig 000099)
    //   +1 bucket-D EXCLUDE — S980 cap④ CMS P3 sys_content_blueprint_links (app-authored cross-link, mig 000100)
    //   +1 bucket-D EXCLUDE — S980 MVP-4 §2.5 sys_auth_mfa_webauthn_credentials (passkey credentials, mig 000102)
    //   +1 bucket-D EXCLUDE - S981 MVP-4 par.2.5 #4 sys_auth_mfa_policies (mandatory-MFA policy config, mig 000103)
    //   +1 bucket-D EXCLUDE - S981 cap4 CMS P3 sys_content_media (app-uploaded binaries, mig 000105)
    //   +1 bucket-D EXCLUDE - S982 sys_auth_mfa_factors (app-generated MFA factors; latent gap —
    //     the table predates the registry and rode on test-leftover has_rows — closed by the
    //     S982 amendment to mig 000062, where the row must live for fresh-rebuild ordering)
    expect(m).toEqual({ A: 23, B: 16, C: 23, D: 38 });
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

// B-50 terminal-annotation close (S972, mig 000076) + Wave-2 close (S982, mig 000106 +
// seeds 49-50): the 7 residual-wall tables that used to RESOLVE to NEEDS_DECISION are now
// ALL terminal. 4 -> NO_SOURCE (no usable 1:1 populated source, unchanged since S972);
// the 3 ex-DEFER tables (branches / succession pools / successor candidates) were IMPORTED
// under PM decisions D1-D3 (Enzo 2026-06-10) and resolve POPULATED via has_rows.
describe('reconciliation registry — B-50 residual-wall terminal close (S972) + Wave-2 close (S982)', () => {
  const TERMINAL_NO_SOURCE = [
    'sys_payout_curves',
    'sys_reward_gate_results',
    'sys_successor_readiness',
    'sys_user_target_positions',
  ] as const;
  const WAVE2_IMPORTED = [
    'sys_branches',
    'sys_succession_pools',
    'sys_successor_candidates',
  ] as const;

  it('view-wide NEEDS_DECISION dropped to exactly 0 (was 3 after S972, 7 before B-50)', async () => {
    const { rows } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status = 'NEEDS_DECISION'`,
    );
    expect(rows[0]?.n).toBe(0);
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

  it('the 3 Wave-2 imported tables resolve POPULATED in the view (S982)', async () => {
    const { rows } = await pool.query<{ table_name: string; resolved_status: string }>(
      `SELECT table_name, resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = ANY($1::text[]) ORDER BY table_name`,
      [WAVE2_IMPORTED as unknown as string[]],
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual([...WAVE2_IMPORTED].sort());
    expect(rows.every((r) => r.resolved_status === 'POPULATED')).toBe(true);
  });

  it('the 3 Wave-2 tables carry declared_status IMPORT + a WAVE2 CLOSE rationale', async () => {
    const { rows } = await pool.query<{ table_name: string; declared: string; marked: boolean }>(
      `SELECT reconciliation_registry_table_name AS table_name,
              reconciliation_registry_declared_status AS declared,
              (reconciliation_registry_rationale LIKE '%[WAVE2 CLOSE S982]%') AS marked
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = ANY($1::text[])`,
      [WAVE2_IMPORTED as unknown as string[]],
    );
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.declared === 'IMPORT')).toBe(true);
    expect(rows.every((r) => r.marked === true)).toBe(true);
  });

  it('the 4 NO_SOURCE tables remain EMPTY; the 3 Wave-2 tables carry the imported counts', async () => {
    for (const t of TERMINAL_NO_SOURCE) {
      const { rows } = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM sys.${t}`,
      );
      expect(rows[0]?.n, `${t} must be empty`).toBe(0);
    }
    const expected: Record<string, number> = {
      sys_branches: 6,
      sys_succession_pools: 17,
      sys_successor_candidates: 25,
    };
    for (const [t, n] of Object.entries(expected)) {
      const { rows } = await pool.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM sys.${t}`,
      );
      expect(rows[0]?.n, `${t} expected ${n} imported rows`).toBe(n);
    }
  });

  it('sys_successor_readiness keeps NO_SOURCE with both S972 and WAVE2 markers (cascade branch decayed)', async () => {
    const { rows } = await pool.query<{ declared: string; r: string }>(
      `SELECT reconciliation_registry_declared_status AS declared,
              reconciliation_registry_rationale AS r
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = 'sys_successor_readiness'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.declared).toBe('NO_SOURCE');
    expect(rows[0]?.r).toContain('[B-50 TERMINAL S972]');
    expect(rows[0]?.r).toContain('[WAVE2 S982]');
  });
});
