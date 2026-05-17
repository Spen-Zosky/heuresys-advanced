#!/usr/bin/env bash
# db/scripts/brownfield-wave-1-preflight.sh
#
# MVP-3 Tappa D — Pre-flight validation for Brownfield Wave 1 execution.
# Does NOT mutate any data. Outputs a structured report on stdout that the
# operator must review before scheduling the actual wave-1 import.
#
# Checks performed:
#   1. Connectivity (heuresys_advanced reachable via $DATABASE_URL).
#   2. brownfield.* schema present.
#   3. brownfield.table_mappings populated for wave=1 with status=APPROVED.
#   4. brownfield.source_tables registered for every approved mapping.
#   5. sys.sys_* canonical target schemas exist for every wave-1 target.
#   6. Outputs the row counts of source tables to estimate import volume.
#
# Exit codes:
#   0 — all checks passed; wave 1 may be scheduled.
#   1 — at least one check failed; review output and fix before scheduling.
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
if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "  ❌ FAIL: cannot reach the database via DATABASE_URL"
  exit 1
fi
echo "  ✓ DB reachable"
echo

# 2. brownfield schema
echo "[2/6] Brownfield schema presence"
SCHEMA_COUNT=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'brownfield'")
if [ "$SCHEMA_COUNT" -ne 1 ]; then
  echo "  ❌ FAIL: 'brownfield' schema not present"
  exit 1
fi
echo "  ✓ brownfield schema present"
echo

# 3. table_mappings for wave 1
echo "[3/6] Wave-1 adaptation map coverage"
APPROVED=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM brownfield.table_mappings
    WHERE table_mapping_wave = 1
      AND table_mapping_status = 'APPROVED'")
TOTAL_WAVE1=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM brownfield.table_mappings
    WHERE table_mapping_wave = 1")
echo "  wave=1 total mappings:    $TOTAL_WAVE1"
echo "  wave=1 APPROVED mappings: $APPROVED"
if [ "$APPROVED" -lt 1 ]; then
  echo "  ❌ FAIL: no APPROVED wave-1 mappings"
  exit 1
fi
echo "  ✓ At least one approved mapping"
echo

# 4. source_tables registration
echo "[4/6] Source tables registration"
UNREG=$(psql "$DATABASE_URL" -tAc "
  SELECT count(*) FROM brownfield.table_mappings tm
   WHERE tm.table_mapping_wave = 1
     AND tm.table_mapping_status = 'APPROVED'
     AND NOT EXISTS (
       SELECT 1 FROM brownfield.source_tables st
        WHERE st.source_table_id = tm.table_mapping_source_table_id
     )")
echo "  approved mappings without source_tables row: $UNREG"
if [ "$UNREG" -gt 0 ]; then
  echo "  ❌ FAIL: $UNREG approved mappings reference unknown source tables"
  exit 1
fi
echo "  ✓ All approved mappings have a registered source table"
echo

# 5. canonical target schemas
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
  EXISTS=$(psql "$DATABASE_URL" -tAc \
    "SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'sys' AND table_name = '$t'")
  if [ "$EXISTS" -ne 1 ]; then
    MISSING+=("$t")
  fi
done
if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "  ❌ FAIL: missing target tables: ${MISSING[*]}"
  exit 1
fi
echo "  ✓ All ${#WAVE1_TARGETS[@]} canonical targets present"
echo

# 6. Source row counts (per mapping, sample)
echo "[6/6] Source row counts (wave-1 sample, top 10 by row count)"
psql "$DATABASE_URL" -c "
  SELECT
    tm.table_mapping_source_schema  AS schema,
    tm.table_mapping_source_table   AS source_table,
    tm.table_mapping_target_table   AS target_table,
    COALESCE(tm.table_mapping_confidence_score::text, 'n/a') AS conf,
    st.source_table_row_count       AS source_rows
   FROM brownfield.table_mappings tm
   JOIN brownfield.source_tables st
     ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_wave = 1
     AND tm.table_mapping_status = 'APPROVED'
   ORDER BY st.source_table_row_count DESC NULLS LAST
   LIMIT 10;
" 2>&1 || echo "  (informational query — non-fatal)"
echo

echo "=== Pre-flight PASSED ==="
echo "Wave 1 may be scheduled. Run the actual import via the wave-1"
echo "execution runbook (docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md)."
