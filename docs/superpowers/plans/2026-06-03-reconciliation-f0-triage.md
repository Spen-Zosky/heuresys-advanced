# Reconciliation F0 — Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: this plan is executed as a **Workflow** fan-out (ultracode). Steps use checkbox (`- [ ]`) syntax for tracking. F0 is **READ-ONLY** — it issues zero writes to any database. Its only artifact is a triage report committed to the repo.

**Goal:** Produce the authoritative, evidence-verified classification of all 65 empty `sys.*` tables into buckets A/B/C/D (+ legacy source, +structural wall, +rationale), as a report for the user's sign-off — the gate that must pass before any DB write (F1+).

**Architecture:** A parallel sweep: one subagent per semantic domain classifies its cluster of empty tables by cross-querying the advanced DB (`:5433`), the legacy source (`heuresys_platform` on the VM, 692 public tables), and the brownfield registry. A synthesis pass merges results, resolves C/D borderlines, verifies every A/B candidate has a real source with rows and a resolvable FK closure, and emits one report. Read-only throughout.

**Tech Stack:** PostgreSQL 16 (advanced `:5433` + legacy VM `heuresys_platform` via `ssh oracle-vm-default sudo -u postgres`), `psql`, Workflow fan-out subagents with structured (JSON-schema) output.

---

## Spec reference

Implements **F0** of `docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md`. The four buckets, terminal states, and the gated protocol are defined there. This plan only produces the *classification*; F1 (migration + registry + EXCLUDE cards) is a separate plan authored after sign-off.

## Verified preconditions (S960, 2026-06-03)

- Advanced `:5433` up; **65 empty** `sys.*` base tables (enumerated, list below).
- Legacy reachable: `ssh -o BatchMode=yes oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -tAc "…"'` → `legacy-ok|692`.
- `brownfield.source_tables` = 94 registered (all schema `public`); the other ~598 legacy tables are candidate sources not yet registered.
- Wave-executor processes only `classification='IMPORT' AND approval_status='APPROVED'`; `EXCLUDE`/`REFERENCE_ONLY` are skipped; `source_table_id` is `NOT NULL` (no card for no-source tables).

## Artifacts produced

- Create: `qa_artifacts/F0_reconciliation_triage.md` — the report: one row per empty table with `bucket | legacy_source(+rows) | wall | fk_closure | rationale`, a per-bucket summary, the assertion `sum = 65`, and an explicit diff vs the spec's proposed classification.
- Create: `qa_artifacts/F0_legacy_inventory.txt` — the 692 legacy table names + row counts (matching aid, committed for reproducibility).
- **No DB writes. No migration. No seed.** (The registry seed + migration are F1.)

## Classification criteria (authoritative — every subagent uses these verbatim)

For each empty `sys.*` table, assign exactly one bucket:

- **A — Import now**: a legacy `public` table exists *with rows* whose columns map ~1:1 to the target, AND every NOT-NULL / FK column of the target resolves with the data already present in `sys.*` (no missing bridge). Deterministic, no modeling needed.
- **B — Structural wall**: a legacy source *with rows* exists, BUT at least one required target FK cannot resolve without a modeling decision. Name the wall: `job_to_position_bridge` | `org_unit_template_vs_instance` | `learning_catalog_reimport` | `other:<desc>`.
- **C — Needs-decision (derived)**: the table is derived analytics (scores/results/predictions/pools/recommendations/assessments/measurements/gaps) — no 1:1 legacy source; populating it requires a human-authored derivation/aggregation rule.
- **D — No-source / app-generated**: no plausible legacy source AND the table is runtime/scaffold/app-generated (`sys_seed_*`, `sys_visualization_*`, sessions, notifications, preferences, documents, `*_history`, `*_overrides`, `*_activations`, engine outputs).

Tie-breakers: a real legacy source with rows → never C/D; if a source exists but every FK resolves → A (not B); `*_history` / `*_overrides` / `*_activations` / `sys_seed_*` / `sys_visualization_*` → D unless a populated legacy source is positively found.

## Per-table output schema (JSON, per subagent)

```json
{
  "tables": [
    {
      "table_name": "sys_career_paths",
      "bucket": "A",
      "legacy_source": "public.career_paths",
      "legacy_source_rows": 32,
      "wall": null,
      "fk_closure": "all target FKs resolve from sys.* (tenant_id, parent self-ref present)",
      "rationale": "1:1 catalog, 32 rows, no missing bridge",
      "confidence": "high",
      "evidence": "legacy count(*)=32; sys_career_paths cols match; no unresolved FK"
    }
  ]
}
```
`bucket` ∈ A|B|C|D. `legacy_source` null only for C/D. `wall` non-null only for B. `confidence` ∈ high|medium|low (low → flagged for the user in the report).

