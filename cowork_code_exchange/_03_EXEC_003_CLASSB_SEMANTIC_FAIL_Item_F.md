# EXEC CLASS B SEMANTIC FAIL — INSERT #3 course→module lineage mismatch

**event:** exec_classB_semantic_fail
**goal_id:** 003
**phase:** EXEC
**item:** F
**budget_consumed_semantic_verify:** 0.5 turn
**halt_state:** AWAITING_COWORK_DECISION
**created_at:** 2026-05-20T01:10+02:00
**triggered_by:** PROMPT v3 §"Action items per CLI" #1 (semantic verify trigger)

---

## §1 — Semantic verify outcomes

Per PROMPT v3 action item #1, ran lineage cross-check for each of the 3 authorized INSERTs:

| # | Mapping | Lineage matches | Source data distribution |
|---|---|---|---|
| 1 | sys_skill_categories.skill_category_family_id ← `competencies.framework_id` | **4** out of 4 distinct framework_ids | 32 staging rows have framework_id key; remaining 7224 of 7256 staged rows come from `ontology_categories`/`skill_classifications` source tables that DON'T have framework_id → would silent-skip |
| 2 | sys_learning_path_steps.learning_path_step_path_id ← `learning_path_courses.learning_path_id` | **20** out of 20 distinct path_ids | 124 staging rows, all have learning_path_id, all resolve via lineage from `learning_paths` source |
| 3 | sys_learning_path_steps.learning_path_step_module_id ← `learning_path_courses.course_id` | **0** ❌ | 124 staging rows have course_id, but `sys_learning_modules` was populated from `learning_bookmarks`/`learning_ratings`/`learning_recommendations`/`module_completions`/`learning_content_providers` — NOT from a `courses` legacy source table |

PROMPT v3 trigger: "If count = 0 → halt+escalate inbox `exec_classB_semantic_fail` with proposed alternative".

---

## §2 — Cascading impact analysis

### #3 root cause

The Wave 1 brownfield does NOT import the legacy `courses` table. Instead, `sys_learning_modules` was populated from 5 different source tables (none of which is `courses`). The `learning_path_courses.course_id` references a row in `courses` (or similar) that has no representation in `sys_learning_modules`. The lineage JOIN deterministically returns NULL for ALL 124 staging rows.

### Coupling with #2

sys_learning_path_steps has TWO NOT NULL FK columns: `learning_path_step_path_id` AND `learning_path_step_module_id`. The upsert-sql WHERE skip filter excludes any row where ANY required FK is NULL. So even if #2 (path_id) resolves successfully for all 124 rows, the row will STILL silent-skip because #3 (module_id) cannot resolve.

**Net effect**: applying INSERT #2 alone (without #3) produces ZERO upserts for sys_learning_path_steps. Both #2 and #3 must succeed together, OR sys_learning_path_steps remains empty.

### #1 partial coverage

INSERT #1 would resolve `skill_category_family_id` for only 4 distinct framework_ids out of 7256 staged rows. The 32 rows from `competencies` source would upsert; the 7224 rows from `ontology_categories` + `skill_classifications` sources have NO framework_id in their staging_raw_record. They would silent-skip.

**Net effect**: applying INSERT #1 yields ~32 upserts (well within the C4 "≥1 successful upsert" threshold for the sys_skill_categories target). The remaining 7224 staged rows fall into a different failure mode — "source table doesn't carry the FK lookup key" — which is a third silent-skip class **Class C**.

---

## §3 — Reclassification (proposed)

Given the cascading and Class-C surfacing, propose:

### Targets feasible in Goal 003 (post-fix Wave 1 retry)

| # | Target | Coverage | Fix |
|---|---|---|---|
| 1 | sys_skill_categories | **partial** (~32 / 7256 = 0.4%) | INSERT #1 |
| 2 | (already populated) sys_skill_families | (no change) | — |
| 3 | (already populated) sys_skills | (no change) | — |
| 4 | (already populated) sys_learning_modules | (no change) | — |
| 5 | (already populated) sys_learning_paths | (no change) | — |
| 6 | (already populated) sys_compensation_bands | (no change) | — |
| 7 | (already populated) sys_activity_classifications | (no change, Item C) | — |
| 8 | sys_skill_aliases / sys_skill_taxonomy_edges / sys_skill_learning_mappings / sys_process_kpi_templates | depend on P1 form (b) fix | Wave 1 retry will exercise P1 |

### Targets reclassified INFEASIBLE Goal 004 (4 of 15)

| Target | Reason |
|---|---|
| sys_blueprint_process_registry | cascade prerequisite sys_blueprint_variants empty + no source_col for variant_id |
| sys_job_roles | cascade prerequisite sys_job_families NOT IN ANY WAVE + no source_col |
| sys_esco_occupation_mappings | cascade prerequisite sys_job_roles empty + no source_col |
| **sys_learning_path_steps (NEW)** | cascade prerequisite — Wave 1 doesn't import legacy `courses` table; course_id has no lineage to sys_learning_modules |

### C5 acceptance further narrowed

