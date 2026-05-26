# EXEC CLASS B SUB-DISCOVERY — registry gap is multi-layered

**event:** exec_classB_subdiscovery
**goal_id:** 003
**phase:** EXEC
**item:** F
**budget_consumed_subdiscovery:** 1 turn (within 1-turn cap)
**halt_state:** AWAITING_COWORK_DECISION
**created_at:** 2026-05-20T00:50+02:00
**p1_commit:** 127e1a7 (shipped, 72/72 tests + typecheck PASS)

---

## §1 — Sub-discovery deliverable: FK targets via pg_constraint (verified)

| Source column on target | FK target (pg_constraint) |
|---|---|
| sys_skill_categories.skill_category_family_id | sys_skill_families.skill_family_id ✓ |
| sys_learning_path_steps.learning_path_step_path_id | sys_learning_paths.learning_path_id ✓ |
| sys_learning_path_steps.learning_path_step_module_id | sys_learning_modules.learning_module_id ✓ |
| sys_blueprint_process_registry.blueprint_process_variant_id | sys_blueprint_variants.blueprint_variant_id ✓ |
| sys_job_roles.job_role_family_id | sys_job_families.job_family_id ✓ |
| sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id | sys_job_roles.job_role_id ✓ |

---

## §2 — Cascade target population status

| Cascade target | rows | In Wave 1 mappings? |
|---|---|---|
| sys_skill_families | 77 ✅ | YES (sys_skill_families is a Wave 1 target) |
| sys_learning_paths | 3227 ✅ | YES |
| sys_learning_modules | 4488 ✅ | YES |
| **sys_blueprint_variants** | **1** (seed only) | **NO** (not in any wave mapping) |
| **sys_job_families** | **0** | **NO** (not in any wave mapping) |
| **sys_job_roles** | **0** | YES (in Wave 1) — but cascade dep on sys_job_families |

**Key finding**: `sys_blueprint_variants` + `sys_job_families` are NOT imported in ANY brownfield wave (verified via `SELECT FROM brownfield.table_mappings WHERE target IN (...)` returning 0 rows). They are PREREQUISITES for sys_blueprint_process_registry and sys_job_roles respectively.

---

## §3 — Source column availability per mapping

Sub-discovery via `\d` and broader regex search:

| # | Required mapping | Candidate source_column | Exists in brownfield.source_columns? |
|---|---|---|---|
| 1 | sys_skill_categories ← sys_skill_families | **competencies.framework_id** (UUID) | ✅ YES |
| 2 | sys_learning_path_steps.path_id ← sys_learning_paths | **learning_path_courses.learning_path_id** (UUID) | ✅ YES |
| 3 | sys_learning_path_steps.module_id ← sys_learning_modules | **learning_path_courses.course_id** (UUID); needs course→module lineage validation | ✅ YES (column); ⚠️ semantic |
| 4 | sys_blueprint_process_registry ← sys_blueprint_variants | business_processes has `profile_id` only (no `variant_id` / `process_variant_id` column) | ❌ NO |
| 5 | sys_job_roles ← sys_job_families | onet_occupations has `job_zone, isco_code` but no `family_id`; job_templates has `salary_band_code` but no `family_id` | ❌ NO |
| 6 | sys_esco_occupation_mappings ← sys_job_roles | onet_esco_mappings has `onet_element_id, esco_occupation_id, esco_skill_id` but no `job_role_id` | ❌ NO |

