/**
 * Audit rule codes emitted by brownfield wave executor.
 *
 * Convention: <CATEGORY>_<TOPIC>_V<N>
 */
export const AUDIT_RULE_CODES = {
  // Pre-existing (Goal 002+003)
  WAVE1_ALL_RULES: "WAVE1_ALL_RULES",
  LEGACY_NULL_LINEAGE_DOCUMENTED_V1: "LEGACY_NULL_LINEAGE_DOCUMENTED_V1",
  HANDLED_VIA_LINEAGE_WRITE_V1: "HANDLED_VIA_LINEAGE_WRITE_V1",

  // CW-B17 fix (Opt3 Phase 1 — this patch)
  /**
   * Emitted for every staging row excluded by WHERE skip filter due to:
   * - NK uuid column NULL or invalid format
   * - Required uuid column NULL
   *
   * payload: target_col, exclusion_reason, target_table, table_mapping_id, staging_row_id
   */
  WHERE_SKIP_FILTER_EXCLUDED_V1: "WHERE_SKIP_FILTER_EXCLUDED_V1",

  // CW-B60-A fix (S934 2026-05-26 — observability for the forensic silent-filter)
  // Emitted ONCE per (run, table_mapping) when the main INSERT in
  // executeUpsertSqlSidePerMapping returns rowCount=0 AND the mapping was
  // NOT classified as skipped:true for one of the explicit reasons
  // (no column_mappings, no colEntries, no conflict_inference, insert_failed).
  //
  // Pre-fix: if (upsertedCount === 0) return { skipped:false, ... } silently
  // returned without log or audit. Affected Wave-1 X19 run 6f561559:
  //   - sys_skill_categories (UQ varchar code only)
  //   - sys_activity_classification_mappings (UQ 2 uuid NK)
  //   - sys_process_kpi_templates (UQ 2 uuid NK)
  // All three lack a _tenant_id NK; column_mappings cover only NK cols ->
  // setClauses empty -> ON CONFLICT DO NOTHING -> rowCount=0 on duplicate
  // inputs (including re-runs).
  //
  // payload jsonb fields:
  //   target_table: string
  //   source_table: string
  //   source_table_id: uuid
  //   table_mapping_id: uuid
  //   conflict_inference: string
  //   natural_key_columns: string[]
  //   col_entries_count: number
  //   set_clause_mode: 'DO_UPDATE' | 'DO_NOTHING'
  //   skip_filters_count: number
  //   staging_rows_input: number    (count probe; -1 on failure)
  //   hint: string                  (forensic next-step suggestion)
  SILENT_UPSERT_ZERO_ROWS_V1: "SILENT_UPSERT_ZERO_ROWS_V1",
} as const;

export type AuditRuleCode = (typeof AUDIT_RULE_CODES)[keyof typeof AUDIT_RULE_CODES];
