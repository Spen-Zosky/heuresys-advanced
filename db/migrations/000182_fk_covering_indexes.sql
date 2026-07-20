-- ============================================================================
-- Migration 000182 — R3 (audit forense S1022 / F-A01, estende QW-C1 000130):
-- indici di copertura sulle FK ad alto traffico ancora SCOPERTE (nessun indice
-- leading sulla colonna FK) su tabelle sys.* > 1000 righe. L'audit S1022 ha
-- misurato 261/549 FK dello schema sys senza indice leading; QW-C1 (000130)
-- ne coprì 6 (i *_tenant_id delle tabelle > 5 MB). Questa migration estende la
-- copertura alle colonne di FILTRO/JOIN REALI a runtime.
--
-- CRITERIO (professionale, non a tappeto): si indicizzano solo le FK usate in
-- filtro/join a runtime — *_tenant_id (I5 isolation), FK verso risorse di
-- dominio joinate (module/path/initiative/target/child/previous/assessment),
-- e *_assessor_user_id (usato nello scope org-gate). Si ESCLUDONO le FK
-- audit-actor (created_by / updated_by / *_validated_by / *_assigned_by): FK
-- di integrità raramente interrogate, il cui indice costerebbe write-overhead
-- senza beneficio di lettura (nessuna query filtra per attore-audit).
--
-- Plain CREATE INDEX IF NOT EXISTS (NOT CONCURRENTLY): migrate.sh applica ogni
-- file con `psql -1` (--single-transaction); CREATE INDEX CONCURRENTLY non può
-- girare in una transazione. Build plain = SHARE lock breve (tabelle ≤ 71k
-- righe, pochi secondi). Additivo, idempotente (IF NOT EXISTS), non tocca
-- alcun contratto API / schema Zod. Reversibile via DROP INDEX.
-- Authored: 2026-07-20 (S1022).
-- ============================================================================

-- sys_source_lineage_records (70.972 righe) — join lineage import/mapping
CREATE INDEX IF NOT EXISTS sys_source_lineage_records_import_run_idx
  ON sys.sys_source_lineage_records (source_lineage_import_run_id);
CREATE INDEX IF NOT EXISTS sys_source_lineage_records_table_mapping_idx
  ON sys.sys_source_lineage_records (source_lineage_table_mapping_id);

-- sys_skill_taxonomy_edges (11.965 righe) — traversata grafo skill lato child
CREATE INDEX IF NOT EXISTS sys_skill_taxonomy_edges_child_idx
  ON sys.sys_skill_taxonomy_edges (skill_taxonomy_edge_child_id);

-- sys_auth_refresh_tokens (13.923 righe) — replay-detection join sul precedente
CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_previous_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_previous_id);

-- sys_activity_classification_mappings (5.730 righe) — join verso il target classificato
CREATE INDEX IF NOT EXISTS sys_activity_classification_mappings_target_idx
  ON sys.sys_activity_classification_mappings (activity_class_mapping_target_id);

-- sys_user_learning_assignments (1.990 righe) — filtro tenant + join risorse learning
CREATE INDEX IF NOT EXISTS sys_user_learning_assignments_tenant_idx
  ON sys.sys_user_learning_assignments (user_learning_assignment_tenant_id);
CREATE INDEX IF NOT EXISTS sys_user_learning_assignments_module_idx
  ON sys.sys_user_learning_assignments (user_learning_assignment_module_id);
CREATE INDEX IF NOT EXISTS sys_user_learning_assignments_path_idx
  ON sys.sys_user_learning_assignments (user_learning_assignment_path_id);
CREATE INDEX IF NOT EXISTS sys_user_learning_assignments_initiative_idx
  ON sys.sys_user_learning_assignments (user_learning_assignment_initiative_id);

-- sys_position_learning_requirements (1.791 righe) — filtro tenant
CREATE INDEX IF NOT EXISTS sys_position_learning_requirements_tenant_idx
  ON sys.sys_position_learning_requirements (position_learning_requirement_tenant_id);

-- sys_assessment_results (1.560 righe) — filtro tenant + scope org su assessor
CREATE INDEX IF NOT EXISTS sys_assessment_results_tenant_idx
  ON sys.sys_assessment_results (assessment_result_tenant_id);
CREATE INDEX IF NOT EXISTS sys_assessment_results_assessor_idx
  ON sys.sys_assessment_results (assessment_result_assessor_user_id);

-- sys_user_assessment_evidence (1.560 righe) — filtro tenant + join assessment + scope assessor
CREATE INDEX IF NOT EXISTS sys_user_assessment_evidence_tenant_idx
  ON sys.sys_user_assessment_evidence (user_assessment_evidence_tenant_id);
CREATE INDEX IF NOT EXISTS sys_user_assessment_evidence_assessment_idx
  ON sys.sys_user_assessment_evidence (user_assessment_evidence_assessment_id);
CREATE INDEX IF NOT EXISTS sys_user_assessment_evidence_assessor_idx
  ON sys.sys_user_assessment_evidence (user_assessment_evidence_assessor_user_id);

-- sys_user_learning_evidence (1.434 righe) — filtro tenant + join modulo
CREATE INDEX IF NOT EXISTS sys_user_learning_evidence_tenant_idx
  ON sys.sys_user_learning_evidence (user_learning_evidence_tenant_id);
CREATE INDEX IF NOT EXISTS sys_user_learning_evidence_module_idx
  ON sys.sys_user_learning_evidence (user_learning_evidence_module_id);
