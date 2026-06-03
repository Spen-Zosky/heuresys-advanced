# DATA_RECONCILIATION_PLAN — legacy→advanced full reconciliation (CLI-owned, gated)

> **🔭 S960 UPDATE (2026-06-03) — superseded by the reconciliation-closure cycle.** This doc's open-ended framing is replaced by the closed-loop plan `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md` (every empty `sys.*` table driven to a terminal state). **F0 (read-only triage) DONE**: all 65 empty tables verified+classified A:5 / B:16 / C:23 / D:21 (report `qa_artifacts/F0_reconciliation_triage.md`, workflow-driven, employee-centric enforced). **F1 (registry) DONE**: migration `000058` + `sys.sys_reconciliation_registry` + view `sys.v_reconciliation_status` — query the live status with `SELECT resolved_status, count(*) FROM sys.v_reconciliation_status GROUP BY 1`. The per-target classification below (§1-§7) remains valid input; the authoritative live state is now the registry/view. **Next**: F2 (import the 5 bucket-A) → F3 (3 structural walls: job→position bridge, org-unit template↔instance, learning-catalog re-import) → F4 (bucket-C derivation dossier). Each phase gated.

> **Status**: authored 2026-06-02 (S958, autonomous backlog sweep). **Execution is GATED on Enzo's go for a supervised production run** (see §6). This document is the evidence-based, ready-to-run plan; the import itself is NOT executed autonomously (it requires a full Wave-1 production re-import on the VM, or loading legacy dumps locally — neither is a low-risk unattended write).
> **Supersedes the loose B-10 / B-50 entries** in `SOT_BACKLOG.md` with a measured, per-target classification. Backing diagnosis: live queries against advanced (`:5433`) + VM legacy (`heuresys_platform`), S958.

## §0 — Why this is gated (measured, not assumed)

The advanced `sys.*` schema is **~49% populated** (67 of 138 tables empty). Closing the gap is real, multi-session work. Three hard facts make the import a **supervised-run** operation, not an autonomous one:

1. **Local infra is not import-ready.** `legacy_mirror` = 0 tables (dropped mig 000047), all 18 `staging.wave1_*` tables empty, and the legacy source dumps (`db/seeds/brownfield/wave1/legacy_data/*.sql`) are gitignored / **absent locally**. The wave executor's `loadLegacyMirrorData` (loader.ts) ingests from on-disk dumps that don't exist on this workstation.
2. **The only import paths are high-impact or infra-heavy.** Either (a) a **full Wave-1 re-import on the VM** (`POST /v1/brownfield/wave-executor/runs {wave:1,mode:EXECUTE}`, PLATFORM_ADMIN) — touches all 71 Wave-1 IMPORT cards, idempotent upsert but production-wide; or (b) extract the needed legacy dumps from the VM into `legacy_data/` and run Wave-1 locally (the tunnel write still lands on the production DB).
3. **Shared production DB.** The local tunnel `:5433` and the VM `:5432` are the **same** PostgreSQL. Every DDL/write is immediately live in production → `pg_dump -Fc` before any write is mandatory (D-SAFE).

Decision authority: a production re-import that might need backup-restore is Enzo's call (DECISION AUTHORITY + scope-discipline cardinal). This plan makes that go a one-step action.

## §1 — Per-target classification (live-measured S958)

Of the 67 empty `sys.*` tables:

| Class | Count | Meaning | Autonomy verdict |
|---|---|---|---|
| **(i) source-backed + deterministic** | ~15-20 | clean 1:1 legacy source; needs only a Wave-2 mapping card (engine is wave-agnostic) | EXECUTABLE per-card under supervision |
| **(ii) source-backed + ambiguous** | ~20-25 | derived analytics (succession/talent/readiness/gap/variable-pay) — needs derivation rules, NOT 1:1 | NEEDS-DECISION (mapping-card semantic authoring; never guess) |
| **(iii) scaffold / no-source** | ~20-25 | `sys_seed_*`, `sys_visualization_*` runtime outputs, notifications, blueprint activations | FUTURE / app-generated, no legacy analog |

### Category (i) — ready-to-author deterministic targets

