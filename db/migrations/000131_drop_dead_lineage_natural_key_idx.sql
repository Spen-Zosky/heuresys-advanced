-- ============================================================================
-- Migration 000131 — QW-C4 (S-100X-A4 / WS-C F-WS-C-2): drop the dead
-- sys_source_lineage_records_natural_key_idx (10 MB, partial btree on
-- source_lineage_source_natural_key WHERE NOT NULL, created by 000025).
--
-- Verified dead before dropping (S993):
--   - idx_scan = 0 over the whole cluster lifetime (stats_reset = NULL).
--   - NON-unique + backs no constraint → it can NEVER serve an ON CONFLICT
--     (ON CONFLICT requires a unique index/constraint), so the lineage upsert
--     path does not depend on it (grep: no ON CONFLICT on source_lineage
--     natural_key; the *_natural_key ON CONFLICTs are on goals/okr tables).
--   - No SELECT … WHERE source_lineage_source_natural_key in the serving path
--     (consistent with idx_scan=0).
-- Reversible: re-create via the original 000025 definition if a natural-key
-- lookup is ever added. Idempotent (DROP INDEX IF EXISTS).
-- Authored: 2026-06-16 (S993).
-- ============================================================================

DROP INDEX IF EXISTS sys.sys_source_lineage_records_natural_key_idx;
