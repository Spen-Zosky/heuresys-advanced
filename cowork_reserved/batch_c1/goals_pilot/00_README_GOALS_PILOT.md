# SDBI Pilot — Goals/OKRs (Batch C1.8)

**Status**: AUTHORED — awaiting Enzo approval before Phase 3 execution by CLI
**Authored**: 2026-05-20
**Author**: Cowork Claude (architect / SDBI supervisor)
**ADR reference**: ADR-0014 §2 + §3 (SDBI architecture)
**Source DB**: `heuresys_platform` (OCI VM 80.225.82.207, postgres 16.14)
**Target DB**: `heuresys_advanced` (same host, separate DB)
**Scope**: 10 source tables Goals/OKRs → 10 new `sys.*` tables + 1 staging schema `temp_sdbi.*`
**Volume**: ~5.94k rows source (1067 + 1811 + 1000 + 1000 + 856 + 100 + 40 + 20 + 20 + 15 + 10)

---

## §1 — Why this pilot exists

ADR-0014 §5 acceptance criterion 1: "Phase 2 pilot Goals/OKRs LIVE in sys.* (~5.8k rows) via SDBI workflow". This deliverable batch authors all Phase 1+2+3-prep artefacts so CLI can execute Phase 3 (migration apply + temp_sdbi seed) + Phase 5 (consolidation) mechanically once Enzo approves.

Goals/OKRs is the canonical TRUE GAP (`02a_ADV_SYS.md` §6.3): rich source data in `heuresys_platform.public` (10 tables, 5.94k rows), **zero sys.\* target schema exists**. SDBI proposes the target schema; brownfield deterministic path cannot.

## §2 — Deliverables index

| # | File | Phase | Purpose |
|---|---|---|---|
| 0 | `00_README_GOALS_PILOT.md` | (this file) | Index + workflow narrative + human checkpoint items |
| 1 | `01_SOURCE_DISCOVERY.md` | Phase 1 | Schema + sample + NULL + FK + semantic analysis per 10 source tables |
| 2 | `02_TARGET_SCHEMA_PROPOSAL.md` | Phase 2 | Proposed `sys.*` schema design — 10 new tables + RLS + indexes + FK |
| 3 | `migrations/000034_temp_sdbi_schema.sql` | Phase 3 prep | `CREATE SCHEMA temp_sdbi` idempotent |
| 4 | `migrations/000035_sys_goals_okrs_scaffold.sql` | Phase 3 prep | 10 sys.* tables idempotent CREATE TABLE + indexes + FKs |
| 5 | `mapping_cards/goals_sys_goals.md` | Phase 2 | Field-by-field mapping card (HIGH/MEDIUM/LOW per field) |
| 5 | `mapping_cards/goal_milestones_sys_goal_milestones.md` | Phase 2 | " |
| 5 | `mapping_cards/goal_check_ins_sys_goal_check_ins.md` | Phase 2 | " |
| 5 | `mapping_cards/goal_updates_sys_goal_updates.md` | Phase 2 | " |
| 5 | `mapping_cards/goal_comments_sys_goal_comments.md` | Phase 2 | " |
| 5 | `mapping_cards/goal_alignments_sys_goal_alignments.md` | Phase 2 | " |
| 5 | `mapping_cards/goal_templates_sys_goal_templates.md` | Phase 2 | " |
| 5 | `mapping_cards/okrs_sys_okrs.md` | Phase 2 | " |
| 5 | `mapping_cards/key_results_sys_okr_key_results.md` | Phase 2 | " |
| 5 | `mapping_cards/okr_check_ins_AND_okr_checkins_sys_okr_check_ins.md` | Phase 2 | Two-source-table → one-target merge card |
| 6 | `04_PHASE3_TEMP_SDBI_DDL.md` | Phase 3 | `temp_sdbi.<table>` mirror DDLs (no-FK) |
| 7 | `05_PHASE5_CONSOLIDATION_PLAN.md` | Phase 5 | INSERT...SELECT plans + lineage gen + audit emission |

## §3 — Workflow narrative (per ADR-0014 §3.1 six-phase)

