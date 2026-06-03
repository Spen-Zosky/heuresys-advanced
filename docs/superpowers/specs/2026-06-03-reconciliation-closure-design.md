# Data Reconciliation Closure — bring `sys.*` to a terminal, explicit state

> **Status**: design approved (brainstorming, S960, 2026-06-03). **Execution GATED** on Enzo's explicit greenlight per phase (B-50 / scope-discipline cardinal). No DB write happens without a `pg_dump -Fc` backup and an explicit go.
> **Supersedes** the open-ended framing of `DATA_RECONCILIATION_PLAN.md` (§0-§7) with a closed-loop plan that drives *every* empty `sys.*` table to one of four terminal states. The KPI-cluster facts and the §7 triage in that doc remain valid inputs.
> **Decision authority**: the user chose scope "option B" (resolve the structural walls, stop only at pure derived-analytics) and "explicit DB view" for the skip registry (brainstorming Q1/Q2, S960).

## §0 — Context (verified live, S960, 2026-06-03, tunnel `:5433`)

The advanced `sys` schema holds **138 base tables**; a real `count(*)` sweep gives **73 populated (52.9%)** and **65 empty (47.1%)**. This is up from the ~49% recorded pre-S958 — the KPI catalog unification (S958: `sys_kpi_definitions` 0→243, `sys_kpi_targets` 0→248) and `skill_categories` 0→6 closed the gap by ~4 points.

Three facts (measured, not assumed) shape this design:

1. **The "pending import" queue is nearly empty.** Of the 65 empty tables, exactly **one** carries a pending `IMPORT` card: `sys_process_kpi_templates` (wave 1, APPROVED — a known silent-skip, now unblocked by the KPI defs). The other 70 system-wide `IMPORT` cards all target **already-populated** tables (Wave-1 is done). There is no backlog of dozens of imports "in flight".
2. **58 of the 65 empty tables have NO mapping card at all** — neither imported nor excluded. They sit in a *limbo*: no one ever decided their fate. 6 are already `REFERENCE_ONLY` (de-facto excluded); 1 is the `IMPORT` above.
3. **The `EXCLUDE` classification already exists** in `brownfield.table_mappings.table_mapping_classification` CHECK (`IMPORT | TRANSFORM | REFERENCE_ONLY | EXCLUDE`) and is used by **zero** cards today. The wave-executor processes **only** `classification='IMPORT' AND approval_status='APPROVED'` (`engine.ts`); `REFERENCE_ONLY` and `EXCLUDE` are already skipped by the flow. **Constraint**: `table_mapping_source_table_id` is `NOT NULL` → an `EXCLUDE` card can only mark a table that *has* a legacy source we choose not to import. App-generated / no-source tables cannot carry a card and must be tracked elsewhere (→ §3).

## §1 — Goal & definition of "done"

**Done = zero `sys.*` tables in an ambiguous state.** Every empty table reaches exactly one *terminal, explicit* status:

| Terminal status | Meaning | Reached by |
|---|---|---|
| `POPULATED` | has rows | F2 import / F3 walls resolved / already populated |
| `REFERENCE_ONLY` | lookup/reference, populated application-level, empty-by-design | existing card (kept) |
| `EXCLUDE` | has a legacy source but deliberately not imported | F1 card |
| `NO_SOURCE` | app-generated / runtime / scaffold — no legacy analog, never a reconciliation target | F1 registry |
| `NEEDS_DECISION` | derived analytics — requires a human derivation rule before it can be populated | F4 dossier (the STOP boundary) |

The cycle **stops** at `NEEDS_DECISION`: those tables (pure derived analytics — bucket C) are handed to the user as a decision dossier, not auto-populated. Everything else is driven to a closed state in this cycle.

## §2 — The four buckets (proposed classification — **finalized in F0**)

The counts below are this design's best evidence-based proposal from table names + `DATA_RECONCILIATION_PLAN.md` + the S958 triage. **F0 verifies each against the live legacy source and the user signs off** before any write. Entries marked `?` are the explicit verification targets.

