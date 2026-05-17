#!/usr/bin/env bash
# db/scripts/brownfield-wave-1-preflight.sh
#
# MVP-3 Tappa D — Pre-flight validation for Brownfield Wave 1 execution.
# Read-only check. Does NOT mutate any data.
#
# Schema reality (as of migrations 000024 + 000025):
#   - brownfield.import_runs has `import_run_wave smallint` (CHECK 1..4).
#     Wave assignment lives ON THE RUN, not on the mapping.
#   - brownfield.table_mappings does NOT have a `wave` column. The mapping
#     ↔ wave linkage is implicit via the run that produced/used it
#     (table_mapping_run_id FK).
#   - The Wave 1 source-table list (≈93 tables from ESKAP, SKILGRO, INDOOR,
#     ITLAB, PROGOV, OPOURSKA, H2R per BROWNFIELD_IMPORT_PLAN.md §3.1) is
#     informational only — the DB does not track which mappings belong to
#     Wave 1 today. ADR before live execution: either (a) add
#     `table_mapping_wave smallint` column + backfill, or (b) record wave
#     assignment in `table_mapping_metadata` jsonb under key `wave`.
#
# Checks performed:
#   1. Connectivity (heuresys_advanced reachable via $DATABASE_URL).
#   2. brownfield.* schema present (5 tables: source_exports, source_tables,
#      table_mappings, import_runs, import_validation_results).
#   3. brownfield.table_mappings has rows with approval_status='APPROVED'
#      and classification IN ('IMPORT','TRANSFORM') — total count + sample.
#   4. Every approved mapping references a registered source_tables row.
#   5. The 17 canonical Wave 1 target tables exist under sys.sys_*.
#   6. Source row estimate for the largest 10 mappings (capacity sanity).
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
if ! psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "  FAIL: cannot reach the database via DATABASE_URL"
  exit 1
fi
echo "  OK: DB reachable"
echo

# 2. brownfield schema + expected tables
echo "[2/6] Brownfield schema presence"
BF_TABLES_PRESENT=$(psql "$DATABASE_URL" -tAc "
  SELECT count(*) FROM information_schema.tables
   WHERE table_schema = 'brownfield'
     AND table_name IN ('source_exports','source_tables','table_mappings',
                        'import_runs','import_validation_results')")
if [ "$BF_TABLES_PRESENT" -lt 5 ]; then
  echo "  FAIL: expected 5 brownfield tables, found $BF_TABLES_PRESENT"
  exit 1
fi
echo "  OK: 5/5 expected brownfield tables present"
echo

# 3. Approved mappings (no wave filter — see file header)
echo "[3/6] Adaptation map coverage (APPROVED + IMPORT/TRANSFORM)"
APPROVED=$(psql "$DATABASE_URL" -tAc "
  SELECT count(*) FROM brownfield.table_mappings
   WHERE table_mapping_approval_status = 'APPROVED'
     AND table_mapping_classification IN ('IMPORT','TRANSFORM')")
TOTAL=$(psql "$DATABASE_URL" -tAc \
  "SELECT count(*) FROM brownfield.table_mappings")
echo "  total mappings:                   $TOTAL"
echo "  APPROVED + IMPORT/TRANSFORM:      $APPROVED"
if [ "$APPROVED" -lt 1 ]; then
  echo "  WARN: no APPROVED IMPORT/TRANSFORM mappings — Wave 1 has nothing to execute"
  echo "        (this is OK pre-bootstrap; populate brownfield.table_mappings first)"
fi
echo

# 4. source_tables registration
echo "[4/6] Source tables registration"
UNREG=$(psql "$DATABASE_URL" -tAc "
  SELECT count(*) FROM brownfield.table_mappings tm
   WHERE tm.table_mapping_approval_status = 'APPROVED'
     AND tm.table_mapping_classification IN ('IMPORT','TRANSFORM')
     AND NOT EXISTS (
       SELECT 1 FROM brownfield.source_tables st
        WHERE st.source_table_id = tm.table_mapping_source_table_id
     )")
echo "  approved mappings without a source_tables row: $UNREG"
if [ "$UNREG" -gt 0 ]; then
  echo "  FAIL: $UNREG approved mappings reference unknown source tables"
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
  EXISTS=$(psql "$DATABASE_URL" -tAc \
    "SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'sys' AND table_name = '$t'")
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

# 6. Source row estimates (sample)
echo "[6/6] Source row estimates (top 10 by estimate)"
psql "$DATABASE_URL" -c "
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
   ORDER BY st.source_table_row_estimate DESC NULLS LAST
   LIMIT 10;
" 2>&1 || echo "  (informational query — non-fatal)"
echo

echo "=== Pre-flight PASSED ==="
echo "Schema is wave-ready. Before scheduling Wave 1:"
echo "  1. Decide wave-assignment ADR (column vs metadata) — see WAVE_1_EXECUTION_RUNBOOK.md"
echo "  2. Backfill brownfield.table_mappings.metadata.wave = 1 for the 93 Wave-1 source tables"
echo "  3. Then trigger via POST /v1/brownfield/import-runs with body {wave: 1, ...}"
