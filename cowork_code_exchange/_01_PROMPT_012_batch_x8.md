# PROMPT 012 — CLI Batch X8 (self-contained briefing)

**Protocol**: Cowork↔CLI v2.2 batch mode
**Scope**: Hardening sprint short — CW-B38 audit clean + CW-B39 REFERENCE_ONLY cleanup
**Expected duration**: 30-60 min CLI continuous (lightweight batch)
**Authored**: 2026-05-21T17:30Z by Cowork (batch C8)
**Predecessor**: REPORT X7 (`cowork_code_exchange/_04_REPORT_011_batch_x7.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C8 has reviewed REPORT X5.B + X7 + completed:
- Bias registry SoT (CW-B41..B45 riconciliazione retroattiva da REPORT 010)
- CW-B38 generalization audit (live verified — only sys_esco vulnerabile + già fixed X7)
- CW-B39 forensic (688 rows learning domain mismatch — defer X9 SKILGRO + tactical cleanup)
- Pattern memo §12 updated (20 anti + 15 vincenti — Inline Mitigation Scope + UPDATE-in-place + Bias Registry)

**Cowork C8 deliverables ready**:
- ✅ `cowork_reserved/bias_registry.md` — SoT 45 bias catalogati + race condition protocol
- ✅ `cowork_reserved/batch_c8/cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md` — audit clean evidence
- ✅ `cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md` — 688 rows defer-to-X9 tactical cleanup
- ✅ `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §12 (5 new anti + 3 new vincenti)

**Your X8 work** (2 blocks short):
- **Block A** (~20 min): CW-B38 audit verify + idempotent re-run check
- **Block B** (~15 min): CW-B39 REFERENCE_ONLY cleanup (course_modules + learning_path_courses → sys_learning_path_steps)
- **Wave 1 retry + acceptance**

**Commitments** (same):
- Read PROMPT + 2 spec files
- Halt+escalate via inbox
- Write REPORT `cowork_code_exchange/_04_REPORT_012_batch_x8.md` + inbox notify
- Commit + push autorizzato come singolo bundle "X8 CW-B38 audit + CW-B39 cleanup"

**Critical thinking INVITED** (pattern memo §13 "Inline Mitigation Scope"):
- Block A is verification-only — if audit finds NEW unexpected vulnerabilities (other nullable NK UUID cols missing NULLS NOT DISTINCT) → halt+escalate `cw_b38_new_vulnerability_<table>`
- Block B is registry UPDATE — if 2 sources expected but find 1 (or 3+), halt+escalate `cw_b39_unexpected_source_count`

---

## §1 — Executive briefing

### §1.1 Current state post-X7

| Metric | Value |
|---|---|
| sys.* populated tables | 59/128 (46%) |
| sys_job_roles | 202 |
| sys_esco_occupation_mappings | 7645 (CW-B38 mitigated via mig 000042) |
| sys_users | 433 |
| Time/Leave cumulative | 6220 |
| sys_skill_taxonomy_edges | 11965 |
| Engine bias catalog | 45 (riconciliato post C8.1) |
| Migrations applied | 000042 |
| ADR accepted | 15 |

### §1.2 Decisions locked (no further confirmation)

| Decision | Status | Reference |
|---|---|---|
| CW-B38 audit clean (no migrations needed) | VERIFIED Cowork C8.2 (live audit) | spec §2 |
| CW-B39 Action A (course_modules + learning_path_courses REFERENCE_ONLY) | APPROVED | forensic §5 |
| CW-B39 deep fix (learning domain) | DEFERRED to X9 SKILGRO | — |
| Pattern memo §12 updates | LOCKED | memo §12 |
| Bias registry SoT protocol | LOCKED (cowork_reserved/bias_registry.md) | — |

---

## §2 — Pre-flight

```bash
# SSH tunnel + DB
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Last commit
cd D:\heuresys-advanced && git log --oneline -3
# Expected: X7 bundle commit visible

# Live baseline
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_esco_occupation_mappings' AS t, COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_learning_path_steps', COUNT(*) FROM sys.sys_learning_path_steps;
"
# Expected: sys_esco=7645, sys_learning_path_steps=0
```

---

## §3 — Block A: CW-B38 audit verify (~20 min)

**Spec authoritative**: `cowork_reserved/batch_c8/cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md` §5 acceptance.

### §3.A.1 Re-run audit query

```sql
SELECT n.nspname, c.relname AS table_name,
       i.indexrelid::regclass::text AS uq_index,
       i.indnullsnotdistinct
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'sys' AND i.indisunique AND NOT i.indisprimary
   AND EXISTS (
     SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = c.oid AND a.attnum = ANY(string_to_array(i.indkey::text, ' ')::int[])
        AND a.attnum > 0 AND NOT a.attnotnull
        AND format_type(a.atttypid, NULL) = 'uuid'
   );
```

**Expected result**: 1 row only (`sys_esco_occupation_mappings_pair_uq`, `indnullsnotdistinct=t`).

**If unexpected rows surface** (e.g. new nullable NK UUID col without NULLS NOT DISTINCT): **halt+escalate** `cw_b38_new_vulnerability_<table>`.

### §3.A.2 Idempotent migration re-run

```bash
cd D:\heuresys-advanced
pnpm db:migrate
# Expected: no-op (000042 already in sys.sys_schema_migrations)
```

### §3.A.3 Wave 1 retry × 2 (verify NULLS NOT DISTINCT works)

```bash
cd apps/api && pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
# Capture runId_1

# After first retry completes:
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings;"
# Expected: 7645 (preserved)

# Run again:
cd apps/api && pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
# Capture runId_2

psql -h localhost -p 5433 -U heuresys -d heuresys_advanced \
  -c "SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings;"
# Expected: STILL 7645 (no cross-run duplicate emission)
```

If count diverges (e.g. 15290) → halt+escalate `cw_b38_regression_post_audit`.

---

## §4 — Block B: CW-B39 REFERENCE_ONLY cleanup (~15 min)

**Spec authoritative**: `cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md` §5 Action.

### §4.B.1 Apply SQL

**File**: `db/seeds/brownfield/wave2/cw_b39_fix/01_learning_path_steps_reclassify.sql` (NEW)

Use spec §5 SQL verbatim:

```sql
BEGIN;

UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-B39 (Cowork batch C8.3): learning domain architectural mismatch. course_modules + learning_path_courses cannot resolve module_id via current sys_learning_modules lineage (sourced from analytics, not canonical courses). Defer to X9 SKILGRO holistic rebuild.'::text)
       )
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
      AND st.source_table_name IN ('course_modules','learning_path_courses')
 );

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
     AND st.source_table_name IN ('course_modules','learning_path_courses')
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CW-B39 expected 2 rows REFERENCE_ONLY, got %', v_count;
  END IF;
END $$;

COMMIT;
```

Apply via psql.

### §4.B.2 Wave 1 retry verify

Wave 1 retry already in §3.A.3 runId_2 covers Block B too. Verify audit:

```sql
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X8_runId_2>'
   AND import_validation_result_payload->>'target_table' = 'sys_learning_path_steps'
 GROUP BY 1;
-- Expected: 0 rows (both sources REFERENCE_ONLY → out of Wave 1 pipeline)
```

### §4.B.3 Audit forensics full distribution

```sql
SELECT exclusion_reason, COUNT(*)
  FROM audit.import_validation_results
 WHERE import_validation_result_run_id = '<X8_runId_2>'
   AND import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1'
 GROUP BY 1
 ORDER BY 2 DESC LIMIT 15;
```

Surface any NEW high-volume reasons (>500 rows) in REPORT §5.

---

## §5 — Halts + escalation

| Trigger | File | Severity |
|---|---|---|
| Block A audit: new nullable NK UUID col without NULLS NOT DISTINCT | `cw_b38_new_vulnerability_<table>` | P0 |
| Block A: sys_esco regression post-double-Wave1 (count ≠ 7645) | `cw_b38_regression_post_audit` | P0 |
| Block B: UPDATE row count ≠ 2 | `cw_b39_unexpected_source_count` | P1 |
| Any sys_* table count regression | `regression_<table>` | P0 |

---

## §6 — REPORT format

Final REPORT at `cowork_code_exchange/_04_REPORT_012_batch_x8.md`. Structure:

```
§0 Pre-conditions + live baseline
§1 Block A outcomes (CW-B38 audit verify)
  §1.A.1 Audit query result
  §1.A.2 Idempotent migration check
  §1.A.3 Wave 1 retry × 2 + count comparison
§2 Block B outcomes (CW-B39 cleanup)
  §2.B.1 UPDATE applied
  §2.B.2 Audit verification post-cleanup
§3 Audit forensics post-X8 (new bias candidates if surfaced)
§4 Pattern memo §12 cross-check (CLI feedback on Cowork additions)
§5 Cowork spec improvements suggested (post-X8)
§6 Next step recommendation for Cowork batch C9 / X9 SKILGRO planning
```

Emit `report_ready` inbox at end: `cowork_code_exchange/.inbox/cli/pending/<TS>_012__report_ready.md`.

---

## §7 — Reference files (Cowork-authored)

| Path | Purpose |
|---|---|
| `cowork_reserved/bias_registry.md` | SoT 45 bias + race condition protocol |
| `cowork_reserved/batch_c8/cw_b38_generalization/01_CW_B38_GENERALIZATION_SPEC.md` | Block A spec |
| `cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md` | Block B spec |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §12 | Pattern memo (5 new anti + 3 new vincenti) |
| `cowork_code_exchange/_04_REPORT_011_batch_x7.md` | X7 REPORT (predecessor) |

---

## §8 — Post-X8 outlook (Cowork C9 + X9 SKILGRO)

Post-X8 stato atteso: 59/128 sys.* populated (no new tables unlocked, only audit cleanup). Engine + framework hardened, ready per macro-area runs.

**Prossimo grosso passo strategico**: X9 SKILGRO (Skills/Learning Loop macro-area) dedicated batch. Scope:
- Re-design canonical source for sys_learning_modules (probably `courses` table)
- Resolve course_modules → sys_learning_modules correct mapping
- 2-hop LOOKUP_FK transform design (ADR-NNNN) for module_id resolution
- Re-trigger sys_learning_path_steps con corrected lineage
- Skills/Learning bias bulk closure (CW-B35 Phase B/C + CW-B37 deep fix + CW-B39 architectural)

Estimated X9 effort: 6-10h CLI active + dedicated Cowork C9 batch (3-4h authoring). Significant unlock potential: ~5000-10000 rows in sys_learning_modules + sys_learning_path_steps + sys_skill_learning_mappings.

---

Cowork standing by per review post-REPORT 012. Halt+escalate via inbox su §5 trigger. Buon lavoro.

---

*End PROMPT 012*
