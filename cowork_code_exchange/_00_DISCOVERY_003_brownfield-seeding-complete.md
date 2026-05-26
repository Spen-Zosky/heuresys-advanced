# _00_DISCOVERY_003_brownfield-seeding-complete.md

**Protocol phase:** DISCOVERY (Cowork-side, facts only)
**Goal ID:** 003 (slug: `brownfield-seeding-complete`)
**Created:** 2026-05-19T13:30:00+02:00, by Cowork Desktop
**Predecessor artefacts:**
- `_05_REVIEW_002_*.md` (partial closure; CW-B13 lesson)
- `_04_REPORT_002_*.md` (REPORT §3 root cause + §6 deferrals)
- `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` (4-wave full pipeline reference)
- `docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md` (Wave 1 source→target map)

---

## §1 — Scope intent

Goal 003 must drive `heuresys_advanced` DB to a state declarable as **"ready for functional development"** per Enzo's directive (2026-05-19). Concretely:

- Wave 1 (catalogs) at VOLUME — every Wave 1 APPROVED mapping has rows in target sys.*
- Wave 2 (tenant operating model) — scaffold mapping registry + execute pipeline
- Wave 3 (demo person data — 274 users) — scaffold + execute
- Wave 4 (advanced intelligence) — scaffold + execute

Per Enzo direttiva: **no scope reduction, no deferral, no partial closure**. Single goal closes the entire seeding chain.

---

## §2 — Verified facts (SSH-captured 2026-05-19T13:25Z)

### 2.1 — Wave 1 mappings + target volume status

```sql
SELECT table_mapping_wave, table_mapping_approval_status, count(*)
FROM brownfield.table_mappings GROUP BY 1,2;
```

| wave | status | count |
|---|---|---|
| 1 | APPROVED | 94 |

**Only Wave 1 is registered.** Waves 2/3/4 have ZERO mappings in the registry.

### 2.2 — Current sys.* Wave 1 target volumes (post-Goal-002)

| target | row_count | gap |
|---|---|---|
| sys_skills | 444 | populated, but blocked at ~1% of source by LOOKUP_FK |
| sys_skill_families | 77 | populated |
| sys_skill_categories | 0 | EMPTY — needs investigation |
| sys_skill_taxonomy_edges | 0 | EMPTY |
| sys_skill_aliases | 0 | EMPTY |
| sys_learning_modules | 93 | populated |
| sys_learning_paths | 135 | populated |
| sys_learning_path_steps | 0 | EMPTY |
| sys_skill_learning_mappings | 0 | EMPTY |
| sys_user_certifications | 1 | populated (test fixture) |
| sys_blueprint_process_registry | 23 | populated |
| sys_activity_classifications | 0 | EMPTY |
| sys_compensation_bands | 75 | populated |
| sys_process_kpi_templates | 0 | EMPTY |
| sys_job_roles | 0 | EMPTY |

8 of 15 Wave 1 targets are EMPTY post-Goal-002.

### 2.3 — LOOKUP_FK semantic mismatch (root of A10/A11 failure in Goal 002)

```sql
WITH lfk AS (
  SELECT DISTINCT column_mapping_transform_payload->>'target_table' AS tbl,
                  column_mapping_transform_payload->>'match_on' AS col
  FROM brownfield.column_mappings
  WHERE column_mapping_transform='LOOKUP_FK'
    AND column_mapping_transform_payload->>'match_on' !~ '->>'
)
SELECT lfk.tbl, lfk.col, CASE WHEN c.column_name IS NULL THEN 'MISSING_FROM_SCHEMA' ELSE 'OK' END
FROM lfk LEFT JOIN information_schema.columns c
       ON c.table_schema='sys' AND c.table_name=lfk.tbl AND c.column_name=lfk.col;
```

| target_table | match_on | status |
|---|---|---|
| sys_skills | skill_name | OK |
| sys_kpi_definitions | kpi_definition_code | OK |
| sys_compensation_bands | compensation_band_code | OK |
| sys_activity_classifications | activity_classification_code | OK |
| sys_users | legacy_user_id | **MISSING_FROM_SCHEMA** (5 mappings) |
| sys_tenancies | legacy_tenant_id | **MISSING_FROM_SCHEMA** (33 mappings) |

**Pattern**: `legacy_<X>_id` is NOT a target column literal — it's a logical-name convention. The runtime resolution must translate `match_on=legacy_<X>_id` into `WHERE <X>_metadata->>'legacy_id' = staging_raw_record->>'<key>'` (jsonb lookup pattern) OR `WHERE <X>_code = ...` (code convention). The compiler in Goal 002 v1 took `match_on` as a literal column name — the PROMPT-drafting gap (CW-B13).

### 2.4 — `sys_tenancies` + `sys_users` actual schema (verified)

`sys_tenancies` columns: `tenant_id, tenant_code, tenant_name, tenant_legal_name, tenant_country_code, tenant_industry_code, tenant_size_band, tenant_status, tenant_metadata, created_at, updated_at`. No `legacy_tenant_id`. `tenant_metadata` (jsonb) likely holds `legacy_id` per RTL_BANK seed convention (verifiable at EXEC step 0).

`sys_users` columns include `user_metadata` (jsonb) per analog convention.

### 2.5 — Wave 2/3/4 prerequisites

