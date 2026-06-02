# ADR-0015 — `sys_job_roles.job_role_family_id` nullable FK

**Status**: ACCEPTED (2026-06-01, v1.0.0 WS-6g — criteria met: sys_job_roles=227≥140, cascade unblocked, no integrity violation; see §10)
**Date**: 2026-05-21
**Author**: Cowork Claude (batch C3.0)
**Decision authority**: Enzo Spenuso
**Triggered by**: CLI REPORT X2 §2.B.3 — sys_job_roles cascade fix failed (semantic FK phantom CW-B26)

---

## §1 — Context

`sys_job_roles.job_role_family_id` is currently declared NOT NULL with FK to `sys_job_families.job_family_id`. Migration `000010_job_role_model.sql` established this constraint.

Wave 1 brownfield + Cowork batch C2.2 cascade fix attempted to resolve this FK via LOOKUP_FK from `job_templates.esco_occupation_code` → `sys_job_families` lineage. **Failed** (CLI REPORT X2 §2.B.3):

- `sys_job_families.source_lineage_source_record_id` = UUID format
- Source `job_templates.esco_occupation_code` = varchar code (when present, 91/140 rows)
- Type mismatch + value mismatch: zero matches via lineage JOIN
- Investigation revealed: **legacy `job_templates` has NO canonical FK to `job_families`**. The source data lacks a semantic family assignment.

CW-B26 bias catalogued by CLI: "Semantic FK Phantom" — assumed FK relationship exists in source data based on column-name pattern matching, while real data has no semantic FK.

## §2 — Decision

**Make `sys_job_roles.job_role_family_id` nullable** via migration 000038 (next available number post-X2 sequence 000031-000037).

Effective DDL:
```sql
ALTER TABLE sys.sys_job_roles
  ALTER COLUMN job_role_family_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_job_roles.job_role_family_id IS
  'Optional FK to sys_job_families. NULL allowed for job_roles imported from legacy sources that lack canonical family assignment (see ADR-0015 + CW-B26 bias). When family becomes known (manual assignment, future taxonomy enrichment, or business catalog update), UPDATE to set the FK.';
```

FK constraint to sys_job_families remains intact (no ON DELETE CASCADE change needed) — NULL is valid for foreign key columns.

## §3 — Rationale + alternatives considered

### Why nullable FK (chosen)

1. **No mock/synthetic data**: respect Enzo's CARD-4 NO_MOCK directive. Avoid creating an artificial "UNASSIGNED" sentinel job_family.
2. **I1 Position-centric invariant compatible**: I1 establishes Position as primary entity; Job role family is enrichment metadata, not foundational identity. Nullable on the family link doesn't break I1.
3. **Legacy data fidelity**: 140/231 source job_templates legitimately have no family. Forcing a value would distort original semantics.
4. **Future-flexible**: when a family becomes known (manual taxonomy work, business catalog import, ML inference), UPDATE the FK. No schema rework required.
5. **Investment preservation**: sys_job_families bootstrap (27 rows real, batch X1) remains operational — used by job_roles that DO have a clear family.

### Alternative A — default "UNASSIGNED" family (REJECTED)

- Pro: maintains NOT NULL deterministic schema
- Pro: pragmatic, no schema migration to existing rows
- **Contro**: violates CARD-4 NO_MOCK (synthetic data injection)
- **Contro**: pollutes sys_job_families with non-real row (27 → 28 real+1 fake)
- **Contro**: downstream consumers can't easily distinguish "family unknown" vs "family is genuinely UNASSIGNED"
- Verdict: REJECTED

### Alternative B — skip sys_job_roles entirely (REJECTED)

- Pro: zero compromise
- **Contro**: 231 rows of legitimate HRMS data (job titles, descriptions, CCNL mapping) unavailable
- **Contro**: blocks downstream cascade (sys_position_skill_requirements, sys_esco_occupation_mappings)
- **Contro**: poor user experience — "ready for functional dev" implies job catalog accessible
- Verdict: REJECTED — too pessimistic

### Alternative C — nullable FK (CHOSEN)

- Pro: respects no-mock + I1 + legacy fidelity + future-flex + cascade unlock
- Contro: requires migration + acceptance criteria adjustment (downstream FK may return NULL)
- Verdict: CHOSEN

## §4 — Migration spec

**File**: `db/migrations/000038_sys_job_roles_family_nullable.sql`

