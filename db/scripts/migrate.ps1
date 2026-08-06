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

# ---------------------------------------------------------------------------
# MIGRAZIONI UNA-TANTUM (#140) — stesso contratto di migrate.sh.
#
# Un file marcato in testata con `-- @migrate: once` viene saltato se il registro
# lo riporta con la STESSA impronta. Senza marcatore nulla cambia: le 166
# post-condizioni della catena continuano a girare a ogni esecuzione.
# MIGRATE_FORCE_ALL=1 riapplica tutto.
#
# Questo gemello DEVE restare allineato a migrate.sh: `pnpm db:migrate` chiama
# questo, il deploy chiama quello. Se solo uno filtrasse, la stessa catena si
# comporterebbe in due modi diversi a seconda di chi la lancia — che e' peggio
# del difetto che stiamo correggendo.
# ---------------------------------------------------------------------------
$ForceAll = ($env:MIGRATE_FORCE_ALL -eq '1')
$Ledger = @{}
if (-not $ForceAll) {
    # Su un database nuovo la tabella non esiste ancora: non e' un errore, il
    # registro resta vuoto e nulla viene saltato.
    $rows = & $Psql -h $env:POSTGRES_HOST -p $env:POSTGRES_PORT -U $env:POSTGRES_USER `
                    -d $env:POSTGRES_DB -tA -F '|' `
                    -c "SELECT file_name, sha256 FROM sys.sys_schema_migrations" 2>$null
    foreach ($r in $rows) {
        $parts = $r -split '\|'
        if ($parts.Count -ge 2 -and $parts[0]) { $Ledger[$parts[0].Trim()] = $parts[1].Trim() }
    }
}
if ($ForceAll) { Write-Host "[migrate] MIGRATE_FORCE_ALL=1 - riapplico TUTTO, marcatori ignorati." }

$applied = 0
$skipped = 0
foreach ($f in $files) {
    $start = Get-Date
    $sha = (Get-FileHash -Algorithm SHA256 $f.FullName).Hash.ToLower()

    # Il marcatore si cerca solo nella TESTATA: piu' avanti sarebbe prosa, e una
    # migrazione che PARLA di `@migrate: once` non deve auto-marcarsi.
    $head = Get-Content -LiteralPath $f.FullName -TotalCount 20
    $isOnce = [bool]($head | Where-Object { $_ -match '^--\s*@migrate:\s*once\s*$' })
    if ((-not $ForceAll) -and $isOnce -and $Ledger.ContainsKey($f.Name) -and $Ledger[$f.Name] -eq $sha) {
        Write-Host "[migrate] SALTATA $($f.Name) (una-tantum, gia' applicata con la stessa impronta)"
        $skipped++
        continue
    }

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
if ($skipped -gt 0) {
    Write-Host "OK: $applied migrations applied, $skipped skipped (una-tantum gia' applicate)."
    Write-Host "[migrate] per rifarle comunque: `$env:MIGRATE_FORCE_ALL='1'"
} else {
    Write-Host "OK: $applied migrations applied."
}
