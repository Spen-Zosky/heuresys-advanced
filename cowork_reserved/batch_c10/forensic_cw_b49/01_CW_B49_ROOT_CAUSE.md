# CW-B49 Forensic — Root cause + patch spec

**Status**: ROOT CAUSE IDENTIFIED + patch spec ready
**Author**: Cowork batch C10.8
**Date**: 2026-05-23
**Trigger**: REPORT 013 §7 CW-B49 P0 BLOCKER — IMPORT new table_mappings not upserted

---

## §1 — Discovery diagnostica live

**Run af2d9d71-4234-49e4-a39c-d413701d74ac** (X9 Wave 1):
- staging.wave1_learning_paths courses → 127 PASSED, **0 upserted** ❌
- staging.wave1_learning_modules course_modules → 564 PASSED, **0 upserted** ❌
- staging.wave1_skill_learning_mappings certification/course_esco_skills → 1381 PASSED, **0 upserted** ❌

**Tutti gli ALTRI sources nello stesso run** (skill_adjacencies, esco_skill_relations, job_templates, ecc.) → upsert OK.

**Differenza chiave identificata**: UQ index target table.

```sql
SELECT c.relname, pg_get_indexdef(i.indexrelid)
  FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid
 WHERE i.indisunique AND NOT i.indisprimary
   AND pg_get_indexdef(i.indexrelid) ILIKE '%COALESCE%'
   AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='sys');
```

**10 target sys.* hanno NK UQ con `COALESCE(<col>, sentinel)` pattern**:
- `sys_career_paths`, `sys_compensation_bands`, `sys_kpi_definitions`, **`sys_learning_modules`**, **`sys_learning_paths`**, `sys_payout_curves`, `sys_skill_aliases`, **`sys_skills`**, `sys_user_auth_roles`, `sys_user_certifications`

Esempio sys_learning_paths:
```
CREATE UNIQUE INDEX sys_learning_paths_tenant_code_uq
ON sys.sys_learning_paths
USING btree (COALESCE(learning_path_tenant_id, '00000000-...'::uuid), learning_path_code);
```

## §2 — Root cause nel codice

**File**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:661-687`

```typescript
const conflictKeyCols = conflictInference.split(",").map((s) => s.trim());  // ❌ BUG
const conflictKeyExprs = conflictKeyCols
  .map((ck) => {
    const entry = colEntries.find((e) => e.targetCol === ck);
    return entry ? entry.sql : ck;
  })
  .join(", ");

