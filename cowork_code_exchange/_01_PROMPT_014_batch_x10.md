# PROMPT 014 — CLI Batch X10 (CW-B49 engine fix + Block B/C unlock retry)

**Protocol**: Cowork↔CLI v2.2 semplificato (skip PLAN/EXEC, direct REPORT)
**Scope**: 3 block: A) CW-B49 fix engine (upsert-sql split-on-COALESCE bug) | B) Wave 1 retry verify B/C unlock | C) Pattern memo cross-check
**Expected duration**: 2-3h CLI
**Authored**: 2026-05-23T15:00Z by Cowork (batch C10)
**Predecessor**: REPORT 013 X9 SKILGRO (`_04_REPORT_013_batch_x9.md`)

---

## §0 — Identity + role + commitments

You are Claude Code CLI on Windows. Cowork batch C10 ha completato forensic CW-B49 + identificato root cause (split-on-COALESCE bug in `upsert-sql.ts:661`) + scritto patch spec.

**Pattern memo §16 (NEW)**: `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` aggiornato con CW-B46/47/48/49 + 2 nuovi vincenti (Document residual + Function-level schema introspection).

**Bias registry**: 49 catalogati (CW-B17→CW-B49). Next available CW-B50.

**Inline Mitigation Scope §13** ampliato vale come da pattern memo. Halt SOLO P0.

**Commitments**:
- Read PROMPT + spec autoritativa `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md` (full forensic + patch design)
- Esegui Block A → B → C
- REPORT 014 `cowork_code_exchange/_04_REPORT_014_batch_x10.md` + inbox notify
- Commit + push singolo bundle "X10 CW-B49 engine fix + unlock"

---

## §1 — Capability hints (CLI architecture utilization)

### Subagent delegation raccomandata

| Sotto-task | Subagent | Model | Razionale |
|---|---|---|---|
| Block A patch spec validation (read CW_B49_ROOT_CAUSE spec) | inline main session | opus | critical code change, needs main context |
| Pre-flight verify (live DB exclusion reasons distribution) | `general-purpose` | haiku | atomic GROUP BY query |
| Unit test authoring (4 cases COALESCE handling) | inline main session | opus | code generation requires reasoning |
| Full suite vitest run + parse | `general-purpose` | sonnet | test output parsing |
| Wave 1 retry monitoring (DB poll loop) | `general-purpose` | haiku | trivial polling |
| Post-retry audit forensic | `general-purpose` | haiku | GROUP BY single query |

### Context budget guidance

Block A è core engine code change (~30-50 LOC patch + 4 unit tests). Block B è Wave 1 retry monitoring + verification. Block C è pattern cross-check (lightweight).

Total estimate ~30-40% context budget main. No `/compact` necessary.

---

## §2 — Pre-flight

```bash
# Connectivity
ssh -fN -L 5433:localhost:5432 oracle-vm-default
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "SELECT NOW()"

# Last commit (X9 bundle)
cd D:\heuresys-advanced && git log --oneline -3
# Spec
ls cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md

# Baseline counts (per regression detection)
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -c "
SELECT 'sys_learning_paths' t, COUNT(*) FROM sys.sys_learning_paths
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules
UNION ALL SELECT 'sys_skill_learning_mappings', COUNT(*) FROM sys.sys_skill_learning_mappings
UNION ALL SELECT 'sys_skill_taxonomy_edges', COUNT(*) FROM sys.sys_skill_taxonomy_edges
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users
UNION ALL SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles
UNION ALL SELECT 'sys_skills', COUNT(*) FROM sys.sys_skills;"
```

---

## §3 — Block A: CW-B49 engine patch (1-1.5h)

**Spec autoritativa**: `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md` §4 (patch design).

### §3.A.1 Apply patch upsert-sql.ts:661-667

Locate `const conflictKeyCols = conflictInference.split(",")...` block. Replace with parenthesis-aware substring substitution (spec §4 verbatim):

