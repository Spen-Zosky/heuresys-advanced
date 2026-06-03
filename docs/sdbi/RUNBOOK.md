# SDBI Operational Runbook

> **Status**: published 2026-06-04 (closes ADR-0014 §5 acceptance criterion 4 + PROMPT 027 §4.4).
> **Owner**: CLI (executor) + Cowork/architect (mapping-card author). **Authority**: ADR-0014.
> **What this is**: the step-by-step procedure to run one SDBI (Semantic-Driven Brownfield Import)
> macro-area end to end, modeled on the proven Goals/OKRs pilot (5939 lineage rows, avg confidence
> 0.900, 11 source tables). SDBI is the AI-led mechanism that **extends** the `sys.*` schema for
> legacy source areas that have **no target table yet** — distinct from (a) the deterministic
> brownfield wave pipeline (ADR-0012, 100% coverage of legacy that already has a target) and
> (b) the reconciliation-closure cycle (fills already-existing empty `sys.*` tables).

---

## 0. When to use SDBI (vs brownfield vs reconciliation)

ADR-0014 §2.1 decision tree, in one line: **target `sys.*` table MISSING → SDBI; target EXISTS → brownfield/reconciliation.**

| You have… | Use |
|---|---|
| A legacy source area with NO `sys.*` target schema (Goals, PerfReviews, Feedback360, Mentorship, Surveys, …) | **SDBI** (this runbook) |
| A legacy source already mapped 1:1 to an existing `sys.*` table | brownfield wave pipeline (`WAVE_1_EXECUTION_RUNBOOK.md`) |
| An empty `sys.*` table whose source is already in legacy_mirror | reconciliation seed (`db/seeds/reconciliation/`) |

---

## 1. Prerequisites (run once, verify each session)

1. **SSH tunnel up** (advanced DB) + **legacy read access**:
   ```bash
   ssh -fN -L 5433:localhost:5432 oracle-vm-default
   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "\dt sys.sys_auth*"
   ssh oracle-vm-default "sudo -u postgres psql -d heuresys_platform -c 'SELECT 1'"
   ```
2. **SDBI infra present** (migration 000063 applied — this runbook assumes it):
   ```bash
   # 4 SDBI lineage columns + SDBI rule_code dictionary
   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c \
     "SELECT count(*) FROM information_schema.columns
        WHERE table_schema='sys' AND table_name='sys_source_lineage_records'
          AND column_name LIKE 'source_lineage_sdbi_%';"   -- expect 4
   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c \
     "SELECT count(*) FROM audit.import_validation_rule_codes
        WHERE import_validation_rule_family='SDBI';"        -- expect >= 8
   ```
3. **`temp_sdbi` schema exists** (created by migration 000036). The SDBI staging tables live here,
   carry no FK constraints, and are TRUNCATE-able / DROP-able.
4. **A registered `brownfield.source_exports` row** to anchor the import_run FK (the goals pilot
   used `db-export-2026-05-15`).

---

## 2. The six phases (ADR-0014 §3.1)

The phases map onto a **3-file seed bundle** per macro-area (Phase 3 DDL, Phase 3 seed, Phase 5
consolidation) plus mapping-cards authored in Phase 2. Copy the skeleton from
`db/seeds/sdbi/_template/` (see §4) into `db/seeds/brownfield/sdbi/<area>/`.

### Phase 1 — Source discovery (Cowork/architect)
- Introspect each legacy source table: columns, types, FK, NOT NULL constraints, soft-delete flag.
- Extract a stratified sample (10-50 rows) and live cardinality / NULL / FK-integrity counts.
- Output: `01_SOURCE_DISCOVERY.md` per area. **Bias gate (CW-B18)**: enumerate ALL NOT NULL source
  columns and confirm each has a proposed mapping — no implicit NULL assumption.

### Phase 2 — Target analogy + mapping cards (Cowork/architect)
- Propose the new `sys.sys_<entity>` schema (I3/I4 naming, `_tenant_id` FK, `_natural_key` UNIQUE,
  `_metadata` jsonb, audit cols). A real numbered migration creates these target tables.