| Empty `sys.*` target | Legacy source | Rows | Notes |
|---|---|---|---|
| `sys_kpi_definitions` | `process_kpis` | 81 | **highest-value unblock** — see §2. Cascades to `sys_process_kpi_templates` (LOOKUP_FK `kpi_code`→`kpi_definition_code` already authored) + the whole KPI FK cluster. |
| `sys_kpi_targets` | `employee_kpi_targets` / `tenant_job_kpis` | 412 / 80 | needs `sys_kpi_definitions` first |
| `sys_organization_unit_kpi_templates` | `org_unit_kpis` | 100 | needs `sys_kpi_definitions` first |
| `sys_position_kpi_requirements` | `job_kpis` | 2000 | needs `sys_kpi_definitions` first (45 distinct kpi_code) |
| `sys_career_paths` / `sys_career_path_steps` | `career_paths` / `career_path_levels` | 32 / 75 | independent card |
| `sys_position_skill_requirements` | `position_skill_requirements` | 1632 | NB: ADR-0020 reclassified its Wave-1 card to REFERENCE_ONLY as "application-level" — revisit if it is in fact catalog data |
| `sys_learning_path_steps` | `learning_path_courses` | 124 | REFERENCE_ONLY by ADR-0020 — revisit |
| `sys_user_learning_assignments` | `learning_path_enrollments` / `course_enrollments` | 341 / 3052 | independent card |

### Category (ii) — needs-decision (do NOT auto-author)

`sys_succession_pools`/`sys_successor_candidates` (from `critical_roles` + recruiting), `sys_gap_analysis_results`/`sys_readiness_scores`/`sys_talent_scores` (from `model_predictions`/`performance_predictions` — derived analytics, 267 rows), `sys_bonus_pools`/`sys_payout_curves`/`sys_variable_pay_calculations` (comp engine, multi-table joins), `sys_behavioral_assessments` (`burnout_assessments`/`competency_review_ratings`). These require derivation/aggregation rules — the MAPPING-CARD rule forbids guessing; each needs a human semantic decision before authoring.

### Category (iii) — future / no legacy source

`sys_seed_*` (5, brownfield-engine self-tracking), `sys_visualization_{styles,layouts,exports,node_layouts}` (app-generated at runtime), `sys_inbox_notifications`, `sys_blueprint_overrides`/`sys_blueprint_activations`, `sys_reward_gate_results`, `sys_payroll_handoff_records`, `sys_user_documents`. No legacy analog or generated by app actions — not reconciliation targets.

## §2 — `sys_kpi_definitions` card design (the #1 unblock, ready)

Source `public.process_kpis` is **global** (no `tenant_id`), 81 rows, 81 distinct `kpi_code`. Target `sys.sys_kpi_definitions` (mig 000015). Deterministic 1:1:

| target column | source col | transform | payload / note |
|---|---|---|---|
| `kpi_definition_id` | `id` | `LINEAGE_SOURCE_NK` | legacy PK on lineage row (mirror process_kpi_templates card) |
| `kpi_definition_code` | `kpi_code` | `DIRECT` (TRIM) | natural key; UQ index is `(COALESCE(tenant_id,zero-uuid), code)` |
| `kpi_definition_name` | `kpi_name` | `DIRECT` | |
| `kpi_definition_description` | `description` | `DIRECT` | |
| `kpi_definition_unit` | `measurement_unit` | `DIRECT` | |
| `kpi_definition_polarity` | `target_direction` | **value-map** | `higher_better→HIGHER_IS_BETTER`, `lower_better→LOWER_IS_BETTER`, `target_range→TARGET_RANGE`. ⚠️ **only non-trivial step**: verify a VALUE_MAP/CASE transform kind exists in `transform-compiler.ts`; if not, import with the column DEFAULT (`HIGHER_IS_BETTER`) + a deterministic post-import `UPDATE` keyed on `target_direction`. CHECK domain on both sides is closed + aligned. |
| `kpi_definition_is_global` | — | `CONSTANT` | `{"value": true}` (source is global) |
| `kpi_definition_tenant_id` | — | (none → NULL) | global |
| `kpi_definition_metadata` | `benchmark_value`/`benchmark_min`/`benchmark_max`/`process_id`/`phase_id` | `JSON_EXTRACT` | embed under `$.legacy.*` (mirror process_kpi_templates) |

**Authoring pattern**: mirror `db/seeds/brownfield/wave1/{03_table_mappings,04_column_mappings}.sql` (WITH src AS lookup `source_table_id` by name+schema+export `db-export-2026-05-15`; `ON CONFLICT DO NOTHING`). Add `process_kpis` as the source if not present, target `sys_kpi_definitions`, IMPORT, wave 1.

