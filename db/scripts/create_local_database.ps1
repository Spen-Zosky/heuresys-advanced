# =============================================================================
# db/scripts/create_local_database.ps1
# -----------------------------------------------------------------------------
# CANONICAL — Model A (localhost native PostgreSQL on Windows PC).
#
# Creates the PostgreSQL role, database and canonical schemas
# (sys + aux: brownfield, staging, audit). Idempotent: every object
# uses IF NOT EXISTS or a DO-block guard.
#
# For Model B (OCI VM oracle-vm-default, current per ADR-0010 RD-25) use
# `setup_oci_vm_database.sh` instead — this script connects to the
# superuser via psql, which is not the canonical path on the VM where
# auth is `peer` for `postgres` and `scram-sha-256` for tunnelled hosts.
#
# Reads connection parameters from .env at repo root (or path passed via -EnvFile).
# Requires: psql.exe in PATH (or under C:\Program Files\PostgreSQL\16\bin).
# =============================================================================

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env"
)

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# .env loader (simple KEY=VALUE parser; ignores comments and blank lines)
# -----------------------------------------------------------------------------
if (-not (Test-Path $EnvFile)) {
    Write-Error "[create_local_database] .env not found at $EnvFile. Copy .env.example to .env and configure."
    exit 1
}
Get-Content $EnvFile | Where-Object {
    $_ -match "^\s*[A-Z_][A-Z0-9_]*\s*=" -and $_ -notmatch "^\s*#"
} | ForEach-Object {
    $kv = $_ -split "=", 2
    $key = $kv[0].Trim()
    $val = $kv[1].Trim().Trim('"')
    Set-Item -Path "env:$key" -Value $val
}

$dbHost = $env:POSTGRES_HOST
$dbPort = $env:POSTGRES_PORT
$super  = $env:POSTGRES_SUPERUSER
$superPwd = $env:POSTGRES_SUPERUSER_PASSWORD
$db     = $env:POSTGRES_DB
$role   = $env:POSTGRES_USER
$rolePwd = $env:POSTGRES_PASSWORD

if (-not $super -or -not $superPwd) {
    Write-Host "[create_local_database] POSTGRES_SUPERUSER / POSTGRES_SUPERUSER_PASSWORD empty."
    Write-Host "  → This is expected on Model B (OCI VM). Run setup_oci_vm_database.sh instead."
    Write-Host "  → If you intend to bootstrap a localhost PostgreSQL (Model A), fill both .env vars."
    exit 1
}

# -----------------------------------------------------------------------------
# Resolve psql.exe path (absolute first, fall back to PATH)
# -----------------------------------------------------------------------------
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
if (-not $Psql) {
    Write-Error "[create_local_database] psql.exe not found. Install PostgreSQL 16 client or add to PATH."
    exit 1
}

$env:PGPASSWORD = $superPwd

function Invoke-PsqlSuper([string]$Sql, [string]$Database = "postgres") {
    & $Psql -h $dbHost -p $dbPort -U $super -d $Database -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

# -----------------------------------------------------------------------------
# 1. Role (idempotent via DO block — CREATE ROLE has no IF NOT EXISTS)
# -----------------------------------------------------------------------------
$createRoleSql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN
    CREATE ROLE $role WITH LOGIN PASSWORD '$rolePwd' CREATEDB;
  ELSE
    -- Refresh password and ensure CREATEDB on existing role (idempotent)
    ALTER ROLE $role WITH LOGIN PASSWORD '$rolePwd' CREATEDB;
  END IF;
END
`$`$;
"@
Write-Host "[create_local_database] Ensuring role '$role' exists..."
Invoke-PsqlSuper $createRoleSql

# -----------------------------------------------------------------------------
# 2. Database (cannot run inside DO block; check existence then CREATE)
# -----------------------------------------------------------------------------
$dbExists = & $Psql -h $dbHost -p $dbPort -U $super -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'"
if (-not $dbExists) {
    Write-Host "[create_local_database] Creating database '$db' (owner $role)..."
    Invoke-PsqlSuper "CREATE DATABASE $db OWNER $role ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C.UTF-8';"
} else {
    Write-Host "[create_local_database] Database '$db' already exists, skipping CREATE."
}

# -----------------------------------------------------------------------------
# 3. Schemas (sys canonical + 3 auxiliary)
# -----------------------------------------------------------------------------
$schemaSql = @"
CREATE SCHEMA IF NOT EXISTS sys        AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS staging    AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION $role;
CREATE SCHEMA IF NOT EXISTS audit      AUTHORIZATION $role;
GRANT USAGE ON SCHEMA sys, staging, brownfield, audit TO $role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT USAGE, SELECT ON SEQUENCES TO $role;
"@
Write-Host "[create_local_database] Ensuring schemas sys/staging/brownfield/audit..."
Invoke-PsqlSuper $schemaSql -Database $db

# -----------------------------------------------------------------------------
# 4. Extensions (pgcrypto + uuid-ossp + pg_trgm + pg_stat_statements)
#    pg_stat_statements backs the B7 slow-queries endpoint. It needs the library in
#    shared_preload_libraries too (cluster-level, restart required, never carried by a
#    dump); without it the view exists but every read fails with SQLSTATE 55000 — the
#    exact failure that turned CI red in S1029. The endpoint degrades instead of 500ing,
#    so a missing preload costs the panel, not the page.
# -----------------------------------------------------------------------------
$extSql = @"
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
"@
Write-Host "[create_local_database] Ensuring extensions..."
Invoke-PsqlSuper $extSql -Database $db

Write-Host ""
Write-Host "OK: role=$role, database=$db, schemas=(sys, staging, brownfield, audit), extensions=(pgcrypto, uuid-ossp, pg_trgm)"
Write-Host "Next step: ./db/scripts/migrate.ps1"
