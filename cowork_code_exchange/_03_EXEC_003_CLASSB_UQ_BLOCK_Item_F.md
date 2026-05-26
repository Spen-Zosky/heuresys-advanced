# EXEC CLASS B UQ COLLISION — INSERT #1 also INFEASIBLE; sys_skill_categories joins INFEASIBLE list

**event:** exec_classB_uq_block
**goal_id:** 003
**phase:** EXEC
**item:** F
**budget_consumed:** 0.5 turn
**halt_state:** AWAITING_COWORK_DECISION
**created_at:** 2026-05-20T01:30+02:00

---

## §1 — Findings

Per Cowork E1 directive, attempted INSERT for sys_skill_categories.skill_category_family_id. Encountered TWO BLOCKERS:

### Blocker 1 — Trigger reject on UNQUOTED match_on

The validate_lookup_fk_payload regex from migration 000033 requires QUOTED form `<col>_metadata->>'legacy_id'`. The real-data convention in existing wave=1 mappings is UNQUOTED (`metadata->>legacy_id`). Trigger rejected initial INSERT.

**Mitigation**: switched to QUOTED form. Compiler accepts both (auto-quotes during emission per Goal 002 R2 amendment); runtime SQL identical. **Resolvable by using QUOTED form in new INSERTs**. NOT a hard blocker.

### Blocker 2 — UQ collision (HARD BLOCKER)

```sql
ERROR: duplicate key value violates unique constraint "brownfield_column_mappings_pair_uq"
DETAIL: Key (column_mapping_table_mapping_id, column_mapping_source_column_id)=
  (79b8eda7-0815-42af-8687-265eb424545b, c880c60c-d0f1-4d77-b737-9e9a1cc1641e) already exists.
```

The UQ index `(column_mapping_table_mapping_id, column_mapping_source_column_id)` enforces that each `(table_mapping_batch, source_column)` pair has at most 1 column_mapping. The existing JSON_EXTRACT mapping for `competencies.framework_id → skill_category_metadata` (column_mapping_id 428b3aa9-...) occupies the slot.

**Cannot add LOOKUP_FK mapping for `competencies.framework_id → skill_category_family_id` without UPDATE/DELETE the existing row (A1 ABSOLUTE forbids)**.

---

## §2 — Alternative source verification (skill_classifications.skill_cluster_id)

Sub-investigated whether `skill_classifications` source table could provide an alternative source column:

| Candidate | Lineage matches → sys_skill_families | Coverage (rows with key / total) |
|---|---|---|
| competencies.framework_id | 4 / 4 distinct | 32 / 7256 (0.4%) |
| **skill_classifications.skill_cluster_id** | **48 / 48 distinct** | **7215 / 7256 (99.4%)** ← much better |
| ontology_categories.parent_id | 0 (semantic mismatch) | 9 rows only |

`skill_classifications.skill_cluster_id` would deliver **huge coverage** (7215 rows resolving cleanly via lineage to sys_skill_families).

**HOWEVER**: same UQ blocker. The pair `(table_mapping=111607a9-skill_classifications→sys_skill_categories, source_column=skill_cluster_id)` is ALREADY occupied by a JSON_EXTRACT mapping (column_mapping_id 7e203beb-... → skill_category_metadata).

---

## §3 — Systemic finding: UQ + JSON_EXTRACT registry design forbids additive LOOKUP_FK

The registry design pre-maps **every source UUID column** to JSON_EXTRACT (storing the value inside `*_metadata` jsonb). This occupies the UQ slot for ALL useful UUID source columns.

To add a LOOKUP_FK mapping for a column that's already in JSON_EXTRACT:
- **UPDATE the existing mapping** to change transform from JSON_EXTRACT → LOOKUP_FK (VIOLATES A1 ABSOLUTE / D6 lock).
- **DELETE the existing mapping + INSERT new** (same violation).
- **INSERT a new mapping with a different source_column_id** (requires INSERTing into brownfield.source_columns — a synthetic alias entry — OUT of current Cowork authorization).
- **Relax the UQ constraint via migration** (architectural change; out of scope).

**Conclusion**: the Cowork-authorized "additive INSERT" path is **architecturally incompatible** with the existing registry design when the source column is already JSON_EXTRACT-mapped.

This is a **CW-B20 candidate** — registry design constraint surfaced only at apply-time, deeper than CW-B16/B18/B19.

---

## §4 — Cascading: all 5 Class-B targets affected

The same UQ pattern likely applies to the other 5 Class-B targets I had previously labeled feasible-pre-UQ-check. Probable verdict (would need per-target verification, but pattern is clear):

| Target | Required FK column | Likely UQ-blocked? |
|---|---|---|
| sys_skill_categories | skill_category_family_id | YES (verified blocker 2) |
| sys_learning_path_steps | path_id + module_id | YES likely (course_id/learning_path_id are UUIDs → JSON_EXTRACT-pre-mapped) |
| sys_blueprint_process_registry | variant_id | source col missing (already INFEASIBLE) |
| sys_job_roles | family_id | cascade target empty (already INFEASIBLE) |
| sys_esco_occupation_mappings | job_role_id | cascade target empty (already INFEASIBLE) |

Even if E1 had no semantic verify halt for #3 + Class C surfacing, the UQ pattern would have blocked ALL of the originally-proposed 3 INSERTs (#1, #2, #3).