- Author one **mapping card** per source table (`mapping_cards/<source>_<target>.md`, ADR-0014 §3.6):
  field-by-field mapping + transform + per-field confidence (HIGH ≥ 0.85 / MEDIUM 0.60-0.85 / LOW < 0.60).
- **HUMAN CHECKPOINT (Enzo)**: approve/correct the schema + every LOW/MEDIUM field before Phase 3.

### Phase 3 — temp_sdbi DDL + seed (CLI, mechanical, post-approval)
- Apply the target-schema migration (`pnpm db:migrate`).
- `01_temp_sdbi_ddl.sql` — `CREATE TABLE IF NOT EXISTS temp_sdbi.<entity>` mirrors (no FK), with
  `_legacy_source_id` PK + `_legacy_source_<fk>_id` raw pointers resolved later + `_import_run_id`.
- `02_phase3_temp_sdbi_seed.sql` — create the SDBI `brownfield.import_runs` row, stash its id via
  `set_config('sdbi.run_id', …, true)`, then `INSERT … SELECT` from `legacy_mirror.<source>`
  (join `brownfield.tenant_id_mappings` for tenant, resolve users via `LEGACY_EMP::` per I14).
  Natural keys: `'<ENTITY>::' || tenant::text || '::' || src.id::text`. All `ON CONFLICT … DO NOTHING`.
- **If the legacy source is not yet in `legacy_mirror`**, extend the extract first
  (`docs/brownfield/wave_runners/` pattern) — `legacy_mirror` currently holds only the wave-1 +
  goals subset, not every SDBI candidate (open gap, dossier §5).

### Phase 4 — Relationship traversal (per-FK, usually closed for a pilot)
- For each FK in the area, traverse to dependent tables and repeat 1-3. Most pilots are a closed
  sub-graph (all FK resolve to `sys_tenancies`, `sys_users`, or sibling tables in the same bundle).

### Phase 5 — Consolidation (CLI, human-gated)
- `03_phase5_consolidation.sql` — `INSERT … SELECT FROM temp_sdbi.<entity> … ON CONFLICT
  (<tenant>, <natural_key>) DO UPDATE/NOTHING` into `sys.<entity>`, resolving the raw `_legacy_source_*`
  pointers to the freshly-inserted UUIDs.
- **Write lineage** to `sys.sys_source_lineage_records` per row: `source_system='heuresys_platform'`,
  `source_natural_key='OLDDB::<table>::<id>'`, and **populate the 4 SDBI columns** (mig 000063):
  `source_lineage_sdbi_mapping_card_id`, `source_lineage_sdbi_confidence`,
  `source_lineage_sdbi_ai_model_id`, `source_lineage_sdbi_human_approver`. (The goals pilot put these
  in `source_lineage_metadata` jsonb — new runs use the first-class columns.)
- **Write audit** to `audit.import_validation_results` with the SDBI rule_codes
  (`SDBI_CONSOLIDATION_COMPLETE_V1` per target table; `source_table_id` may be NULL — mig 000039 —
  with `mapping_card_id` in the payload). Emit a row per processed row (CW-B17: PASSED, or SKIPPED
  with reason — never a silent skip).

### Phase 6 — Cleanup (CLI, post-confirmation)
- `DROP TABLE temp_sdbi.<entity>` for the bundle. Audit marker `SDBI_TEMP_CLEANUP_V1`.

---

## 3. Apply / verify / idempotency