Original PROMPT v3 C5: "≥12 of 15 Wave 1 sys.* targets populated" (3 INFEASIBLE documented).
**Updated proposal**: "≥11 of 15 Wave 1 sys.* targets populated" (4 INFEASIBLE documented).

---

## §4 — Proposed action paths

### Option E1 — Drop INSERT #2 + #3 from seed, keep only #1; reclassify sys_learning_path_steps as 4th Goal 004 INFEASIBLE

Apply only INSERT #1 (sys_skill_categories.skill_category_family_id). Cleanup:
- sys_learning_path_steps joins the 3 INFEASIBLE list. Emit `CASCADE_PREREQUISITE_MISSING_GOAL_004` audit for its 124 staged rows.
- C5 narrowed to ≥11/15 (was ≥12 in PROMPT v3, now needs micro-amendment v3.1 or supervisor verbal lock).

**Coverage post-retry**:
- 6 originally-populated targets + sys_activity_classifications (Item C) + sys_skill_categories (~32 rows) + 4 P1-fixed targets (sys_skill_aliases, sys_skill_taxonomy_edges, sys_skill_learning_mappings, sys_process_kpi_templates) = **11 populated targets**.
- 4 INFEASIBLE documented (sys_blueprint_process_registry, sys_job_roles, sys_esco_occupation_mappings, sys_learning_path_steps).
- = 15 total ✅.
- C5 narrowed bar 11/15 satisfied.

**Estimated turns**: +2 (seed + retry + verify; smaller scope than original P-B).

### Option E2 — Find alternative source for sys_learning_path_steps.module_id

Investigate whether `learning_path_courses.course_id` could be mapped to a different sys.* target table that DOES have the course lineage (perhaps a `sys_learning_modules` row created from a `course_modules` source?). Requires sub-discovery: which sys.* target table did `course_modules` source populate?

Looking at the existing mapping data (STEP 3.1 from earlier): `course_modules` source contributed 12 column_mappings for `sys_learning_path_steps` — so `course_modules` IS a source for sys_learning_path_steps itself, not for sys_learning_modules. This is a dead end.

Alternative: import `courses` legacy table in Wave 1 (out-of-scope per PROMPT, not in any wave).

**Estimated turns**: 3-5 (sub-discovery + potentially Wave 1 scope add — significant scope expansion).

### Option E3 — Hybrid: ship 2 INSERTs (#1 + #2) without #3; sys_learning_path_steps remains empty but with rows-staged audit-documented

Apply only #1 and #2. sys_learning_path_steps remains 0 upserted (because module_id can't resolve), but the audit row tracking it changes from "silent skip" (Class B) to "deterministic skip due to module_id unresolvable" (Class C with new audit rule_code). Cleaner audit trail for diagnostic.

Drawback: same effective end state as E1 (sys_learning_path_steps empty), just with different audit class. Adds a useless INSERT #2 if it leads to no upserts.

**Estimated turns**: same as E1.

---

## §5 — Recommendation

**Option E1**. Rationale:
1. Cleanest end-to-end: 1 INSERT, 4 INFEASIBLE documented uniformly with `CASCADE_PREREQUISITE_MISSING_GOAL_004` audit rule_code.
2. Aligns with PROMPT v3 architecture (narrow C4/C5 to feasible subset).
3. Requires micro-amendment to C5 bar (≥12 → ≥11) — this is supervisor-side, NOT scope reduction by executor.
4. Lowest cycle cost.

If E1 approved → CLI proceeds: write seed with 1 INSERT, validate trigger, apply, emit `CASCADE_PREREQUISITE_MISSING_GOAL_004` audit for 4 INFEASIBLE targets (63 + 231 + 7645 + 124 = 8063 staged rows total), Wave 1 retry, verify, REPORT.

---

## §6 — Halt request

**halt_state: AWAITING_COWORK_DECISION**

Choose:

- **(E1') Option E1** — drop #2+#3, ship #1 only, reclassify sys_learning_path_steps as 4th INFEASIBLE, narrow C5 to ≥11/15. RECOMMENDED.
- **(E2') Option E2** — sub-discovery to find alternative module_id source. Scope expansion.
- **(E3') Option E3** — ship #1+#2 (#2 produces no upserts but maintains audit symmetry).

CLI standing by. No further DB/code writes until directive.

---

## §7 — Budget

| Phase | turns |
|---|---|
| Consumed pre-semantic-verify | 21 |
| Semantic verify (this turn) | 0.5 |
| Cumulative | **21.5** |
| Option E1 (recommended) | +2 → 23.5 |
| Audit emission (CASCADE_PREREQUISITE_MISSING) | inline |
| Wave 1 retry bundled | +2-3 → 25.5-26.5 |
| Item L (REPORT + STATE) | +2 → 27.5-28.5 |
| Projected closure | **27.5-28.5 / 40** |
| Buffer at closure | 11.5-12.5 turn |
| Escalation threshold 35: not crossed |

---

*End of _03_EXEC_003_CLASSB_SEMANTIC_FAIL_Item_F.md*
