# PROMPT 015 — CLI Batch X11 (hardening sprint consolidation)

**Protocol**: Cowork↔CLI v2.2 semplificato
**Scope**: 4 block hardening consolidation post-CW-B49 unlock (NOT new macro-area — source data limited per X11+)
**Expected duration**: 2-4h CLI
**Authored**: 2026-05-23T17:45Z by Cowork (batch C11)
**Predecessor**: REPORT 014 X10 (`_04_REPORT_014_batch_x10.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C11 ha letto REPORT 014 + verified live legacy_mirror source data per X11+ macro-aree.

**Discovery cruciale Cowork-side**: source data legacy_mirror è SCARSA per macro-aree X11+:
- GOKMER (Performance): solo 517 rows (competency_review_ratings 465 + ontology_feedback 52)
- SMERTO (Compensation): solo 84 rows (market_salary_data)
- H2R, TALPIPE, PULSAR: 0 legacy_mirror tables

**Conclusione**: NON è viable "X11.B Performance Reviews new macro-area" come raccomandato in REPORT 014 §6 — source data troppo poco. Pivot a **X11 = hardening sprint consolidation** (combinato).

**Pattern memo §19 reference**: 4 lessons da REPORT 014 §5 codificate (Fast-suite tier vincente, Empirical hand-probe vincente, ADR class-of-bug §25 enumeration, CW-B47 spec wording anti-pattern). **ADR-0018** scritto enumera 10 COALESCE-UQ sys.* tables + preventive measures.

**Commitments**:
- Read PROMPT + spec autoritative
- Esegui Block A → B → C → D (sequenziali, ortogonali per scope)
- REPORT 015 + inbox notify
- Commit + push singolo bundle "X11 hardening consolidation"

---

## §1 — Capability hints

### Subagent delegation raccomandata
| Sotto-task | Subagent | Model | Razionale |
|---|---|---|---|
| Block A live audit (5-sample CW-B47 hop3) | `Explore` | haiku | atomic SQL introspect |
| Block B 10 COALESCE-UQ sweep verify | `general-purpose` | sonnet | per-table count check |
| Block C GOKMER partial (competency_review_ratings 465 + ontology_feedback 52) | inline main | opus | new mappings authoring |
| Block D CW-B36 + CW-B35 Phase B residue (32+100 rows) | `general-purpose` | haiku | UPDATE registry trivial |
| Test suite fast-tier post Block A/B/C | `general-purpose` | sonnet | parse output |

### Context budget
Total ~30-40% budget. Mega-bundle MA blocks sono atomic + ortogonali. No `/compact` necessario.

### Model tiering (vedi pattern memo §15)
- Main session orchestrator: Opus 4.7
- Forensic + verify per-table: Haiku 4.5
- Mapping authoring (Block C): Sonnet 4.6 acceptable, Opus per quality

---

## §2 — Pre-flight

```bash
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"
cd D:\heuresys-advanced && git log --oneline -3  # X10 commit visible

# Baseline counts pre-X11
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_assessments' t, COUNT(*) FROM sys.sys_assessments
UNION ALL SELECT 'sys_assessment_methods', COUNT(*) FROM sys.sys_assessment_methods
UNION ALL SELECT 'sys_assessment_results', COUNT(*) FROM sys.sys_assessment_results
UNION ALL SELECT 'sys_user_assessment_evidence', COUNT(*) FROM sys.sys_user_assessment_evidence
UNION ALL SELECT 'sys_skill_learning_mappings', COUNT(*) FROM sys.sys_skill_learning_mappings
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
UNION ALL SELECT 'sys_skill_categories', COUNT(*) FROM sys.sys_skill_categories
UNION ALL SELECT 'sys_kpi_definitions', COUNT(*) FROM sys.sys_kpi_definitions
UNION ALL SELECT 'sys_compensation_bands', COUNT(*) FROM sys.sys_compensation_bands
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users;"
```

---

## §3 — Block A: CW-B47 resolution (1h)

CW-B47 = `sys_skill_learning_mappings.skill_learning_mapping_module_id` NOT NULL semantic gap. CLI X9 ha mitigated skill_id via LOOKUP_FK_2HOP MA module_id resta blocked (course_id source-level vs module_id target-level).

### Step A.1 — 3-hop forensic verify

Test feasibility 3-hop LOOKUP per module_id:
```sql
-- Sample 5 esco_skill_uri da staging → resolve esco_skills → trovare module_id
WITH samples AS (
  SELECT staging_raw_record->>'esco_skill_uri' AS uri
    FROM staging.wave1_skill_learning_mappings
   WHERE staging_source_table = 'certification_esco_skills' LIMIT 5
)
SELECT s.uri,
       (SELECT lm.id FROM legacy_mirror.esco_skills lm WHERE lm.uri = s.uri LIMIT 1) AS esco_id,
       -- Hop 3 candidate: course_modules joining? Or learning_path_steps?
       (SELECT slr.source_lineage_target_record_id 
          FROM sys.sys_source_lineage_records slr
         WHERE slr.source_lineage_source_record_id LIKE '%' || s.uri || '%'
           AND slr.source_lineage_target_table_name = 'sys_learning_modules' LIMIT 1) AS module_id_resolved
  FROM samples s;
```

Risultato atteso: 0/5 resolve (course_id non maps a module_id direttamente — confirms residual semantic gap)

### Step A.2 — Decision matrix

Se 0/5 resolve (atteso):
- **Option A** (recommended low-risk): re-classify table_mappings (certification_esco_skills + course_esco_skills → sys_skill_learning_mappings) come `REFERENCE_ONLY` con metadata note "CW-B47 module_id semantic gap — defer to dedicated SKILGRO macro-area when source-target relation clarified"
- **Option B** (deep fix): author engine extension `LOOKUP_FK_3HOP` per resolution 3-hop (out of scope X11 — defer)

Apply Option A:
```sql
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{cw_b47_residual}',
         to_jsonb('module_id source course_id != target module_id semantic. Pending LOOKUP_FK_3HOP or SKILGRO macro-area dedicated.'::text)
       )
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_learning_mappings'
      AND st.source_table_name IN ('certification_esco_skills', 'course_esco_skills')
 );