```typescript
// CW-B49 fix: conflictInference may contain expressions with internal commas
// (e.g. COALESCE(col, sentinel)). Naive split(",") corrupts the expression.
// Instead, replace bare target column references with their staging expressions.
let conflictKeyExprs = conflictInference;
for (const entry of colEntries) {
  // Match target col name as whole word (word boundary), replace with parenthesized SQL.
  const re = new RegExp(
    `\\b${entry.targetCol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
    'g'
  );
  conflictKeyExprs = conflictKeyExprs.replace(re, `(${entry.sql})`);
}
```

Remove the old `conflictKeyCols.map(...).join(", ")` block.

### §3.A.2 Verify dry-run mental

Per sys_learning_paths:
- Input: `COALESCE(learning_path_tenant_id, '00000000-...'::uuid), learning_path_code`
- colEntries include `learning_path_tenant_id` (sql: `NULL::uuid` injected via CW-B34) + `learning_path_code` (sql: TRIM expression)
- Output: `COALESCE((NULL::uuid), '00000000-...'::uuid), (TRIM(staging_raw_record->>'code'))`
- DISTINCT ON valid ✅

Per sys_skill_taxonomy_edges (regression check):
- Input: `skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id, skill_taxonomy_edge_kind`
- Output: `(LOOKUP_FK_2HOP(...)), (LOOKUP_FK_2HOP(...)), ('IS_A'::varchar)`
- DISTINCT ON valid ✅ (semantically identical to pre-patch)

### §3.A.3 Add unit tests

File: `apps/api/test/upsert-sql.cw-b49-coalesce-conflict.test.ts` (NEW, 4 test cases):

1. **T1** sys_learning_paths (COALESCE NK UQ): verify conflictKeyExprs replaces `learning_path_tenant_id` with `(NULL::uuid)` and `learning_path_code` with mapped expression
2. **T2** sys_skill_taxonomy_edges (flat NK UQ — regression): verify replacement still works for simple comma-separated cols
3. **T3** sys_skill_aliases (lower() + COALESCE): verify replacement inside nested expressions
4. **T4** edge case: target col name appearing as substring (e.g. `code` vs `learning_path_code`): verify word boundary regex prevents partial replacement

### §3.A.4 Test suite + typecheck

```bash
cd apps/api
pnpm exec vitest run test/upsert-sql.cw-b49-coalesce-conflict.test.ts  # 4/4 PASS expected
pnpm exec vitest run  # full suite ≥327
pnpm typecheck  # clean
```

### Acceptance Block A

- 4/4 new unit tests PASS
- Full suite ≥327 (no regression)
- typecheck clean

---

## §4 — Block B: Wave 1 retry verify B/C unlock (1-1.5h)

### §4.B.1 Wave 1 retry

```bash
cd apps/api && pnpm tsx src/cli/brownfield-wave-run.ts --wave 1
# Capture runId for verification
```

### §4.B.2 Monitor via DB poll (CW-B48 mitigation — NOT shell job status)

```bash
RUNID="<from above>"
while true; do
  status=$(psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -tA -c "SELECT import_run_status FROM brownfield.import_runs WHERE import_run_id='$RUNID'")
  echo "[$(date +%H:%M:%S)] status=$status"
  [ "$status" = "COMPLETED" ] && break
  [ "$status" = "FAILED" ] && exit 1
  sleep 60
done
```

### §4.B.3 Acceptance Block B

```sql
-- Pre-X10 baseline vs post-X10
SELECT 'sys_learning_paths' t, COUNT(*) FROM sys.sys_learning_paths       -- Expected: 3227 + ~127 = ~3354
UNION ALL SELECT 'sys_learning_modules', COUNT(*) FROM sys.sys_learning_modules   -- Expected: 4488 + ~564 = ~5052
UNION ALL SELECT 'sys_skill_learning_mappings', COUNT(*) FROM sys.sys_skill_learning_mappings;  -- Expected: depends on CW-B47 URI match + module_id semantic

-- Lineage from courses + course_modules
SELECT source_lineage_source_table, source_lineage_target_table_name, COUNT(*)
  FROM sys.sys_source_lineage_records
 WHERE source_lineage_import_run_id = '<X10_runId>'
   AND source_lineage_source_table IN ('courses','course_modules','certification_esco_skills','course_esco_skills')
 GROUP BY 1,2 ORDER BY 3 DESC;
-- Expected: courses → sys_learning_paths (~127), course_modules → sys_learning_modules (~564), esco sources ~partial