**Why not authored+committed now**: an IMPORT card that can't be executed/validated in this session is "shipped-not-executed" (CW-B63) and would change wave-executor behavior untested. Authored at the supervised run, against the live source, with the polarity transform verified.

## §3 — Supervised run procedure (VM — recommended)

```bash
# 0. Backup (D-SAFE) — on the VM, co-located with the DB
ssh oracle-vm-default 'pg_dump -Fc heuresys_advanced > ~/pg_dump_snapshots/pre-kpi-reconcile_$(date +%Y%m%d).dump'

# 1. Author + apply the sys_kpi_definitions card (seed SQL mirroring 03/04) on the VM advanced DB
#    (process_kpis dump is already present in the VM legacy_data set)

# 2. Trigger Wave-1 (idempotent upsert; populates kpi_definitions + re-resolves process_kpi_templates)
#    PLATFORM_ADMIN login -> POST /v1/brownfield/wave-executor/runs {"wave":1,"mode":"EXECUTE"}

# 3. Validate
ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_advanced -c \
  "SELECT (SELECT count(*) FROM sys.sys_kpi_definitions) kpi_defs, \
          (SELECT count(*) FROM sys.sys_process_kpi_templates) kpi_tpls;"'
# expect kpi_defs ~81, kpi_tpls > 0 (was 0/0)
```

Then re-run the KPI-cluster cards (kpi_targets, org_unit_kpi_templates, position_kpi_requirements) which depend on kpi_definitions. Then category-(i) independent cards (career_paths, learning, etc.) one at a time, validate-after-each. Each card: backup → author → trigger → validate source-vs-target + sample 5 rows → integration test green → atomic commit.

## §4 — Local alternative (if VM run is undesirable)

Extract the needed dumps from the VM into the gitignored `legacy_data/`, then run Wave-1 through the tunnel:
```bash
ssh oracle-vm-default 'sudo -u postgres pg_dump -d heuresys_platform --table=public.process_kpis \
  --data-only --column-inserts' > db/seeds/brownfield/wave1/legacy_data/wave1_process_kpis.sql
# (repeat per source table needed; loader.ts ingests all present dumps)
# then: PLATFORM_ADMIN trigger wave 1 against the local API (writes land on the production DB via :5433)
```
⚠️ Verify `loader.ts` tolerates a partial dump set (only some sources present) — it should stage only what exists; confirm before relying on it.

## §5 — Carried-forward blockers (unchanged, → SOT_BACKLOG)

- `sys_activity_classification_mappings` — **RESOLVED** S958 by reclassify (mig 000056, ADR-0025 §5.4): empty-by-design, mis-authored card parked. Not a reconciliation target.
- `sys_kpi_definitions`/cluster — gated on §3 supervised run (this plan).
- Category (ii) derived-analytics targets — need human derivation-rule decisions.
- Wave-2/3 watermark/delta design (`brownfield.source_watermarks`) — not designed; every run is full re-stage.

## §7 — Triage S958 (measured): cat(i) is NOT mechanically importable beyond kpi_definitions

A read-only FK match-rate triage (S958, live queries on both DBs) **falsifies the initial "cat(i) ~15-20 deterministic" estimate**. Only `sys_kpi_definitions` was genuinely CLEAN. Every other restant target fails on a required FK — forcing them would create silent-skips / FK-violations (the activity_classification_mappings failure mode).

| Target ← source | Verdict | Decisive FK match-rate |
|---|---|---|
| `sys_kpi_definitions` ← `process_kpis` (81) | ✅ **DONE** (S958, `ae34588`) | 81/81 1:1, polarity value-map clean |
| `sys_organization_unit_kpi_templates` ← `org_unit_kpis` (100) | SOURCE-BLOCKED ×2 | kpi 0/100 + org_unit 0/91 |
| `sys_position_kpi_requirements` ← `job_kpis` (2000) | SOURCE-BLOCKED ×2 | kpi 0/45 + position 0/162 (no legacy job key on sys_positions) |
| `sys_kpi_targets` ← `employee_kpi_targets` (412) | SOURCE-BLOCKED (kpi) | kpi 0/17 (user FK fine: 138/138 RTL) |
| `sys_career_paths` ← `career_paths` (32) | SOURCE-BLOCKED | parent catalog empty (must import first) |
| `sys_career_path_steps` ← `career_path_levels` (75) | SOURCE-BLOCKED | parent empty + job→position bridge absent |
| `sys_learning_path_steps` ← `learning_path_courses` (124) | REFERENCE_ONLY confirmed | path 0/20, module 0/60 — correctly operational (ADR-0020), leave it |
| `sys_user_learning_assignments` ← `*_enrollments` | FK-COMPLEX | user 100% RTL but path/module FK 0/18 & 0/117 |

