#!/usr/bin/env bash
# db/scripts/brownfield-wave-1-preflight.sh
#
# MVP-3 Tappa D — Pre-flight validation for Brownfield Wave 1 execution.
# Read-only check. Does NOT mutate any data.
#
# Schema reality (as of migrations 000024 + 000025 + 000029):
#   - brownfield.import_runs has `import_run_wave smallint` (CHECK 1..4).
#     Wave assignment lives ON THE RUN.
#   - brownfield.table_mappings has `table_mapping_wave smallint` (CHECK 1..4)
#     per ADR-0012 (migration 000029). Wave 1 mappings are those with
#     table_mapping_wave = 1, classification IN ('IMPORT','TRANSFORM'),
#     approval_status = 'APPROVED'.
#   - The Wave 1 source-table list (≈93 tables from ESKAP, SKILGRO, INDOOR,
#     ITLAB, PROGOV, OPOURSKA, H2R per BROWNFIELD_IMPORT_PLAN.md §3.1) is the
#     target population for backfill. Migration 000029 includes an idempotent
#     UPDATE that sets wave=1 on these mappings when present.
#
# Checks performed:
#   1. Connectivity (heuresys_advanced reachable via $DATABASE_URL).
#   2. Brownfield schema present (6 brownfield + 2 audit tables: source_exports,
#      source_tables, source_columns, table_mappings, column_mappings,
#      import_runs in `brownfield`; import_validation_results,
#      import_approval_decisions in `audit`).
#   3. brownfield.table_mappings has Wave 1 rows: approval_status='APPROVED'
#      AND classification IN ('IMPORT','TRANSFORM') AND table_mapping_wave=1.
#   4. Every Wave 1 mapping references a registered source_tables row.
#   5. The 17 canonical Wave 1 target tables exist under sys.sys_*.
#   6. Source row estimate for the largest 10 Wave 1 mappings (capacity).
#
# Exit codes:
#   0 — all checks passed; wave 1 may be scheduled (read the runbook
#       for the wave-assignment ADR step first).
#   1 — at least one check failed.
#
# Required env:
#   DATABASE_URL  (e.g. postgres://heuresys:***@localhost:5433/heuresys_advanced)
#
# Twin: db/scripts/brownfield-wave-1-preflight.ps1 (Windows native).

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set (postgres connection string)}"

echo "=== Brownfield Wave 1 — Pre-flight check ==="
echo "Started: $(date --iso-8601=seconds)"
echo

# 1. Connectivity
echo "[1/6] Connectivity"
if ! psql -c "SELECT 1" "$DATABASE_URL" >/dev/null 2>&1; then
  echo "  FAIL: cannot reach the database via DATABASE_URL"
  exit 1
fi
echo "  OK: DB reachable"
echo