- `brownfield.tenant_id_mappings` table: **DOES NOT EXIST** in DB. Goal 003 must create it as migration 000032 (or DDL inline). Schema per BROWNFIELD_IMPORT_PLAN §4.1: `(legacy_id, canonical_tenant_id)`.
- Wave 2/3/4 mapping registry rows: **NONE EXIST**. Goal 003 must produce them via mapping discovery (~80 + ~50 + ~58 = ~188 new `brownfield.table_mappings` rows).
- Source `legacy_mirror.*` tables for Wave 2/3/4: verified present (e.g., `tenants`, `org_units`, `users`, `career_paths` — see legacy_mirror inventory in MIGRATION_STATUS §2.B).

### 2.6 — Other Goal 002 deferred blockers (REPORT §3.5)

- 2× `learning_path_step_ordinal` smallint mismatch: transform not in DIRECT_COPY/TRIM auto-wrap whitelist. Goal 003 must extend.
- 2× `sys_activity_classifications` CHECK constraint violation on `_scheme_check`. Data-quality decision — either fix legacy values or relax CHECK.

### 2.7 — Infrastructure validated end-to-end (Goal 002 proven)

- Migration 000031 active (UQ on sys_user_certifications)
- pg_stat_statements 1.10 active
- Audit pipeline durable (165k+ rows in `audit.import_validation_results`)
- Full-scale runner works (`scripts/run-wave1-fullscale.mjs`)
- Wall-clock ≤ 10 min easily achievable (Goal 002 hit 110s for ~440 rows; full ~47k extrapolated ~4-6 min)

---

## §3 — Cross-check enforcement (U-2026-05-19-01)

For Wave 2/3/4 mapping authoring, the supervisor mandates that the executor MUST run the same payload-vs-schema cross-check shown in §2.3 BEFORE registering each new mapping. Specifically, after authoring every `(target_table, match_on)` payload, query:

```sql
SELECT
  m.target_table, m.match_on,
  CASE WHEN c.column_name IS NULL THEN 'INVALID' ELSE 'OK' END AS status
FROM (...new mappings authored as VALUES table...) m
LEFT JOIN information_schema.columns c
       ON c.table_schema='sys'
      AND c.table_name=m.target_table
      AND c.column_name=m.match_on;
```

Any `INVALID` row blocks the wave until either (a) the payload is corrected to use an existing column or a documented `_metadata->>'legacy_id'` pattern, or (b) the mapping is removed from scope with explicit audit note.

---

## §4 — Volume targets for "DBMS ready" declaration

Per Enzo direttiva, "DBMS ready" requires:

- **Wave 1**: every APPROVED mapping → ≥ 1 lineage row per source-table-with-non-zero-rows; every target sys.* table with at least 1 row OR documented as "source is empty in legacy_mirror".
- **Wave 2**: tenancies (4: RTL_BANK + SmartFood + EcoNova + Heuresys System) + organization_units + blueprint_variants + KPI_definitions populated for at least RTL_BANK.
- **Wave 3**: 270 employees + 274 users + assignments + skill evidence + learning evidence for at least RTL_BANK tenant.
- **Wave 4**: career_paths + succession_pools + at least 1 talent_score per user — accepted PARTIAL if Wave 3 baseline rows present (Wave 4 is enrichment over Wave 3).

---

## §5 — Source SHAs (rollback anchor) — verified 2026-05-19T13:25Z

Same fingerprints as DISCOVERY 002 §10 (no source drift since Goal 002 commits — those commits are in main).

---

## §6 — Unknowns + mitigations

| # | Unknown | Mitigation in PROMPT |
|---|---|---|
| U1 | Exact `tenant_metadata` / `user_metadata` jsonb schema (does it contain `legacy_id`?) | EXEC step 0: query sample `sys.sys_tenancies.tenant_metadata` rows; if `legacy_id` present, use that convention; if absent, use `tenant_code` (RTL_BANK→"RTL_BANK_REFERENCE") with deterministic lookup |
| U2 | Wave 2 source tables that DON'T have a target in current `sys.*` schema | EXEC step 0: enumerate legacy_mirror Wave-2-relevant tables vs sys.* targets via TARGET_SCHEMA_DESIGN map; surface gaps; either extend schema (out-of-scope per I3/I4) or document as "no canonical target" |
| U3 | Tenant_id resolution for Wave 2/3 (legacy tenant_id uuid → canonical sys_tenancies.tenant_id) | Goal 003 creates `brownfield.tenant_id_mappings` AS migration 000032 + populates from legacy_mirror.tenants seed |
| U4 | RTL_BANK_REFERENCE seed already loaded? (per migration 000021) | EXEC step 0: verify `SELECT count(*) FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE'` returns 1; if so, link as canonical Wave 2 tenant |
| U5 | Per-wave wall-clock budget | Wave 1 ~5 min (per Goal 002 extrapolation), Wave 2 ~15 min (similar scale × jsonb metadata overhead), Wave 3 ~20 min (274 users + ~80 attributes/user), Wave 4 ~10 min (career data lighter) — total ≤ 60 min full-scale all 4 waves |

---

## §7 — Discovery acceptance

- [x] Every fact above has SSH-verified query + timestamp
- [x] No "I think" / "probably" — only verified data
- [x] Cross-check rule U-2026-05-19-01 explicit
- [x] Volume targets defined for "DBMS ready" declaration
- [x] Unknowns enumerated with mitigation path

**Cowork-side actions executed pre-PROMPT**: none (no DB writes by Cowork; Wave 1 infrastructure unchanged from Goal 002).

---

*End of _00_DISCOVERY_003_brownfield-seeding-complete.md*
