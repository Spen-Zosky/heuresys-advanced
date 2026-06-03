import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client';

// F2 of the reconciliation-closure cycle: bucket-A imports. One block per imported table.
// Hits the live DB (no mocks). Verifies the imported state, not the seed mechanics
// (seeds load from staging under a supervised run — see db/seeds/reconciliation/0N_*.sql headers).

describe('reconciliation F2 imports', () => {
  describe('career_paths (#1)', () => {
    it('imported 28 RTL rows with deterministic legacy code, valid kind, single tenant', async () => {
      const { rows } = await pool.query<{
        n: number; bad_code: number; bad_kind: number; tenants: number;
      }>(
        `SELECT count(*)::int AS n,
                count(*) FILTER (WHERE career_path_code NOT LIKE 'LEGACY_CP::%')::int AS bad_code,
                count(*) FILTER (WHERE career_path_kind NOT IN
                  ('VERTICAL','LATERAL','SPECIALIST','MANAGERIAL','CROSS_FUNCTIONAL'))::int AS bad_kind,
                count(DISTINCT career_path_tenant_id)::int AS tenants
           FROM sys.sys_career_paths`,
      );
      expect(rows[0]?.n).toBe(28);
      expect(rows[0]?.bad_code).toBe(0);
      expect(rows[0]?.bad_kind).toBe(0);
      expect(rows[0]?.tenants).toBe(1);
    });

    it('shows POPULATED in the reconciliation view', async () => {
      const { rows } = await pool.query<{ s: string }>(
        `SELECT resolved_status AS s FROM sys.v_reconciliation_status WHERE table_name = 'sys_career_paths'`,
      );
      expect(rows[0]?.s).toBe('POPULATED');
    });
  });
});
