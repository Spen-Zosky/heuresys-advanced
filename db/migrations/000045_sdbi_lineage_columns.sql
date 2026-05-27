-- ============================================================================
-- Migration 000045 — SDBI lineage provenance columns
-- ----------------------------------------------------------------------------
-- ADR-0014 §3.4: extend sys.sys_source_lineage_records (NOT replace) with SDBI
--   provenance metadata. Brownfield-path lineage rows keep these columns NULL
--   (preserved invariant); SDBI-path rows populate mapping_card_id + AI
--   confidence + model id + human approver.
-- ----------------------------------------------------------------------------
-- Idempotent: ADD COLUMN IF NOT EXISTS (re-run safe → empty pg_dump diff)
-- Reversibility: ALTER TABLE ... DROP COLUMN IF EXISTS source_lineage_sdbi_* (4 cols)
-- ----------------------------------------------------------------------------
-- Authored: 2026-05-27 (MVP-4 2.4.1 — SDBI Phase 2 stream infra)
-- ============================================================================

BEGIN;

-- §1 — SDBI provenance columns (all nullable; brownfield rows stay NULL)
ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_mapping_card_id text,
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_confidence      numeric(4,3),
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_ai_model_id     text,
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_human_approver  text;

-- §2 — Column documentation
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_mapping_card_id IS
  'SDBI (ADR-0014) mapping_card_id that drove this row''s import; NULL for deterministic brownfield-path rows.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_confidence IS
  'SDBI AI self-reported mapping confidence 0.000-1.000 (ADR-0014 §3.3 thresholds); NULL for brownfield-path.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_ai_model_id IS
  'SDBI AI model identifier (e.g. cowork-claude-opus-4.7) that authored the mapping_card; NULL for brownfield-path.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_human_approver IS
  'Human approver email who signed off the SDBI mapping_card (ADR-0014 §3.3 HUMAN CHECKPOINT); NULL for brownfield-path.';

-- §3 — Partial index for SDBI-path provenance queries (only non-NULL rows)
CREATE INDEX IF NOT EXISTS ix_source_lineage_sdbi_mapping_card
  ON sys.sys_source_lineage_records (source_lineage_sdbi_mapping_card_id)
  WHERE source_lineage_sdbi_mapping_card_id IS NOT NULL;

COMMIT;
