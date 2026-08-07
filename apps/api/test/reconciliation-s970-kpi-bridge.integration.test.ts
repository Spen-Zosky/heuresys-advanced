import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// S970 #1 bridge job->position (KPI leg). sys_position_kpi_requirements is seeded from legacy
// tenant_job_kpis via the EMPLOYEE-MEDIATED bridge (I14): position.legacy_employee_id -> employee ->
// current job assignment -> tenant_job_kpis; kpi_definition_id resolved by code (KPI1..KPI4).
// Succession (pools/candidates) is DEFERRED (Enzo decision B) — gap-explicit, registry-annotated.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation S970 KPI bridge', () => {
  // [S1045] Erano 172 righe su 43 posizioni. La 000273 ha archiviato i 4 KPI
  // appesi a una posizione RITIRATA dalla ricostruzione dell'organigramma: 168 su
  // 42. Non e' copertura persa — quella posizione non ha titolare e non esiste
  // piu' nell'organigramma, quindi i suoi attesi non erano piu' esigibili da
  // nessuno. Le righe restano leggibili in `audit.position_requirements_stale_archive`.
  //
  // I numeri restano fissi apposta: questo test sorveglia che il ponte S970 non
  // perda righe in silenzio, ed e' un compito che un conteggio derivato dal DB non
  // potrebbe svolgere (si adeguerebbe alla perdita invece di segnalarla).
  it('position_kpi_requirements POPULATED at the measured coverage (168 rows / 42 positions / 1 tenant)', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_kpi_requirements`)).toBe(168);
    expect(await count(`SELECT count(DISTINCT position_id)::int AS n FROM sys.sys_position_kpi_requirements`)).toBe(42);
    expect(await count(`SELECT count(DISTINCT position_kpi_requirement_tenant_id)::int AS n FROM sys.sys_position_kpi_requirements`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status
      WHERE table_name='sys_position_kpi_requirements' AND resolved_status='POPULATED'`)).toBe(1);
  });

  it('dedup invariant + FK integrity + tenant isolation (I5)', async () => {
    // DISTINCT ON kept exactly one row per (position, kpi)
    expect(await count(`SELECT (count(*) - count(DISTINCT (position_id, kpi_definition_id)))::int AS n
      FROM sys.sys_position_kpi_requirements`)).toBe(0);
    // every kpi_definition_id resolves
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_kpi_requirements r
      LEFT JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = r.kpi_definition_id
      WHERE k.kpi_definition_id IS NULL`)).toBe(0);
    // requirement tenant always equals the owning position's tenant (no cross-tenant leak)
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_kpi_requirements r
      JOIN sys.sys_positions p ON p.position_id = r.position_id
      WHERE p.position_tenant_id <> r.position_kpi_requirement_tenant_id`)).toBe(0);
  });

  it('provenance recorded on every row (legacy.source_table = tenant_job_kpis)', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_position_kpi_requirements
      WHERE coalesce(target_template->'legacy'->>'source_table','') <> 'tenant_job_kpis'`)).toBe(0);
  });

  it('succession unblocked by Wave-2 close (S982): pools e candidates entro i totali d import, DEFER S970 history preserved', async () => {
    // The S970 DEFER was superseded by the Wave-2 close (PM decisions D2/D3, mig 000106 +
    // seed 49): incumbent-anchor + CEO/CFO title-match imported both tables. The S970
    // rationale marker survives (rationale updates are prepend-only).
    //
    // [S1048] I conteggi esatti non sono più invarianti — né 17 né un altro numero. La
    // 000278 (#160) rimuove i bacini agganciati a un ruolo critico che non era il loro e
    // quelli su posizioni spente, e quanti ne restano dipende da COSA c'è sulla macchina:
    // 9 su un database con la storia RTL seminata, 7 su un clone di CI dove i seed non
    // girano. Misurato: proprio questa riga ha fatto rossa la CI con «expected 7 to be
    // 17». L'invariante che sopravvive è che l'import non si GONFI.
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_succession_pools`)).toBeLessThanOrEqual(17);
    // il numero dei candidati importati scende per costruzione quando la storia C5
    // rimuove dai bacini chi non ha titolo a starci (coda #4/#5): l'invariante è che
    // l'import non ne abbia prodotti più di quanti dichiarati, non il numero esatto.
    // [S1048] E può arrivare a ZERO: la 000278 li ha rimossi tutti, perché stavano nei
    // bacini agganciati male e nessuno reggeva il criterio di successione.
    const candidatiImportati = await count(
      `SELECT count(*)::int AS n FROM sys.sys_successor_candidates
        WHERE successor_candidate_metadata->>'legacy_plan_id' IS NOT NULL`,
    );
    expect(candidatiImportati).toBeGreaterThanOrEqual(0);
    expect(candidatiImportati).toBeLessThanOrEqual(25);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
      WHERE reconciliation_registry_table_name IN ('sys_succession_pools','sys_successor_candidates')
        AND reconciliation_registry_rationale LIKE '%DEFER S970%'
        AND reconciliation_registry_rationale LIKE '%[WAVE2 CLOSE S982]%'`)).toBe(2);
  });
});