### Bucket A — Import now (source-backed, 1:1, no wall) — ~4-8
| Table | Legacy source (proposed) | Note |
|---|---|---|
| `sys_process_kpi_templates` | `process_kpis` (via existing card) | already-APPROVED IMPORT card; unblocked by `sys_kpi_definitions` (S958). Re-run resolves it. |
| `sys_career_paths` | `career_paths` | catalog; verify self-referential parent resolves |
| `sys_branches` ? | legacy org/branch structure ? | RTL Bank has branches; verify a legacy source exists |
| `sys_reward_gates` ? | blueprint reward-gate catalog (global) ? | CLAUDE.md notes "7 reward gates" in blueprint — verify catalog vs engine-output |
| `sys_objective_reward_rules` ? | reward-rule catalog ? | verify catalog vs runtime |
| `sys_user_professional_experiences` ? | legacy `employees` bio / experience ? | source-backed CV data candidate |
| `sys_kpi_metric_definitions` ? | KPI metric catalog ? | verify vs KPI cluster |

### Bucket B — Structural walls (source exists, needs modeling first) — ~10-12
| Table | Legacy source | Wall |
|---|---|---|
| `sys_position_kpi_requirements` | `job_kpis` | job→position bridge |
| `sys_position_skill_requirements` | `position_skill_requirements` (now REFERENCE_ONLY) | job→position bridge; revisit reclass |
| `sys_position_learning_requirements` | (REFERENCE_ONLY) | job→position bridge + learning catalog |
| `sys_position_career_paths` | career link | job→position bridge |
| `sys_career_path_steps` | `career_path_levels` | parent catalog + job→position bridge |
| `sys_organization_unit_kpi_templates` | `org_unit_kpis` | org-unit template↔instance |
| `sys_learning_path_steps` | `learning_path_courses` (REFERENCE_ONLY) | learning catalog re-import (event-sourced) |
| `sys_skill_learning_mappings` | (REFERENCE_ONLY) | learning catalog re-import |
| `sys_user_learning_assignments` | `*_enrollments` | learning catalog re-import |
| `sys_organization_hierarchies` ? | org structure | verify importable vs derived |

### Bucket C — STOP / derived analytics (needs derivation rules — user authority) — ~22-25
Succession/talent: `sys_succession_pools`, `sys_successor_candidates`, `sys_successor_readiness`, `sys_succession_scores`, `sys_talent_scores`, `sys_readiness_scores`, `sys_critical_positions`, `sys_critical_role_coverage_status`, `sys_position_succession_relevance`, `sys_employee_position_fit_scores`. Gap: `sys_gap_analysis_results`, `sys_gap_closure_plans`, `sys_gap_closure_actions`, `sys_learning_gaps`. Comp engine: `sys_bonus_pools`, `sys_payout_curves`, `sys_variable_pay_calculations`, `sys_compensation_recommendations`. KPI measurement: `sys_kpi_assessment_results`, `sys_kpi_measurements`, `sys_user_kpi_evidence`. Behavioral: `sys_behavioral_assessments`. SDBI/evidence (verify vs bucket D): `sys_enterprise_typing_profiles` ?, `sys_person_evidence_records` ?. Career-plan (verify vs D): `sys_user_career_plans` ?, `sys_user_target_positions` ?, `sys_position_economic_weight` ?, `sys_user_learning_evidence` ?.

### Bucket D — EXCLUDE / no-source (app-generated / runtime / scaffold) — ~22-25
Seed engine self-tracking: `sys_seed_acquisition_runs`, `sys_seed_approval_decisions`, `sys_seed_candidate_records`, `sys_seed_source_evidence`, `sys_seed_validation_results`. Visualization runtime: `sys_visualization_styles`, `sys_visualization_layouts`, `sys_visualization_node_layouts`, `sys_visualization_exports`. App-generated: `sys_auth_sessions`, `sys_inbox_notifications`, `sys_user_preferences` (created at runtime via P1 `/v1/me/preferences`), `sys_user_documents`, `sys_payroll_handoff_records`, `sys_reward_gate_results`, `sys_blueprint_activations`, `sys_blueprint_overrides` (REFERENCE_ONLY), `sys_activity_classification_mappings` (REFERENCE_ONLY, ADR-0025), `sys_organization_unit_history`, `sys_position_skill_requirement_history`.

> **F0's decisive job**: resolve every `?` (does a real legacy source exist?), splitting bucket C/D borderline tables and confirming bucket A candidates. A table with a legacy source we choose not to import → `EXCLUDE` card (bucket D, source-backed). A table with no legacy source → `NO_SOURCE` registry row.

