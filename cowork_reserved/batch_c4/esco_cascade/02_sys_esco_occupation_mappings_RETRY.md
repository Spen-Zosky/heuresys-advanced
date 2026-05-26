# sys_esco_occupation_mappings cascade RETRY (post X3 sys_job_roles=91)

**Status**: spec ready per CLI X4 Block A.4
**Predecessor**: X2 Batch C2.2 file `02_sys_esco_occupation_mappings_fix.sql` (was BLOCKED by sys_job_roles=0)
**Post-X3 state**: sys_job_roles=91 (ccnl_job_title_mapping only). After X4 CW-B31 fix, sys_job_roles expected ~141-151 (+ job_templates dedup).

---

## §1 — Recap REPORT X2 §2.B.4

CLI deferred cascade fix 02 (sys_esco_occupation_mappings, 7645 staged blocked by `nk_missing_esco_occupation_mapping_job_role_id`) because sys_job_roles was empty.

**Now sys_job_roles populated** (91 ccnl + ~50 job_templates post X4) → cascade unblocks.

## §2 — Pre-flight schema introspection (CW-B25 mandatory)

```bash
ssh -i ~/.ssh/oci_key ubuntu@80.225.82.207 'sudo -u postgres psql -d heuresys_advanced -c "
\d sys.sys_esco_occupation_mappings
\d sys.sys_job_roles
"'

# Verify column_mappings state for sys_esco_occupation_mappings
ssh -i ~/.ssh/oci_key ubuntu@80.225.82.207 "sudo -u postgres psql -d heuresys_advanced -c \"
SELECT cm.column_mapping_target_column, cm.column_mapping_transform,
       sc.source_column_name, st.source_table_name
FROM brownfield.column_mappings cm
JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id
JOIN brownfield.source_columns sc ON sc.source_column_id=cm.column_mapping_source_column_id
JOIN brownfield.source_tables st ON st.source_table_id=tm.table_mapping_source_table_id
WHERE tm.table_mapping_target_table='sys_esco_occupation_mappings'
ORDER BY st.source_table_name, cm.column_mapping_target_column;\""
```

## §3 — Re-try options

### §3.A — Option α (preferred): re-apply X2 cascade fix 02 with synthetic alias

Source: `cowork_reserved/batch_c2/cascade_fixes/02_sys_esco_occupation_mappings_fix.sql`

The X2 file was authored but BLOCKED by sys_job_roles=0. With X4 sys_job_roles ≥140, the LOOKUP_FK from `<esco_source>.job_role_code` (or similar) to sys_job_roles via lineage JOIN now resolves.

⚠️ Pre-apply re-verify:
1. R-01 staging alias deref engine.ts patch from X2 still in place (commit `8b08983`)
2. CW-B25 verify spec column names match live brownfield.source_columns
3. CW-B26 verify semantic FK actually resolves — test sample row pre-Wave-retry:

```sql
-- Take 5 sample esco_occupation rows + check if LOOKUP_FK would resolve
WITH samples AS (
  SELECT staging_raw_record->>'job_code' AS job_code_in_source,
         staging_row_id
  FROM staging.wave1_esco_occupation_mappings
  WHERE staging_source_table = '<the esco source table>'
  LIMIT 5
)
SELECT s.job_code_in_source,
       (SELECT slr.source_lineage_record_target_id
        FROM sys.sys_source_lineage_records slr
        WHERE slr.source_lineage_target_table = 'sys_job_roles'
          AND slr.source_lineage_source_record_id = s.job_code_in_source
        LIMIT 1) AS resolved_job_role_id
FROM samples s;
```

Expected: at least 3/5 resolved (if 0/5 → cascade fix semantically broken, halt+escalate).

### §3.B — Option β (skip): defer to dedicated batch C5/X5

If pre-flight reveals semantic FK still broken (similar to sys_job_roles CW-B26 phantom), defer to architectural redesign — possibly nullable FK for sys_esco_occupation_mappings too (similar ADR-0015 pattern).

## §4 — Recommendation per CLI X4

**Apply Option α** if pre-flight resolved≥3/5 sample. Expected outcome:
- 7645 staged → ~1500-5000 upserted (per X2 README C2.2 §SUMMARY R-06: "Partial unlock 20-40% expected")
- sys_esco_occupation_mappings count: ~1500-5000 (was 0)

**Halt+escalate** if pre-flight resolves 0/5 — invoke ADR-0016 nullable FK companion (X5 future).

## §5 — Verification post-fix

```sql
SELECT 'sys_esco_occupation_mappings', COUNT(*) FROM sys.sys_esco_occupation_mappings;
-- Expected: ≥1500 (lower bound)

SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_run_id = '<X4_run_id>'
  AND import_validation_result_payload->>'target_table' = 'sys_esco_occupation_mappings'
GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
-- Expected: nk_missing_*_job_role_id count significantly reduced
```

## §6 — Effort

CLI X4 Block A: 30-45 min (pre-flight 15 + apply 5 + Wave 1 retry [already running for CW-B31 fix] + verify 15).

---

*End esco cascade retry spec*