const insertSql = `
  WITH staging_filtered AS (...),
  staging_deduped AS (
    SELECT DISTINCT ON (${conflictKeyExprs}) *
      FROM staging_filtered
     ORDER BY ${conflictKeyExprs}, ...
  )
  INSERT INTO ${qTargetTable} (${colsList})
  SELECT ${selectList}
    FROM staging_deduped
  ON CONFLICT (${conflictInference}) ${setClause}
  RETURNING ${qPkCol}
`;
```

**Il bug**: `conflictInference.split(",")` è naive — non rispetta parentheses depth. Quando UQ contiene `COALESCE(a, b)`, la virgola interna alla COALESCE viene tratta come separator.

**Esempio sys_learning_paths**:
- `conflictInference` = `COALESCE(learning_path_tenant_id, '00000000-...'::uuid), learning_path_code`
- `split(",")` produce **3 elementi sbagliati**:
  - `COALESCE(learning_path_tenant_id`
  - ` '00000000-...'::uuid)`
  - ` learning_path_code`
- `colEntries.find(targetCol === "COALESCE(learning_path_tenant_id")` → no match → return raw
- `colEntries.find(targetCol === "'00000000-...'::uuid)")` → no match → return raw
- `colEntries.find(targetCol === "learning_path_code")` → match → return `TRIM(staging_raw_record->>'code')` o simile
- Joined: `COALESCE(learning_path_tenant_id, '00000000-...'::uuid), TRIM(staging_raw_record->>'code')`

**SQL emitted DISTINCT ON**:
```sql
SELECT DISTINCT ON (
  COALESCE(learning_path_tenant_id, '00000000-...'::uuid),
  TRIM(staging_raw_record->>'code')
) *
FROM staging_filtered
```

**Errore runtime**: `learning_path_tenant_id` NON è una colonna di `staging_filtered` (staging table ha solo `staging_*` cols + `staging_raw_record` jsonb). → PG raise `column "learning_path_tenant_id" does not exist`.

Try/catch in upsert-sql.ts:691-704 absorba l'errore → `upsertedCount = 0` + `skipReason = "insert_failed: column X does not exist..."`.

## §3 — Verifica empirica

Sample SQL hand-probe in isolamento PG (eseguibile manualmente):

```sql
SELECT DISTINCT ON (
  COALESCE(learning_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  TRIM(staging_raw_record->>'code')
) staging_row_id
FROM staging.wave1_learning_paths
WHERE staging_import_run_id = 'af2d9d71-4234-49e4-a39c-d413701d74ac'
  AND staging_source_table = 'courses'
  AND staging_validation_status = 'PASSED'
LIMIT 1;
```
**Atteso**: `ERROR: column "learning_path_tenant_id" does not exist`.

## §4 — Patch design

**File**: `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:661-667`

Replace naive split with **parenthesis-depth-aware substring matching**:

```typescript
// CW-B49 fix: conflictInference may contain expressions with internal commas
// (e.g. COALESCE(col, sentinel)). Naive split(",") corrupts the expression.
// Instead, replace bare target column references with their staging expressions.
let conflictKeyExprs = conflictInference;
for (const entry of colEntries) {
  // Match the target col name as whole word (word boundary), replace with parenthesized SQL.
  const re = new RegExp(`\\b${entry.targetCol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
  conflictKeyExprs = conflictKeyExprs.replace(re, `(${entry.sql})`);
}
```

**Effetto su sys_learning_paths**:
- Input `conflictInference` = `COALESCE(learning_path_tenant_id, '00000000-...'::uuid), learning_path_code`
- colEntries contiene entry per `learning_path_tenant_id` (sql: `NULL::uuid` via CW-B34 nullable NK injection) + `learning_path_code` (sql: `TRIM(staging_raw_record->>'code')`)
- Replace `learning_path_tenant_id` → `(NULL::uuid)`
- Replace `learning_path_code` → `(TRIM(staging_raw_record->>'code'))`
- Output: `COALESCE((NULL::uuid), '00000000-...'::uuid), (TRIM(staging_raw_record->>'code'))`
- DISTINCT ON valid SQL ✅

PG semantic: `COALESCE(NULL, sentinel)` = sentinel UUID. Group by tenant=sentinel + code → correct dedup.

## §5 — Regression risk

**Tables con UQ semplici (no COALESCE)**: il fix è additive — bare target col names sono replaced 1:1 con entry.sql. Same behavior come split() in flat case.

Esempio sys_skill_taxonomy_edges UQ `(parent_id, child_id, kind)`:
- Replace `parent_id` → `(LOOKUP_FK_2HOP(...))` (o simile)
- Replace `child_id` → `(LOOKUP_FK_2HOP(...))`
- Replace `kind` → `('IS_A')` (CAST_ENUM o constant)
- Output: `(LOOKUP_FK_2HOP(...)), (LOOKUP_FK_2HOP(...)), ('IS_A')` ✅ semantically identical to split version.

**Edge case**: target col name come sub-string di altro col (es. `code` appare in `learning_path_code`). Mitigato da `\b` word boundary regex.

**Edge case**: target col name include caratteri regex special (raro per PG identifier). Mitigato da escape `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.

## §6 — Acceptance criteria post-patch (CLI X10)

1. `pnpm typecheck` clean
2. Unit test new in `upsert-sql.test.ts` (o equivalente): verify `conflictKeyExprs` per target con COALESCE UQ è correctly substituted (4 test cases minimum)
3. Full test suite ≥327 PASS (no regression)
4. Wave 1 retry post-patch:
   - sys_learning_paths: 3227 → ~3354 (+127 courses)
   - sys_learning_modules: 4488 → ~5052 (+564 course_modules)
   - sys_skill_learning_mappings: dipende da CW-B47 module_id semantic + URI match (può restare 0 se altri blocker)
5. No regression on sys_skill_taxonomy_edges, sys_job_roles, sys_skills, sys_users (count preserved)

## §7 — Impact analysis (downstream)

Post-patch, 10 sys.* tables con COALESCE UQ diventano upsert-able tramite engine standard:
- sys_career_paths, sys_compensation_bands, sys_kpi_definitions, sys_learning_modules, sys_learning_paths, sys_payout_curves, sys_skill_aliases, sys_skills, sys_user_auth_roles, sys_user_certifications

**Plus**: sys_skill_aliases UQ ha `lower((skill_alias_label)::text)` — function call con `::text` cast. Verifica che il replace funziona anche con cast expression. Likely OK perché `skill_alias_label` è whole word.

**Plus**: sys_user_auth_roles UQ ha WHERE clause `WHERE (user_auth_role_revoked_at IS NULL)`. Verifica se `pg_get_indexdef` regex extraction in engine.ts:118 catch correttamente la WHERE clause (out of conflictInference). Verificato in code (line 118: regex strip WHERE).

## §8 — Effort estimate

CLI X10 Block A (CW-B49 fix): **1-2h**
- Patch upsert-sql.ts:661-667: 15 min
- 4 unit tests new: 45 min
- Typecheck + full suite: 30 min
- Wave 1 retry verify (~55min wall-clock + 30 min Cowork analysis): ~1.5h
- Commit + push: 15 min

## §9 — Open questions per X10

1. Dovrebbe l'engine **trim WHERE clause** from conflictInference se presente? (sys_user_auth_roles case) — Likely engine.ts:118 regex già fa. Verify.
2. Caso edge: target col name is a SQL reserved word (`code`, `name`, `order`)? Verifica replace funziona con \b word boundary su keywords PG.
3. Per UQ con `lower()` o altre funzioni che wrap target col: replace di `skill_alias_label` → entry.sql sostituisce correttamente dentro `lower((skill_alias_label)::text)` → `lower(((TRIM(...))::text)`? Sì, perché \b matcha confine.

---

*End CW-B49 forensic — split-on-COALESCE bug identified, patch ready for CLI X10*