## §3 — Reconciliation status registry (`sys.v_reconciliation_status`)

The user chose an explicit, queryable DB view (not doc-only). `NO_SOURCE` vs `NEEDS_DECISION` is **not inferable from data alone** (both are "empty + no card"), so the design pairs a small decision-backing table with a computed view.

**Backing table** `sys.sys_reconciliation_registry` (seeded by F0, one row per `sys.*` table that is not trivially `POPULATED`):
- `reconciliation_registry_id uuid pk`
- `reconciliation_registry_table_name varchar(255) UNIQUE NOT NULL`
- `reconciliation_registry_bucket char(1) CHECK in ('A','B','C','D')`
- `reconciliation_registry_declared_status varchar(20) CHECK in ('IMPORT','REFERENCE_ONLY','EXCLUDE','NO_SOURCE','NEEDS_DECISION')`
- `reconciliation_registry_legacy_source varchar(255)` (nullable — null ⇔ NO_SOURCE)
- `reconciliation_registry_wall varchar(40)` (nullable — which structural wall, bucket B)
- `reconciliation_registry_rationale text NOT NULL`
- `reconciliation_registry_decided_at timestamptz NOT NULL default now()`
- standard `created_at/updated_at`

Follows I3/I4 (`sys.sys_<plural>`), RD-08 (varchar+CHECK, no enum). Seeded idempotently (`INSERT … ON CONFLICT (table_name) DO UPDATE`). The registry holds a row for every non-`POPULATED` table (to carry `bucket`/`rationale`/`legacy_source`); for tables that **also** have a card, the view resolves status from the card (card > declared precedence) and the registry row is documentary — `declared_status` mirrors the card there. The authoritative skip signal is therefore: a card (`EXCLUDE`/`REFERENCE_ONLY`) for source-backed tables, the registry `declared_status` (`NO_SOURCE`/`NEEDS_DECISION`) for card-less ones.

**View** `sys.v_reconciliation_status` — live resolved status per `sys.*` base table:
```
for each base table in schema sys:
  live_rows      := count(*)               -- live
  card_class     := classification of its IMPORT/REFERENCE_ONLY/EXCLUDE card, if any
  declared       := registry.declared_status, if any
  resolved_status := POPULATED              if live_rows > 0
                  else card_class           if a card exists      (IMPORT/REFERENCE_ONLY/EXCLUDE)
                  else declared             if a registry row exists
                  else 'UNCLASSIFIED'       -- must be 0 when the cycle is "done"
```
Columns: `table_name, live_rows, card_classification, declared_status, resolved_status, bucket, legacy_source, wall, rationale`. The "done" assertion is a one-liner: `SELECT count(*) FROM sys.v_reconciliation_status WHERE resolved_status='UNCLASSIFIED'` must be 0 (modulo bucket C `NEEDS_DECISION`, which is a *valid* terminal state, not unclassified).

