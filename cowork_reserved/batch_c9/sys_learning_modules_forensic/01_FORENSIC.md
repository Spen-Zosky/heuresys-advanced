# Sys_learning_modules canonical re-mapping forensic

**Status**: investigation complete — re-mapping plan defined
**Author**: Cowork batch C9.3
**Date**: 2026-05-21
**Trigger**: REPORT 012 §6.2 + CW-B39 forensic — learning domain architectural mismatch

---

## §1 — Live state

```
legacy_mirror.courses        =   127 rows (CANONICAL source, currently UNUSED)
legacy_mirror.course_modules =   564 rows (currently mis-targeted → sys_learning_path_steps REFERENCE_ONLY post-X8)
legacy_mirror.esco_skills    = 14011 rows (already in lineage for sys_skills, target sys_skill_learning_mappings hop)
sys.sys_learning_modules     =  4488 rows (sourced from 5 ANALYTICS tables — non-canonical)
sys.sys_learning_paths       =  3227 rows
```

**Current sys_learning_modules sources (verified pre-X9)**:
- learning_bookmarks
- learning_content_providers
- learning_ratings
- learning_recommendations
- module_completions

All 5 are **analytics derivatives** (user feedback, completion tracking, recommendations) NOT canonical course/module content.

**legacy_mirror.courses schema** (canonical source):
```
id uuid, tenant_id uuid, code text, title text, title_en text, description text,
description_en text, course_type text, category text, duration_hours numeric,
skill_level text, provider text, provider_course_id text, provider_url text,
thumbnail_url text, ...
```

127 canonical courses — small but real. Plus 564 course_modules (children of courses).

## §2 — Architectural decision

**Two valid mappings exist**:

**Option A — courses → sys_learning_modules + course_modules → sys_learning_path_steps**
- `courses` (127) → sys_learning_modules as top-level learning content units
- `course_modules` (564) → sys_learning_path_steps where path_id resolves via course→sys_learning_modules lineage 2-hop
- Pro: canonical 1:1 between source semantic + target
- Contro: requires sys_learning_modules schema accepts 127 courses + 4488 analytics derivatives co-existing (might OK if course content is the "ground truth" and analytics derivatives are enrichments)

**Option B — courses → sys_learning_paths + course_modules → sys_learning_modules**
- `courses` (127) → sys_learning_paths (course = ordered path of modules)
- `course_modules` (564) → sys_learning_modules (modules = atomic content unit)
- Pro: semantically cleaner (course is "path", module is "unit")
- Contro: changes existing sys_learning_paths semantics (currently 3227 rows from other sources)

**Recommendation**: **Option A** — minimal disruption, leverages existing engine post-CW-B34/B38 patches, plus `course_modules → sys_learning_path_steps` was the ORIGINAL intent of legacy mapping (just blocked by missing 2-hop FK resolution).

## §3 — Mitigation plan (X9 Block B)

### §3.1 Create canonical lineage: courses → sys_learning_modules

1. Add table_mapping: `legacy_mirror.courses → sys.sys_learning_modules` with classification IMPORT
2. Add column_mappings:
   - `courses.id` → `learning_module_id` (LINEAGE_SOURCE_NK)
   - `courses.title` → `learning_module_name`
   - `courses.description` → `learning_module_description`
   - `courses.code` → `learning_module_code` (if applicable)
   - `courses.duration_hours` → metadata JSON
   - `courses.provider` → metadata JSON
   - `courses.tenant_id` → `learning_module_tenant_id` (LOOKUP_FK via brownfield.tenant_id_mappings)
3. Wave 1 retry → sys_learning_modules gets +127 rows lineage-tracked
4. Verify: lineage table sys_source_lineage_records now includes 127 rows source='courses' target='sys_learning_modules'

### §3.2 Re-enable course_modules + learning_path_courses → sys_learning_path_steps

After §3.1 succeeds (canonical courses now in sys_learning_modules lineage):
1. UPDATE 2 table_mappings (course_modules + learning_path_courses → sys_learning_path_steps) from REFERENCE_ONLY back to IMPORT
2. Add column_mappings using LOOKUP_FK (NOT LOOKUP_FK_2HOP — direct lineage now exists):
   - `course_modules.course_id` → `learning_path_step_path_id` (LOOKUP_FK via lineage to sys_learning_modules then map to learning_path)

Wait. Re-examining schema:

`sys_learning_path_steps.path_id → sys_learning_paths.learning_path_id`. NOT `sys_learning_modules.learning_module_id`.

