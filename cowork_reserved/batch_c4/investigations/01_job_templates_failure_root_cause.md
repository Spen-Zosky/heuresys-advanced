# Investigation — job_templates 140 → 0 upserted (REPORT X3 anomaly)

**Author**: Cowork batch C4.1
**Date**: 2026-05-21T03:10Z
**Method**: SSH forensic queries on staging.wave1_job_roles + brownfield.column_mappings + sys.sys_job_roles

---

## §1 — Symptom (from REPORT X3)

Wave 1 retry runId `a4011c1d-1790-4e67-9bac-ada902cf57ee` (post-X3 Block A):
- ccnl_job_title_mapping: 91/91 staged → 91 upserted ✅
- job_templates: 140/140 staged + validated PASSED → **0 upserted** ❌

REPORT X3 ipotesi:
1. UQ collision on job_role_code (ccnl inserted first)
2. Source data issue
3. CHECK constraint violation

## §2 — Root cause analysis (live SQL forensic)

### §2.1 staging.wave1_job_roles status
```sql
SELECT staging_validation_status, COUNT(*),
  SUM(CASE WHEN staging_target_record_id IS NOT NULL THEN 1 ELSE 0 END) AS upserted
FROM staging.wave1_job_roles WHERE staging_source_table='job_templates' GROUP BY 1;
```
Result: **PASSED 140, upserted 0**. Validation OK, WHERE skip filter PASS (140 staged_target_record_id NULL → went through main INSERT path), but **zero target rows produced**.

### §2.2 job_templates column_mappings
```sql
job_role_code      ← TRIM   (source `job_code`)
job_role_name      ← TRIM   (source `title_en`, then title_it skipped via "keep first" rule)
job_role_description ← TRIM (source `description`, then summary skipped)
job_role_seniority_level ← CAST_VARCHAR (source `org_level`)
job_role_id        ← LINEAGE_SOURCE_NK (source `id`)
job_role_metadata  ← JSON_EXTRACT (20+ source cols aggregated into jsonb)
created_at/updated_at ← CAST_TIMESTAMPTZ
```

### §2.3 SMOKING GUN — job_code has duplicates in source

```sql
SELECT staging_raw_record->>'job_code' AS jc, COUNT(*) FROM staging.wave1_job_roles
WHERE staging_source_table='job_templates' GROUP BY 1 HAVING COUNT(*)>1 ORDER BY COUNT(*) DESC LIMIT 10;
```

Result (top 10 duplicates):
| job_code | dup count |
|---|---|
| PROTO-1-1 | 4 |
| PROTO-2-1 | 4 |
| PROTO-3-2 | 3 |
| PROTO-2-2 | 3 |
| PROTO-4-1 | 3 |
| PROTO-1-1 | 3 |
| PROTO-3-1 | 3 |
| PROTO-4-6 | 2 |
| PROTO-6-1 | 2 |
| PROTO-2-5 | 2 |

Multiple `job_templates` rows share the same `job_code` (PROTO-X-Y pattern), likely 1 per tenant × multiple variants. Total 140 rows with ~50-60 distinct codes.

### §2.4 sys.sys_job_roles UQ index

```sql
\d sys.sys_job_roles
-- sys_job_roles_code_uq UNIQUE, btree (job_role_code)
```

PK uniqueness enforced on `job_role_code`.

### §2.5 ON CONFLICT semantic failure path

The Wave executor upsert-sql.ts emits a single `INSERT INTO sys.sys_job_roles ... SELECT ... ON CONFLICT (job_role_code) DO UPDATE SET ...`.

When the SELECT produces multiple rows with the **same** `job_role_code` (`PROTO-1-1` × 4):
- PostgreSQL error: **"ON CONFLICT DO UPDATE command cannot affect row a second time"**
- Identical CW-B24 root cause as lineage write, ma applicato a main INSERT path (step 6 in upsert-sql.ts, NOT step 8)
- Engine try/catch absorbs the error → returns 0 upserted, continues to next mapping

**ccnl_job_title_mapping non hit dello stesso bug perché**:
- NO direct mapping on `job_role_code` from ccnl source (no `job_code` column in ccnl_job_title_mapping)
- Fallback: `job_role_code` populated from `staging_source_natural_key` = `OLDDB::ccnl_job_title_mapping::<uuid>` — unique per row
- ON CONFLICT NEVER triggered → all 91 INSERTs succeed

## §3 — Bias classification

This is **CW-B24 extension** — same DISTINCT ON dedup pattern needed, but applied to:
- Step 6: main INSERT INTO sys.<target> (X2 batch fixed only step 8 lineage write)
- Generalization needed: ANY upsert-sql step that has `INSERT...SELECT...ON CONFLICT DO UPDATE` is at risk when SELECT produces dup conflict-key rows.