**Migration**: one new sequential file (`000058_reconciliation_registry.sql`) — idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE VIEW`), twice-run-clean. Registry rows are seeded by a separate idempotent seed (`db/seeds/reconciliation/04_registry.sql`) produced by F0, not baked into the migration (so the migration stays data-free and the classification can be re-run/corrected).

## §4 — The three structural walls (bucket B sub-milestones)

Each wall is its own design→approval→implement→import sub-cycle (own evidence, own gated run). Sequenced because later ones depend on the bridge:

1. **job→position bridge** — `sys_positions` has no legacy job key, so `job_kpis` / `position_skill_requirements` / career links can't resolve a position FK. Need a deterministic bridge from the legacy job/template id to `sys_positions` (candidate: via `position_metadata->>'legacy_employee_id'` → `employees.job_title`/job id, mirroring the B-51 derivation that already wired 162/162 titles). **Unblocks** the most tables → first.
2. **org-unit template↔instance** — `org_unit_kpis` keys a design-layer template; `sys` imported instance-layer `org_units` (no bridge). Need a template↔instance modeling decision. **Unblocks** `organization_unit_kpi_templates`.
3. **learning catalog re-import** — `sys_learning_paths/modules` were built from operational event rows (`OLDDB::<event>::<id>`), not the legacy `learning_paths`/`courses` catalog → canonical catalog FK resolves 0. Re-import the canonical learning catalog. **Unblocks** the learning cluster.

Each wall validates: source-vs-target row count + 5-row sample + a new integration test (these imports have **zero** test coverage today — that's the dominant risk, §8).

## §5 — Execution phases

| Phase | What | Write? | Gate |
|---|---|---|---|
| **F0 — Triage (read-only)** | Per the 65: query legacy VM (`ssh oracle-vm-default sudo -u postgres -d heuresys_platform`) + advanced; resolve every `?`; produce final A/B/C/D + `legacy_source` per table. Deliverable: the registry seed `04_registry.sql` + a validated table for user sign-off. | **No** (read-only) | user signs off the classification |
| **F1 — Terminal states (D)** | mig `000058` (registry + view); seed registry from F0; create `EXCLUDE` cards for source-backed-excluded tables; assert `v_reconciliation_status` UNCLASSIFIED=0 except bucket C. | Yes (DDL + registry/cards) | backup + go |
| **F2 — Import bucket A** | per-card, supervised: author card (if missing) → trigger Wave-1 idempotent upsert → validate → integration test → atomic commit. Start with `process_kpi_templates` (card exists). | Yes (data) | backup + go per card |
| **F3 — Walls (B)** | 3 sub-milestones in order (bridge → org-unit → learning), each its own design→ok→implement→import. | Yes (schema + data) | backup + go per wall |
| **F4 — Dossier (C)** | Compile the bucket-C derivation-decision dossier (per cluster: source tables, candidate derivation rule, open questions). Hand to user. **Cycle STOP.** | No | — |

Phases are sequential for safety, but F0 gates everything: nothing is written until the classification is signed off.

## §6 — Gated protocol (D-SAFE, non-negotiable)

- The local tunnel `:5433` and the VM `:5432` are the **same production PostgreSQL**. Every DDL/write is immediately live.
- `pg_dump -Fc heuresys_advanced` (on the VM, co-located) **before any write phase**, named `pre-<phase>_<date>`.
- Every import: idempotent (twice-run → 0 net mutations), `db:migrate ×2` clean, `db:validate` 7/7, source-vs-target count + 5-row sample, integration test green, then **atomic commit**.
- Execution on the VM under supervision (recommended) or local-tunnel; result is identical (same DB).
- **No `git push` without the user's explicit ok.** Local commits on `main` are pre-authorized (project rule).
- Each write phase needs the user's **explicit greenlight** — no autonomous bulk import (B-50 engagement rule).
- Conflict with an invariant (SOT_STATE §9, esp. I1 position-centric, I3/I4 schema, I14 employee-centric key `LEGACY_EMP::`) → **stop and ask**.

## §7 — Out of scope (this cycle)

- **Populating bucket C** (derived analytics) — handed off as F4 dossier; needs the user's semantic derivation rules.
- **Wave-2/3 watermark/delta design** (`brownfield.source_watermarks`) — every run stays full-restage idempotent.
- **SDBI Phase 2** (B-10) — unless F0 places `enterprise_typing_profiles`/`person_evidence_records` in a bucket that needs it.
- **SuccessFactors connector**, MFA multi-kind, mobile a11y, F7 showcase — unrelated v1.x backlog.

## §8 — Risks

| Risk | P×I | Mitigation |
|---|---|---|
| Bucket B imports have **zero integration-test coverage** today | High × High | each wall ships its integration test *first* (TDD); validate source-vs-target + sample before commit |
| Production DB write via shared tunnel | Med × High | mandatory `pg_dump -Fc` per write phase; idempotent upserts; per-phase greenlight |
| Mis-classification (C vs D, or A candidate has no real source) | Med × Med | F0 is read-only and user-signed-off before any write; `?` entries are explicit verification targets |
| job→position bridge modeling touches schema / invariants (I1) | Med × High | bridge is its own sub-milestone with its own design + approval; mirror the proven B-51 derivation; no FK change without ADR |
| `EXCLUDE`/registry hides a table that *should* have been imported | Low × Med | registry `rationale` mandatory + queryable view → auditable, reversible (flip a registry row + re-trigger) |

## §9 — Transition

On user approval of this spec → `writing-plans` to produce the F0 implementation plan (read-only triage) first; subsequent phases get their own plans as each gate opens.