## The 65 empty tables, grouped into 11 domains (one subagent each)

1. **kpi**: `sys_process_kpi_templates`, `sys_organization_unit_kpi_templates`, `sys_position_kpi_requirements`, `sys_kpi_metric_definitions`, `sys_kpi_assessment_results`, `sys_kpi_measurements`, `sys_user_kpi_evidence`
2. **career_position**: `sys_career_paths`, `sys_career_path_steps`, `sys_position_career_paths`, `sys_user_career_plans`, `sys_user_target_positions`, `sys_position_economic_weight`
3. **skills_learning**: `sys_position_skill_requirements`, `sys_position_skill_requirement_history`, `sys_position_learning_requirements`, `sys_learning_path_steps`, `sys_skill_learning_mappings`, `sys_user_learning_assignments`, `sys_user_learning_evidence`, `sys_learning_gaps`
4. **succession_talent**: `sys_succession_pools`, `sys_successor_candidates`, `sys_successor_readiness`, `sys_succession_scores`, `sys_talent_scores`, `sys_readiness_scores`, `sys_critical_positions`, `sys_critical_role_coverage_status`, `sys_position_succession_relevance`, `sys_employee_position_fit_scores`
5. **gap**: `sys_gap_analysis_results`, `sys_gap_closure_plans`, `sys_gap_closure_actions`
6. **comp**: `sys_bonus_pools`, `sys_payout_curves`, `sys_variable_pay_calculations`, `sys_compensation_recommendations`
7. **org**: `sys_organization_hierarchies`, `sys_organization_unit_history`, `sys_branches`
8. **reward_blueprint**: `sys_reward_gates`, `sys_reward_gate_results`, `sys_objective_reward_rules`, `sys_blueprint_activations`, `sys_blueprint_overrides`
9. **runtime_app**: `sys_auth_sessions`, `sys_inbox_notifications`, `sys_user_preferences`, `sys_user_documents`, `sys_payroll_handoff_records`, `sys_visualization_styles`, `sys_visualization_layouts`, `sys_visualization_node_layouts`, `sys_visualization_exports`
10. **seed_engine**: `sys_seed_acquisition_runs`, `sys_seed_approval_decisions`, `sys_seed_candidate_records`, `sys_seed_source_evidence`, `sys_seed_validation_results`
11. **sdbi_misc**: `sys_enterprise_typing_profiles`, `sys_person_evidence_records`, `sys_behavioral_assessments`, `sys_activity_classification_mappings`, `sys_user_professional_experiences`

(7+6+8+10+3+4+3+5+9+5+5 = 65 ✓)

---

## Task 1: Build the legacy inventory (shared matching aid)

**Files:** Create `qa_artifacts/F0_legacy_inventory.txt`

- [ ] **Step 1: Dump the 692 legacy table names + row counts**

Run:
```bash
ssh -o BatchMode=yes oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -tAc "
SELECT relname, n_live_tup
FROM pg_stat_user_tables WHERE schemaname=''public''
ORDER BY relname;"' > qa_artifacts/F0_legacy_inventory.txt
```
Expected: 692 lines `tablename|rowcount`. (n_live_tup is an estimate; subagents confirm exact `count(*)` for the specific candidates they pick.)

- [ ] **Step 2: Sanity-check the dump**

Run: `wc -l qa_artifacts/F0_legacy_inventory.txt`
Expected: `692` (±0). If far off, re-run Step 1 (stale connection).

## Task 2: Domain triage fan-out (Workflow)

**Files:** none (in-memory structured results)

- [ ] **Step 1: Dispatch 11 domain subagents in parallel**

Each subagent receives: (a) its domain's table list, (b) the classification criteria verbatim, (c) the JSON output schema, (d) the access recipe below, (e) `qa_artifacts/F0_legacy_inventory.txt` content. Each returns the JSON `{tables:[…]}` for its cluster only.

