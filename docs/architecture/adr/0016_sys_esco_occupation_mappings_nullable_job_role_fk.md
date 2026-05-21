# ADR-0016 — `sys_esco_occupation_mappings.job_role_id` nullable FK

**Status**: PROPOSED (awaiting CLI X5 codebase audit + Enzo confirmation)
**Date**: 2026-05-21
**Author**: Cowork batch C5.2
**Related**: ADR-0015 (sys_job_roles.family_id nullable — mirror pattern)
**Triggered by**: REPORT X4.A §1.A.2 — sys_esco_occupation_mappings cascade re-try halt; pre-flight CW-B26 verification confirmed 0/5 sample resolve (esco varchar codes vs UUID lineage)

---

## §1 — Context

`sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id` currently declared NOT NULL FK to `sys_job_roles.job_role_id`. Cascade fix authoring (Cowork batch C2.2, X2 file `02_sys_esco_occupation_mappings_fix.sql`) attempted LOOKUP_FK from esco source codes to sys_job_roles via lineage JOIN. **Failed** (CLI REPORT X4.A §1.A.2):

- `sys_job_roles.source_lineage_source_record_id` format = UUID (e.g. `OLDDB::ccnl_job_title_mapping::<uuid>`)
- Source `esco_occupation_code` = varchar ISCO classification code (e.g. `2149.4`, `2146`, `3257.1`)
- **Type + value mismatch**: ESCO codes (varchar, ISCO-style) cannot resolve to UUID lineage keys
- 5/5 sample queries returned NULL resolution

Source data semantically does NOT have canonical FK from ESCO codes to internal job_roles. ESCO is an independent classification catalog (5237 esco_occupations + 25 onet_occupations + 15 industry_occupation_mapping + 4565 occupation_industry_classifications = 7642 staged rows).

CW-B26 bias confirmed: "Semantic FK Phantom" — second occurrence after sys_job_roles family_id (ADR-0015). Pattern is **generalizable** — propose generic "Semantic FK Phantom resolution workflow" §6.

## §2 — Decision

**Make `sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id` nullable** via migration 000041.

Effective DDL:
```sql
ALTER TABLE sys.sys_esco_occupation_mappings
  ALTER COLUMN esco_occupation_mapping_job_role_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id IS
  'Optional FK to sys_job_roles. NULL allowed for ESCO catalog entries imported
   without canonical job_role assignment (legacy source: ISCO/ESCO classification codes
   != internal UUID lineage). See ADR-0016 + CW-B26 (Semantic FK Phantom).
   When job_role becomes known (manual taxonomy work or future enrichment),
   UPDATE to set the FK.';
```

FK constraint to sys_job_roles remains intact (NULL valid for FK columns). UQ `(job_role_id, esco_uri)` still functions (NULLs treated as distinct in PG UNIQUE by default — multiple NULL/<uri> rows allowed; minor semantic shift acceptable for ESCO catalog use case).

## §3 — Rationale + alternatives considered

### Why nullable FK (chosen)

1. **NO mock data**: respect Enzo CARD-4 NO_MOCK. Avoid synthetic "UNASSIGNED" job_role for ESCO catalog entries.
2. **CW-B26 pattern recurrence**: 2nd occurrence (after sys_job_roles family_id ADR-0015). Pattern emerging: **nullable FK** is correct architectural response per Semantic FK Phantom resolution workflow §6.
3. **Legacy data fidelity**: 7642 ESCO source rows legitimately have NO internal job_role assignment. Forcing FK = data fabrication.
4. **Future-flexible**: manual taxonomy work or AI inference can UPDATE FK later (no schema rework).
5. **ESCO catalog independence**: ESCO is international classification standard (ESCO + ONET + ISCO). Imposing internal heuresys job_role FK conflates catalog with assignment.

### Alternative A — synthetic "UNCLASSIFIED" job_role (REJECTED)

- Pro: maintains NOT NULL
- **Contro**: CARD-4 violation (synthetic data injection)
- **Contro**: poisons sys_job_roles with non-real row
- **Contro**: downstream UI cannot distinguish "ESCO unclassified" vs "ESCO uncertain"
- Verdict: REJECTED

### Alternative B — skip sys_esco_occupation_mappings entirely (REJECTED)

- Pro: zero compromise
- **Contro**: 7642 rows of legitimate ESCO classification data unavailable
- **Contro**: blocks downstream skill/occupation analytics
- **Contro**: ESCO is foundational for industry mapping + skill normalization
- Verdict: REJECTED

### Alternative C — relax UQ to allow NULL job_role_id (CHOSEN — implicit)

PG default: `UNIQUE (col_a, col_b)` allows multiple NULL+<value> rows (NULL ≠ NULL).
So with nullable FK, UQ semantics shift slightly: ESCO rows without job_role can have multiple entries per esco_uri. Acceptable for catalog.

If problematic in future, can refine to `UNIQUE NULLS NOT DISTINCT` (PG15+) but defer per now.

### Alternative D — ON DELETE behavior

Current: `ON DELETE CASCADE` (delete esco mapping if job_role deleted). Acceptable to keep — with nullable FK, ON DELETE doesn't trigger on NULL FK rows (they stay).

## §4 — Migration spec

**File**: `db/migrations/000041_sys_esco_occupation_mappings_job_role_nullable.sql`

