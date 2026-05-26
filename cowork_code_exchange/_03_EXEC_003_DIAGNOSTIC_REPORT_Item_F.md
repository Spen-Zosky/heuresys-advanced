# EXEC DIAGNOSTIC REPORT — Item F silent-skip root cause

**event:** exec_diagnostic_report
**goal_id:** 003
**phase:** EXEC
**item:** F
**budget_consumed_diagnostic:** 2 turn (within 3-turn cap)
**halt_state:** AWAITING_COWORK_DECISION
**created_at:** 2026-05-20T00:50+02:00 (post-midnight, run completed at 19:41 UTC = 21:41 local 2026-05-19)
**run_inspected:** `08d3bc9f-e16d-418d-8414-17873ef170aa` (Wave 1 fullscale, status=COMPLETED, wall_clock=2896s/48min)

---

## §1 — Findings

### silent_skip_root_cause_class_A (HIGH confidence)

LOOKUP_FK form (b) jsonb-expr `<X>_metadata->>'legacy_id'` resolves to NULL because `sys.*_metadata` jsonb columns NEVER contain `legacy_id` key — verified across ALL 6 populated tables.

| Target sys.* table | count(*) | count where metadata ? 'legacy_id' |
|---|---|---|
| sys_skills | 6037 | **0** |
| sys_learning_modules | 4488 | **0** |
| sys_learning_paths | 3227 | **0** |
| sys_skill_families | 77 | **0** |
| sys_compensation_bands | 75 | **0** |
| sys_activity_classifications | 3276 | **0** |

Item A scope-lock (Cowork CHECKPOINT 2026-05-19T16:40Z) only fixed form (a) `legacy_tenant_id`/`legacy_user_id` for sys_tenancies/sys_users targets. Form (b) was explicitly NOT in Item A scope. When LOOKUP_FK resolves NULL, the upsert-sql.ts WHERE skip filter (lines 238-269) excludes the row to avoid NOT NULL FK constraint violation. **NO audit class is emitted** for these skips (by design — only `FAILED` validation produces audit class).

Affected mappings (4 distinct patterns, ~8104 staged rows):

| Target table | LOOKUP_FK match_on | lookup_to | n mappings | staged rows blocked |
|---|---|---|---|---|
| sys_skill_aliases | `skill_metadata->>legacy_id` | sys_skills | 1 | 130 |
| sys_skill_taxonomy_edges | `skill_metadata->>legacy_id` | sys_skills (parent + child) | 2 | 6306 |
| sys_skill_learning_mappings | `learning_module_metadata->>legacy_id` | sys_learning_modules | 1 | 1588 |
| sys_process_kpi_templates | `blueprint_process_metadata->>legacy_id` | sys_blueprint_process_registry | 1 | 81 |

### silent_skip_root_cause_class_B (MEDIUM confidence — needs second-pass)

5 of the 9 failed targets have ZERO LOOKUP_FK mappings yet remain empty:

| Target | mappings_total | lookup_fk_n | NOT NULL FK columns requiring resolution |
|---|---|---|---|
| sys_skill_categories | 45 | 0 | skill_category_family_id |
| sys_learning_path_steps | 20 | 0 | learning_path_step_path_id, learning_path_step_module_id |
| sys_blueprint_process_registry | 21 | 0 | blueprint_process_variant_id |
| sys_job_roles | 43 | 0 | job_role_family_id |
| sys_esco_occupation_mappings | 53 | 0 | esco_occupation_mapping_job_role_id |

These FK columns must be populated by some mapping (DIRECT_COPY of a legacy UUID?), but the legacy UUID does NOT match any sys.* row's `gen_random_uuid()`-generated PK. Same WHERE-skip-filter exclusion suspected. **Requires second-pass diagnostic with sample-row trace for each of these 5 targets.**

### Secondary finding: lineage-write inconsistency

