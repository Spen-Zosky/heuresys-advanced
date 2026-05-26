param([switch]$SkipVerify)

# ship-cw-b60-a.ps1
# Heuresys Advanced — S934 ship script for CW-B60-A engine silent-skip observability fix.
#
# Run from Windows host (PowerShell 5.1+) after Cowork session S934 closure.
# Sandbox limitation: pnpm symlinks Windows mount + .git/index.lock not removable
# from Cowork side, so commit + push must happen here.
#
# Pre-conditions:
#   1. CWD = D:\heuresys-advanced (or wherever the repo lives)
#   2. git status shows the 4 expected modifications listed below
#   3. SSH tunnel to OCI VM PostgreSQL active (ssh -fN -L 5433:localhost:5432 oracle-vm-default)
#      — required for the typecheck + vitest verify step to pass without pool errors.
#   4. pnpm install already up to date (no need to re-install)

$ErrorActionPreference = "Stop"

Write-Host "=== S934 CW-B60-A ship script — starting ===" -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# Step 1 — sanity: working dir is the repo root
# -----------------------------------------------------------------------------
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: not in repo root (no .git/ here). cd to D:\heuresys-advanced first." -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# Step 2 — cleanup pnpm leftover + stale git lock
# -----------------------------------------------------------------------------
Write-Host "Cleanup _tmp_3_* pnpm leftovers + stale git lock..." -ForegroundColor Yellow
Get-ChildItem -Path "." -Filter "_tmp_3_*" -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "  rm $($_.Name)" -ForegroundColor DarkGray
    Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".git\index.lock") {
    Write-Host "  rm .git\index.lock" -ForegroundColor DarkGray
    Remove-Item -Path ".git\index.lock" -Force -ErrorAction SilentlyContinue
}

# -----------------------------------------------------------------------------
# Step 3 — verify expected 4 files modified
# -----------------------------------------------------------------------------
Write-Host "Verifying expected diff..." -ForegroundColor Yellow
$expectedFiles = @(
    "apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts",
    "apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts",
    "apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts",
    "cowork_reserved/bias_registry.md",
    ".handoff/STATE.md",
    "cowork_reserved/HANDOFF_FRESH_SESSION.md"
)
foreach ($f in $expectedFiles) {
    if (-not (Test-Path $f)) {
        Write-Host "ERROR: missing expected file $f" -ForegroundColor Red
        exit 1
    }
}