```
[PHASE 1 — SOURCE DISCOVERY] ✅ DONE (Cowork)
   • Schema introspection via \d public.<table> for all 10 sources
   • NULL/cardinality/FK integrity counts via SQL on live DB
   • Sample rows extracted (3-5 per table) for semantic validation
   • Output: 01_SOURCE_DISCOVERY.md

[PHASE 2 — TARGET ANALOGY + SCHEMA PROPOSAL] ✅ DONE (Cowork)
   • 10 sys.* new tables proposed following sys.* conventions
     (sys_<entity> name, sys_<entity>_<field> cols, _tenant_id FK, audit fields,
      _natural_key UQ, _metadata jsonb)
   • Field-by-field mapping cards (10) with confidence HIGH/MEDIUM/LOW
   • HUMAN CHECKPOINT [Enzo]: review schema design before Phase 3 apply
   • Output: 02_TARGET_SCHEMA_PROPOSAL.md + 10 mapping_cards/

[PHASE 3 — MIGRATION APPLY + TEMP_ SEEDING] ⏳ PREP-COMPLETE — awaits CLI exec
   • Apply 000034 (temp_sdbi schema)
   • Apply 000035 (sys.sys_goals + 9 satellite tables)
   • Create temp_sdbi.<table> mirrors (no-FK, TRUNCATE-able)
   • INSERT...SELECT da heuresys_platform.public via dblink or pg_dump|psql pipeline
   • Output: temp_sdbi.* populated with row counts ≈ source

[PHASE 4 — RELATIONSHIP TRAVERSAL] ⏳ SCOPE-LIMITED for pilot
   • All FK from Goals/OKRs tables already resolved:
     - tenant_id → sys.sys_tenancies via brownfield.tenant_id_mappings (existing infra)
     - employee_id/owner_id/author_id/etc. → sys.sys_users via email lookup
     - goal_id/okr_id/key_result_id/parent_*_id → self-FK or sibling-FK in same import wave
   • Templates FKs (role_id → ?, org_unit_id → sys.sys_organization_units) — handled
   • No new traversal-driven discoveries expected (closed sub-graph)

[PHASE 5 — CONSOLIDATION] ⏳ PLAN-PREPPED — awaits CLI exec post Phase 3
   • Diff temp_sdbi vs sys.* (empty initially)
   • INSERT ... ON CONFLICT (natural_key) DO UPDATE SET (for arricchimento)
   • Generate sys.sys_source_lineage_records per row
   • Audit rule_codes: SDBI_CONFIDENCE_HIGH_AUTO_APPROVED, SDBI_HUMAN_APPROVED,
     SDBI_CONSOLIDATION_COMPLETE_V1
   • Output: 05_PHASE5_CONSOLIDATION_PLAN.md plus runtime INSERT...SELECT execution

[PHASE 6 — CLEANUP] ⏳ POST-CONSOLIDATION
   • DROP TABLE temp_sdbi.* (10 tables)
   • Audit row: SDBI_TEMP_CLEANUP_V1
```

## §4 — Human checkpoint items (BEFORE Phase 3 exec)

Enzo must review and approve:

| # | Item | Where to look | Decision needed |
|---|---|---|---|
| HC-1 | Schema naming consistency | `02_TARGET_SCHEMA_PROPOSAL.md` §1-§10 | Approve sys.sys_<entity> + col prefixes? |
| HC-2 | `sys_okrs` vs `sys_goals` duality | `02_TARGET_SCHEMA_PROPOSAL.md` §8 | Keep separate (decision) vs merge into `sys_goals` with `goal_framework` discriminator |
| HC-3 | `okr_check_ins` (15) + `okr_checkins` (10) merge | `02_TARGET_SCHEMA_PROPOSAL.md` §10 + mapping card | Approve merge into single `sys_okr_check_ins` with `check_in_scope ∈ {KEY_RESULT, OKR_AGGREGATE}` |
| HC-4 | `goal_templates.role_id` resolution | `02_TARGET_SCHEMA_PROPOSAL.md` §7 + mapping card | role_id 100% NULL in source — skip column entirely OR add `template_role_id uuid` nullable FK to `sys.sys_job_roles`? |
| HC-5 | Drop `embedding` + `smart_criteria` columns | `01_SOURCE_DISCOVERY.md` §goals + mapping card | Both 100% NULL in source — confirm SKIP (no AI/ML data to import) |
| HC-6 | I1 invariant: employee_id resolution semantic | `02_TARGET_SCHEMA_PROPOSAL.md` §1 + I1 commentary | Goals link to user OR position? Source uses `employee_id → employees_core`. Proposal: target `sys_goal_subject_user_id` (FK sys_users) — confirm |
| HC-7 | Confidence-LOW fields (manual SCAN) | mapping cards search "LOW" or "MEDIUM" | Approve/correct/reject each flagged field |
| HC-8 | Migration numbering 000034/000035 | head of each .sql file | No conflict with HANDOFF.md committed migration sequence |

## §5 — Confidence overall self-assessment

