# =============================================================================
# db/scripts/reset_local_database.ps1
# -----------------------------------------------------------------------------
# DEV-ONLY destructive helper for Model A (localhost).
# Drops POSTGRES_DB and recreates it empty (then re-applies create_local_database).
# Prompts for confirmation unless -Force is passed.
#
# For Model B (OCI VM, shared DB): NEVER run this against the VM cluster
# while heuresys_platform legacy DB exists alongside — drops are isolated
# to POSTGRES_DB only, but always double-check the .env target first.
# =============================================================================

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) { Write-Error "[reset] .env not found at $EnvFile"; exit 1 }
Get-Content $EnvFile | Where-Object {
    $_ -match "^\s*[A-Z_][A-Z0-9_]*\s*=" -and $_ -notmatch "^\s*#"
} | ForEach-Object {
    $kv = $_ -split "=", 2
    $key = $kv[0].Trim()
    $val = $kv[1].Trim().Trim('"')
    Set-Item -Path "env:$key" -Value $val
}

if (-not $env:POSTGRES_SUPERUSER_PASSWORD) {
    Write-Error "[reset] POSTGRES_SUPERUSER_PASSWORD empty. For Model B (OCI VM) drop the DB manually via SSH:"
    Write-Host "    ssh oracle-vm-default 'sudo -u postgres dropdb $env:POSTGRES_DB && sudo -u postgres createdb -O $env:POSTGRES_USER $env:POSTGRES_DB'"
    exit 1
}

Write-Host "WARNING: this will DROP database '$env:POSTGRES_DB' on $($env:POSTGRES_HOST):$($env:POSTGRES_PORT)" -ForegroundColor Yellow
Write-Host "         and recreate it empty. All data in that database will be LOST." -ForegroundColor Yellow

if (-not $Force) {
    $reply = Read-Host "Type 'yes' to continue, anything else to abort"
    if ($reply -ne "yes") { Write-Host "Aborted."; exit 0 }
}

$env:PGPASSWORD = $env:POSTGRES_SUPERUSER_PASSWORD

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
if (-not $Psql) { Write-Error "[reset] psql.exe not found."; exit 1 }

Write-Host "[reset] Terminating active connections to '$env:POSTGRES_DB'..."
& $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_SUPERUSER -d postgres -v ON_ERROR_STOP=1 -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$env:POSTGRES_DB' AND pid <> pg_backend_pid();
"

Write-Host "[reset] Dropping database '$env:POSTGRES_DB'..."
& $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_SUPERUSER -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $env:POSTGRES_DB;"

Write-Host "[reset] Re-creating database empty..."
& "$PSScriptRoot\create_local_database.ps1" -EnvFile $EnvFile

Write-Host ""
Write-Host "OK: database '$env:POSTGRES_DB' reset to empty state. Run migrate.ps1 to re-apply migrations."
