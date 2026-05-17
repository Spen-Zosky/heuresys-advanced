# db/scripts/brownfield-wave-1-preflight.ps1
#
# MVP-3 Tappa D — Pre-flight validation for Brownfield Wave 1 execution
# (Windows PowerShell twin of brownfield-wave-1-preflight.sh).
#
# See the .sh twin for full doc. Both scripts are idempotent and read-only.

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
    & psql $DatabaseUrl -tAc $Sql 2>$null
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
    Write-Host "  + DB reachable"
} catch {
    Write-Host "  X FAIL: cannot reach the database via DatabaseUrl"
    exit 1
}
Write-Host ""

# 2. brownfield schema
Write-Host "[2/6] Brownfield schema presence"
$schemaCount = [int](Invoke-PsqlScalar "SELECT count(*) FROM information_schema.schemata WHERE schema_name = 'brownfield'")
if ($schemaCount -ne 1) {
    Write-Host "  X FAIL: 'brownfield' schema not present"
    exit 1
}
Write-Host "  + brownfield schema present"
Write-Host ""

# 3. table_mappings wave 1
Write-Host "[3/6] Wave-1 adaptation map coverage"
$approved = [int](Invoke-PsqlScalar "SELECT count(*) FROM brownfield.table_mappings WHERE table_mapping_wave = 1 AND table_mapping_status = 'APPROVED'")
$total = [int](Invoke-PsqlScalar "SELECT count(*) FROM brownfield.table_mappings WHERE table_mapping_wave = 1")
Write-Host "  wave=1 total mappings:    $total"
Write-Host "  wave=1 APPROVED mappings: $approved"
if ($approved -lt 1) {
    Write-Host "  X FAIL: no APPROVED wave-1 mappings"
    exit 1
}
Write-Host "  + At least one approved mapping"
Write-Host ""

# 4. source_tables registration
Write-Host "[4/6] Source tables registration"
$unreg = [int](Invoke-PsqlScalar @"
SELECT count(*) FROM brownfield.table_mappings tm
 WHERE tm.table_mapping_wave = 1
   AND tm.table_mapping_status = 'APPROVED'
   AND NOT EXISTS (
     SELECT 1 FROM brownfield.source_tables st
      WHERE st.source_table_id = tm.table_mapping_source_table_id
   )
"@)
Write-Host "  approved mappings without source_tables row: $unreg"
if ($unreg -gt 0) {
    Write-Host "  X FAIL: $unreg approved mappings reference unknown source tables"
    exit 1
}
Write-Host "  + All approved mappings have a registered source table"
Write-Host ""

# 5. canonical target schemas
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
    Write-Host "  X FAIL: missing target tables: $($missing -join ', ')"
    exit 1
}
Write-Host "  + All $($wave1Targets.Count) canonical targets present"
Write-Host ""

# 6. Source row counts (sample)
Write-Host "[6/6] Source row counts (wave-1 sample, top 10 by row count)"
& psql $DatabaseUrl -c @"
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
"@
Write-Host ""

Write-Host "=== Pre-flight PASSED ==="
Write-Host "Wave 1 may be scheduled. Run the actual import via the wave-1"
Write-Host "execution runbook (docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md)."
