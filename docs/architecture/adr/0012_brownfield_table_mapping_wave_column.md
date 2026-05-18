# ADR‑0012 — Brownfield Wave Assignment: Dedicated Column on `table_mappings`

- **Status:** Accepted
- **Date:** 2026‑05‑18

## Context

`docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` defines a 4‑wave brownfield import strategy. Each wave covers a disjoint set of source domains:

| Wave | Domain |
|------|--------|
| 1 | Low‑risk catalogs: ESKAP, SKILGRO, INDOOR, ITLAB, PROGOV, OPOURSKA, H2R (≈93 source tables) |
| 2 | Tenant operating model — RTL_BANK_REFERENCE |
| 3 | Sensitive tenant data — human approval required |
| 4 | Cross‑tenant — human approval required |

The wave attribute today lives on `brownfield.import_runs.import_run_wave smallint CHECK (1..4)` (migration `000024`). It does **not** exist on `brownfield.table_mappings` (migration `000025`). The mapping ↔ wave link is currently only implicit through `table_mapping_run_id` referencing the run that produced/used the mapping.

MVP‑3 Tappa D (Brownfield Wave 1 execution) needs a stable, queryable wave attribute on the mapping rows themselves so that:

1. Pre‑flight checks can scope by wave (`WHERE wave = 1`) without joining through `import_runs`.
2. The wave executor can stream "mappings assigned to wave N" deterministically across multiple runs.
3. Acceptance criteria SQL in `WAVE_1_EXECUTION_RUNBOOK.md` §"Acceptance criteria" can express wave membership directly.

We needed to choose between two storage shapes for this attribute.

## Decision

Add a dedicated column `table_mapping_wave smallint` to `brownfield.table_mappings`, with:

- `CHECK (table_mapping_wave IS NULL OR table_mapping_wave BETWEEN 1 AND 4)` — same shape as `brownfield.import_runs.import_run_wave`.
- Secondary `INDEX (table_mapping_wave) WHERE table_mapping_wave IS NOT NULL` for wave‑scoped scans.
- NULL allowed for mappings that have not yet been wave‑assigned (e.g. freshly proposed mappings still in `PROPOSED` state).

Migration: `db/migrations/000029_brownfield_table_mapping_wave.sql` (idempotent, additive only).

Backfill: a wave‑1 backfill UPDATE is included in the migration, gated on `source_table_domain IN (<Wave 1 domains>)` (the lexicon classification on `brownfield.source_tables`, NOT the SQL schema column which always holds `'public'` for the legacy `heuresys_platform`). It is a no‑op when `brownfield.table_mappings` is empty (current state of the DB; the mapping population is a prerequisite of the executor session, not of this ADR).

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **A — Dedicated column** (chosen) | Symmetric with `import_runs.import_run_wave`; type‑safe in TS repositories; CHECK constraint validates 1..4 at DB level; simple secondary index; runbook acceptance SQL already written for this shape | One additive migration; tied to a single wave per mapping | — |
| **B — JSONB key `table_mapping_metadata.wave`** | Zero schema change; theoretically supports multi‑wave assignment per mapping | Asymmetric with `import_runs` (column vs jsonb); requires `jsonb_extract` in every query; no DB‑level validation; TS repository would need accessor parsing; expression index required for performance; no real demand for multi‑wave (the 4‑wave plan allocates disjoint source domains) | Adds query complexity and gives up DB‑level validation for a flexibility the domain doesn't need |
| **C — Implicit wave via `table_mapping_run_id → import_runs.import_run_wave`** | No schema change | Mapping is wave‑bound only once a run touches it; cannot scope "pre‑run" wave membership; ambiguous if a mapping participates in runs across multiple waves; preflight checks become a 2‑hop join | The whole point of preflight is to know the wave assignment **before** scheduling a run |

## Consequences

**Positive:**

- `brownfield.table_mappings.table_mapping_wave` is symmetric with `brownfield.import_runs.import_run_wave`. The "wave‑aware brownfield" sub‑model is internally consistent.
- Pre‑flight scripts gain a single‑line filter (`AND table_mapping_wave = $WAVE`) instead of a jsonb cast.
- The acceptance criteria SQL block in `WAVE_1_EXECUTION_RUNBOOK.md` §"Acceptance criteria" works as documented.
- TS repository at `apps/api/src/modules/brownfield-table-mappings/repository.ts` can surface `wave: number | null` typed exactly like `brownfield-import-runs/repository.ts` does today.
- Validation enforced at DB level — wave=5 or wave=0 is rejected by the CHECK constraint.

**Negative:**

- One additive migration (`000029`) to maintain across environments. Idempotent and additive only, so very low risk.
- A mapping is tied to one wave at a time. If the 4‑wave plan ever needs to reassign a mapping (e.g. promote a Wave‑2 mapping to Wave‑1), it requires an UPDATE. This is the intended workflow.

**Neutral:**

- The backfill UPDATE is a no‑op today (`brownfield.table_mappings` has 0 rows). It will populate the wave column for the 93 Wave‑1 source domains the moment those mappings are loaded — populating the mapping rows themselves is a separate, future task that belongs to the Wave 1 executor session.

## References

- Consumed by: `db/migrations/000029_brownfield_table_mapping_wave.sql`, `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md`, `db/scripts/brownfield-wave-1-preflight.{sh,ps1}`, `apps/api/src/modules/brownfield-table-mappings/`.
- See also: `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §3 (Wave 1 source domain list), migration `000024_brownfield_import_staging.sql` (`import_run_wave` precedent), migration `000025_brownfield_lineage_and_mapping.sql` (`table_mappings` base schema).