**Two structural walls (root causes):**
- **Wall 1 — KPI catalog is single-source.** `sys_kpi_definitions` = only `process_kpis` (codes `BP-NNN-KPI-NN`). The 3 KPI-cluster sources use **disjoint** legacy namespaces (`KPI-NNNN` / `OPER-DIR-A` / `AML-ALERTS`); code overlap = 0, name overlap ≈ 0. → targets 1-3 need the missing KPI catalogs **ingested into `sys_kpi_definitions` first** (a catalog-unification decision: which sources are canonical, how to derive defs from instance-level rows like org_unit_kpis/employee_kpi_targets — NOT a 1:1 import).
- **Wall 2 — learning catalog is event-sourced.** `sys_learning_paths/modules` were built from operational event rows (`OLDDB::<event>::<id>`), not the legacy `learning_paths`/`courses` catalog. → targets 6-7 reference the canonical catalog id which resolves 0. Re-importing the canonical learning catalog is its own milestone.
- **Healthy axis**: the employee/user FK resolves 100% for the RTL subset (the unresolved fraction is exactly the collapsed-out SmartFood/EcoNova tenants — a clean, documentable boundary).

**Conclusion**: beyond `kpi_definitions`, cat(i) reconciliation is **NEEDS-DECISION**, not mechanical import. Proceeding requires modeling decisions (KPI catalog unification, canonical learning-catalog re-import, a job→position bridge) — each a scoped milestone with Enzo's semantic authority, NOT an autonomous 1:1 import (mapping-card rule / no-fabrication). The original cat(ii) "needs-decision" set is therefore larger than first measured; cat(i) "deterministic" was over-optimistic.

### §7.1 — Execution update S958 (opt. A: KPI catalog unification — DONE)

Enzo greenlit opt. A (unify the KPI catalog). Executed + validated (supervised VM run, backup `pre-kpi-unification`):
- **`sys_kpi_definitions` 0→243** — the 4 legacy KPI levels unified (process 81 + job 45 + org_unit 100 + employee 17), each 1:1 from its definitional columns, all GLOBAL, polarity in-domain. Seeds `02_kpi_catalog_unification.sql`, idempotent.
- **`sys_kpi_targets` 0→248** — employee-level targets, kpi-FK resolved (17 codes now present), user-FK via `LEGACY_EMP::` (138 RTL users / 9 KPIs used), tenant from the resolved sys_user. 164 source rows skipped = collapsed-out tenants (clean boundary). Seed `03_kpi_targets.sql`, idempotent.
- **Verified**: integration tests 12/12, `db:validate` 7/7 structural PASS (incl. `v_tenant_boundary_violations`), both seeds idempotent (2nd run INSERT 0).

**Still blocked after unification** (the kpi-FK now resolves, but the SECOND FK doesn't):
- `sys_organization_unit_kpi_templates` — org_unit FK: legacy `org_unit_kpis` keys a design-layer template, sys imported the instance-layer org_units (no bridge). → needs an org-unit template↔instance decision.
- `sys_position_kpi_requirements` — position FK: `job_kpis.job_template_id` has no key on `sys_positions` (job→position bridge absent). → needs the job→position bridge milestone.
These two remain NEEDS-DECISION (second-FK blockers), independent of the KPI catalog.

## §6 — Decision points for Enzo

1. **Run the KPI-cluster reconciliation now?** (§3, VM, ~30-60 min, idempotent, backup-guarded). Single highest-value unblock; LOW data-integrity risk (test coverage exists), but it is a production write batch → your go.
2. **Category (i) independent cards** (career paths, learning, skill reqs) — author + import per-card under the same supervised pattern? (each ~15-30 min).
3. **Category (ii)** — schedule a design session per cluster (succession/talent, comp engine) — these are real modeling decisions, not imports.
