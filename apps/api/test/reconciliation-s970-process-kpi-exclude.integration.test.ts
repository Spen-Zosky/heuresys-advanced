import { describe, it, expect } from 'vitest';
import { pool } from '../src/db/client.js';

// S970 #4: sys_process_kpi_templates LOOKUP_FK closed OUT-OF-SCOPE (Enzo decision b).
// v5 blueprint_process_registry is a v5-native banking taxonomy; legacy business_processes is a
// multi-industry table with 0 code-overlap -> taxonomy mismatch, not a code bug. declared_status -> EXCLUDE.
//
// ⚠ AGGIORNATO S1096 (2026-09-10) — LA DECISIONE RESTA, IL CONTEGGIO NO.
// Questo test pretendeva `count = 0`, e per tre mesi e' stato vero. Dal 2026-09-09 non lo e'
// piu': B30 ha ricostruito 73 legami processo-KPI, e li ha ricostruiti PER SIGNIFICATO dai KPI
// gia' presenti — non importandoli dal legacy, che e' esattamente cio' che I12/ADR-0038
// vietano. La tabella e' quindi legittimamente popolata con dato NATIVO.
//
// Il conteggio a zero era una CONSEGUENZA contingente della decisione, non la decisione: cio'
// che S970/S994 proteggono e' che nessuno fabbrichi un crosswalk col legacy. Cristallizzare il
// conteggio ha reso il test rosso su un lavoro voluto — e la CI non se n'era accorta, perche'
// quelle 73 righe sono entrate da uno *script* e sul clone della CI non esistono.
//
// La guardia ora misura la SOSTANZA, e sa ancora fallire: ogni riga deve risolvere la propria
// chiave verso il registro dei processi **v5**. Un import dal legacy non potrebbe farlo — e'
// il fatto misurato in S994: 0/25 di sovrapposizione fra i due keyspace.

const count = async (sql: string): Promise<number> => {
  const { rows } = await pool.query<{ n: number }>(sql);
  return rows[0]?.n ?? -1;
};

describe('reconciliation S970 #4 process_kpi_templates out-of-scope', () => {
  it('nessuna riga viene dal legacy: tutte risolvono il registro dei processi v5', async () => {
    const righe = await count(`SELECT count(*)::int AS n FROM sys.sys_process_kpi_templates`);
    const risolte = await count(`SELECT count(*)::int AS n
        FROM sys.sys_process_kpi_templates t
        JOIN sys.sys_blueprint_process_registry r
          ON r.blueprint_process_id = t.process_kpi_template_process_id`);
    // Se qualcuno importasse il crosswalk dal legacy, queste due non coinciderebbero.
    expect(risolte, 'righe che non risolvono il registro processi v5 = crosswalk fabbricato')
      .toBe(righe);
  });

  it('la classificazione dichiarata resta EXCLUDE: quella e la decisione vera', async () => {
    expect(await count(`SELECT count(*)::int AS n FROM sys.v_reconciliation_status
      WHERE table_name='sys_process_kpi_templates'
        AND resolved_status IN ('EXCLUDE','POPULATED')`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM sys.sys_reconciliation_registry
      WHERE reconciliation_registry_table_name='sys_process_kpi_templates'
        AND reconciliation_registry_declared_status='EXCLUDE'`)).toBe(1);
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