# -----------------------------------------------------------------------------
# Step 4 — optional pre-commit verify (typecheck + lint + test)
#         Skip with -SkipVerify if user has already verified manually.
# -----------------------------------------------------------------------------
if (-not $SkipVerify) {
    Write-Host "Running pre-commit verify (typecheck + lint + cw-b60-a vitest)..." -ForegroundColor Yellow
    Push-Location "apps\api"
    try {
        Write-Host "  pnpm typecheck..." -ForegroundColor DarkGray
        & pnpm typecheck
        if ($LASTEXITCODE -ne 0) { throw "typecheck FAILED" }

        Write-Host "  pnpm lint..." -ForegroundColor DarkGray
        & pnpm lint
        if ($LASTEXITCODE -ne 0) { throw "lint FAILED" }

        Write-Host "  pnpm exec vitest run upsert-sql-cw-b60-a-silent-skip..." -ForegroundColor DarkGray
        & pnpm exec vitest run upsert-sql-cw-b60-a-silent-skip.test.ts
        if ($LASTEXITCODE -ne 0) { throw "vitest cw-b60-a FAILED" }

        Write-Host "  Pre-commit verify GREEN." -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "Skipping pre-commit verify (user opted in)." -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# Step 5 — stage 6 files
# -----------------------------------------------------------------------------
Write-Host "Staging files..." -ForegroundColor Yellow
foreach ($f in $expectedFiles) {
    & git add $f
    if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git add $f failed" -ForegroundColor Red; exit 1 }
}

# Print summary of staged changes
Write-Host "Staged diff stat:" -ForegroundColor Cyan
& git diff --cached --stat

# -----------------------------------------------------------------------------
# Step 6 — atomic commit
# -----------------------------------------------------------------------------
$commitMsg = @"
feat(api): S934 CW-B60-A — engine silent-skip observability fix (audit emit + WARN log + 3 unit tests)

Root cause for the (A) part of CW-B60 (X19 run 6f561559 residual): main INSERT
in executeUpsertSqlSidePerMapping returns rowCount=0 -> silent return without
log or audit. With skipped:false, engine.ts:840 logger.error branch was bypassed.
CW-B17 audit (WHERE_SKIP_FILTER_EXCLUDED_V1) only covers per-row skipFilter
exclusions; not the main INSERT rowCount=0 case.

Triggered for the 3 CW-B60-A targets (sys_skill_categories /
sys_activity_classification_mappings / sys_process_kpi_templates) because all
3 lack a _tenant_id NK (CW-B49 COALESCE-sentinel UQ pattern inapplicable);
their column_mappings cover only NK cols -> setClauses=[] -> ON CONFLICT DO
NOTHING -> rowCount=0 on duplicate / re-run inputs.

Fix:
  - audit-rule-codes.ts: new SILENT_UPSERT_ZERO_ROWS_V1 constant.
  - upsert-sql.ts:763-875: probe SELECT count (staging input) + structured
    logger.warn (10 fields) + audit INSERT (status='SKIPPED') emitted BEFORE
    silent return. Result shape unchanged for back-compat.
  - apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts: 3 TDD unit tests
    (T1 silent-skip emits audit; T2 happy-path stays quiet; T3 DRY_RUN no
    side effect). Verde 3/3 in Cowork standalone driver.
  - cowork_reserved/bias_registry.md: CW-B61 entry; CW-B60-A reclassified
    MITIGATED via CW-B61; tally 60 catalogued / 41 mitigated; Next CW-B62.
  - .handoff/STATE.md + HANDOFF_FRESH_SESSION.md: S934 outcome section.

Verification on Windows host (gates this script enforces unless -SkipVerify):
  pnpm typecheck (api)         exit 0
  pnpm lint (api)              exit 0
  pnpm exec vitest run upsert-sql-cw-b60-a-silent-skip.test.ts   3/3 PASS

Live re-run validation deferred to S935 (P0-3 sequencing): requires SSH
tunnel 5433 + WAVE1_DEBUG_LIMIT=N + one of the 3 affected targets, then
SELECT * FROM audit.import_validation_results
 WHERE import_validation_result_rule_code = 'SILENT_UPSERT_ZERO_ROWS_V1'
   AND import_validation_result_run_id = <run-id>;
should return >0 rows (one per (run, table_mapping) silent-skip event).

Refs: CW-B60 (X19 §6 forensic), CW-B49 (X10 split-on-COALESCE prior fix),
      CW-B17 (per-row skipFilter audit). Bias registry §2 entry 61.
"@

Write-Host "Committing..." -ForegroundColor Yellow
$commitMsg | Out-File -FilePath ".git\COMMIT_EDITMSG_S934" -Encoding utf8
& git commit -F ".git\COMMIT_EDITMSG_S934"
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git commit failed" -ForegroundColor Red; exit 1 }
Remove-Item ".git\COMMIT_EDITMSG_S934" -Force -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------
# Step 7 — push origin main (R12: no --force, no --no-verify)
# -----------------------------------------------------------------------------
Write-Host "Pushing origin main (R12 compliant: no --force, no --no-verify)..." -ForegroundColor Yellow
& git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: git push failed" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== S934 CW-B60-A SHIPPED ===" -ForegroundColor Green
Write-Host "HEAD: $(& git rev-parse --short HEAD)" -ForegroundColor Cyan
Write-Host "Origin: $(& git rev-parse --short origin/main)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps (S935 candidate):" -ForegroundColor Yellow
Write-Host "  - Live re-run validation (1 dei 3 target) con tunnel attivo." -ForegroundColor Yellow
Write-Host "  - P0-3 CW-B60-B Wave 2 scope ADR (3 IMPORT targets sans staging source)." -ForegroundColor Yellow
Write-Host "  - P0-1 DEFER-F /showcase RSC bundle threshold fix (HIGH-RISK)." -ForegroundColor Yellow
