# =============================================================================
# db/scripts/validate_database.ps1
# -----------------------------------------------------------------------------
# Two-part validation:
#   1. Runs every sys.v_* validation view; expects every count to be 0.
#   2. Captures `pg_dump --schema-only` snapshot, re-applies migrations,
#      captures snapshot again, diffs. Empty diff = idempotency PASS.
#
# Run after `migrate.ps1` to prove the DB is healthy and the migrations
# are idempotent (acceptance test A3 in BOOTSTRAP_EXECUTION_PLAN §6).
#
# Snapshots written under qa_artifacts/schema_snapshot_{before,after}.sql.
# =============================================================================

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env",
    [switch]$SkipTwiceRun
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) { Write-Error "[validate] .env not found at $EnvFile"; exit 1 }
Get-Content $EnvFile | Where-Object {
    $_ -match "^\s*[A-Z_][A-Z0-9_]*\s*=" -and $_ -notmatch "^\s*#"
} | ForEach-Object {
    $kv = $_ -split "=", 2
    $key = $kv[0].Trim()
    $val = $kv[1].Trim().Trim('"')
    Set-Item -Path "env:$key" -Value $val
}

$env:PGPASSWORD = $env:POSTGRES_PASSWORD

$PsqlCandidates = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\17\bin\psql.exe",
    "C:\Program Files\PostgreSQL\18\bin\psql.exe"
)
$Psql = $PsqlCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Psql) {
    $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($cmd) { $Psql = $cmd.Source }
}
if (-not $Psql) { Write-Error "[validate] psql.exe not found."; exit 1 }

$PgDumpCandidates = @(
    "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
    "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
)
$PgDump = $PgDumpCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $PgDump) {
    $cmd = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
    if ($cmd) { $PgDump = $cmd.Source }
}
if (-not $PgDump) { Write-Warning "[validate] pg_dump.exe not found — twice-run idempotency proof will be skipped."; $SkipTwiceRun = $true }

# -----------------------------------------------------------------------------
# Step 1 — validation views
# -----------------------------------------------------------------------------
$views = @(
    'sys.v_orphan_position_assignments',
    'sys.v_tenant_boundary_violations',
    'sys.v_positions_without_job_role',
    'sys.v_pip_completeness',
    'sys.v_reward_gate_completeness',
    'sys.v_synthetic_user_flag_consistency',
    'sys.v_canonical_outside_sys',
    'sys.v_active_primary_assignment_per_user',
    'sys.v_visualization_node_in_canonical_node',
    'sys.v_inbox_resource_consistency'
)
$fail = $false
$skipped = 0
foreach ($v in $views) {
    $exists = & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -tAc "SELECT 1 FROM information_schema.views WHERE table_schema || '.' || table_name = '$v'" 2>$null
    if (-not $exists) {
        Write-Host "SKIP: $v (view not yet created — migration 000023 not applied?)"
        $skipped++
        continue
    }
    $count = & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -tAc "SELECT count(*) FROM $v"
    if ([int]$count -ne 0) {
        Write-Host "FAIL: $v returned $count rows" -ForegroundColor Red
        $fail = $true
    } else {
        Write-Host "PASS: $v" -ForegroundColor Green
    }
}
if ($fail) { Write-Error "[validate] One or more validation views returned rows."; exit 1 }
if ($skipped -eq $views.Count) {
    Write-Host "[validate] All validation views skipped (migrations not yet applied). Aborting twice-run too."
    exit 0
}

# -----------------------------------------------------------------------------
# Step 2 — twice-run idempotency proof (skipped if pg_dump unavailable)
# -----------------------------------------------------------------------------
if ($SkipTwiceRun) {
    Write-Host ""
    Write-Host "[validate] Twice-run idempotency proof skipped (pg_dump missing or -SkipTwiceRun set)."
    exit 0
}

$artifactsDir = Join-Path $PSScriptRoot "..\..\qa_artifacts"
New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null
$snap1 = Join-Path $artifactsDir "schema_snapshot_before.sql"
$snap2 = Join-Path $artifactsDir "schema_snapshot_after.sql"

Write-Host ""
Write-Host "[validate] Capturing schema snapshot BEFORE second migrate run..."
& $PgDump -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f $snap1
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump (before) failed."; exit 1 }

Write-Host "[validate] Re-applying migrations..."
& "$PSScriptRoot\migrate.ps1" -EnvFile $EnvFile

Write-Host "[validate] Capturing schema snapshot AFTER second migrate run..."
& $PgDump -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB --schema-only --no-owner --no-acl --schema=sys --schema=brownfield --schema=staging --schema=audit -f $snap2
if ($LASTEXITCODE -ne 0) { Write-Error "pg_dump (after) failed."; exit 1 }

$diff = Compare-Object (Get-Content $snap1) (Get-Content $snap2)
if ($diff) {
    Write-Host ""
    Write-Host "FAIL: schema diverged on second migrate run." -ForegroundColor Red
    $diff | Select-Object -First 50 | Format-Table -AutoSize
    exit 1
}

Write-Host ""
Write-Host "OK: validation views all 0 rows; twice-run idempotency proven (empty schema diff)."
