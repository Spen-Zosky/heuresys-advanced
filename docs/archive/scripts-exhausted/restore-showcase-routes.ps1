param(
    [switch]$DryRun
)

# restore-showcase-routes.ps1
# Heuresys Advanced — S935 Path G/A pre-step: restore /showcase routes from
# apps/web/src/_disabled_showcase_X18/ to apps/web/src/app/showcase/.
#
# Run this AFTER applying the React pnpm.overrides (Path G hypothesis test)
# and BEFORE the revised bisect script. If Path G works (build clean), no
# bisect needed; close DEFER-F as MITIGATED.
#
# Idempotent: if apps/web/src/app/showcase already exists, exits 0 with note.
# Use -DryRun to preview without changes.

$ErrorActionPreference = "Stop"
$srcDir = "apps\web\src\_disabled_showcase_X18"
$dstDir = "apps\web\src\app\showcase"
$tsconfig = "apps\web\tsconfig.json"

Write-Host "=== Restore /showcase routes — starting ===" -ForegroundColor Cyan

if (-not (Test-Path $srcDir)) {
    Write-Host "ERROR: source dir not found: $srcDir" -ForegroundColor Red
    Write-Host "Either already restored (check $dstDir) or repo is in unexpected state." -ForegroundColor Red
    exit 1
}

if (Test-Path $dstDir) {
    Write-Host "NOTE: destination already exists: $dstDir" -ForegroundColor Yellow
    Write-Host "Assuming idempotent — exiting 0. Delete $dstDir manually to force re-restore." -ForegroundColor Yellow
    exit 0
}

if ($DryRun) {
    Write-Host "DRY RUN — would do the following:" -ForegroundColor Yellow
    Write-Host "  1. Move-Item $srcDir → $dstDir" -ForegroundColor DarkGray
    Write-Host "  2. Edit $tsconfig — remove the exclude entry for _disabled_showcase_X18" -ForegroundColor DarkGray
    Write-Host "  3. pnpm install (to refresh)" -ForegroundColor DarkGray
    exit 0
}

# Move the directory
Write-Host "Moving $srcDir → $dstDir..." -ForegroundColor Yellow
Move-Item -Path $srcDir -Destination $dstDir -Force

# Edit tsconfig to remove the exclude
Write-Host "Updating $tsconfig (remove _disabled_showcase_X18 from exclude)..." -ForegroundColor Yellow
$tsconfigContent = Get-Content $tsconfig -Raw
$updatedContent = $tsconfigContent -replace '\s*"src/_disabled_showcase_X18[^"]*",?\s*\n?', ''
$updatedContent | Set-Content $tsconfig -NoNewline

# Refresh lockfile
Write-Host "Running pnpm install..." -ForegroundColor Yellow
& pnpm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: pnpm install failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== Restore complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Try Path G: pnpm --filter '@heuresys/web' build (should pass with React overrides)" -ForegroundColor Yellow
Write-Host "  2. If still fails with createContext error: run scripts/bisect-cw-b59-createctx.ps1" -ForegroundColor Yellow
Write-Host "  3. If bisect inconclusive: split @heuresys/ui per docs/cw-b59-true-root-cause §6" -ForegroundColor Yellow