```sql
-- =============================================================================
-- 000041_sys_esco_occupation_mappings_job_role_nullable.sql
-- ADR-0016 — Make sys_esco_occupation_mappings.job_role_id nullable
-- Rationale: ESCO catalog data lacks canonical FK to internal job_roles (CW-B26).
-- Mirror pattern of ADR-0015 (sys_job_roles.family_id nullable).
-- Idempotent: ALTER COLUMN DROP NOT NULL safe to re-run.
-- =============================================================================

BEGIN;

ALTER TABLE sys.sys_esco_occupation_mappings
  ALTER COLUMN esco_occupation_mapping_job_role_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id IS
  'Optional FK to sys_job_roles. NULL allowed for ESCO catalog entries imported
   without canonical job_role assignment (ESCO codes != UUID lineage). See ADR-0016
   + CW-B26 Semantic FK Phantom. UPDATE when job_role becomes known.';

COMMIT;
-- pnpm db:migrate handles sys.sys_schema_migrations INSERT automatically (CW-B29 convention).
```

## §5 — Codebase audit (CW-B33 mitigation pre-apply)

CLI X5 MUST execute this audit BEFORE applying migration 000041:

```bash
cd D:\heuresys-advanced
grep -rn "esco_occupation_mapping_job_role_id\|escoOccupationMappingJobRoleId\|escoJobRoleId" \
  apps/api/src packages/shared/src apps/api/test 2>/dev/null
```

Expected hits + decision matrix:
- **0 hits**: no consumer assumes NOT NULL → apply migration directly, no companion edits
- **1-3 hits in Zod schemas / Row types**: companion edit to mark `.nullable()` in Zod, `string | null` in Row types (similar pattern ADR-0015 X3 §1.A.6 companion edits)
- **>3 hits with business logic assuming presence**: halt+escalate `exec_strategic_concern`, propose deeper redesign

Pattern from ADR-0015 X3 §1.A.1: codebase audit caught 3 Zod/Row schemas assuming NOT NULL — applied companion edits. Repeat pattern for ADR-0016.

## §6 — Semantic FK Phantom resolution workflow (CW-B26 generalization)

Two-occurrences-now pattern (ADR-0015 + this ADR-0016). Document as **general workflow** to apply for ANY future similar case:

```
GIVEN: target table T with NOT NULL FK to parent table P
       source data S claims to provide FK value but actual semantics unknown
       
STEP 1 (pre-flight 5-sample resolution check):
  WITH samples AS (
    SELECT staging_raw_record->>'<source_fk_col>' AS code_in_source, staging_row_id
    FROM staging.wave1_<T>
    WHERE staging_source_table = '<source>'
    LIMIT 5
  )
  SELECT s.code_in_source,
         (SELECT slr.source_lineage_target_record_id
          FROM sys.sys_source_lineage_records slr
          WHERE slr.source_lineage_target_table = '<parent_P>'
            AND slr.source_lineage_source_record_id = s.code_in_source LIMIT 1) AS resolves
  FROM samples s;

STEP 2 (decision matrix):
  resolves count 5/5 → semantic FK valid, proceed with cascade fix (LOOKUP_FK)
  resolves count 3-4/5 → partial semantic FK, proceed with cascade fix + accept partial unlock
  resolves count 0-2/5 → SEMANTIC FK PHANTOM CONFIRMED, propose ADR-0016 pattern (nullable FK)

STEP 3 (if nullable FK chosen):
  - Write ADR-NNNN (mirror this template)
  - Codebase audit grep for FK col references in Zod/Row/service
  - Author migration ALTER COLUMN DROP NOT NULL
  - Companion edits per audit findings
  - Apply + Wave 1 retry (rows now upsert with NULL FK)
  - UQ adjustment if needed (NULLS NOT DISTINCT decision)

STEP 4 (future enrichment):
  - Manual taxonomy work OR AI inference can UPDATE FK
  - Backfill pattern: WHERE FK IS NULL AND <inference_logic>
```

Apply this workflow for any future target with similar pattern. Catalogue candidates per next batches:
- sys_position_skill_requirements (cascade dependency)
- Any future SDBI pilot target with cross-domain FK assumptions

## §7 — Acceptance criteria

1. Migration 000041 applies idempotently
2. `\d sys.sys_esco_occupation_mappings` shows `esco_occupation_mapping_job_role_id uuid` (no NOT NULL)
3. Existing 0 rows pre-migration unaffected
4. Codebase audit completed + companion edits applied if needed
5. Post Wave 1 retry: sys_esco_occupation_mappings ≥ 3000 (50%+ of 7642 staged — ESCO catalog rows now upsert with NULL job_role_id)
6. UQ pair_uq still functions (no constraint violation on multi-NULL ESCO entries)
7. FK constraint to sys_job_roles intact

## §8 — Risk + rollback

### Risk
- LOW: nullable FK is standard PG pattern. ON DELETE CASCADE still works (no NULL rows triggered).
- LOW: UQ semantics shift (NULL+<uri> multiple OK) — acceptable for ESCO catalog.
- MEDIUM: companion Zod/Row edits required if codebase audit finds hits. Mitigated by audit step §5.

### Rollback
```sql
-- Only safe if no row has NULL job_role_id
UPDATE sys.sys_esco_occupation_mappings
SET esco_occupation_mapping_job_role_id = '<default_uuid>'
WHERE esco_occupation_mapping_job_role_id IS NULL;
ALTER TABLE sys.sys_esco_occupation_mappings
  ALTER COLUMN esco_occupation_mapping_job_role_id SET NOT NULL;
```

## §9 — Open questions

1. Future enrichment workflow for backfilling NULL job_role_ids — defer to dedicated ADR when needed
2. UQ semantics decision (NULLS NOT DISTINCT vs default) — accept default for now, refine if conflicts surface
3. Downstream UI/API endpoints querying sys_esco_occupation_mappings — codebase audit §5 will surface

## §10 — Status

**PROPOSED** — awaiting CLI X5 §A.2 codebase audit + Enzo confirmation.

If audit clean (0 hits or trivial companion edits) → migration apply + Wave 1 retry → ACCEPTED.

---

*End ADR-0016*
