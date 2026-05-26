# EXEC CLASS B FINDINGS — Item F second-pass diagnostic

**event:** exec_classB_findings
**goal_id:** 003
**phase:** EXEC
**item:** F
**budget_consumed_classB:** 1.5 turn (within 2-turn cap)
**halt_state:** AWAITING_COWORK_DECISION
**created_at:** 2026-05-20T00:30+02:00
**p1_commit:** `127e1a7` (compiler form (b) → lineage JOIN, 72/72 tests + typecheck PASS)
**run_inspected:** `08d3bc9f-e16d-418d-8414-17873ef170aa` (same Wave 1 fullscale, pre-P1)

---

## §1 — Class B root cause (pattern-uniform across all 5 targets)

The 5 no-LOOKUP_FK targets are EMPTY because their NOT NULL FK columns have **zero column_mappings** in the brownfield registry. The validation phase passed (rows reach staging) but the upsert phase computes NULL for the unmapped FK columns → upsert-sql WHERE skip filter excludes the rows silently.

**Evidence — unmapped NOT NULL FK columns**:

| Target | NOT NULL FK column | n column_mappings | Staged rows blocked |
|---|---|---|---|
| sys_skill_categories | `skill_category_family_id` | **0** | 7256 |
| sys_learning_path_steps | `learning_path_step_path_id` | **0** | 688 |
| sys_learning_path_steps | `learning_path_step_module_id` | **0** | 688 (same rows) |
| sys_blueprint_process_registry | `blueprint_process_variant_id` | **0** | 63 |
| sys_job_roles | `job_role_family_id` | **0** | 231 |
| sys_esco_occupation_mappings | `esco_occupation_mapping_job_role_id` | **0** | 7645 |

Total blocked: ~15,883 staged rows across 5 targets (overlap on learning_path_steps).

**Source evidence** (sample row from `staging.wave1_skill_categories`):
```json
{
  "id": "78f44f01-b78e-4432-85eb-c753a5b21fe5",
  "name": "Problem Solving",
  "category": "Cognitive",
  "framework_id": "5912d53d-92bf-40c2-b842-5a1b58ecb61a",   ← legacy framework UUID (would map to sys_skill_families.skill_family_id via lineage)
  "tenant_id": "d5855519-3ed1-4427-865f-fe75f1e42c4c",
  "created_at": "...",
  "updated_at": "..."
}
```

The legacy source HAS the UUID needed (e.g., `framework_id`), and the lineage table HAS the canonical mapping (`source_record_id=framework_id_value, target_table='sys_skill_families' → target_record_id`). What's MISSING is the `brownfield.column_mappings` row instructing the executor to use LOOKUP_FK form (b) with matchKey='legacy_id' to resolve this FK.

**Conclusion**: pattern-uniform. All 5 targets have the same failure shape: **a registry gap, NOT a runtime/compiler issue**. With P1 (compiler form (b) lineage JOIN) shipped, the fix is purely additive INSERTs of LOOKUP_FK mappings to brownfield.column_mappings.

---

## §2 — Proposed P-B fix (NOT pattern-uniform compiler extension)

**Per Cowork decision gate**, this fix triggers STOP because:
- It is NOT a "pattern-uniform compiler extension" (P1 IS such an extension; P-B is a registry change).
- It requires `brownfield.column_mappings` INSERT on wave=1 (registry semantic modification).

### P-B proposal (the fix that would close C4/C5 for 5 remaining targets)

INSERT 6 new `brownfield.column_mappings` rows on wave=1:

| target_table | target_column | source_column | transform | payload |
|---|---|---|---|---|
| sys_skill_categories | skill_category_family_id | framework_id | LOOKUP_FK | `{"target_table":"sys_skill_families","match_on":"skill_family_metadata->>legacy_id"}` |
| sys_learning_path_steps | learning_path_step_path_id | path_id | LOOKUP_FK | `{"target_table":"sys_learning_paths","match_on":"learning_path_metadata->>legacy_id"}` |
| sys_learning_path_steps | learning_path_step_module_id | module_id | LOOKUP_FK | `{"target_table":"sys_learning_modules","match_on":"learning_module_metadata->>legacy_id"}` |
| sys_blueprint_process_registry | blueprint_process_variant_id | variant_id (verify) | LOOKUP_FK | `{"target_table":"<sys.*>","match_on":"<metadata->>legacy_id>"}` (target verification needed) |
| sys_job_roles | job_role_family_id | family_id (verify) | LOOKUP_FK | `{"target_table":"<sys.*>","match_on":"<metadata->>legacy_id>"}` (target verification needed) |
| sys_esco_occupation_mappings | esco_occupation_mapping_job_role_id | job_role_id (verify) | LOOKUP_FK | `{"target_table":"sys_job_roles","match_on":"job_role_metadata->>legacy_id"}` |