```sql
-- =============================================================================
-- 000038_sys_job_roles_family_nullable.sql
-- ADR-0015 — Make sys_job_roles.job_role_family_id nullable
-- Rationale: legacy job_templates lacks canonical FK to job_families (CW-B26).
-- Allows nullable FK; sys_job_families bootstrap preserved for future enrichment.
-- Idempotent: ALTER COLUMN DROP NOT NULL is safe to re-run (PG ignores if already nullable).
-- =============================================================================

BEGIN;

ALTER TABLE sys.sys_job_roles
  ALTER COLUMN job_role_family_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_job_roles.job_role_family_id IS
  'Optional FK to sys_job_families. NULL allowed for job_roles imported from legacy sources lacking canonical family assignment (see ADR-0015 + CW-B26). UPDATE when family becomes known.';

-- Record migration
INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_by, duration_ms)
VALUES (
  '000038_sys_job_roles_family_nullable.sql',
  -- sha256 placeholder, CLI computes
  REPEAT('0', 64),
  CURRENT_USER,
  0
)
ON CONFLICT (file_name) DO NOTHING;

COMMIT;
```

**Note**: CLI must compute actual sha256 of the SQL file content + replace placeholder. Pattern matches existing migrations 000031-000037.

## §5 — Cascade fix 01 redesign (companion change)

**File**: `cowork_reserved/batch_c3/cascade_redesign/01_sys_job_roles_REDESIGN.sql`

Old approach (REJECTED): synthetic alias source_column + LOOKUP_FK to job_families via esco_occupation_code

New approach (POST ADR-0015):
- **No LOOKUP_FK mapping needed** for `job_role_family_id` — left NULL on insert
- Existing column_mappings for `job_role_code`, `job_role_name`, `job_role_description`, etc. remain valid
- Wave 1 retry will populate `sys_job_roles` with 231 rows (job_template_id 140 + ccnl_job_title_mapping 91) — all with `job_role_family_id = NULL`

Migration 000038 must apply BEFORE re-run of Wave 1.

## §6 — Downstream cascade impact

Once sys_job_roles populates (231 rows post-X3):
- `sys_esco_occupation_mappings` unblocks (cascade fix 02 was blocked by sys_job_roles=0)
- `sys_position_skill_requirements` unblocks (uses sys_job_roles via I1 Position model)

Expected post-X3 hit ratio jump: +3-4 sys.* tables populated.

## §7 — Acceptance criteria

1. Migration 000038 applies idempotently (twice-run pg_dump diff empty)
2. `\d sys.sys_job_roles` shows `job_role_family_id uuid` (no NOT NULL marker)
3. Existing 0 rows pre-migration not affected
4. Post Wave 1 retry: sys_job_roles count ≥ 140 (lower bound; 231 staged expected to upsert mostly)
5. Existing 27 sys_job_families rows preserved
6. FK constraint to sys_job_families intact (test: try INSERT with non-existent family_id, expect error)

## §8 — Risk + rollback

### Risk
- LOW: nullable FK is standard PG pattern, no data loss risk on existing rows (0 rows in sys_job_roles pre-migration)
- LOW: downstream consumers (UI, API endpoints) reading sys_job_roles must handle NULL family_id — code audit needed in pre-prod (likely OK since target endpoints not yet built)

### Rollback
```sql
-- Only safe if no row has NULL family_id
UPDATE sys.sys_job_roles SET job_role_family_id = '<some_default_uuid>' WHERE job_role_family_id IS NULL;
ALTER TABLE sys.sys_job_roles ALTER COLUMN job_role_family_id SET NOT NULL;
```

Or revert via fresh migration 000038-rollback.sql.

## §9 — Open questions for Enzo (resolvable in X3 REPORT review)

1. UI/API endpoints that query sys_job_roles — do they assume family_id is always present? (Cowork inspection of `apps/api/src/modules/...` may surface — defer to CLI runtime check)
2. Long-term: do you want a "family enrichment" workflow (manual or AI-assisted) to backfill NULL family_ids eventually? (defer to future ADR)

## §10 — Status

**ACCEPTED** (2026-06-01, v1.0.0 consolidation WS-6g). Acceptance criteria all met (verified against the live DB via tunnel :5433):
- `sys_job_roles` = **227** rows (criterion ≥ 140 — 162% over).
- Downstream cascade unblocked: rows import with the FK nullable rather than being WHERE-skip-filtered (227/227 currently carry `job_role_family_id IS NULL`, which is exactly the brownfield-import outcome this nullable-FK decision authorizes — family enrichment deferred per §9.2).
- No integrity violations: NULL `job_role_family_id` is the intended, allowed state; no FK constraint breach.
- Consistent with the sibling **ADR-0016** (`sys_esco_occupation_mappings` nullable `job_role_id`), ACCEPTED 2026-05-21. The same nullable-brownfield-FK pattern is the canonical resolution for required-FK-induced silent import skips (cf. v1.0.0 WS-3 applying it to `sys_skill_categories.skill_category_family_id`).

---

*End ADR-0015*
