# PROMPT 011 — CLI Batch X7 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: Hardening sprint — CW-B35 Import Gap fix + CW-B36/B37 Mapping Misclassification triage + trivial test fix
**Expected duration**: 1.5-3h CLI continuous
**Authored**: 2026-05-21T13:50Z by Cowork (batch C7)
**Predecessor**: REPORT X6.A (`cowork_code_exchange/_04_REPORT_009_batch_x6a.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C7 has reviewed REPORT X6.A audit forensics §4 + completed forensic deep-dive on the 3 new bias candidates (CW-B35/B36/B37) surfaced post-CW-B34 unlock.

**X6.A outcome recap**:
- ✅ CW-B34 engine patch landed — `sys_esco_occupation_mappings` 0 → 7645 (154% over target)
- ✅ ADR-0016 ACCEPTED (status update committed by you in `eb48998`)
- ✅ `buildNkJoinPredicate` extension scope-creep (lineage JOIN-back COALESCE) preserved — lineage_rows = 11256
- ✅ X5.B parallel session in progress (Time/Leave + sys_users HYBRID)
- 🆕 3 new bias candidates surfaced in audit §4 — Cowork C7 forensic complete

**Cowork C7 deliverables ready**:
- ✅ `cowork_reserved/batch_c7/forensic_cw_b35/01_CW_B35_FORENSIC.md` — Import Mapping Gap, 17609 unlockable rows
- ✅ `cowork_reserved/batch_c7/forensic_cw_b36/01_CW_B36_FORENSIC.md` — Mapping Misclassification, re-classify REFERENCE_ONLY
- ✅ `cowork_reserved/batch_c7/forensic_cw_b37/01_CW_B37_FORENSIC.md` — LOOKUP_FK Payload Bug + Import Gap split, partial fix + defer
- ✅ `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §11 added (Lineage JOIN-back vincente + CW-B35/36/37 anti-patterns + Audit forensic vincente)
- ✅ `apps/api/test/transform-compiler.test.ts:516` trivial fix applied (expect 15→16 + CAST_ENUM in array) — VERIFY ONLY

**Your X7 work** (3 blocks + verify):
- **Block A (P1, ~1h)**: CW-B35 Action A — add 10 column_mappings (5 CLEAN sources × 2 cols) with LOOKUP_FK for sys_skill_taxonomy_edges
- **Block B (P2, ~15min)**: CW-B36 Action A — re-classify skill_classifications + ontology_categories table_mappings as REFERENCE_ONLY
- **Block C (P2, ~10min)**: CW-B37 Action A — re-classify job_title_courses table_mapping as REFERENCE_ONLY (CW-B37 deep fix deferred to X9 SKILGRO)
- **Verify**: transform-compiler.test.ts trivial fix (already authored by Cowork) — run vitest to confirm green
- **Wave 1 retry + acceptance verify**

**Commitments** (same as before):
- Read PROMPT in full + 3 forensic spec files
- Execute Block A → B → C sequenziali (single session OK, total ~1.5-2h)
- Halt+escalate via `cowork_code_exchange/.inbox/cowork/pending/<TS>_011_halt_<reason>.md`
- Write REPORT `cowork_code_exchange/_04_REPORT_011_batch_x7.md` + inbox notify
- Commit + push autorizzato come singolo bundle "X7 hardening CW-B35/36/37 + trivials"

**Critical thinking INVITED** (pattern §9 #5 + §11 #5):
- Block A: spec ha LOOKUP_FK payload structure derived from existing X3 cascade patterns. Verify against live brownfield.column_mappings actual payload keys before INSERT. If payload schema differs → adapt + document in REPORT §5.
- Block B/C: re-classify is trivial UPDATE. Verify `table_mapping_id` resolves uniquely (use the JOIN-on-source query in spec).
- If during Block A you notice that DISTINCT ON CW-B31 dedup interaction with new column_mappings produces unexpected rejections, halt+escalate `dedup_interaction_<source>` rather than improvise.

---

## §1 — Executive briefing

### §1.1 Current state post-X6.A + X5.B in flight

| Metric | Post-X6.A | X5.B (in flight) | X7 target | X7 acceptance |
|---|---|---|---|---|
| sys.* populated tables | 52/128 | +3 Time/Leave + sys_users → 56/128 | +2-3 (skill_taxonomy_edges + cleanup) | 58-60/128 |
| sys_job_roles | 202 | preserved | preserved | ✅ no regression |
| sys_esco_occupation_mappings | 7645 | preserved | preserved | ✅ no regression |
| sys_skill_taxonomy_edges | 0 | preserved | **≥14000** | unlock |
| audit `nk_missing_skill_taxonomy_edge_parent_id` | 17924 | preserved | **≤300** | drop 98%+ |
| audit `required_missing_skill_category_family_id` | 7256 | preserved | **≤41** | drop 99%+ (re-classify 7215) |
| audit `nk_null_skill_learning_mapping_skill_id` | 207 | preserved | **0** | drop 100% (re-classify) |
| Engine bias catalog | 34 | preserved | 37 (CW-B35/36/37 mitigated/documented) | tracking |

### §1.2 Decisions locked Enzo (no further confirmation)

| Decision | Status | Reference |
|---|---|---|
| CW-B35 Action A (10 column_mappings INSERT) | APPROVED (Cowork-authored, evidence 5/5 lineage PASS) | `cowork_reserved/batch_c7/forensic_cw_b35/` |
| CW-B36 Action A (re-classify skill_classifications + ontology_categories REFERENCE_ONLY) | APPROVED | `cowork_reserved/batch_c7/forensic_cw_b36/` |
| CW-B37 Action A (re-classify job_title_courses REFERENCE_ONLY) | APPROVED | `cowork_reserved/batch_c7/forensic_cw_b37/` |
| CW-B35 Phase B+C (heterogeneous + defer) | DEFERRED to C8 polishing | — |
| CW-B37 deep fix (esco_skill_uri 2-hop LOOKUP) | DEFERRED to X9 SKILGRO macro-area | — |
| transform-compiler.test.ts:516 expect 16 | DONE by Cowork — CLI verify only | — |
| `endsWith('_tenant_id')` retention vs removal | RETENTION (per REPORT 009 §6.a CLI raccomandato) | — |

---

## §2 — Pre-flight

### §2.1 Connectivity
```bash
# SSH tunnel
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Last commit
cd D:\heuresys-advanced && git log --oneline -3
# Expected: eb48998 (X6.A) + possibly X5.B descendants visible
```

### §2.2 Live baseline (record in REPORT §0)

```sql
SELECT 'sys_skill_taxonomy_edges' AS t, COUNT(*) FROM sys.sys_skill_taxonomy_edges
UNION ALL SELECT 'sys_skill_categories', COUNT(*) FROM sys.sys_skill_categories
UNION ALL SELECT 'sys_skill_learning_mappings', COUNT(*) FROM sys.sys_skill_learning_mappings
UNION ALL SELECT 'sys_skill_families (parent)', COUNT(*) FROM sys.sys_skill_families
UNION ALL SELECT 'sys_skills (parent)', COUNT(*) FROM sys.sys_skills;
```

---

## §3 — Block A: CW-B35 fix (P1, ~1h)

**Spec authoritative**: `cowork_reserved/batch_c7/forensic_cw_b35/01_CW_B35_FORENSIC.md` §6 Phase A.

**Goal**: add 10 column_mappings (5 sources × 2 cols) to populate `skill_taxonomy_edge_parent_id` + `child_id` via LOOKUP_FK with lineage resolution.

### §3.A.1 Verify LOOKUP_FK payload schema (CW-B33 mitigation — Dry-run pre-INSERT)

Check existing LOOKUP_FK payload structure in registry (from X3 cascade fixes pattern):

```sql
SELECT cm.column_mapping_transform_payload
  FROM brownfield.column_mappings cm
 WHERE cm.column_mapping_transform = 'LOOKUP_FK'
 LIMIT 5;
```

Note the exact keys used (`lookup_table`, `lookup_strategy`, `lineage_source_table` or other). Use these EXACT keys in your INSERTs to avoid payload-key drift.

### §3.A.2 Author SQL file

**File**: `db/seeds/brownfield/wave2/cw_b35_fix/01_skill_taxonomy_edges_lookup_fks.sql` (NEW)

Pattern (adapt payload keys per §3.A.1 finding):

```sql
-- =============================================================================
-- CW-B35 fix: add 10 LOOKUP_FK column_mappings for sys_skill_taxonomy_edges
-- 5 CLEAN sources × 2 NK cols (parent_id + child_id)
-- Idempotent: WHERE NOT EXISTS check on (table_mapping_id, source_column_id)
-- =============================================================================

BEGIN;

-- 5 sources: skill_adjacencies, esco_skill_relations, ontology_skill_relations,
--           skill_relationships, skill_pair_usage
-- Mapping per source: parent_id col ← child_id col

WITH source_configs AS (
  SELECT 'skill_adjacencies'        AS src, 'skill_id'         AS parent_col, 'adjacent_skill_id' AS child_col
  UNION ALL
  SELECT 'esco_skill_relations',         'source_skill_id',         'target_skill_id'
  UNION ALL
  SELECT 'ontology_skill_relations',     'source_skill_id',         'target_skill_id'
  UNION ALL
  SELECT 'skill_relationships',          'source_skill_id',         'target_skill_id'
  UNION ALL
  SELECT 'skill_pair_usage',             'skill_id_1',              'skill_id_2'
)
INSERT INTO brownfield.column_mappings (
  column_mapping_table_mapping_id,
  column_mapping_source_column_id,
  column_mapping_target_column,
  column_mapping_transform,
  column_mapping_transform_payload
)
SELECT tm.table_mapping_id,
       sc.source_column_id,
       'skill_taxonomy_edge_parent_id',
       'LOOKUP_FK',
       jsonb_build_object(
         'lookup_table', 'sys_skills',
         'lookup_strategy', 'lineage',
         'lineage_source_table', sg.src,
         'note', 'CW-B35 fix — resolve legacy skill UUID → sys_skills.skill_id via lineage'
       )
  FROM source_configs sg
  JOIN brownfield.table_mappings tm ON tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
                                    AND st.source_table_name = sg.src
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
                                     AND sc.source_column_name = sg.parent_col
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
      AND cm.column_mapping_source_column_id = sc.source_column_id
      AND cm.column_mapping_target_column = 'skill_taxonomy_edge_parent_id'
 );

-- Repeat block for child_id (same pattern, child_col)
INSERT INTO brownfield.column_mappings (
  column_mapping_table_mapping_id,
  column_mapping_source_column_id,
  column_mapping_target_column,
  column_mapping_transform,
  column_mapping_transform_payload
)
SELECT tm.table_mapping_id,
       sc.source_column_id,
       'skill_taxonomy_edge_child_id',
       'LOOKUP_FK',
       jsonb_build_object(
         'lookup_table', 'sys_skills',
         'lookup_strategy', 'lineage',
         'lineage_source_table', sg.src,
         'note', 'CW-B35 fix — resolve legacy skill UUID → sys_skills.skill_id via lineage'
       )
  FROM (VALUES
    ('skill_adjacencies', 'adjacent_skill_id'),
    ('esco_skill_relations', 'target_skill_id'),
    ('ontology_skill_relations', 'target_skill_id'),
    ('skill_relationships', 'target_skill_id'),
    ('skill_pair_usage', 'skill_id_2')
  ) AS sg(src, child_col)
  JOIN brownfield.table_mappings tm ON tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
                                    AND st.source_table_name = sg.src
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
                                     AND sc.source_column_name = sg.child_col
 WHERE NOT EXISTS (
   SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
      AND cm.column_mapping_source_column_id = sc.source_column_id
      AND cm.column_mapping_target_column = 'skill_taxonomy_edge_child_id'
 );

-- Verify exactly 10 new rows added
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.column_mappings cm
    JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
   WHERE tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
     AND cm.column_mapping_target_column IN ('skill_taxonomy_edge_parent_id','skill_taxonomy_edge_child_id')
     AND cm.column_mapping_transform_payload->>'note' LIKE 'CW-B35%';
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'CW-B35 fix expected 10 new column_mappings, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B35 column_mappings inserted: %', v_count;
END $$;

COMMIT;
```

### §3.A.3 Apply + verify

```bash
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -v ON_ERROR_STOP=1 \
  -f db/seeds/brownfield/wave2/cw_b35_fix/01_skill_taxonomy_edges_lookup_fks.sql
```

### §3.A.4 Wave 1 retry

```bash
cd apps/api && pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
```

### §3.A.5 Acceptance

```sql
SELECT COUNT(*) FROM sys.sys_skill_taxonomy_edges;
-- Pre-X7: 0 → Post-X7: ≥14000 (80% of 17609 estimated post-dedup)

SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X7_runId>'
   AND import_validation_result_payload->>'target_table' = 'sys_skill_taxonomy_edges'
 GROUP BY 1;
-- Expected: nk_missing_skill_taxonomy_edge_parent_id ≤ 300 (only HETEROGENEOUS + DEFER sources remain)
```

If sys_skill_taxonomy_edges < 10000 → halt+escalate `cw_b35_unexpected_low_unlock`.

---

## §4 — Block B: CW-B36 fix (P2, ~15min)

**Spec authoritative**: `cowork_reserved/batch_c7/forensic_cw_b36/01_CW_B36_FORENSIC.md` §4 Action A.

**File**: `db/seeds/brownfield/wave2/cw_b36_fix/01_skill_categories_reclassify.sql` (NEW)

```sql
BEGIN;

-- Re-classify skill_classifications + ontology_categories as REFERENCE_ONLY for sys_skill_categories
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_rationale = 'CW-B36 (Cowork batch C7.2): source semantics differ from sys_skill_categories target. Re-classified pending dedicated SKILGRO macro-area (X9). See cowork_reserved/batch_c7/forensic_cw_b36/.'
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_categories'
      AND st.source_table_name IN ('skill_classifications','ontology_categories')
 );

-- Verify 2 rows updated
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_skill_categories'
     AND st.source_table_name IN ('skill_classifications','ontology_categories')
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CW-B36 fix expected 2 rows REFERENCE_ONLY, got %', v_count;
  END IF;
END $$;

COMMIT;
```

Apply + verify. competencies (32 rows) STAYS APPROVED (low-volume, defer to C8 polishing).

### §4.B Acceptance
```sql
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X7_runId>'
   AND import_validation_result_payload->>'target_table' = 'sys_skill_categories'
   AND exclusion_reason LIKE 'required_missing_skill_category_family_id%'
 GROUP BY 1;
-- Expected: ≤ 32 (competencies only, ontology_categories + skill_classifications now REFERENCE_ONLY)
```

---

## §5 — Block C: CW-B37 fix (P2, ~10min)

**Spec authoritative**: `cowork_reserved/batch_c7/forensic_cw_b37/01_CW_B37_FORENSIC.md` §4 Action A.

**File**: `db/seeds/brownfield/wave2/cw_b37_fix/01_skill_learning_reclassify.sql` (NEW)

```sql
BEGIN;

UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_rationale = 'CW-B37 (Cowork batch C7.3): LOOKUP_FK payload {match_on:skill_name} unresolvable — staging_raw_record has only course_id. Semantically belongs to sys_job_role_skill_mappings (ciclo X10 H2R or X12 TALPIPE). See cowork_reserved/batch_c7/forensic_cw_b37/.'
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_learning_mappings'
      AND st.source_table_name = 'job_title_courses'
 );

-- Verify 1 row updated
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_skill_learning_mappings'
     AND st.source_table_name = 'job_title_courses'
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CW-B37 fix expected 1 row REFERENCE_ONLY, got %', v_count;
  END IF;
END $$;

COMMIT;
```

### §5.C Acceptance
```sql
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X7_runId>'
   AND import_validation_result_payload->>'target_table' = 'sys_skill_learning_mappings'
 GROUP BY 1;
-- Expected: nk_null_skill_learning_mapping_skill_id = 0 (job_title_courses no longer in pipeline)
-- Expected: nk_missing_skill_learning_mapping_skill_id = 1381 (certification + course esco unchanged — deferred X9)
```

---

## §6 — Verify Cowork-authored trivial fix

Cowork has already edited `apps/api/test/transform-compiler.test.ts:515-516`:
- Expectation 15 → 16
- Added "CAST_ENUM" to the loop array

**Verify** the test now passes:

```bash
cd apps/api
pnpm exec vitest run test/transform-compiler.test.ts -t "contains exactly 16 entries"
# Expected: 1/1 PASS
```

If FAIL — investigate diff vs current SUPPORTED_TRANSFORMS export. Halt+escalate `trivial_fix_unexpected_fail`.

Full suite verification post all blocks:
```bash
cd apps/api && pnpm test
# Expected: 326/333 PASS OR better. NO new regressions.
```

---

## §7 — Halts + escalation triggers

| Trigger | File | Severity |
|---|---|---|
| Block A retry: sys_skill_taxonomy_edges < 10000 | `cw_b35_unexpected_low_unlock` | P1 |
| Block A: 5/5 lineage resolution check fails at apply time | `cw_b35_lineage_phantom` | P1 |
| Block B: UPDATE affects ≠ 2 rows | `cw_b36_update_mismatch` | P1 |
| Block C: UPDATE affects ≠ 1 row | `cw_b37_update_mismatch` | P1 |
| Trivial test fix verify FAIL | `trivial_fix_unexpected_fail` | P2 |
| Wave 1 retry wall-clock > 90 min | `wave1_timeout` | P1 |
| Test suite > 5 new failures | `test_regression_x7` | P1 |
| Any sys_*esco/job_roles/users regression | `regression_<table>` | **P0** |

---

## §8 — REPORT format

Final REPORT at `cowork_code_exchange/_04_REPORT_011_batch_x7.md`. Structure:

```
§0 Pre-conditions + live baseline
§1 Block A outcomes (CW-B35 fix)
  §1.A.1 LOOKUP_FK payload schema verified
  §1.A.2 SQL file authored + applied
  §1.A.3 Wave 1 retry runId + wall-clock
  §1.A.4 Acceptance (sys_skill_taxonomy_edges count + audit exclusion delta)
§2 Block B outcomes (CW-B36 fix)
§3 Block C outcomes (CW-B37 fix)
§4 Trivial test fix verification
§5 Audit forensics post-X7 (CW-B38+ candidates?)
§6 Bias catalog updates
§7 Cowork spec improvements suggested
§8 Feedback sul modello operativo Cowork↔CLI
§9 Next step recommendation for Cowork batch C8
```

Emit `report_ready` inbox at end: `cowork_code_exchange/.inbox/cli/pending/<TS>_011__report_ready.md`.

---

## §9 — Critical thinking invitation (continue X4.A + X6.A pattern)

Per Cowork pattern memo §11 #5 vincente "Audit forensic":
- Post-X7 Wave 1 retry, **run the audit distribution query**:
  ```sql
  SELECT exclusion_reason, COUNT(*)
    FROM audit.import_validation_results
   WHERE import_validation_result_run_id = '<X7_runId>'
   GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
  ```
- Surface CW-B38/B39/B40 candidates in REPORT §5 if HIGH-volume new reasons emerge
- Skill taxonomy unlock may surface downstream cascade gaps (e.g. `sys_skills.skill_category_id` requirements changes once edges resolve)

**Cowork commitments for X7**:
- Spec authoring against LIVE introspection (CW-B25 maintained)
- 5-sample lineage resolution verified for CW-B35 (5/5 PASS)
- Pattern memo §11 added with 3 new anti-patterns + 2 vincenti

---

## §10 — Reference files (Cowork-authored, ready for your use)

| Path | Purpose |
|---|---|
| `cowork_reserved/batch_c7/forensic_cw_b35/01_CW_B35_FORENSIC.md` | Block A spec (full) |
| `cowork_reserved/batch_c7/forensic_cw_b36/01_CW_B36_FORENSIC.md` | Block B spec |
| `cowork_reserved/batch_c7/forensic_cw_b37/01_CW_B37_FORENSIC.md` | Block C spec |
| `apps/api/test/transform-compiler.test.ts` | Trivial fix already applied (verify only) |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §11 | Anti-pattern + vincenti catalog (NEW 3+2) |
| `cowork_code_exchange/_04_REPORT_009_batch_x6a.md` | X6.A REPORT (predecessor) |

---

Cowork standing by per review post-REPORT 011. Halt+escalate via inbox su any §7 trigger. Buon lavoro.

---

*End PROMPT 011*