-- Regression check (no count loss su targets già funzionanti)
SELECT 'sys_skill_taxonomy_edges' t, COUNT(*) FROM sys.sys_skill_taxonomy_edges   -- Expected: 11965 (preserved)
UNION ALL SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings   -- Expected: 7645 (preserved)
UNION ALL SELECT 'sys_job_roles', COUNT(*) FROM sys.sys_job_roles   -- Expected: 202 (preserved)
UNION ALL SELECT 'sys_users', COUNT(*) FROM sys.sys_users;   -- Expected: 433 (R-A2 ≥430)
```

### §4.B.4 Audit forensics post-X10

```sql
SELECT exclusion_reason, COUNT(*)
  FROM (SELECT import_validation_result_payload->>'exclusion_reason' AS exclusion_reason
          FROM audit.import_validation_results
         WHERE import_validation_result_run_id = '<X10_runId>'
           AND import_validation_result_rule_code = 'WHERE_SKIP_FILTER_EXCLUDED_V1') s
 GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
```

Surface eventuali CW-B50+ candidate. Documenta in REPORT §5.

---

## §5 — Block C: Pattern cross-check (15 min)

Verifica live applicazione pattern memo §16 added in C10.7:
- §16 anti-pattern 21 CW-B46 → already mitigated in X9 (dispatch function inlined)
- §16 anti-pattern 22 CW-B47 → residual finding documented in X9 REPORT
- §16 anti-pattern 23 CW-B48 → mitigated in this X10 (DB poll in §4.B.2)
- §16 anti-pattern 24 CW-B49 → mitigated in this X10 (patch §3.A.1)
- §16 vincente 19 (Document residual) → applied if Wave 1 partial unlock
- §16 vincente 20 (Function-level schema introspection) → reflexive Cowork lesson (no CLI exercise)

Documenta in REPORT §6 quale pattern CW-B5x potrebbe surface.

---

## §6 — Halt triggers P0

| Trigger | File pattern | Severity |
|---|---|---|
| Block A unit test fail non-inline-recoverable | `cw_b49_unit_test_fail` | P0 |
| Block A regression suite >5 new failures | `cw_b49_regression` | P1 |
| Block B sys_learning_paths < 3300 (or sys_learning_modules < 4900) | `cw_b49_partial_fail` | P1 |
| Block B regression on sys_skill_taxonomy_edges / sys_users / sys_esco / sys_job_roles | `regression_<table>` | **P0** |
| Block B R-A2: sys_users < 430 | `r_a2_regression` | **P0 CRITICAL** |
| Wave 1 retry wall-clock > 90 min | `wave1_timeout` | P1 |

---

## §7 — REPORT format

`cowork_code_exchange/_04_REPORT_014_batch_x10.md`. Structure:

```
§0 Pre-conditions + baseline
§1 Block A outcomes (CW-B49 patch)
  §1.A.1 Patch applied
  §1.A.2 Unit tests (4/4 PASS expected)
  §1.A.3 Full suite + typecheck
§2 Block B outcomes (Wave 1 retry)
  §2.B.1 runId + wall-clock
  §2.B.2 sys_* count deltas
  §2.B.3 Lineage from X9-targets
  §2.B.4 Audit forensics (exclusion_reason distribution)
§3 Block C pattern cross-check
§4 Bias catalog updates (CW-B50+ if surfaced)
§5 Cowork spec improvements suggested
§6 Next step recommendation for Cowork batch C11
```

Emit `report_ready` inbox.

---

## §8 — Reference files (Cowork-authored)

| Path | Purpose |
|---|---|
| `cowork_reserved/batch_c10/forensic_cw_b49/01_CW_B49_ROOT_CAUSE.md` | Block A spec autoritativa |
| `cowork_reserved/bias_registry.md` | Bias SoT 49 (CW-B17→CW-B49) |
| `cowork_reserved/COWORK_CLI_PROMPT_PATTERN.md` §16 | Pattern memo aggiornato post-X9 |
| `cowork_code_exchange/_04_REPORT_013_batch_x9.md` | X9 REPORT predecessor (per context) |

---

## §9 — Post-X10 outlook

**Expected post-X10**:
- sys.* populated: 59/128 → **61-62/128** (+sys_learning_paths growth + sys_learning_modules growth)
- Engine bias catalog: 49 → 49 (no new bias expected, salvo surprises) — eventuali CW-B50+ surface = bonus learning
- Migrations applied: 000043
- ADR accepted: 16 (no new)

**Successor X11**:
- Performance Reviews / GOKMER extension (sys_users + sys_goals + sys_job_roles ready) — low complexity given engine maturity
- OR Recruiting / H2R macro-area
- Decision deferred a Cowork batch C11 post-X10

---

Cowork standing by per REPORT 014. Halt+escalate via inbox solo P0 §6. Buon lavoro.

---

*End PROMPT 014*
