import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// F1 of the reconciliation-closure cycle. Asserts the registry + view shipped by
// migration 000058 + seed 04_registry.sql. Hits the live DB via the tunnel (no mocks),
// consistent with the rest of the integration suite. The pool is shared across the
// suite (singleThread) so this file does NOT close it.

describe('reconciliation registry (F1)', () => {
  /**
   * RETIRED (S1021): this used to assert a frozen census — "exactly 115 rows, split
   * A27/B16/C23/D49" — carrying a 45-line changelog of the ~25 times the number had been
   * bumped by hand. It duplicated the registry, which IS the source of truth, so every new
   * `sys.*` table turned a green suite red for bookkeeping reasons rather than for a defect;
   * the changelog itself records a session that left the assert stale and red without noticing
   * ("was already red at the S990 session start"). Its real content — that nothing escapes
   * classification — is already asserted, better, by the 0-UNCLASSIFIED test below.
   *
   * Replaced by invariants derived from the live schema, which cannot go stale:
   *   - every registry row carries a valid bucket and declared status;
   *   - no row points at a table that no longer exists (a dropped table left registered would
   *     otherwise sit unnoticed — something the census could never catch).
   */
  it('every registry row is well-formed and points at a table that exists', async () => {
    const { rows: malformed } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_bucket NOT IN ('A','B','C','D')
           OR reconciliation_registry_declared_status IS NULL`,
    );
    expect(malformed[0]?.n, 'righe con bucket/declared_status non validi').toBe(0);

    const { rows: orphans } = await pool.query<{ t: string }>(
      `SELECT r.reconciliation_registry_table_name AS t
         FROM sys.sys_reconciliation_registry r
        WHERE NOT EXISTS (
          SELECT 1 FROM pg_tables p
           WHERE p.schemaname = 'sys' AND p.tablename = r.reconciliation_registry_table_name
        )`,
    );
    expect(orphans.map((r) => r.t), 'righe di registro orfane (tabella inesistente)').toEqual([]);
  });

  it('the bucket split is internally consistent (every classified table counted once)', async () => {
    const { rows } = await pool.query<{ b: string; n: number }>(
      `SELECT reconciliation_registry_bucket AS b, count(*)::int AS n
         FROM sys.sys_reconciliation_registry GROUP BY 1`,
    );
    const m = Object.fromEntries(rows.map((r: { b: string; n: number }) => [r.b, r.n]));
    const total = Object.values(m).reduce((s, n) => s + (n as number), 0);

    const { rows: all } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry`,
    );
    expect(total).toBe(all[0]?.n);
    expect(Object.keys(m).sort()).toEqual(['A', 'B', 'C', 'D']);
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

// B-42 RE-CONFIRMATION (S994, item #12, seed 53). sys_process_kpi_templates is the only
// EXCLUDE row with a measurable legacy source (process_kpis). It was re-measured live: the
// KPI side resolves 1:1 (81/81 kpi_code in sys_kpi_definitions) but the NOT-NULL process FK
// to sys_blueprint_process_registry cannot resolve (CODE-overlap 0/25, NAME-overlap 1/25 vs
// the legacy business_processes BP-xxx keyspace). Importing would require an Enzo-authored
// process crosswalk (a WHAT decision) -> kept EXCLUDE, fresh evidence appended to the
// registry rationale. This guards against a silent regression that imports the table or
// flips its terminal status without the crosswalk.
describe('reconciliation registry — B-42 process_kpi_templates EXCLUDE re-confirmed (S994)', () => {
  it('sys_process_kpi_templates resolves EXCLUDE in the view and stays empty', async () => {
    const { rows: view } = await pool.query<{ resolved_status: string }>(
      `SELECT resolved_status FROM sys.v_reconciliation_status
        WHERE table_name = 'sys_process_kpi_templates'`,
    );
    expect(view).toHaveLength(1);
    expect(view[0]?.resolved_status).toBe('EXCLUDE');

    const { rows: cnt } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_process_kpi_templates`,
    );
    expect(cnt[0]?.n, 'sys_process_kpi_templates must remain empty (no fabricated crosswalk)').toBe(0);
  });

  it('the registry row carries declared_status EXCLUDE + the S994 re-confirmation evidence', async () => {
    const { rows } = await pool.query<{ declared: string; r: string }>(
      `SELECT reconciliation_registry_declared_status AS declared,
              reconciliation_registry_rationale AS r
         FROM sys.sys_reconciliation_registry
        WHERE reconciliation_registry_table_name = 'sys_process_kpi_templates'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.declared).toBe('EXCLUDE');
    // S994 fresh-evidence marker (seed 53) + the original S970 out-of-scope marker (seed 43).
    expect(rows[0]?.r).toContain('RE-CONFIRMED S994');
    expect(rows[0]?.r).toContain('OUT-OF-SCOPE S970');
  });
});
