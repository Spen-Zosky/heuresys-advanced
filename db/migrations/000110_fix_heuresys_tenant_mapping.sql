-- 000110_fix_heuresys_tenant_mapping.sql
-- #8 Wave-3 L1 (S987) — correct the stale Heuresys System tenant mapping.
--
-- Migration 000033 (revised S954) INTENDED to map the legacy Heuresys System tenant
-- (d5855519-…) to the canonical HEURESYS tenant (8bc5bc59-…), but its INSERT ends with
--   ON CONFLICT (legacy_id) DO NOTHING
-- On any DB that already held the original Goal-003 Wave-1 row (d5855519 -> RTL_BANK), the
-- corrected INSERT was a no-op, so the LIVE row stayed pointed at RTL_BANK — verified S987:
--   d5855519-… -> 86ba7a65-… (RTL_BANK)   [stale]
-- 000033 cannot self-heal (re-running its ON CONFLICT DO NOTHING does nothing); a forward
-- UPDATE is required. The mapping drives brownfield ingestion tenant resolution; with the
-- reconciliation registry at 0 open states there is no in-flight ingestion to disturb.
--
-- Idempotent: the WHERE guard makes a second run a no-op (0 rows) once corrected.

UPDATE brownfield.tenant_id_mappings m
SET canonical_tenant_id = t.tenant_id,
    notes = 'S987 Wave-3 L1: corrected stale Goal-003 Wave-1 mapping (000033 ON CONFLICT DO NOTHING skipped the S954 fix) — d5855519 -> HEURESYS'
FROM sys.sys_tenancies t
WHERE t.tenant_code = 'HEURESYS'
  AND m.legacy_id = 'd5855519-3ed1-4427-865f-fe75f1e42c4c'
  AND m.canonical_tenant_id IS DISTINCT FROM t.tenant_id;
