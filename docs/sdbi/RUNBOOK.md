# SDBI Runbook — Semantic-Driven Brownfield Import

**Reference**: ADR-0014 (`docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md`, status ACCEPTED 2026-05-27).
**Scope**: operational procedure to import a TRUE-GAP HRMS macro-area (target `sys.*` schema missing) from the legacy source into `sys.*`, using the AI-assisted SDBI workflow as a complement to the deterministic brownfield ETL.

This runbook is the worked, repeatable procedure. It assumes the architectural decisions in ADR-0014 (6-phase workflow, confidence thresholds, schema locations, bias mitigations) and does not restate them.

---

## §0 — Table of contents

1. [Pre-conditions](#1--pre-conditions)
2. [Phase 1 — Source discovery](#2--phase-1--source-discovery)
3. [Phase 2 — Target analogy matching + mapping card](#3--phase-2--target-analogy-matching--mapping-card)
4. [Phase 3 — temp_sdbi seeding](#4--phase-3--temp_sdbi-seeding)
5. [Phase 4 — Relationship traversal](#5--phase-4--relationship-traversal)
6. [Phase 5 — Consolidation review](#6--phase-5--consolidation-review)
7. [Phase 6 — temp_sdbi cleanup](#7--phase-6--temp_sdbi-cleanup)
8. [Artifacts & conventions](#8--artifacts--conventions)
9. [Worked example — Goals/OKRs pilot](#9--worked-example--goalsokrs-pilot)

---

## §1 — Pre-conditions

```bash
# SSH key in agent + tunnel 5433 up
ssh -o BatchMode=yes oracle-vm-default 'echo OK'
nc -z localhost 5433 || ssh -fN -L 5433:localhost:5432 oracle-vm-default

# Smoke both DBs (source + target share the OCI Postgres server)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced  -c "SELECT now()"
psql -h localhost -p 5433 -U heuresys -d heuresys_platform   -c "SELECT now()"
```

- Working tree clean on `main`.
- `temp_sdbi` schema exists (migration `000036`); lineage SDBI columns exist (migration `000045`); SDBI audit rule_codes present (`apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts`).

> **Source-data availability check (mandatory, CW-B16/B21).** Before committing to a macro-area, verify the source actually has rows. The HR transactional tables in `heuresys_platform.public` are partly schema-only (0 rows) — verified 2026-05-27. The real demo data for the shipped pilots lived in `legacy_mirror.*` (export `db-export-2026-05-15`). If the source is empty, only a **design pilot** (mapping card + target schema, no data import) is possible until the data is located/extracted.

---

## §2 — Phase 1 — Source discovery

For each source table in the macro-area cluster:

```sql
-- columns + types + nullability
SELECT column_name, data_type, is_nullable, character_maximum_length
FROM information_schema.columns
WHERE table_schema='public' AND table_name='<source_table>' ORDER BY ordinal_position;
-- FK relationships
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.<source_table>'::regclass AND contype IN ('f','c');
-- row count + stratified sample
SELECT count(*) FROM public.<source_table>;
SELECT * FROM public.<source_table> ORDER BY random() LIMIT 20;
```

Record per source table: row count, NOT NULL columns (each must get a mapping — CW-B18), FK columns + non-NULL ratio (CW-B19), soft-delete pattern, hierarchy (self-FK), temporal nature, PII flag.

## §3 — Phase 2 — Target analogy matching + mapping card

1. Propose target `sys.sys_<plural>` schema (new migration) OR map by analogy to existing `sys.*`.
2. Field-by-field mapping with confidence (HIGH/MEDIUM/LOW per ADR §3.3) + transform code.
3. **HUMAN CHECKPOINT** (Enzo) on any MEDIUM/LOW field or schema-design choice.
4. Emit mapping card → `cowork_reserved/sdbi_mapping_cards/<macro_area>_card.md` (format ADR §3.6; see worked example `cowork_reserved/batch_c1/goals_pilot/mapping_cards/goals_sys_goals.md`).

Schema conventions (non-negotiable, repo invariants):
- Tables `sys.sys_<plural>`; per-table column prefix (`review_*`, `cycle_*`, …).
- `*_tenant_id` FK → `sys.sys_tenancies` (I5 tenant isolation = FK, **never RLS**).
- Categoricals = `varchar(N) + CHECK` (RD-08, **never** PG ENUM).
- `date` for date-only, `timestamptz` only where time-of-day matters (RD-09).
- `*_natural_key` text + UQ `(tenant_id, natural_key)` for idempotent consolidation.
- `*_metadata jsonb NOT NULL DEFAULT '{}'` carrying `legacy_id` / `legacy_table` provenance.

## §4 — Phase 3 — temp_sdbi seeding

Author `db/seeds/brownfield/sdbi/<macro_area>/` with three SQL files (model on `goals_pilot/`):
- `01_temp_sdbi_ddl.sql` — `CREATE TABLE temp_sdbi.<t>` mirror, **no FK**, `_legacy_source_id` + `_import_run_id` book-keeping columns, `ON CONFLICT (_legacy_source_id)` UQ.
- `02_phase3_temp_sdbi_seed.sql` — `BEGIN;` create `brownfield.import_runs` row (`set_config('sdbi.run_id', …)`), `INSERT … SELECT FROM legacy_mirror.<t>` with transforms; tenant via `brownfield.tenant_id_mappings`; FK/self-FK resolved late-bind; `COMMIT;` + verify counts.
- Idempotent: `ON CONFLICT DO NOTHING`; re-run safe (TRUNCATE-and-retry policy).

## §5 — Phase 4 — Relationship traversal

For each FK in the cluster, traverse to dependent source tables; repeat Phase 1-3. Build the seed order from the FK graph (parents before children); detect cycles; resolve self-FK in a second pass (pass 1 NULL, pass 2 UPDATE via `temp_sdbi.legacy_id ↔ <target>_id`).

## §6 — Phase 5 — Consolidation review

`03_phase5_consolidation.sql`: `BEGIN;` `INSERT INTO sys.<t> SELECT … FROM temp_sdbi.<t> ON CONFLICT (tenant_id, natural_key) DO UPDATE/DO NOTHING`; then **bulk lineage** insert into `sys.sys_source_lineage_records` (set `source_lineage_sdbi_mapping_card_id`, `_confidence`, `_ai_model_id`, `_human_approver` from migration 000045) `ON CONFLICT … DO NOTHING`; then **audit** row per target with the appropriate SDBI rule_code (`SDBI_CONSOLIDATION_COMPLETE_V1`) — now writable since `import_validation_result_source_table_id` is nullable (migration 000039). `COMMIT;` + verify `sys.<t>` counts and acceptance criteria from the mapping card.

> CW-B17: emit an audit row for every skipped row, not just successes.

## §7 — Phase 6 — temp_sdbi cleanup

After human-confirmed consolidation: `DROP TABLE temp_sdbi.<t>` per cluster table; emit audit `SDBI_TEMP_CLEANUP_V1`.

---

## §8 — Artifacts & conventions

| Artifact | Location |
|---|---|
| Mapping card | `cowork_reserved/sdbi_mapping_cards/<macro_area>_card.md` |
| Target migration | `db/migrations/0000NN_sdbi_<macro_area>_target.sql` |
| Seed/consolidation SQL | `db/seeds/brownfield/sdbi/<macro_area>/0{1,2,3}_*.sql` |
| Lineage provenance | `sys.sys_source_lineage_records` (SDBI columns, migration 000045) |
| Audit trail | `audit.import_validation_results` (rule_codes in `audit-rule-codes.ts`) |

Commit prefix: `feat(sdbi): MVP-4 2.4.<N> — <item>` / `docs(sdbi): …`. Atomic per phase. **No push** without explicit Enzo authorization.

## §9 — Worked example — Goals/OKRs pilot

The Goals/OKRs pilot (commit `bddf987`, ~5.9k rows across 10 `sys.*` tables) is the reference implementation:
- Mapping cards: `cowork_reserved/batch_c1/goals_pilot/mapping_cards/` (10 cards).
- Seed/consolidation: `db/seeds/brownfield/sdbi/goals_pilot/0{1,2,3}_*.sql`.
- Target migration: `db/migrations/000037_sys_goals_okrs_scaffold.sql`.
- Pragmatic deviations recorded inline (user lookups NULL where `legacy_mirror.employees_core` absent; self-FK pass-2 skipped; audit rows deferred pre-000039). New clusters should resolve these now that 000039 (nullable audit FK) + 000045 (lineage SDBI cols) exist.

A second pilot (Time/Leave, commit `5735556`) follows the same shape.