3 targets have `upserted >> lineage` count mismatch:
- sys_skills: 5753 upserted, **160 lineage**
- sys_learning_modules: 4395 upserted, **0 lineage**
- sys_learning_paths: 3157 upserted, **65 lineage**

Lineage write is the JOIN-based final step after upsert; this suggests partial or missed lineage-write batches. NOT blocking C4 (upsert success per criterion) but blocks C8 traceability auditability.

---

## §2 — Acceptance verdict

| Criterion | Status | Note |
|---|---|---|
| C4 — every APPROVED mapping ≥1 successful upsert OR source-empty | **FAIL** | 9 targets staged>0 + upserted=0 |
| C5 — all 15 sys.* Wave 1 targets ≥1 row OR documented source-empty | **FAIL** | 6/15 populated; 9/15 still empty (no source-empty justification) |
| C6 — sys_activity_classifications 0 CHECK violations | **PASS** ✅ | 3276/3284 upserted (8 source-NULL); Item C migration 000032 effect verified |
| C7 — 0 SKIPPED_UNSUPPORTED_TRANSFORM_V1 | **PASS** ✅ | confirmed 0 audit rows of this class |
| C9 — 0 no_conflict_inference_available | **PASS** ✅ | confirmed 0 audit rows |
| (auxiliary) C8 trigger active | **PASS** ✅ | tested in EXEC §0 CHECKPOINT |

---

## §3 — Proposed fix paths

### P1 (RECOMMENDED) — Extend compiler form (b) → lineage-records JOIN

Rewrite the form (b) `<col>_metadata->>'legacy_id'` LOOKUP_FK case to instead JOIN through `sys.sys_source_lineage_records`:

```sql
(SELECT slr.source_lineage_record_target_id
   FROM sys.sys_source_lineage_records slr
  WHERE slr.source_lineage_source_record_id = (srcExpr)
    AND slr.source_lineage_target_table = '<target_table inferred from payload>'
  LIMIT 1)
```

The lineage-records table provides a deterministic mapping legacy_source_record_id → target sys row ID. This is the canonical "where was this legacy UUID imported to?" lookup.

**Caveats:**
- Need to verify the lineage table has a `source_lineage_record_target_id` column (likely exists per Goal 001a v5 design — confirm in fix turn).
- Need source_lineage_source_table filtering or source_lineage_target_table filtering to disambiguate (e.g., the same legacy uuid could be in multiple source tables).

**Scope:** extends Item A from FALLBACK-ONLY 2 pairs to form (b) pattern generalization. Cowork sign-off requested.
**Anti-pattern check:** NOT scope reduction (coverage GROWS); within EXEC turn budget; halt+escalate path preserved.
**Estimated turns:** 4-6 (code 2-3 + tests 1 + Wave 1 retry 2 + verify 1)
**Files touched:** `apps/api/src/modules/brownfield-wave-executor/transform-compiler.ts`, `apps/api/test/transform-compiler.test.ts`
**Retry required:** yes (Wave 1 fullscale re-run after fix)
**Addresses:** silent_skip_class_A only (4 of 9 failed targets at root cause level). Class B requires separate investigation.

### P2 — Backfill `legacy_id` into `*_metadata` jsonb at upsert time

Modify upsert-sql.ts to ALWAYS merge `jsonb_build_object('legacy_id', staging_source_record_id)` into the target *_metadata column during upsert. After this fix, form (b) LOOKUP_FK resolves naturally without compiler change.

**Path A (column_mappings UPDATE)**: would require modifying brownfield.column_mappings to add a new JSON_EXTRACT-equivalent for legacy_id → **VIOLATES A1 ABSOLUTE** (D6, no wave=1 row UPDATE).
**Path B (upsert-sql merge)**: extend upsert-sql to always merge `legacy_id` key into metadata jsonb during upsert. Within scope.

