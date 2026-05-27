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

  // SDBI family (ADR-0014 §3.5 — Semantic-Driven Brownfield Import).
  // Emitted by the SDBI workflow (Phase 2 mapping_card review → Phase 6 cleanup)
  // into audit.import_validation_results. Confidence thresholds per ADR §3.3
  // (HIGH >=0.85, MEDIUM 0.60-0.85, LOW <0.60). Audit status in the comment is
  // the import_validation_result_status the consolidator writes for each code.
  /** Mapping_card auto-approved, confidence >= 0.85 (status PASSED). */
  SDBI_CONFIDENCE_HIGH_AUTO_APPROVED: "SDBI_CONFIDENCE_HIGH_AUTO_APPROVED",
  /** Mapping_card requires human review, confidence 0.60-0.85 (status WARNING). */
  SDBI_CONFIDENCE_MEDIUM_NEEDS_REVIEW: "SDBI_CONFIDENCE_MEDIUM_NEEDS_REVIEW",
  /** Workflow halted for AI clarification, confidence < 0.60 (status WARNING). */
  SDBI_CONFIDENCE_LOW_HALT_ASKED: "SDBI_CONFIDENCE_LOW_HALT_ASKED",
  /** Human approved the mapping_card (status PASSED). */
  SDBI_HUMAN_APPROVED: "SDBI_HUMAN_APPROVED",
  /** Human rejected the mapping_card (status FAILED). */
  SDBI_HUMAN_REJECTED: "SDBI_HUMAN_REJECTED",
  /** Human corrected and re-approved the mapping_card (status PASSED). */
  SDBI_HUMAN_CORRECTED: "SDBI_HUMAN_CORRECTED",
  /** Phase 5 consolidation completed successfully (status PASSED). */
  SDBI_CONSOLIDATION_COMPLETE_V1: "SDBI_CONSOLIDATION_COMPLETE_V1",
  /** Phase 6 temp_sdbi cleanup done (status PASSED). */
  SDBI_TEMP_CLEANUP_V1: "SDBI_TEMP_CLEANUP_V1",
} as const;

export type AuditRuleCode = (typeof AUDIT_RULE_CODES)[keyof typeof AUDIT_RULE_CODES];
