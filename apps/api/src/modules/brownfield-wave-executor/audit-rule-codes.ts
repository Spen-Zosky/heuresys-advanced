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
   * payload: { target_col: string, exclusion_reason: string,
   *            target_table: string, table_mapping_id: uuid,
   *            staging_row_id: uuid }
   */
  WHERE_SKIP_FILTER_EXCLUDED_V1: "WHERE_SKIP_FILTER_EXCLUDED_V1",
} as const;

export type AuditRuleCode = (typeof AUDIT_RULE_CODES)[keyof typeof AUDIT_RULE_CODES];