```

### Acceptance Block A
- 2 table_mappings re-classified REFERENCE_ONLY
- Next Wave 1: `WHERE_SKIP_FILTER_EXCLUDED_V1 nk_missing_skill_learning_mapping_skill_id` drops 1381 → 0

---

## §4 — Block B: COALESCE-UQ 10 sys.* sweep verify (45 min)

Post-CW-B49 fix (X10), 10 sys.* tables con COALESCE NK UQ sono ora upsert-able. Verifica live + audit:

```sql
SELECT 'sys_career_paths' t, COUNT(*) FROM sys.sys_career_paths
UNION ALL SELECT 'sys_compensation_bands', COUNT(*) FROM sys.sys_compensation_bands
UNION ALL SELECT 'sys_kpi_definitions', COUNT(*) FROM sys.sys_kpi_definitions
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules
UNION ALL SELECT 'sys_learning_paths', COUNT(*) FROM sys.sys_learning_paths
UNION ALL SELECT 'sys_payout_curves', COUNT(*) FROM sys.sys_payout_curves
UNION ALL SELECT 'sys_skill_aliases', COUNT(*) FROM sys.sys_skill_aliases
UNION ALL SELECT 'sys_skills', COUNT(*) FROM sys.sys_skills
UNION ALL SELECT 'sys_user_auth_roles', COUNT(*) FROM sys.sys_user_auth_roles
UNION ALL SELECT 'sys_user_certifications', COUNT(*) FROM sys.sys_user_certifications;
```

Expected post-X10: sys_skill_aliases ≥80 (unlocked X10), sys_learning_paths 3354, sys_learning_modules 5052, sys_skills 20048. Le altre dipendono da legacy_mirror data presence.

Se altre 7 tables (career_paths, compensation_bands, kpi_definitions, payout_curves, skills, user_auth_roles, user_certifications) hanno COUNT > 0 → confirm X10 silent unlock.
Se 0 → confirm no source data legacy_mirror per quei targets (nothing to populate).

### Acceptance Block B
- Audit query eseguita + counts loggati
- Documenta in REPORT §3 quali sys.* effectively unlocked vs no-source-data
- NO action richiesta (verify only)

---

## §5 — Block C: GOKMER partial (517 rows, 1.5h)

Source data scarsa MA worth ship to chiudere il pattern:
- `legacy_mirror.competency_review_ratings` (465 rows) → likely sys_assessment_results
- `legacy_mirror.ontology_feedback` (52 rows) → likely sys_assessment_results or sys_user_assessment_evidence

### Step C.1 — Schema introspection LIVE

```sql
-- competency_review_ratings columns + sample row
\d legacy_mirror.competency_review_ratings
SELECT * FROM legacy_mirror.competency_review_ratings LIMIT 2;

-- Target schemas
\d sys.sys_assessment_results
\d sys.sys_user_assessment_evidence