**Caveats:** side-effect of enriching ALL sys.* schemas with `legacy_id` key going forward; may have downstream impact on JSON_EXTRACT consumers. Requires DB-side migration to backfill existing 6 populated tables' metadata before form (b) starts resolving (otherwise still NULL during the retry).
**Estimated turns:** 5-7 (more complex due to merge logic + need to backfill existing rows + re-run).
**Files touched:** `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`, possibly a new migration 000034 for backfill.
**Addresses:** silent_skip_class_A only.

### P3 (REJECTED per directive) — Defer to Goal 004 + accept C4 partial

VIOLATES anti-pattern guard #2 (no partial closure) per PROMPT v2 §"Anti-pattern guard". Mentioned only to document the prohibited path.

---

## §4 — Recommendation + flow

**P1 RECOMMENDED.** Rationale:
1. Directly addresses 4 of 9 failed targets at root cause level via compiler extension (consistent with Item A's strategy).
2. No DB writes per A1 ABSOLUTE (compiler-side only).
3. Sets up cleaner Goal 004 narrative — the same form (b) → lineage JOIN pattern will work for Wave 2/3/4 mappings.
4. Cleaner than P2's side-effect of schema-wide metadata.legacy_id enrichment.

**Class B (5 no-LOOKUP_FK targets)** requires SECOND-PASS diagnostic AFTER P1 retry. Until those 5 targets are populated by P1's effect (if P1's broader fix reaches them) OR investigated further, C4/C5 remain unmet.

**Proposed flow:**
1. Cowork approves P1 (or amends scope).
2. CLI implements P1 (~4-6 turn): code change + tests + Wave 1 retry + verify.
3. CLI emits exec_progress with P1 retry results + class B status.
4. If class A resolved + class B still has failures → CLI requests Cowork directive on 2-turn diagnostic for class B.
5. If both resolved → CLI proceeds to Item L (REPORT + STATE finalize).
6. If still partial → halt+escalate.

---

## §5 — Budget tracking

| Phase | Estimate | Cumulative |
|---|---|---|
| EXEC consumed (K + C + D+M + A + B + F-first-run + F-diagnostic) | 17 | 17 |
| P1 fix + retry | 4-6 | 21-23 |
| Class B diagnostic (if needed) | 2 | 23-25 |
| Class B fix + retry (if needed) | 3-5 | 26-30 |
| Item L REPORT + STATE | 2 | 28-32 |
| **Projected closure** | — | **28-32 / 40** |
| Buffer at closure | — | **8-12 turns** |
| Escalation threshold | — | **35** |

Within budget envelope. No escalation predicted under P1+classB path.

---

## §6 — Bias catalog input (Goal 003 closure)

**CW-B16 candidate (post-Goal-003)**: even after Item A scope-lock + Cowork CHECKPOINT, EXEC surfaced 2 NEW silent-skip classes not enumerated in DISCOVERY 003. The DB-level `validate_lookup_fk_payload` trigger (Item M, CP2) correctly accepts form (b) payloads at registry-INSERT time, but the RUNTIME resolution returns NULL because the data semantic was incomplete — `accepted-at-validation ≠ resolves-at-runtime`. Goal 004 DISCOVERY should include END-TO-END row trace sample for EACH empty target (not just schema check + payload check), specifically: for each (target, LOOKUP_FK) pair, manually trace a staging row through the compiler-emitted SQL and validate it returns a non-NULL FK at runtime.

**CW-B17 candidate**: the WHERE skip filter (upsert-sql.ts:238-269) intentionally silent-skips rows that would violate NOT NULL FK constraints — but this design creates a forensic blind spot. Future improvement: emit a NEW audit class `LOOKUP_FK_NULL_RESOLUTION_V1` for each row silently skipped due to NULL FK, with payload {target_col, match_on, source_record_id}. This would make class A failures audit-visible at run time instead of requiring forensic comparison.

---

*End of _03_EXEC_003_DIAGNOSTIC_REPORT_Item_F.md*
