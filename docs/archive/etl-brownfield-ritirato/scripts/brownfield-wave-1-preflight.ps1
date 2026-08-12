# db/scripts/brownfield-wave-1-preflight.ps1
#
# MVP-3 Tappa D — Pre-flight validation for Brownfield Wave 1 execution
# (Windows PowerShell twin of brownfield-wave-1-preflight.sh).
#
# See the .sh twin for full doc (schema reality post-ADR-0012, exit codes).
# Both scripts are read-only and idempotent.

[CmdletBinding()]
param(
    [string]$DatabaseUrl = $env:DATABASE_URL
)

$ErrorActionPreference = 'Stop'

if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL env var (or -DatabaseUrl) is required"
    exit 1
}

function Invoke-PsqlScalar {
    param([string]$Sql)
    # psql on Windows requires options BEFORE the connection URL positional arg,
    # otherwise the URL consumes all subsequent args as positional and the SQL
    # is ignored with "extra command-line argument" warning.
    & psql -tAc $Sql $DatabaseUrl 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "psql failed for: $Sql"
    }
}

Write-Host "=== Brownfield Wave 1 — Pre-flight check ==="
Write-Host "Started: $(Get-Date -Format o)"
Write-Host ""

# 1. Connectivity
Write-Host "[1/6] Connectivity"
try {
    Invoke-PsqlScalar "SELECT 1" | Out-Null
    Write-Host "  OK: DB reachable"
} catch {
    Write-Host "  FAIL: cannot reach the database via DatabaseUrl"
    exit 1
}
Write-Host ""

# 2. brownfield schema + expected tables (+ audit validation tables)
Write-Host "[2/6] Brownfield + audit schema presence"
$bfTablesPresent = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'brownfield'
   AND table_name IN ('source_exports','source_tables','source_columns',
                      'table_mappings','column_mappings','import_runs')
"@)
$auditTablesPresent = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM information_schema.tables
 WHERE table_schema = 'audit'
   AND table_name IN ('import_validation_results','import_approval_decisions')
"@)
if ($bfTablesPresent -lt 6) {
    Write-Host "  FAIL: expected 6 brownfield tables, found $bfTablesPresent"
    exit 1
}
if ($auditTablesPresent -lt 2) {
    Write-Host "  FAIL: expected 2 audit tables (import_validation_results, import_approval_decisions), found $auditTablesPresent"
    exit 1
}
Write-Host "  OK: 6/6 brownfield + 2/2 audit tables present"
Write-Host ""

# 3. Wave 1 mappings (APPROVED + IMPORT/TRANSFORM + wave=1)
Write-Host "[3/6] Wave 1 mapping coverage (APPROVED + IMPORT/TRANSFORM + wave=1)"
$wave1 = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM brownfield.table_mappings
 WHERE table_mapping_approval_status = 'APPROVED'
   AND table_mapping_classification IN ('IMPORT','TRANSFORM')
   AND table_mapping_wave = 1
"@)
$approved = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM brownfield.table_mappings
 WHERE table_mapping_approval_status = 'APPROVED'
   AND table_mapping_classification IN ('IMPORT','TRANSFORM')
"@)
$total = [int](Invoke-PsqlScalar "SELECT count(*) FROM brownfield.table_mappings")
Write-Host "  total mappings:                   $total"
Write-Host "  APPROVED + IMPORT/TRANSFORM:      $approved"
Write-Host "  └─ of which wave=1:               $wave1"
if ($wave1 -lt 1) {
    Write-Host "  WARN: no wave=1 APPROVED IMPORT/TRANSFORM mappings — Wave 1 has nothing to execute"
    Write-Host "        (this is OK pre-bootstrap; populate brownfield.table_mappings + run migration 000029 backfill)"
}
Write-Host ""

# 4. source_tables registration (Wave 1 mappings only)
Write-Host "[4/6] Source tables registration (wave=1 mappings)"
$unreg = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM brownfield.table_mappings tm
 WHERE tm.table_mapping_approval_status = 'APPROVED'
   AND tm.table_mapping_classification IN ('IMPORT','TRANSFORM')
   AND tm.table_mapping_wave = 1
   AND NOT EXISTS (
     SELECT 1 FROM brownfield.source_tables st
      WHERE st.source_table_id = tm.table_mapping_source_table_id
   )
"@)
Write-Host "  wave=1 mappings without a source_tables row: $unreg"
if ($unreg -gt 0) {
    Write-Host "  FAIL: $unreg wave=1 mappings reference unknown source tables"
    exit 1
}
Write-Host "  OK"
Write-Host ""

# 5. canonical target tables
Write-Host "[5/6] Canonical target tables (sys.sys_*)"
$wave1Targets = @(
    "sys_skills", "sys_skill_families", "sys_skill_categories",
    "sys_skill_taxonomy_edges", "sys_skill_aliases",
    "sys_learning_modules", "sys_learning_paths", "sys_learning_path_steps",
    "sys_skill_learning_mappings", "sys_user_certifications",
    "sys_esco_occupation_mappings", "sys_activity_classifications",
    "sys_activity_classification_mappings", "sys_compensation_bands",
    "sys_process_kpi_templates", "sys_blueprint_process_registry",
    "sys_job_roles"
)
$missing = @()
foreach ($t in $wave1Targets) {
    $exists = [int](Invoke-PsqlScalar "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'sys' AND table_name = '$t'")
    if ($exists -ne 1) { $missing += $t }
}
if ($missing.Count -gt 0) {
    Write-Host "  FAIL: missing target tables: $($missing -join ', ')"
    exit 1
}
Write-Host "  OK: all $($wave1Targets.Count) canonical targets present"
Write-Host ""

# 6. Source row estimates for Wave 1 (sample)
Write-Host "[6/6] Source row estimates (top 10 wave=1 by estimate)"
& psql -c @"
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
"@ $DatabaseUrl
Write-Host ""

Write-Host "=== Pre-flight PASSED ==="
Write-Host "Schema is wave-ready (ADR-0012 closed, migration 000029 applied)."
Write-Host "Before scheduling Wave 1:"
Write-Host "  1. Populate brownfield.source_tables + brownfield.table_mappings"
Write-Host "     (currently empty pre-bootstrap; populate via brownfield import bootstrap)."
Write-Host "  2. Re-run migration 000029 to backfill table_mapping_wave=1 for the 93"
Write-Host "     Wave 1 mappings (UPDATE is idempotent and only touches wave IS NULL rows)."
Write-Host "  3. Trigger via POST /v1/brownfield/import-runs with body {wave: 1, ...}"
