# =============================================================================
# db/scripts/migrate.ps1
# -----------------------------------------------------------------------------
# Applies db/migrations/*.sql in lexical order against the database in .env.
# Records each apply in sys.sys_schema_migrations (idempotent upsert).
#
# Works for Model A (localhost) and Model B (OCI VM via tunnel) — connects
# as POSTGRES_USER (no superuser needed; assumes create_local_database.ps1
# or setup_oci_vm_database.sh already ran once).
#
# Each migration is wrapped in `psql -1 -f <file>` so the file runs as a
# single transaction; if any statement fails, nothing commits.
# =============================================================================

[CmdletBinding()]
param(
    [string]$EnvFile = "$PSScriptRoot\..\..\.env",
    [string]$MigrationsDir = "$PSScriptRoot\..\migrations"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $EnvFile)) { Write-Error "[migrate] .env not found at $EnvFile"; exit 1 }
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
if (-not $Psql) { Write-Error "[migrate] psql.exe not found."; exit 1 }

if (-not (Test-Path $MigrationsDir)) {
    Write-Host "[migrate] No migrations directory at $MigrationsDir (yet). Nothing to apply."
    exit 0
}

$files = Get-ChildItem -Path $MigrationsDir -Filter "*.sql" | Sort-Object Name
if ($files.Count -eq 0) {
    Write-Host "[migrate] db/migrations/ is empty. Nothing to apply."
    exit 0
}

$applied = 0
foreach ($f in $files) {
    $start = Get-Date
    $sha = (Get-FileHash -Algorithm SHA256 $f.FullName).Hash.ToLower()
    Write-Host "[migrate] applying $($f.Name) (sha256=$($sha.Substring(0,12)))"

    & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -v ON_ERROR_STOP=1 -1 -f $f.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[migrate] migration $($f.Name) FAILED (exit $LASTEXITCODE)."
        exit 1
    }
    $duration = [int]((Get-Date) - $start).TotalMilliseconds

    # Audit upsert. Note: sys.sys_schema_migrations is created by 000002 itself.
    # The first migration (000001 init_extensions) runs BEFORE the audit table
    # exists, so we guard the upsert with a "table-exists" check.
    $upsert = @"
DO `$`$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='sys' AND table_name='sys_schema_migrations') THEN
    INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_at, applied_by, duration_ms)
    VALUES ('$($f.Name)', '$sha', now(), current_user, $duration)
    ON CONFLICT (file_name) DO UPDATE
       SET sha256      = EXCLUDED.sha256,
           applied_at  = EXCLUDED.applied_at,
           applied_by  = EXCLUDED.applied_by,
           duration_ms = EXCLUDED.duration_ms;
  END IF;
END
`$`$;
"@
    & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER -d $env:POSTGRES_DB -v ON_ERROR_STOP=1 -c $upsert | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error "[migrate] audit upsert for $($f.Name) FAILED."
        exit 1
    }
    $applied++
}

Write-Host ""
Write-Host "OK: $applied migrations applied."