---

## §5 — Reclassification post-finding

| Target | Goal 003 final verdict |
|---|---|
| sys_skill_categories | **INFEASIBLE Goal 004** (UQ collision; alt source skill_cluster_id same UQ pattern) |
| sys_learning_path_steps | INFEASIBLE Goal 004 (semantic course→module fail + likely UQ) |
| sys_blueprint_process_registry | INFEASIBLE Goal 004 (registry design + cascade empty) |
| sys_job_roles | INFEASIBLE Goal 004 (cascade target sys_job_families NOT IN ANY WAVE) |
| sys_esco_occupation_mappings | INFEASIBLE Goal 004 (cascade dep on sys_job_roles) |

**5 INFEASIBLE** of 15. Coverage feasible post-Wave-1-retry (P1 only):
- 6 baseline populated targets
- + sys_activity_classifications (Item C)
- + 4 Class-A P1-fixed via P1 commit 127e1a7 (sys_skill_aliases, sys_skill_taxonomy_edges, sys_skill_learning_mappings, sys_process_kpi_templates)
- = **10 populated** + 5 INFEASIBLE documented = 15 total

**C5 narrowed proposal**: ≥10/15 (was ≥11 in E1 micro-amendment; further narrows to ≥10).

---

## §6 — Action paths

### Option Z1 — Accept 5 INFEASIBLE + Wave 1 retry P1-only + REPORT closure (RECOMMENDED)

NO seed INSERTs needed (all are UQ-blocked). Wave 1 retry exercises only P1 compiler fix. Coverage 10/15.

**Pro**: lowest cycle, honest, documents systemic UQ design finding (CW-B20).
**Con**: C5 further narrows to ≥10/15.
**Estimated turns**: +2-3 (retry + verify + REPORT/STATE atomic).
**Anti-pattern check**: NOT scope reduction (these targets ARE infeasible due to registry design constraint). Documenting honestly.

### Option Z2 — Migration to relax UQ constraint, then INSERT 6 mappings

Migration 000035 drops `brownfield_column_mappings_pair_uq` (or replaces with composite including target_column). Then INSERTs become possible.

**Pro**: closes C4/C5 at full coverage (15/15).
**Con**: architectural change to brownfield registry semantics; new migration; significant scope expansion; potentially breaks downstream consumers relying on (table_mapping, source_column) uniqueness.
**Estimated turns**: +6-8 (migration + apply + INSERTs + retry + verify + REPORT).

### Option Z3 — Brownfield.source_columns INSERT (synthetic aliases)

Create synthetic source_columns entries that alias framework_id/etc. with NEW source_column_ids. Then INSERT column_mappings with these new IDs (no UQ collision).

**Pro**: closes coverage gap.
**Con**: registry pollution (synthetic source_columns rows); changes data model semantic of source_columns.
**Estimated turns**: +5-7.

### Option Z4 — Accept partial closure (REJECTED by guard #2)

NOT viable per anti-pattern guard.

---

## §7 — Recommendation

**Option Z1 (RECOMMENDED)**. The systemic UQ + JSON_EXTRACT design constraint is a discovery, NOT executor's decision to reduce scope. The 5 INFEASIBLE targets cannot be populated without architectural change (Z2) or registry pollution (Z3). Both options expand scope significantly; both are appropriately deferred to Goal 004 with explicit DISCOVERY of registry redesign needs.

Z1 closure narrative for REPORT 003:
- §wave1-scope-correction documents 4 scope amendments: v1→v2 (Wave 2/3/4), v2→v3 (Class B 3 targets), E1 (1 target), Z1 (1 more target).
- §bias-catalog adds **CW-B20**: "registry UQ + JSON_EXTRACT pre-mapping forbids additive LOOKUP_FK" — surfaced only at apply-time in Goal 003 Item F. Goal 004 DISCOVERY mitigation: enumerate (table_mapping, source_column) UQ slots per target before proposing any new LOOKUP_FK mapping.

---

## §8 — Halt request

**halt_state: AWAITING_COWORK_DECISION**

Choose:

- **(Z1') Option Z1** — accept 5 INFEASIBLE, ship P1 retry only, narrow C5 to ≥10/15. RECOMMENDED.
- **(Z2') Option Z2** — UQ-relax migration + 6 INSERTs (significant scope expansion).
- **(Z3') Option Z3** — synthetic source_columns aliases (registry pollution).
- **(Z4') Option Z4** — partial closure (VIOLATES guard #2, NOT viable).

CLI standing by.

---

## §9 — Budget

| Phase | turns |
|---|---|
| Consumed pre-UQ-block | 21.5 |
| UQ-block discovery (this turn) | 0.5 |
| Cumulative | **22** |
| Z1 (recommended): Wave 1 retry + verify + REPORT/STATE | +4-5 → 26-27 |
| Z2: migration + INSERTs + retry + verify + REPORT/STATE | +6-8 → 28-30 |
| Z3: source_columns + INSERTs + retry + verify + REPORT/STATE | +5-7 → 27-29 |
| Projected closure under Z1 | **26-27 / 40** |
| Buffer at closure | 13-14 turn |
| Escalation threshold 35: not crossed under any option |

---

*End of _03_EXEC_003_CLASSB_UQ_BLOCK_Item_F.md*