-- ontology_feedback
\d legacy_mirror.ontology_feedback
SELECT * FROM legacy_mirror.ontology_feedback LIMIT 2;
```

### Step C.2 — SDBI pattern application

Apply Goals/OKRs C1.8 SDBI pattern condensed:
1. Identify source→target mapping (which sys.* table for which source)
2. Author column_mappings (LINEAGE_SOURCE_NK + LOOKUP_FK for FKs + JSON_EXTRACT for metadata)
3. Apply Dry-run EXPLAIN mental check (pattern memo §9 vincente 8)
4. Apply Function-level + table-level schema introspection (pattern memo §20 + CW-B25)
5. Author table_mappings + column_mappings SQL
6. Wave 1 retry

### Acceptance Block C
- 517 rows staged + ≥80% upserted (sys_assessment_results / sys_user_assessment_evidence growth)
- 0 regression on existing sys.* counts
- Bias surfacing → documented + claim numero in bias_registry

---

## §6 — Block D: CW-B35 Phase B + CW-B36 cleanup (45 min)

### CW-B35 Phase B (100 rows filter)
cross_entity_relations (85) + semantic_entity_relations (15) → sys_skill_taxonomy_edges. Source has `source_entity_type` / `target_entity_type` cols. Apply staging pre-filter:

```sql
UPDATE staging.wave1_skill_taxonomy_edges
   SET staging_validation_status = 'REFERENCE_ONLY'
 WHERE staging_source_table IN ('cross_entity_relations','semantic_entity_relations')
   AND (staging_raw_record->>'source_entity_type' != 'skill'
        OR staging_raw_record->>'target_entity_type' != 'skill');
```

Then add column_mappings (source_entity_id → parent_id LOOKUP_FK to sys_skills, target_entity_id → child_id idem) per Phase A pattern (cowork_reserved/batch_c7/forensic_cw_b35/).

### CW-B36 (competencies 32 rows fuzzy)
Apply fuzzy LOOKUP via name match to sys_skill_families: pre-staging UPDATE injecting skill_category_family_id via CASE statement (Leadership→BUS-LEAD, Interpersonal→COMM-INT, Performance→HR-PERF, Personal→COMM-INT). 4/6 matched, 2/6 (Cognitive, External) → REFERENCE_ONLY skip pattern.

### Acceptance Block D
- CW-B35 Phase B: +100 sys_skill_taxonomy_edges (or +66 dopo dedup)
- CW-B36: +28 sys_skill_categories (4/6 matched × 7 instances avg)
- Audit `nk_missing_skill_taxonomy_edge_parent_id` drops 331 → ~231 (after Phase B unlock)

---

## §7 — Halt triggers P0

| Trigger | File | Severity |
|---|---|---|
| Block A: 5/5 resolve (unexpected) — would invalidate REFERENCE_ONLY decision | `cw_b47_unexpected_resolve` | P1 |
| Block B sys_* count regression | `regression_<table>` | P0 |
| Block C: schema spec drift unexpected | `gokmer_schema_drift` | P1 |
| R-A2 sys_users < 430 | `r_a2_regression` | **P0 CRITICAL** |
| Wave 1 retry > 90 min | `wave1_timeout` | P1 |
| Test regression > 5 new failures | `test_regression_x11` | P1 |

---

## §8 — REPORT format

`cowork_code_exchange/_04_REPORT_015_batch_x11.md`. Structure:

```
§0 Pre-conditions + baseline
§1 Block A outcomes (CW-B47 REFERENCE_ONLY)
§2 Block B outcomes (10 COALESCE-UQ sweep verify counts)
§3 Block C outcomes (GOKMER partial 517 rows)
§4 Block D outcomes (CW-B35 Phase B + CW-B36 fuzzy)
§5 Audit forensics post-X11
§6 Bias catalog updates (CW-B50+ if surfaced)
§7 Cowork spec improvements suggested
§8 Next step recommendation for Cowork batch C12
```

Emit `report_ready` inbox notify.

---

## §9 — Reference files

| Path | Purpose |
|---|---|
| `docs/architecture/adr/0018_coalesce_uq_class_of_bug.md` | Block B sweep context (NEW) |
| `cowork_reserved/batch_c7/forensic_cw_b35/` | Block D Phase B pattern reference |
| `cowork_reserved/batch_c7/forensic_cw_b36/` | Block D CW-B36 fuzzy pattern |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §19 | Pattern memo X10 lessons (Fast-suite, hand-probe, ADR class-of-bug) |

---

## §10 — Post-X11 expected outlook

- sys.* populated: 60/128 → **~62-64/128** (+1 sys_assessment_results + ev. growth other COALESCE tables)
- Engine bias catalog: 49 stable
- ADR accepted: 17 (+ADR-0018)
- Macro-aree shipped: 2/11 + partial GOKMER (517 rows worth)
- CW-B47 retired (REFERENCE_ONLY)
- CW-B35 Phase B closed
- CW-B36 closed

**Post-X11 reality check**: SDBI roadmap revisiona stato — source data limit per macro-aree future (H2R, TALPIPE, PULSAR, SMERTO grosse) richiede strategia diversa. Possibly conclude SDBI phase + pivot a MVP-2 frontend (HANDOFF.md priorities).

Sources future macro-aree NON-SDBI:
- API integration (data fresh da partner systems)
- Manual taxonomy work (Enzo team curation)
- AI inference / synthesis from existing canonical data

Discutere strategia post-X11 in batch C12.

---

Cowork standing by per REPORT 015. Halt+escalate via inbox solo P0 §7. Buon lavoro.

---

*End PROMPT 015*
