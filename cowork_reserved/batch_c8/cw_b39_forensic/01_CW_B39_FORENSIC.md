# CW-B39 Forensic — sys_learning_path_steps.path_id (688 missing)

**Status**: investigation complete — Learning domain architectural mismatch. Defer to X9 SKILGRO macro-area.
**Author**: Cowork batch C8.3
**Date**: 2026-05-21
**Audit trigger**: REPORT 011 §5 — 688 rows excluded as `nk_missing_learning_path_step_path_id` (new top-rank post X5.B/X7)

---

## §1 — Target schema

```
sys.sys_learning_path_steps
  learning_path_step_id      uuid NOT NULL PK
  learning_path_step_path_id   uuid NOT NULL FK→sys_learning_paths(learning_path_id) ON DELETE CASCADE
  learning_path_step_module_id uuid NOT NULL FK→sys_learning_modules(learning_module_id) ON DELETE RESTRICT
  learning_path_step_ordinal   smallint NOT NULL
  ...

UNIQUE INDEX path_ordinal_uq (path_id, ordinal)
```

NK UQ: (path_id, ordinal). 2 NK FKs `NOT NULL`. Pattern similar to CW-B35 (NK UUID required).

## §2 — Source breakdown (688 staged rows)

| Source | Rows | path_id candidate | module_id candidate | Classification |
|---|---:|---|---|---|
| course_modules | 564 | **none** (`course_id` resolves nowhere) | `course_id` (resolves nowhere) | **MISCLASSIFIED** ❌ |
| learning_path_courses | 124 | `learning_path_id` 5/5 PASS → sys_learning_paths ✅ | `course_id` 0/5 to sys_learning_modules ❌ | **HALF-RESOLVABLE** ⚠️ |

## §3 — Per-source diagnosis

### §3.1 course_modules (564 rows) — MAPPING MISCLASSIFICATION

```
keys in staging: course_id, title, description, sequence_order, duration_minutes,
                 content_type, content_url, is_mandatory, passing_score, tenant_id
```

`course_id` (UUID) doesn't resolve to ANY sys.* target via lineage (verified 0/5 to sys_learning_modules + 0/5 to sys_learning_paths + 0/5 to any source_table). The source table `course_modules` is canonical learning content (modules of a course), but the brownfield registry classifies it as a "step in a learning path" — semantic mismatch.

Looking at sys_learning_modules current lineage:
```
sys_learning_modules sources: learning_bookmarks, learning_content_providers,
                              learning_ratings, learning_recommendations, module_completions
```

**Canonical source `courses` / `course_modules` is NOT in sys_learning_modules lineage**. The current sys_learning_modules is populated from analytics derivatives (bookmarks, ratings, recommendations) — NOT from the source-of-truth course content.

This indicates **learning domain mapping architectural error** in the legacy brownfield registry. `course_modules` should logically populate `sys_learning_modules` (or be reference data for them), NOT `sys_learning_path_steps`.

**Verdict §3.1**: MAPPING MISCLASSIFICATION (CW-B36 family). Re-classify REFERENCE_ONLY pending X9 SKILGRO holistic learning domain rebuild.

### §3.2 learning_path_courses (124 rows) — HALF-RESOLVABLE (Import Gap + Semantic gap)

```
keys in staging: course_id, learning_path_id, sequence_order, is_mandatory,
                 unlock_after_days, tenant_id
```

`learning_path_id` 5/5 PASS resolution → sys_learning_paths (3227 rows). Path FK side **resolvable**.

`course_id` 0/5 PASS resolution → sys_learning_modules (4488 rows). Module FK side **NOT resolvable** — same root cause as §3.1 (sys_learning_modules lineage doesn't include canonical courses).

**Verdict §3.2**: HALF-RESOLVABLE. Theoretical Import Gap fix for path_id is feasible, BUT module_id resolution fails → row would skip on module_id regardless. Effectively also deferred to X9 SKILGRO.

## §4 — Conclusion: defer to X9 SKILGRO

CW-B39 surfaces a **learning domain architectural mismatch** that requires holistic re-design:
- Canonical `courses` / `course_modules` legacy table is not currently in sys_learning_modules lineage
- learning_path_courses partial mappable but blocked by module_id
- 688 rows of audit noise without resolvable target structure

**X9 SKILGRO macro-area** (per roadmap) will re-evaluate the entire SKILGRO ontology (Skills + Learning Loop) including:
- Decide canonical source for sys_learning_modules (probably needs new table_mapping from `courses`)
- Re-target course_modules to sys_learning_modules (correct semantic destination)
- Resolve learning_path_courses 2-hop (path + module) once both lineages exist
- Consider new transform `LOOKUP_FK_2HOP` (also CW-B37 deferred fix)

## §5 — Proposed mitigation (X8 trivial — cosmetic audit cleanup)

Re-classify **both** table_mappings (`course_modules` + `learning_path_courses` → sys_learning_path_steps) as REFERENCE_ONLY. Effect: 688 rows out of Wave 1 audit noise, no functional regression (target was already 0 populated).

```sql
BEGIN;

UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-B39 (Cowork batch C8.3): learning domain architectural mismatch. course_modules + learning_path_courses cannot resolve module_id via current sys_learning_modules lineage (sourced from analytics, not canonical courses). Defer to X9 SKILGRO holistic rebuild.'::text)
       )
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
      AND st.source_table_name IN ('course_modules','learning_path_courses')
 );

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
     AND st.source_table_name IN ('course_modules','learning_path_courses')
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CW-B39 expected 2 rows REFERENCE_ONLY, got %', v_count;
  END IF;
END $$;

COMMIT;
```

## §6 — Acceptance criteria post-X8

```sql
-- Audit post X8 Wave 1 retry
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X8_runId>'
   AND import_validation_result_payload->>'target_table' = 'sys_learning_path_steps'
 GROUP BY 1;
-- Expected: 0 rows (both sources REFERENCE_ONLY → no rows in Wave 1 pipeline)
```

## §7 — Pattern catalog impact

CW-B39 = mix of CW-B36 (Mapping Misclassification, course_modules 564) + partial CW-B35 (Import Gap blocked, learning_path_courses 124).

No new pattern category — confirms existing CW-B36 + CW-B35 patterns are recurring in learning/skills domain. Pattern memo §12 will note that **multiple bias instances in same domain = signal for dedicated macro-area triage** (here X9 SKILGRO).

## §8 — Effort estimate

CLI X8 Block B (CW-B39 cleanup only): **10 min**.
- 1 UPDATE SQL
- Wave 1 retry verify
- Commit

Deep fix (course_modules → correct target + module_id 2-hop resolution): X9 SKILGRO dedicated batch.

## §9 — Open questions for X9 SKILGRO planning

1. What is the canonical source for `sys_learning_modules`? `courses` table in legacy? Or new SDBI synthesis from multiple analytics sources?
2. Should `sys_learning_path_steps` rebuild from scratch with new sources (learning_paths + courses 2-hop join) once canonical learning_modules established?
3. `course_modules` 564 rows — should they populate sys_learning_modules (not sys_learning_path_steps)?
4. 2-hop LOOKUP_FK transform — design decision: engine extension OR pre-staging materialized view?

---

*End CW-B39 forensic — Learning domain architectural mismatch, defer to X9 SKILGRO*