```bash
# Apply (target-schema migration first, then the area seed bundle in 01→02→03 order)
pnpm db:migrate                                   # applies db/migrations/*.sql (incl. 000063 infra)
psql … -v ON_ERROR_STOP=1 -f db/seeds/brownfield/sdbi/<area>/01_temp_sdbi_ddl.sql
psql … -v ON_ERROR_STOP=1 -f db/seeds/brownfield/sdbi/<area>/02_phase3_temp_sdbi_seed.sql
psql … -v ON_ERROR_STOP=1 -f db/seeds/brownfield/sdbi/<area>/03_phase5_consolidation.sql

# Verify (counts ≈ source, 0 NULL on NOT NULL, lineage rows = upserted rows)
psql … -c "SELECT count(*) FROM sys.sys_<entity>;"
psql … -c "SELECT count(*) FROM sys.sys_source_lineage_records
             WHERE source_lineage_target_table_name='sys_<entity>';"

# Idempotency proof (re-run the bundle → 0 new rows; migrate twice → empty pg_dump diff)
```

**Idempotency rules** (every SDBI artifact must satisfy):
- DDL: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`+`ADD`.
- Seed/consolidation: `INSERT … ON CONFLICT (…) DO NOTHING|DO UPDATE`. Re-run inserts 0.
- Migrations run under `psql -1 -f` (single txn) — **no inner BEGIN/COMMIT**; the runner records
  `sys.sys_schema_migrations` itself. Seed bundles MAY wrap their own `BEGIN/COMMIT` (they are not
  applied by the migrate runner).

---

## 4. Reusable template

`db/seeds/sdbi/_template/` is the promoted goals-pilot skeleton — copy it per new area:

| Template file | Becomes | Phase |
|---|---|---|
| `01_temp_sdbi_ddl.sql` | `db/seeds/brownfield/sdbi/<area>/01_temp_sdbi_ddl.sql` | 3 |
| `02_phase3_temp_sdbi_seed.sql` | `…/<area>/02_phase3_temp_sdbi_seed.sql` | 3 |
| `03_phase5_consolidation.sql` | `…/<area>/03_phase5_consolidation.sql` | 5 |
| `mapping_card.template.md` | `…/<area>/mapping_cards/<source>_<target>.md` | 2 |
| `README.md` | the template contract + placeholder legend | — |

Replace every `<ENTITY>` / `<entity>` / `<SOURCE_TABLE>` / `<TARGET_TABLE>` / `<AREA>` placeholder.
The reference implementation is the live goals pilot at
`db/seeds/brownfield/sdbi/goals_pilot/{01_temp_sdbi_ddl,02_phase3_temp_sdbi_seed,03_phase5_consolidation}.sql`.

---

## 5. Worked example — PerformanceReviews (next pilot, Option-B)

Measured live (legacy `heuresys_platform`, 2026-06-04): `performance_reviews` 292,
`competency_review_ratings` 465, `feedback_360` 714. FK axis healthy (138/138 RTL via `LEGACY_EMP::`).
Sequence: Phase 1-2 (Cowork authors `sys_performance_reviews` + satellites + mapping cards, Enzo
approves) → extend `legacy_mirror` to hold these 3 sources → copy `_template/` → Phase 3 DDL+seed →
Phase 5 consolidation (lineage with the 4 SDBI columns + `SDBI_CONSOLIDATION_COMPLETE_V1` audit) →
Phase 6 cleanup. This is **D6 Option-B** in the dossier — a CLASS-B Enzo greenlight (production-write,
multi-session). This runbook + the template + migration 000063 are its prerequisite (now closed).

---

## 6. References

- `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md` — the doctrine (§3.1 phases, §3.4 lineage, §3.5 rule_codes, §3.6 mapping card, §3.8 bias mitigations).
- `docs/brownfield/EMPLOYEE_CENTRIC_MAPPING_DOCTRINE.md` — I14: legacy person = `employees`, key `LEGACY_EMP::`||employees.id (never `users.id`).
- `db/seeds/brownfield/sdbi/goals_pilot/` — the proven 3-file reference run.
- `db/seeds/sdbi/_template/` — the reusable skeleton (this runbook §4).
- `db/migrations/000063_sdbi_infra.sql` — the 2 DB-side infra items (rule_code dictionary + 4 lineage columns).
- `apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts` — SDBI rule_code TS constants.
- `docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md` §5 — W4 / Option-A/B/C scope decision.