So if courses → sys_learning_modules, then course_modules can't have path_id (path_id requires a sys_learning_paths row). The path↔module relation is different.

**Revised analysis**:
- `sys_learning_paths.learning_path_id` is the PARENT (what we'd traditionally call a "course")
- `sys_learning_path_steps` links path → ordered sequence of `sys_learning_modules`
- So a "course" in legacy = a "learning_path" in sys.* terminology

**Re-do mapping** (corrected):

### §3.1' Create canonical: courses → sys_learning_paths

`legacy_mirror.courses (127)` → `sys.sys_learning_paths` (already 3227, will add 127 more)
- Reasoning: a "course" semantically IS an ordered path of learning content

### §3.2' Create canonical: course_modules → sys_learning_modules

`legacy_mirror.course_modules (564)` → `sys.sys_learning_modules`
- Reasoning: a "course_module" IS an atomic learning unit
- The current 4488 analytics-derived sys_learning_modules can coexist (each analytics row references a module by id — these IDs would need to be reconciled OR analytics row reference is loose)

### §3.3 Unlock sys_learning_path_steps via lineage 2-hop

`learning_path_courses (124 rows)` has `learning_path_id` + `course_id`:
- `learning_path_id` 5/5 PASS resolves to sys_learning_paths (already verified C8.3) — straightforward LOOKUP_FK
- `course_id` — needs LOOKUP_FK_2HOP (course_id → legacy_mirror.courses.id → sys_learning_paths.learning_path_id) — wait, no, course_id refers to a COURSE which is now in sys_learning_paths

This is getting tangled. The cleanest fix:

**Final clean plan**:
1. `courses → sys_learning_paths` (127 new rows, canonical) — ADD lineage track
2. `course_modules → sys_learning_modules` (564 new rows, canonical) — ADD lineage track
3. `learning_path_courses → sys_learning_path_steps`:
   - `path_id ← learning_path_id` via LOOKUP_FK (existing lineage)
   - `module_id ← course_id` via LOOKUP_FK — but wait, course_id in learning_path_courses doesn't map to module, it maps to course (=path). Semantic mismatch in schema.

**Conclusion**: the learning domain in legacy has a complicated `course ↔ course_module ↔ learning_path` triple-entity that doesn't perfectly map to heuresys_advanced's `learning_path ↔ learning_module ↔ learning_path_step` triple.

Given complexity, X9 SKILGRO needs to **carefully audit** these semantics. The forensic in this file documents the analysis; the actual CLI implementation may surface additional drift requiring inline mitigation.

## §4 — Recommendation for X9 Block B (revised)

Given the complexity exposed above, recommend a **two-phase** approach within X9:

**Phase B.1 — courses → sys_learning_paths (low risk)**:
- 127 rows incremental, no existing collision
- Acceptance: sys_learning_paths 3227 → 3354
- Effort: ~30 min CLI

**Phase B.2 — course_modules → sys_learning_modules (low risk)**:
- 564 rows incremental + lineage tracking to canonical course (parent)
- Acceptance: sys_learning_modules 4488 → 5052
- Effort: ~30 min CLI

**Phase B.3 — sys_learning_path_steps unlock (medium risk)**:
- learning_path_courses 124 rows: NK = (path_id, ordinal). path_id LOOKUP_FK on learning_path_id (now resolvable post B.1). module/step semantics need decision: do these 124 rows have a "step module" or just a course assignment?
- Examine staging_raw_record sample for learning_path_courses to confirm path_step semantics
- Effort: ~1h CLI (depends on schema decision)

**Phase B.4 — DEFER if complex**:
- If learning_path_courses semantics don't fit sys_learning_path_steps after B.3 audit, classify back to REFERENCE_ONLY (already there post-X8). No regression.

## §5 — Acceptance criteria

Phase B.1: sys_learning_paths +127 rows lineage = courses ✅
Phase B.2: sys_learning_modules +564 rows lineage = course_modules ✅
Phase B.3 (optional): sys_learning_path_steps +X rows from learning_path_courses (X depends on schema audit) OR documented defer

## §6 — Effort estimate

CLI X9 Block B (canonical re-mapping): **2-3h cumulative**
- B.1 courses → sys_learning_paths: 30 min (DDL column_mappings + Wave 1)
- B.2 course_modules → sys_learning_modules: 30 min
- B.3 sys_learning_path_steps unlock (if feasible): 1-1.5h or defer

Plus Wave 1 retry ~1h.

---

*End sys_learning_modules forensic — canonical re-mapping plan with caveats*