| Dimension | Confidence | Reasoning |
|---|---|---|
| Source semantic understanding | **HIGH** (0.92) | 10 schema dumps + 30 sample rows + cardinality + FK integrity all verified live |
| Target schema design | **HIGH** (0.88) | Follows established `sys.*` conventions (sys_skills, sys_positions, sys_learning_modules pattern). Only novelty: Goals/OKRs duality decision |
| Field-by-field mapping | **HIGH** (0.85) avg | 7/10 source-target pairs are direct-copy with type compatible. 3 require small transforms (CHECK relax, scope discriminator, derive fiscal_year) |
| FK resolution path | **HIGH** (0.90) | Reuses existing brownfield.tenant_id_mappings + sys_users by email lookup (already-proven Goal 003 pattern) |
| Edge cases coverage | **MEDIUM** (0.70) | Templates 100% NULL on 4 columns → ambiguous. parent_goal_id/parent_okr_id self-FK ordering during INSERT requires deferred constraints or two-pass |
| Lineage instrumentation | **HIGH** (0.85) | Builds on `sys_source_lineage_records` extension defined in ADR-0014 §3.4 |
| Audit instrumentation | **HIGH** (0.85) | New rule_codes already defined in ADR-0014 §3.5 |
| **Overall pilot readiness** | **HIGH** (0.83) | Ready for CLI execution post-Enzo approval. Honest residual uncertainty on HC-2/HC-3/HC-4/HC-6 (4 design decisions that require Enzo input) |

## §6 — Known challenges identified

1. **Self-referential FK ordering** (goals.parent_goal_id, okrs.parent_okr_id, goal_comments.parent_comment_id): standard pg pattern uses deferred FK or two-pass INSERT. Resolved in Phase 5 plan via `INSERT all + ALTER TABLE ADD FK` ordering.

2. **`fiscal_year`/`fiscal_quarter` 100% NULL in source OKRs**: derive from `period_start` in target rather than carry NULL → MEDIUM confidence transform (added explicit transform code `DERIVE_FISCAL_FROM_PERIOD`).

3. **`embedding` column is `vector(1536)`** in source but 0 rows populated → target schema OMITS the column entirely (pgvector extension dependency avoided in `sys.*` for now). Re-add when AI embedding rebuild becomes priority.

4. **Two source tables to one target**: `okr_check_ins` (per-KR) + `okr_checkins` (per-OKR aggregate with jsonb). Decision proposed: merge with discriminator. Risk: Phase 5 INSERT logic non-trivial. Mitigation: per-source-table mapping card validates separately + Phase 5 plan handles both with UNION ALL.

5. **`alignment_type` source only uses `supports`** (1/4 CHECK values): preserve CHECK constraint accepting all 4 (forward-compat) in target.

6. **`goal_templates` 4 columns 100% NULL** (role_id, org_unit_id, created_by, deleted_at): include in target schema (nullable) — they're real columns just unused-yet. role_id→FK `sys_job_roles` (deferred until target has rows, late-bind pattern). HC-4 awaits Enzo decision.

7. **Heuresys System tenant has only 3 employees** and only 9 goals — small data slice, may not stress-test all transforms equally across tenants.

## §7 — Ready-for-CLI status

**APPROVED FOR CLI EXECUTION**: NO (pending HC-1..HC-8 Enzo decisions)

**Once approved**, CLI can sequentially:
1. Apply `000034_temp_sdbi_schema.sql` + `000035_sys_goals_okrs_scaffold.sql` via `pnpm db:migrate`
2. Run Phase 3 seed (psql-to-psql INSERT...SELECT cross-DB or extract+load through legacy_mirror)
3. Run Phase 5 consolidation per `05_PHASE5_CONSOLIDATION_PLAN.md`
4. Run Phase 6 cleanup (DROP temp_sdbi.*)
5. Insert `sys.sys_source_lineage_records` + `audit.import_validation_results` rows per ADR-0014 §3.4-§3.5
6. Update `HANDOFF.md` with pilot outcome

**Estimated CLI execution time**: ~45-60 min (migrations 5 min + Phase 3 seed 15 min + Phase 5 consolidation 15 min + Phase 6 cleanup 5 min + audit/lineage row gen 10 min + verification 10 min). Budget more for unexpected ON CONFLICT collisions on first run.

## §8 — Bias mitigations applied (per ADR-0014 §3.8)

| Bias | This pilot's mitigation |
|---|---|
| CW-B16 wall-clock | Mapping cards include empirical row count from live SQL, not estimates |
| CW-B17 silent skip | Phase 5 plan INSERT logic emits audit row per row processed (PASSED or SKIPPED with reason) |
| CW-B18 DISCOVERY completeness | All NOT NULL source cols have mapping. All 209 NOT NULL constraints across 10 source tables enumerated (see §6 of source discovery) |
| CW-B19 source-side FK availability | FK resolution sampled live: 0 dangling employee_id, 0 dangling owner_id, 0 cross-tenant alignments (`SELECT COUNT(*) FROM goals LEFT JOIN employees_core WHERE...` =0) |
| CW-B20 UQ constraint block | Each new sys.* table has explicit `<entity>_natural_key` UQ defined in 000035 — wave-executor would not silent-skip |
| CW-B21 freshness | Source snapshot 2026-05-20T02:10Z confirmed (`01_DB_PLATFORM_INVENTORY.md` §8). No source writes detected between then and 2026-05-20T16:30Z author session |

---

*End of 00_README_GOALS_PILOT.md*
