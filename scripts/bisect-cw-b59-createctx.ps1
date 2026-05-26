param(
    [string]$BadCommit = "HEAD",
    [string]$GoodCommit = "e13eb73"
)

# bisect-cw-b59-createctx.ps1
# Heuresys Advanced — S935 Path A revised bisect for CW-B59 /showcase build failure.
#
# Replaces the X18.4 iter scripts (which only checked exit code) with a
# message-grep bisect: looks for "createContext is not a function" in the
# Next.js build stderr. Converges to the first commit that introduced the
# React peer-dep mismatch or missing 'use client' directive.
#
# Pre-requisites:
#   1. /showcase routes must be restored (apps/web/src/app/showcase/ exists).
#      Use scripts/restore-showcase-routes.ps1 first.
#   2. apps/web/tsconfig.json must include /showcase paths (not in exclude).
#   3. pnpm install completed on each bisect step (we re-install per iteration).
#
# Usage:
#   pwsh -File scripts/bisect-cw-b59-createctx.ps1 -BadCommit HEAD -GoodCommit e13eb73

$ErrorActionPreference = "Stop"

Write-Host "=== CW-B59 Path A revised bisect — starting ===" -ForegroundColor Cyan
Write-Host "Bad commit: $BadCommit" -ForegroundColor Yellow
Write-Host "Good commit: $GoodCommit" -ForegroundColor Yellow

# Initialize bisect
& git bisect start $BadCommit $GoodCommit
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git bisect start failed" -ForegroundColor Red; exit 1 }

$iter = 0
$logDir = "qa_artifacts\bisect-cw-b59-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Write-Host "Iteration logs in: $logDir" -ForegroundColor Cyan

while ($true) {
    $iter += 1
    $currentSha = (& git rev-parse --short HEAD).Trim()
    $iterLog = "$logDir\iter_$iter`_$currentSha.txt"
    Write-Host ""
    Write-Host "=== Iter $iter — testing $currentSha ===" -ForegroundColor Cyan

    # Refresh lockfile (overrides may have changed)
    & pnpm install --no-frozen-lockfile *> "$iterLog.install.log"

    # Run web build, capture stderr+stdout
    $buildOutput = (& pnpm --filter '@heuresys/web' build 2>&1) | Out-String
    $buildOutput | Out-File -FilePath $iterLog -Encoding utf8

    # Classify result
    if ($buildOutput -match "createContext is not a function") {
        Write-Host "  BAD: createContext error reproduced" -ForegroundColor Red
        $result = & git bisect bad
    } elseif ($buildOutput -match "(?ms)Compiled successfully|Generating static pages") {
        Write-Host "  GOOD: build clean" -ForegroundColor Green
        $result = & git bisect good
    } else {
        Write-Host "  SKIP: unrelated failure (neither createContext nor success markers found)" -ForegroundColor Yellow
        $result = & git bisect skip
    }

    # Check if bisect converged
    $resultText = $result | Out-String
    if ($resultText -match "is the first bad commit") {
        Write-Host ""
        Write-Host "=== BISECT CONVERGED ===" -ForegroundColor Green
        Write-Host $resultText
        $resultText | Out-File -FilePath "$logDir\CONVERGED.txt" -Encoding utf8
        break
    }

    # Safety: max 20 iter (range $GoodCommit..$BadCommit log2 < 15 for ~32k commits)
    if ($iter -ge 20) {
        Write-Host "MAX ITER REACHED — manual investigation required" -ForegroundColor Yellow
        break
    }
}

Write-Host ""
Write-Host "Restoring HEAD..." -ForegroundColor Cyan
& git bisect reset

Write-Host ""
Write-Host "=== DONE — review $logDir for findings ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. If converged: inspect the bad commit diff for createContext / 'use client' / peer-dep changes." -ForegroundColor Yellow
Write-Host "  2. Apply mirror fix in ux-design-shared/ui source and republish @heuresys/ui as 0.1.2." -ForegroundColor Yellow
Write-Host "  3. Bump dep here and re-build to confirm." -ForegroundColor Yellow
Write-Host "  4. If NOT converged: fall to Path F (split @heuresys/ui) per docs/cw-b59-true-root-cause-2026-05-26.md §6." -ForegroundColor Yellow
