-- 000051_sys_skill_categories_family_nullable.sql
-- WS-3 (v1.0.0 CW-B60-A silent-skip remediation, 2026-06-01): make
-- sys.sys_skill_categories.skill_category_family_id NULLABLE.
--
-- DOCTRINE (ADR-0025, sibling of ADR-0015 / ADR-0016 nullable-brownfield-FK pattern):
--   The brownfield Wave-1 IMPORT mapping for sys_skill_categories sources from
--   legacy `competencies` (65,528 rows). That source carries NO canonical family
--   assignment (legacy `framework_id` is enrichment metadata, not the skill_family
--   FK; only 4 of the 77 sys_skill_families rows are framework-derived and the
--   families' metadata->>'legacy_id' is empty). With skill_category_family_id
--   declared NOT NULL and no resolvable column_mapping, the wave engine's WHERE
--   skip filter (upsert-sql.ts requiredColumns loop) drops EVERY staging row with
--   audit reason 'required_missing_skill_category_family_id' -> 0 rows imported.
--
--   This is the IDENTICAL failure mode ADR-0015 resolved for
--   sys_job_roles.job_role_family_id (227 rows now import with family_id NULL
--   instead of being skip-filtered to 0). We apply the identical decision here:
--   drop NOT NULL so the 65,528 competencies import with family_id NULL.
--   Family enrichment (manual taxonomy work / future catalog import) is deferred
--   exactly as in ADR-0015 §9. NO synthetic "UNASSIGNED" family is fabricated
--   (respects the NO_MOCK directive).
--
-- The FK constraint to sys.sys_skill_families remains intact — NULL is a valid
-- value for a foreign-key column, so referential integrity is preserved.
--
-- IDEMPOTENT: ALTER COLUMN ... DROP NOT NULL is a no-op if the column is already
-- nullable (PG silently accepts it); COMMENT ON is unconditionally re-appliable.
-- Twice-run => empty pg_dump diff.

BEGIN;

ALTER TABLE sys.sys_skill_categories
  ALTER COLUMN skill_category_family_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_skill_categories.skill_category_family_id IS
  'Optional FK to sys_skill_families. NULL allowed for skill categories imported from legacy `competencies`, which lack a canonical family assignment (see ADR-0025, sibling of ADR-0015 + CW-B26). UPDATE when the family becomes known (manual taxonomy enrichment or future catalog import).';

-- Integrity guard: fail loud if the column is somehow still NOT NULL after the ALTER
-- (e.g. a re-add of the constraint by a later migration). Belt-and-suspenders for
-- the idempotency contract.
DO $$
DECLARE col_nullable text;
BEGIN
  SELECT is_nullable INTO col_nullable
  FROM information_schema.columns
  WHERE table_schema = 'sys'
    AND table_name   = 'sys_skill_categories'
    AND column_name  = 'skill_category_family_id';
  IF col_nullable IS DISTINCT FROM 'YES' THEN
    RAISE EXCEPTION '000051: sys_skill_categories.skill_category_family_id expected NULLABLE after migration, got is_nullable=%', col_nullable;
  END IF;
  RAISE NOTICE '000051: sys_skill_categories.skill_category_family_id is now NULLABLE (ADR-0025).';
END $$;

COMMIT;