Note: 3 of 6 have unclear lookup targets (which sys.* table is the proper FK target). Would require additional sub-discovery of:
- sys_blueprint_process_registry's blueprint_process_variant_id → what sys.* row has the variant?
- sys_job_roles's job_role_family_id → likely sys_job_role_families (need to verify table exists).
- sys_esco_occupation_mappings's esco_occupation_mapping_job_role_id → sys_job_roles.

All 6 INSERTed mappings would use **form (b)** which P1 now resolves via lineage JOIN deterministically. The trigger validate_lookup_fk_payload (Item M / CP2) would accept all 6 at INSERT time (form (b) check).

**Constraint check (A1 ABSOLUTE)**:
- A1 forbids UPDATE/DELETE of wave=1 brownfield.column_mappings rows. ✓ INSERT is NOT UPDATE/DELETE.
- D6 decision-locked the same. ✓ INSERT not addressed.
- However, the SPIRIT of A1 ABSOLUTE was "don't modify the registry". INSERT NEW rows IS a registry modification, even if technically not UPDATE/DELETE.

**Estimated impact** (if Cowork approves):
- Code change: 1 SQL seed file `db/seeds/brownfield/wave1_classB_fk_mappings.sql` with 6 INSERTs.
- Apply via SSH on VM (~5 sec).
- Sub-discovery for 3 unclear lookup targets (~1 turn).
- Wave 1 retry (~30-50 min wall-clock per Goal 003 recalibrated target).
- Turns: ~3-5 (seed + apply + sub-discovery + retry + verify).

---

## §3 — Alternative fix paths (less preferred)

### P-B-alt1: Compiler "FK convention fallback"

Add compiler heuristic: if upsert target has NOT NULL FK column without mapping, emit synthetic LOOKUP_FK via lineage JOIN based on column name convention (e.g., `*_family_id` → `sys_*_families.family_id`). This is **architectural change** (pattern-uniform compiler extension would require generic convention rules, not target-specific). NOT recommended — too speculative.

### P-B-alt2: Accept partial closure

VIOLATES anti-pattern guard #2. Per PROMPT v2 §6 + Cowork decision gate. Not viable.

### P-B-alt3: Defer to Goal 004

VIOLATES anti-pattern guard #4 — "NO Goal 004 deferral of Wave 1 issues". Not viable.

---

## §4 — Recommendation

**P-B (INSERT 6 new wave=1 column_mappings + sub-discovery for 3 unclear targets)** is the only fix that closes C4/C5 within Goal 003 scope.

The fix is **mechanical** (no architectural change, no new transform codes — uses existing LOOKUP_FK + P1 form (b) compiler logic). But it requires:
1. Cowork sign-off on wave=1 column_mappings INSERT (interpret A1 ABSOLUTE as UPDATE/DELETE only, NOT INSERT).
2. Cowork sign-off on sub-discovery turn for 3 unclear lookup targets.

**Alternative cleaner narrative** (Cowork might prefer): rename the constraint from "A1 ABSOLUTE no UPDATE/DELETE wave=1" to "A1 wave=1 column_mappings rows are immutable IN THEIR EXISTING SHAPE; new mappings to fill gaps are authorized per Goal 003 §F closure plan". This makes P-B legitimate without bending A1.

---

## §5 — Budget status

| Phase | Used | Remaining |
|---|---|---|
| Pre-Item-F EXEC (K+C+D+M+A+B) | 12 | 28 |
| Item F first run | 3 | 25 |
| Diagnostic class A | 2 | 23 |
| P1 implementation + tests + commit | 2 | **21** |
| Class B diagnostic | 1.5 | **19.5** |
| ESTIMATED for P-B (if approved) | 3-5 | 14.5-16.5 |
| Wave 1 retry (single bundled) | 2-3 | 12-14 |
| Item L (REPORT + STATE) | 2 | **10-12** |
| Projected closure | — | **28-30/40** |
| Escalation threshold | — | 35 |

Buffer at closure: 10-12 turns. Within budget envelope.

---

## §6 — Halt request

**halt_state: AWAITING_COWORK_DECISION**

Choose one:

- **(D1) APPROVE P-B**: authorize wave=1 column_mappings INSERT (clarify A1 ABSOLUTE as UPDATE/DELETE-only). CLI proceeds with seed file + sub-discovery + bundled Wave 1 retry.
- **(D2) AMEND P-B**: provide direction on which sys.* tables the 3 unclear targets map to (blueprint_process_variant_id, job_role_family_id, esco_occupation_mapping_job_role_id). CLI proceeds with seed + retry.
- **(D3) ESCALATE**: this is a Goal-level architectural decision (registry-gap discovery during Item F was unexpected). Pivot to a Goal 003 PROMPT v3 amendment or split scope.

CLI standing by. No further code/DB writes until Cowork direction.

---

*End of _03_EXEC_003_CLASSB_FINDINGS_Item_F.md*
