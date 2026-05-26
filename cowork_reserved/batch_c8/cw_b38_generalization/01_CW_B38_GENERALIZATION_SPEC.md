# CW-B38 Generalization — Nullable NK UUID + NULLS NOT DISTINCT companion (preventive)

**Status**: spec ready for CLI X8 (Block A)
**Author**: Cowork batch C8.2
**Date**: 2026-05-21
**Trigger**: REPORT 011 §6.a — CLI X7 surfaced ESCO 7645→15290 P0 regression, mitigated inline via migration 000042 (UNIQUE NULLS NOT DISTINCT)

---

## §1 — Problem statement (generalized)

ADR-0015/0016 pattern (nullable NK UUID column via `ALTER COLUMN DROP NOT NULL`) is INCOMPLETE without companion `UNIQUE NULLS NOT DISTINCT` index property.

**Why**: PostgreSQL default UQ semantic treats `NULL ≠ NULL`. So `ON CONFLICT (nk_col_1, nk_col_2) DO NOTHING` does NOT trigger when `nk_col_1 IS NULL`. Every Wave 1 re-run emits fresh rows. Result: cross-run duplicates, lineage UQ updates point pre-existing rows as orphans.

**Live evidence (X7)**:
- Migration 000041 ADR-0016 made `esco_occupation_mapping_job_role_id` nullable
- X6.A Wave 1 retry: 7645 rows inserted
- X7 Wave 1 retry v1 (no NULLS NOT DISTINCT): 7645 fresh → total 15290 (X6.A originals orphaned)
- X7 inline migration 000042 fix: DROP + RE-CREATE UQ with NULLS NOT DISTINCT + DELETE 7645 orphans → 7645 stable

## §2 — Audit live state (verified 2026-05-21 by Cowork C8.2)

```sql
SELECT n.nspname, c.relname AS table_name,
       i.indexrelid::regclass::text AS uq_index,
       i.indnullsnotdistinct
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'sys' AND i.indisunique AND NOT i.indisprimary
   AND EXISTS (
     SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum = ANY(string_to_array(i.indkey::text, ' ')::int[])
        AND a.attnum > 0 AND NOT a.attnotnull
        AND format_type(a.atttypid, NULL) = 'uuid'
   );
```

**Results (live 2026-05-21T17:00Z)**:

| Table | UQ Index | nullable UUID NK col | NULLS NOT DISTINCT | Status |
|---|---|---|---|---|
| sys_esco_occupation_mappings | sys_esco_occupation_mappings_pair_uq | esco_occupation_mapping_job_role_id | **YES** ✅ | already fixed X7 (mig 000042) |
| sys_job_roles | sys_job_roles_code_uq | n/a (family_id NOT in NK UQ — only code) | n/a | **NOT vulnerable** ✅ |

**Conclusion**: only `sys_esco_occupation_mappings` has the pattern + already mitigated. **No additional preventive migration needed for current sys.* state**.

## §3 — Generalization policy (pattern memo §12 entry)

**For future ADRs in the "make nullable FK" family**, the spec MUST bundle:

1. **DB layer**: `ALTER COLUMN <col> DROP NOT NULL` migration
2. **Codebase audit**: grep for `<col>` references in Zod/Row/service code
3. **NK UQ analysis** (NEW post-CW-B38):
   - Is `<col>` part of any NK UQ index on this table? Query:
     ```sql
     SELECT i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid)
       FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
      WHERE c.relname = '<table>' AND i.indisunique AND NOT i.indisprimary
        AND '<col>' = ANY(SELECT attname FROM pg_attribute
                          WHERE attrelid = c.oid
                            AND attnum = ANY(string_to_array(i.indkey::text, ' ')::int[]));
     ```
   - If YES → **REQUIRED**: companion `DROP INDEX + CREATE UNIQUE INDEX ... NULLS NOT DISTINCT` migration in same batch
   - If NO → no companion needed (NK UQ untouched)
4. **Engine companion fix** (CW-B34): WHERE skip filter + buildNkJoinPredicate nullable-aware (already in engine post-X6.A)
5. **Acceptance**: Wave 1 re-run twice, verify count stable (no cross-run dup)

## §4 — Future preventive migration template

When emitting future migration `ALTER COLUMN <col> DROP NOT NULL`, use this template:

```sql
-- =============================================================================
-- 0000NN_<table>_<col>_nullable.sql
-- ADR-NNNN — Make <table>.<col> nullable.
-- CW-B38 mitigation: includes NULLS NOT DISTINCT companion for affected NK UQ.
-- =============================================================================

BEGIN;

-- Phase 1: DB nullable
ALTER TABLE sys.<table> ALTER COLUMN <col> DROP NOT NULL;

COMMENT ON COLUMN sys.<table>.<col> IS
  'Optional FK ... See ADR-NNNN + CW-B38 (Nullable FK NK UQ NULLS DISTINCT mitigation).';

-- Phase 2: NK UQ companion (ONLY IF <col> IS IN NK UQ — verify via §3 query first)
-- Uncomment if applicable:
-- DROP INDEX sys.<table>_<nk_uq>;
-- CREATE UNIQUE INDEX <table>_<nk_uq>
--   ON sys.<table> (<nk_col_1>, <nk_col_2>, ...) NULLS NOT DISTINCT;

COMMIT;
```

## §5 — Acceptance criteria (CLI X8 Block A)

CLI X8 verification (no migrations required for current state, only audit + documentation):

1. Re-run §2 audit query → confirm same result (only sys_esco mitigated, sys_job_roles not vulnerable)
2. Document in REPORT 012 §X "CW-B38 audit clean post C8.2 generalization"
3. Verify migration 000042 idempotent re-run safe:
   ```bash
   pnpm db:migrate
   # Expected: no-op (000042 already in sys.sys_schema_migrations)
   ```
4. Wave 1 retry twice (separate runIds), verify `sys_esco_occupation_mappings` count stable at 7645:
   ```sql
   SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings; -- first retry
   -- run wave1 again
   SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings; -- second retry
   -- Both must be 7645
   ```

## §6 — Open items

- **No new migrations** required by C8.2 (current state clean)
- **Future ADRs**: must follow §3 checklist (codified in pattern memo §12 + ADR template)
- **Engine improvement candidate (deferred)**: `loadTargetMeta` could optionally check `indnullsnotdistinct` and warn at startup if nullable NK UUID UQ lacks NULLS NOT DISTINCT property

## §7 — Effort estimate

CLI X8 Block A (CW-B38 audit-only): **15 min**
- Re-run audit query
- Verify migration 000042 idempotent
- Wave 1 twice + count verify
- Document in REPORT

No migration authoring needed.

---

*End CW-B38 generalization spec — preventive audit clean for current state, template for future*
