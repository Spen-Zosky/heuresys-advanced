-- ============================================================================
-- 000185 — reconciliation-registry cleanup: completes 000183 (R4 dead-schema
-- drop). 000183 dropped sys.sys_organization_hierarchies but left its
-- reconciliation-registry row behind, breaking the registry invariant
-- "every row points at an existing table" (reconciliation-registry.integration
-- test). Surfaced by the first full CI run on the off-prod runner (S1023).
-- Idempotent: deleting an absent row is a no-op.
--
-- [S1023 v2] Also DROP the table itself (IF EXISTS): the original v1 (bare
-- DELETE) broke the full-chain twice-run invariant — 000009 still re-created
-- the dead closure table on every re-run, and with the registry row gone the
-- 000062 "0 UNCLASSIFIED" assert failed on the SECOND pass, aborting the chain
-- and leaving a resurrected orphan table behind. v2 pairs with the 000009
-- amendment (CREATE removed at the source) and self-heals any orphan.
-- ============================================================================

DROP TABLE IF EXISTS sys.sys_organization_hierarchies;

DELETE FROM sys.sys_reconciliation_registry
 WHERE reconciliation_registry_table_name = 'sys_organization_hierarchies';
