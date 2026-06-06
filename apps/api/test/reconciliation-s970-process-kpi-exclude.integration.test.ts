import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// S970 #4: sys_process_kpi_templates LOOKUP_FK closed OUT-OF-SCOPE (Enzo decision b).
// v5 blueprint_process_registry is a v5-native banking taxonomy; legacy business_processes is a
// multi-industry table with 0 code-overlap -> taxonomy mismatch, not a code bug. declared_status -> EXCLUDE.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation S970 #4 process_kpi_templates out-of-scope', () => {
  it('table stays empty and resolves to EXCLUDE in the reconciliation view', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_process_kpi_templates`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status
      WHERE table_name='sys_process_kpi_templates' AND resolved_status='EXCLUDE'`)).toBe(1);
  });

  it('registry carries the OUT-OF-SCOPE S970 rationale', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
      WHERE reconciliation_registry_table_name='sys_process_kpi_templates'
        AND reconciliation_registry_declared_status='EXCLUDE'
        AND reconciliation_registry_rationale LIKE '%OUT-OF-SCOPE S970%'`)).toBe(1);
  });

  it('no UNCLASSIFIED tables remain in the registry', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'`)).toBe(0);
  });
});