Propose new bias entry **CW-B31 — On-Conflict Self-Conflict Generalization**: the DISTINCT ON dedup applied to lineage write (CW-B24 X2 fix) needs symmetric application to the main upsert INSERT step. Without it, source data with duplicate natural keys (e.g., job_code shared cross-tenant) silently fails.

## §4 — Proposed fix

### §4.1 Option A — Engine-level dedup (RECOMMENDED, sym CW-B24)

Apply DISTINCT ON to step 6 main INSERT in `apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts`:

Current pattern (~line 478-488):
```sql
INSERT INTO ${qTargetTable} (${colsList})
SELECT ${selectList}
  FROM ${qStagingTable}
 WHERE ${baseWhere.join(" AND ")}
 ORDER BY staging_row_id
 ${limitClause}
ON CONFLICT (${conflictInference}) ${setClause}
RETURNING ${qPkCol}
```

Proposed:
```sql
INSERT INTO ${qTargetTable} (${colsList})
SELECT DISTINCT ON (<conflict_key_expressions>) ${selectList}
  FROM ${qStagingTable}
 WHERE ${baseWhere.join(" AND ")}
 ORDER BY <conflict_key_expressions>, staging_mapping_confidence DESC NULLS LAST, staging_row_id ASC
 ${limitClause}
ON CONFLICT (${conflictInference}) ${setClause}
RETURNING ${qPkCol}
```

Where `<conflict_key_expressions>` derives from `conflictInference` (e.g. for sys_job_roles: `(<job_role_code expression>)`).

**Impact**: silently absorbs source duplicates (keep first by confidence + staging_row_id). Audit row per dropped duplicate (new audit class `MAIN_INSERT_DEDUP_DROPPED_V1` symmetric to LINEAGE_DEDUP_COLLAPSED_V1 deferred from X2).

**Effort**: 2-3h engine code + tests (similar pattern to CW-B24 X2 fix).

### §4.2 Option B — Composite natural key for job_templates

Change `job_role_code` mapping for job_templates from `TRIM(job_code)` to `TRIM(tenant_id::text) || '/' || TRIM(job_code)` to disambiguate cross-tenant PROTO codes.

**Pro**: data-level fix, no engine change.
**Contro**:
- Violates "job_role_code = canonical code" semantic (now becomes synthetic composite)
- Doesn't fix the general class of bug (CW-B31 will resurface on next source with duplicate natural keys)
- Requires brownfield.column_mappings edit for job_templates only

**Recommendation**: skip Option B in favor of Option A (engine-level generalization).

### §4.3 Option C — Pre-DEDUP in staging populate

Modify staging phase to dedup BEFORE upsert. Issues:
- Doesn't solve the general bug class
- Couples staging logic to specific target UQ constraint semantics
- Risk of false dedup (rows that look like duplicates but should be split with different natural keys)

**Recommendation**: REJECTED. Engine-level Option A is cleaner.

## §5 — Recommendation per CLI X4

**Apply Option A** as part of X4 Block A. Code patch + tests + Wave 1 retry. Expected outcome:
- job_templates 140 staged → **~50-60 upserted** (unique by job_code after dedup)
- sys_job_roles total: 91 + 50-60 = **141-151** (within ADR-0015 acceptance ≥140)
- Optional new audit class for visibility

## §6 — Cross-area implications

CW-B31 affects ANY target with UQ + source data potentially containing duplicates:
- sys_job_roles ✅ confirmed
- sys_skill_categories (PRO-X codes? check)
- sys_skill_taxonomy_edges (edges UQ on parent+child? possible duplicates)
- sys_blueprint_process_registry (process_code UQ?)
- ...

After Option A landing, suggest sweep via:
```sql
-- Audit which targets may have potential dedup loss
SELECT
  tm.table_mapping_target_table,
  st.source_table_name,
  cm_target.column_mapping_target_column AS target_col,
  cm_target.column_mapping_transform
FROM brownfield.column_mappings cm_target
JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm_target.column_mapping_table_mapping_id
JOIN brownfield.source_tables st ON st.source_table_id=tm.table_mapping_source_table_id
WHERE cm_target.column_mapping_target_column IN (
  SELECT table_constraint.constraint_name -- which columns are part of UQ for each target
  FROM information_schema.table_constraints WHERE constraint_type='UNIQUE'
)
ORDER BY tm.table_mapping_target_table;
```

## §7 — Verification anchor (post-fix)

```sql
-- Post Option A apply + Wave 1 retry:
SELECT
  jr.job_role_metadata->>'source_table' AS src,
  COUNT(*) AS n,
  COUNT(DISTINCT jr.job_role_code) AS distinct_codes
FROM sys.sys_job_roles jr GROUP BY 1;
-- Expected:
--   ccnl_job_title_mapping: 91 (unchanged)
--   job_templates: ~50-60 (dedup of 140 duplicates)
--   Total: ~141-151 (≥ ADR-0015 acceptance 140)
```

---

*End investigation*