# 2. brownfield schema + expected tables (+ audit validation tables)
echo "[2/6] Brownfield + audit schema presence"
BF_TABLES_PRESENT=$(psql -tAc "
  SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'brownfield'
     AND table_name IN ('source_exports','source_tables','source_columns',
                        'table_mappings','column_mappings','import_runs')" "$DATABASE_URL")
AUDIT_TABLES_PRESENT=$(psql -tAc "
  SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'audit'
     AND table_name IN ('import_validation_results','import_approval_decisions')" "$DATABASE_URL")
if [ "$BF_TABLES_PRESENT" -lt 6 ]; then
  echo "  FAIL: expected 6 brownfield tables, found $BF_TABLES_PRESENT"
  exit 1
fi
if [ "$AUDIT_TABLES_PRESENT" -lt 2 ]; then
  echo "  FAIL: expected 2 audit tables (import_validation_results, import_approval_decisions), found $AUDIT_TABLES_PRESENT"
  exit 1
fi
echo "  OK: 6/6 brownfield + 2/2 audit tables present"
echo

# 3. Wave 1 mappings (APPROVED + IMPORT/TRANSFORM + wave=1)
echo "[3/6] Wave 1 mapping coverage (APPROVED + IMPORT/TRANSFORM + wave=1)"
WAVE1=$(psql -tAc "
  SELECT count(*) FROM brownfield.table_mappings
   WHERE table_mapping_approval_status = 'APPROVED'
     AND table_mapping_classification IN ('IMPORT','TRANSFORM')
     AND table_mapping_wave = 1" "$DATABASE_URL")
APPROVED=$(psql -tAc "
  SELECT count(*) FROM brownfield.table_mappings
   WHERE table_mapping_approval_status = 'APPROVED'
     AND table_mapping_classification IN ('IMPORT','TRANSFORM')" "$DATABASE_URL")
TOTAL=$(psql -tAc \
  "SELECT count(*) FROM brownfield.table_mappings" "$DATABASE_URL")
echo "  total mappings:                   $TOTAL"
echo "  APPROVED + IMPORT/TRANSFORM:      $APPROVED"
echo "  └─ of which wave=1:               $WAVE1"
if [ "$WAVE1" -lt 1 ]; then
  echo "  WARN: no wave=1 APPROVED IMPORT/TRANSFORM mappings — Wave 1 has nothing to execute"
  echo "        (this is OK pre-bootstrap; populate brownfield.table_mappings + run migration 000029 backfill)"
fi
echo

# 4. source_tables registration (Wave 1 mappings only)
echo "[4/6] Source tables registration (wave=1 mappings)"
UNREG=$(psql -tAc "
  SELECT count(*) FROM brownfield.table_mappings tm
   WHERE tm.table_mapping_approval_status = 'APPROVED'
     AND tm.table_mapping_classification IN ('IMPORT','TRANSFORM')
     AND tm.table_mapping_wave = 1
     AND NOT EXISTS (
       SELECT 1 FROM brownfield.source_tables st
        WHERE st.source_table_id = tm.table_mapping_source_table_id
     )" "$DATABASE_URL")
echo "  wave=1 mappings without a source_tables row: $UNREG"
if [ "$UNREG" -gt 0 ]; then
  echo "  FAIL: $UNREG wave=1 mappings reference unknown source tables"
  exit 1
fi
echo "  OK"
echo

# 5. canonical target tables
echo "[5/6] Canonical target tables (sys.sys_*)"
WAVE1_TARGETS=(
  "sys_skills"
  "sys_skill_families"
  "sys_skill_categories"
  "sys_skill_taxonomy_edges"
  "sys_skill_aliases"
  "sys_learning_modules"
  "sys_learning_paths"
  "sys_learning_path_steps"
  "sys_skill_learning_mappings"
  "sys_user_certifications"
  "sys_esco_occupation_mappings"
  "sys_activity_classifications"
  "sys_activity_classification_mappings"
  "sys_compensation_bands"
  "sys_process_kpi_templates"
  "sys_blueprint_process_registry"
  "sys_job_roles"
)
MISSING=()
for t in "${WAVE1_TARGETS[@]}"; do
  EXISTS=$(psql -tAc \
    "SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'sys' AND table_name = '$t'" "$DATABASE_URL")
  if [ "$EXISTS" -ne 1 ]; then
    MISSING+=("$t")
  fi
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "  FAIL: missing target tables: ${MISSING[*]}"
  exit 1
fi
echo "  OK: all ${#WAVE1_TARGETS[@]} canonical targets present"
echo

# 6. Source row estimates for Wave 1 (sample)
echo "[6/6] Source row estimates (top 10 wave=1 by estimate)"
psql -c "
  SELECT
    st.source_table_schema         AS schema,
    st.source_table_name           AS source_table,
    tm.table_mapping_target_table  AS target_table,
    tm.table_mapping_classification AS class,
    st.source_table_row_estimate   AS source_rows_estimate
   FROM brownfield.table_mappings tm
   JOIN brownfield.source_tables st
     ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_approval_status = 'APPROVED'
     AND tm.table_mapping_classification IN ('IMPORT','TRANSFORM')
     AND tm.table_mapping_wave = 1
   ORDER BY st.source_table_row_estimate DESC NULLS LAST
   LIMIT 10;
" "$DATABASE_URL" 2>&1 || echo "  (informational query — non-fatal)"
echo

echo "=== Pre-flight PASSED ==="
echo "Schema is wave-ready (ADR-0012 closed, migration 000029 applied)."
echo "Before scheduling Wave 1:"
echo "  1. Populate brownfield.source_tables + brownfield.table_mappings"
echo "     (currently empty pre-bootstrap; populate via brownfield import bootstrap)."
echo "  2. Re-run migration 000029 to backfill table_mapping_wave=1 for the 93"
echo "     Wave 1 mappings (UPDATE is idempotent and only touches wave IS NULL rows)."
echo "  3. Trigger via POST /v1/brownfield/import-runs with body {wave: 1, ...}"