Access recipe given to each subagent:
```bash
# advanced target DDL (cols + FKs to judge fk_closure):
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\d sys.<table>"
# advanced live row counts of referenced sys tables (to judge FK resolvability):
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "SELECT count(*) FROM sys.<referenced>"
# legacy candidate source columns + exact rows:
ssh -o BatchMode=yes oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\d public.<candidate>"'
ssh -o BatchMode=yes oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -tAc "SELECT count(*) FROM public.<candidate>"'
# existing mapping for the target (may already classify it):
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tAc "
SELECT tm.table_mapping_classification, st.source_table_name
FROM brownfield.table_mappings tm JOIN brownfield.source_tables st
  ON st.source_table_id=tm.table_mapping_source_table_id
WHERE tm.table_mapping_target_table='<table>';"
```

- [ ] **Step 2: Verify each subagent returned valid JSON for all its tables**

Expected: 11 results, union covers exactly the 65 tables, each with a bucket ∈ A|B|C|D. Any table missing or with an invalid bucket → re-dispatch that single domain.

## Task 3: Synthesis + adversarial coherence pass

**Files:** none

- [ ] **Step 1: Merge the 11 JSON results into one 65-row table**

Assert: `count == 65`, no duplicate `table_name`, every row has a bucket.

- [ ] **Step 2: Adversarial verification of every A and B**

For each A/B row, a verifier subagent independently re-checks: does the named `legacy_source` exist with `legacy_source_rows > 0` (exact `count(*)`)? For A, does every NOT-NULL/FK target column truly resolve (no hidden bridge)? If the verifier disagrees (e.g. an "A" actually has an unresolved FK → it's B; a "B" whose source is empty → it's C/D), record the corrected bucket + both rationales. **Default to the more conservative bucket on disagreement** (A→B→C, and "has source" beats "no source" only with positive evidence).

- [ ] **Step 3: Resolve C/D borderlines**

For every C or D with `confidence != high`, a subagent searches the 692-table inventory for any plausible source by name/semantics and confirms empty-or-absent. A populated source found → reclassify (C/D → A/B). Record the search performed (so "no source" is evidence, not assumption — R5).

## Task 4: Emit the report + validation assertions

**Files:** Create `qa_artifacts/F0_reconciliation_triage.md`

- [ ] **Step 1: Write the report**

Sections: (1) summary table per bucket with counts; (2) the full 65-row table `table | bucket | legacy_source | rows | wall | fk_closure | confidence | rationale`; (3) explicit diff vs the spec's proposed classification (which tables moved bucket and why); (4) the bucket-B wall assignment per table; (5) low-confidence rows flagged for the user.

- [ ] **Step 2: Run the closure assertions**

Assert in the report:
- buckets sum to exactly 65
- every A/B row has a non-null `legacy_source` with verified `rows > 0`
- every C/D row has null `legacy_source` and a recorded source-search (for low-confidence)
- every B row has a non-null `wall`

Any assertion fails → fix the offending classification (back to Task 3) before delivering.

- [ ] **Step 3: Commit the report (docs-only, no push)**

Run:
```bash
git add qa_artifacts/F0_reconciliation_triage.md qa_artifacts/F0_legacy_inventory.txt
git commit -m "docs(reconcile): F0 triage — verified A/B/C/D classification of 65 empty sys.* tables (S960)"
```
(`qa_artifacts/runs/` is gitignored but these two files are at `qa_artifacts/` root → tracked.)

## Task 5: Deliver for sign-off

- [ ] **Step 1: Present the per-bucket summary + the diff-vs-spec + the low-confidence flags to the user.**

State plainly: F0 wrote nothing to any DB. Ask the user to sign off the classification (or correct specific rows). Only on sign-off does F1 (writing-plans → migration `000058` + registry seed + EXCLUDE cards) begin.

---

## Self-Review

- **Spec coverage:** F0 (spec §5 row 1) — produces the A/B/C/D classification + legacy_source per table for sign-off ✓. The registry/view (spec §3) and EXCLUDE cards (spec §1/§5 F1) are explicitly deferred to F1 — not in this plan by design ✓. The 3 walls (spec §4) are *identified* here (bucket B `wall` field) but *resolved* in F3 ✓.
- **Placeholder scan:** access recipe uses `<table>`/`<candidate>` as documented substitution slots (not TODOs); the JSON schema and criteria are concrete; no "handle edge cases" hand-waving. ✓
- **Consistency:** bucket letters A/B/C/D, wall enum (`job_to_position_bridge`/`org_unit_template_vs_instance`/`learning_catalog_reimport`/`other`), and the JSON field names (`legacy_source`, `legacy_source_rows`, `wall`, `fk_closure`) are used identically in criteria, schema, and report. ✓
- **Read-only invariant:** every command is a SELECT / `\d` / `git add` of a report. No INSERT/UPDATE/DDL anywhere. ✓
