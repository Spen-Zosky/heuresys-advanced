import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F1 of the reconciliation-closure cycle. Asserts the registry + view shipped by
// migration 000058 + seed 04_registry.sql. Hits the live DB via the tunnel (no mocks),
// consistent with the rest of the integration suite. The pool is shared across the
// suite (singleThread) so this file does NOT close it.

describe('reconciliation registry (F1)', () => {
  it('registry holds exactly 78 rows with the signed-off bucket split A14/B16/C23/D25', async () => {
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
    expect(m).toEqual({ A: 14, B: 16, C: 23, D: 25 });
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
