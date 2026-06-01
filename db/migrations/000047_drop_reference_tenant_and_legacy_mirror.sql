-- 000047_drop_reference_tenant_and_legacy_mirror.sql
-- Case-study scope cleanup (S954, 2026-06-01). Product decision (Enzo): the case study
-- is RTL Bank; the ONLY accepted business tenants are HEURESYS (system) + RTL_BANK
-- (operational, S950 rebuild). Everything tied to the early-development scaffold or to
-- unrelated legacy tenants (SmartFood, EcoNova) is removed.
--
-- This migration does TWO things, both idempotent:
--   (1) DELETE the RTL_BANK_REFERENCE reference-tenant row (its INSERT was removed from
--       migration 000021 §7 in the same commit). 0 dependent rows verified across all 92
--       tenant-FK tables (qa_artifacts/_rtlref_deps.txt) — safe DELETE, no cascade needed.
--       The FIN_BANKING blueprint / reward gates / 23 processes from 000021 are GLOBAL
--       catalogs (not tenant-scoped) and are KEPT (relevant to the real RTL_BANK).
--   (2) DROP SCHEMA legacy_mirror — a rebuildable offline cache (115 tables, 586 MB) that
--       held mirrored legacy data including unrelated tenants (SmartFood 82, EcoNova 26).
--       Not created by any migration (only referenced in 000033 comments), not read by any
--       active test (the wave-executor REAL_EXECUTE test is skipIf-guarded). The brownfield
--       wave-executor recreates it on demand via loader.ts when an import is actually run.
--
-- IDEMPOTENT: DELETE ... WHERE + DROP SCHEMA IF EXISTS. Re-running is a no-op.

BEGIN;

-- (1) Remove the reference tenant (idempotent; 0 live dependencies).
DELETE FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE';

-- (1b) Purge out-of-scope legacy tenant mappings (SmartFood, EcoNova) from
--      brownfield.tenant_id_mappings — case study is RTL_BANK + HEURESYS only.
--      The in-scope rows (RTL Bank 0c54b84a, Heuresys d5855519) are kept / re-seeded
--      to the real canonical tenants by the revised 000033.
DELETE FROM brownfield.tenant_id_mappings
WHERE legacy_id IN (
  '1d7bf448-ceac-4215-917d-45ff13678104',  -- SmartFood
  'fb1e866c-e90a-4e25-a146-f68d660a0be8'   -- EcoNova
);

COMMIT;

-- (2) Drop the rebuildable legacy_mirror cache schema. Outside the txn above because a
--     large CASCADE drop is cleaner standalone; DROP SCHEMA is itself atomic.
DROP SCHEMA IF EXISTS legacy_mirror CASCADE;

-- Verification (NOTICE only; does not fail the migration).
DO $$
DECLARE ref_left int; lm_exists int;
BEGIN
  SELECT count(*) INTO ref_left FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE';
  SELECT count(*) INTO lm_exists FROM information_schema.schemata WHERE schema_name='legacy_mirror';
  RAISE NOTICE 'After cleanup: RTL_BANK_REFERENCE rows = % (expect 0), legacy_mirror schema = % (expect 0)', ref_left, lm_exists;
END $$;