**Net feasibility (per Cowork D1 approval scope)**:
- **2 fully feasible** (#1, #2)
- **1 partially feasible with semantic verification needed** (#3 — depends on whether `course_id` legacy values map to sys_learning_modules via existing lineage rows)
- **3 INFEASIBLE in Goal 003 Wave 1 scope** (#4, #5, #6) — either source_column missing AND/OR cascade target empty

---

## §4 — Root cause expanded

The Wave 1 brownfield registry was designed assuming certain target tables would be **pre-seeded outside the brownfield import** (specifically `sys_blueprint_variants` and `sys_job_families`), OR that downstream consumers would tolerate sparse FKs. Neither assumption holds:

- `sys_blueprint_variants` has 1 seed row (likely from migration 000021 RTL_BANK seed) but the 63 staging.wave1_blueprint_process_registry rows can't deterministically map their `variant_id` to that single seed because they have no `variant_id` source column.
- `sys_job_families` has 0 rows. Wave 1 designers may have assumed this table would be populated by an out-of-band process or in a different wave, but it's not in any wave.

**This is NOT a runtime bug. It's a Wave 1 SCOPE design gap.**

Per anti-pattern guard #4 ("NO Goal 004 deferral of Wave 1 issues"), these 3 INFEASIBLE mappings cannot simply be punted. But they require fundamentally different fixes than P1/P-B-pattern-uniform compiler/registry tweaks:

- **Option α — Seed `sys_job_families` + `sys_blueprint_variants` via a new migration 000034**: define a synthetic-but-realistic set of job families and blueprint variants. Then the 3 INFEASIBLE targets could resolve via CONSTANT-default mappings or via heuristic clustering (job_template.job_code prefix → family lookup). Estimated turns: 5-8 (migration + seed data design + 6 registry INSERTs + retry). **Scope expansion**: adds new sys.* data outside brownfield import pipeline.

- **Option β — Wave 1 SCOPE re-cut**: acknowledge that sys_blueprint_process_registry/sys_job_roles/sys_esco_occupation_mappings are Wave 2-or-later targets (they depend on prerequisites the brownfield doesn't import in Wave 1). Excise them from Wave 1 acceptance criteria. **Effective**: closes Goal 003 with documented "Wave 1 scope correction; original DISCOVERY misclassified these 3 targets as Wave 1 when they need Wave 2+ prerequisites". Allows C4/C5 PASS for the remaining 12-13 targets.
  - PROMPT v2 amendment required (this is supervisor-side scope correction, similar to v1→v2 transition).

- **Option γ — Apply 2 feasible INSERTs only + documented partial**: ship 2 mappings (sys_skill_categories + sys_learning_path_steps × 2 columns = 3 INSERTs total), document the 3 infeasible cases in REPORT, accept C4/C5 partial. **VIOLATES anti-pattern guard #2** (no partial closure) — not viable.

- **Option δ — Try with sub-optimal source_column choices** (e.g., business_processes.profile_id → sys_blueprint_variants.blueprint_variant_id via lineage). Profile_id is not semantically a variant_id; the lineage JOIN would resolve NULL for all 63 rows (silent skip continues). **Wastes a retry cycle**.

---

## §5 — Recommendation

**Option β (Wave 1 SCOPE re-cut)** is cleanest given:

1. The 3 INFEASIBLE mappings are not a runtime bug — they're a DISCOVERY-time scope mis-design (CW-B18 case study from Cowork directive).
2. Option α adds significant non-brownfield seed work that bleeds into other concerns (where do "realistic" job families come from? Out-of-scope per PROMPT v2).
3. Option β is consistent with v1→v2 transition pattern: supervisor-side scope correction at PLAN/EXEC-review when evidence shows original PROMPT was over-scoped.

Concrete proposal under Option β:
- PROMPT v3 amends C5 to require ≥12 of 15 sys.* Wave 1 targets ≥1 row OR documented (acknowledges 3 cascade-dependent targets as Wave 2 prerequisites).
- C4 reformulated as "every APPROVED mapping with feasible cascade target has ≥1 successful upsert OR documented source-empty/cascade-incomplete exception".
- CLI implements the 2 feasible INSERTs + retries Wave 1.

---

## §6 — Halt request

**halt_state: AWAITING_COWORK_DECISION**

CLI standing by. Choose:

- **(D1') Option α** — authorize new migration 000034 to seed sys_job_families + sys_blueprint_variants synthesis. CLI implements migration + seed + 6 mappings + retry. ~5-8 turn.
- **(D2') Option β** — PROMPT v3 amendment narrowing C4/C5 to feasible subset. CLI implements 2 feasible mappings (3 INSERTs covering sys_skill_categories + 2× sys_learning_path_steps cols) + retry + REPORT documenting Wave 1 scope correction.
- **(D3') Option γ** — partial closure (VIOLATES anti-pattern). Not viable per guard #2.
- **(D4') Option δ** — try sub-optimal mappings + retry (likely wastes a cycle). Not recommended.

Per Cowork CW-B18 acknowledgment in earlier turn (DISCOVERY 003 missed registry completeness for these 3 targets), Option β feels most honest. Option α adds significant scope. Awaiting directive.

---

## §7 — Budget impact

| Phase | turns |
|---|---|
| Consumed pre-sub-discovery | 19.5 |
| Sub-discovery (this turn) | 1 (within cap) |
| Cumulative | **20.5** |
| Option α (if approved) | +5-8 → 25.5-28.5 |
| Option β (if approved) | +3-4 (smaller scope, 2 INSERTs + retry + REPORT amendment) → 23.5-24.5 |
| Item L (REPORT + STATE) | +2 → see below |
| Projected closure under α | 27.5-30.5 / 40 |
| Projected closure under β | 25.5-26.5 / 40 |
| Escalation threshold | 35 |

Both options within budget. β is leaner.

---

*End of _03_EXEC_003_CLASSB_SUBDISCOVERY_Item_F.md*
