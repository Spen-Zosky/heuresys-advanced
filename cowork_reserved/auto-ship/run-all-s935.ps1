param(
    [switch]$SkipVerify,
    [ValidateSet("A", "B", "C", "E", "F", "D", "Z")]
    [string]$FromPhase = "A",
    [switch]$NoPush
)

# run-all-s935.ps1 - Master ship script for Cowork S935 sequence.
# Heuresys Advanced (ships A=S934 + B/C/E/F/D=S935 + Z=closure).
#
# Run from Windows host (PowerShell 5.1+) at repo root.
# Sandbox limitation: Cowork cannot commit/push directly (pnpm symlinks
# Windows mount + .git/index.lock). This script bridges by executing all
# the commits + tags + push that Cowork has already authored in the
# working tree.
#
# Flags:
#   -SkipVerify    skip pnpm typecheck/lint/test per phase (faster, less safe)
#   -FromPhase X   resume from phase X if a previous run halted (A/B/C/E/F/D/Z)
#   -NoPush        commit + tag but skip git push (manual push later)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: not in repo root (no .git/ here). cd to D:\heuresys-advanced first." -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$logDir = "cowork_reserved\auto-ship"
$logFile = "$logDir\run-$timestamp.log"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Message"
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path $logFile -Value $line
}

Write-Log "=== S935 master ship script - starting ===" "Cyan"
Write-Log "Log file: $logFile" "Cyan"
Write-Log "FromPhase: $FromPhase | SkipVerify: $SkipVerify | NoPush: $NoPush" "Cyan"

# -----------------------------------------------------------------------------
# Cleanup leftover
# -----------------------------------------------------------------------------
Write-Log "Cleanup pnpm leftover + stale git lock..." "Yellow"
Get-ChildItem -Path "." -Filter "_tmp_3_*" -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Log "  rm $($_.Name)" "DarkGray"
    Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
}
if (Test-Path ".git\index.lock") {
    Write-Log "  rm .git\index.lock" "DarkGray"
    Remove-Item -Path ".git\index.lock" -Force -ErrorAction SilentlyContinue
}

# -----------------------------------------------------------------------------
# Helper: verify pnpm gates per phase
# -----------------------------------------------------------------------------
function Invoke-Gates {
    param([string]$Phase, [string[]]$Gates)
    if ($SkipVerify) {
        Write-Log "  [SKIP VERIFY] phase $Phase gates: $($Gates -join ', ')" "Yellow"
        return
    }
    foreach ($gate in $Gates) {
        Write-Log "  [VERIFY $Phase] $gate" "DarkGray"
        switch ($gate) {
            "typecheck-api" {
                Push-Location "apps\api"
                & pnpm typecheck
                $rc = $LASTEXITCODE
                Pop-Location
                if ($rc -ne 0) { throw "typecheck api FAILED in phase $Phase" }
            }
            "typecheck-web" {
                Push-Location "apps\web"
                & pnpm typecheck
                $rc = $LASTEXITCODE
                Pop-Location
                if ($rc -ne 0) { throw "typecheck web FAILED in phase $Phase" }
            }
            "lint-api" {
                Push-Location "apps\api"
                & pnpm lint
                $rc = $LASTEXITCODE
                Pop-Location
                if ($rc -ne 0) { throw "lint api FAILED in phase $Phase" }
            }
            "lint-web" {
                Push-Location "apps\web"
                & pnpm lint
                $rc = $LASTEXITCODE
                Pop-Location
                if ($rc -ne 0) { throw "lint web FAILED in phase $Phase" }
            }
            "test-cw-b60-a" {
                Push-Location "apps\api"
                & pnpm exec vitest run upsert-sql-cw-b60-a-silent-skip.test.ts
                $rc = $LASTEXITCODE
                Pop-Location
                if ($rc -ne 0) { throw "vitest cw-b60-a FAILED in phase $Phase" }
            }
            "i18n-check" {
                & pnpm i18n:check
                if ($LASTEXITCODE -ne 0) { throw "i18n parity FAILED in phase $Phase" }
            }
            default { Write-Log "  [WARN] unknown gate '$gate' for phase $Phase" "Yellow" }
        }
    }
}

# -----------------------------------------------------------------------------
# Helper: stage + commit
# -----------------------------------------------------------------------------
function Invoke-CommitPhase {
    param(
        [string]$Phase,
        [string[]]$Paths,
        [string]$Subject,
        [string]$Body
    )

    Write-Log "[COMMIT $Phase] staging $($Paths.Count) paths..." "Yellow"
    foreach ($p in $Paths) {
        if (-not (Test-Path $p)) {
            Write-Log "  WARN: path $p not found, skipping" "Yellow"
            continue
        }
        & git add $p
        if ($LASTEXITCODE -ne 0) { throw "git add $p FAILED in phase $Phase" }
    }

    $staged = & git diff --cached --name-only
    if (-not $staged) {
        Write-Log "  [SKIP COMMIT] nothing staged for phase $Phase (already committed?)" "Yellow"
        return
    }

    $fullMsg = $Subject + "`n`n" + $Body
    $msgFile = "$logDir\COMMIT_MSG_$Phase.tmp"
    $fullMsg | Out-File -FilePath $msgFile -Encoding utf8 -NoNewline
    & git commit -F $msgFile
    if ($LASTEXITCODE -ne 0) { throw "git commit FAILED in phase $Phase" }
    Remove-Item $msgFile -Force -ErrorAction SilentlyContinue

    $newSha = (& git rev-parse --short HEAD).Trim()
    Write-Log "  [DONE $Phase] commit $newSha - $Subject" "Green"
}

# -----------------------------------------------------------------------------
# Phase ordering check
# -----------------------------------------------------------------------------
$phaseOrder = @{ "A" = 1; "B" = 2; "C" = 3; "E" = 4; "F" = 5; "D" = 6; "Z" = 7 }
function Test-ShouldRun { param([string]$P) return $phaseOrder[$P] -ge $phaseOrder[$FromPhase] }

# =============================================================================
# Commit message bodies (single-quote here-strings = no $ interpolation)
# =============================================================================

$bodyA = @'
Root cause for the (A) part of CW-B60: main INSERT in
executeUpsertSqlSidePerMapping returned rowCount=0 without log or audit.
With skipped:false, engine.ts:840 logger.error branch was bypassed.
CW-B17 audit (WHERE_SKIP_FILTER_EXCLUDED_V1) only covers per-row skipFilter
exclusions; not the main INSERT rowCount=0 case.

Triggered for sys_skill_categories, sys_activity_classification_mappings,
sys_process_kpi_templates: all lack _tenant_id NK (CW-B49 pattern
inapplicable). column_mappings cover only NK cols -> setClauses=[] ->
ON CONFLICT DO NOTHING -> rowCount=0 on duplicates.

Fix:
  - audit-rule-codes.ts: new SILENT_UPSERT_ZERO_ROWS_V1 rule code.
  - upsert-sql.ts lines 763-875: probe SELECT count + structured logger.warn
    + audit INSERT status SKIPPED before silent return. Back-compat preserved.
  - apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts: 3 TDD tests
    (T1 silent emits audit; T2 happy quiet; T3 DRY_RUN no side effect).
  - ship-cw-b60-a.ps1: legacy ship script (kept for archive; superseded
    by cowork_reserved/auto-ship/run-all-s935.ps1).

Refs: CW-B60 (X19), CW-B49 (X10), CW-B17 (per-row audit).
'@

$bodyB = @'
3 brownfield.table_mappings entries (sys_blueprint_overrides,
sys_position_skill_requirements, sys_position_learning_requirements)
were IMPORT/APPROVED but the engine has no staging.wave1_* tables for
them -> stagingTableFor returns null -> silent skip at engine.ts:764.

Schema analysis: all 3 carry created_by/updated_by FK to sys_users +
tenant-scoped activation/position deps. Application-level operational
data, not catalog/reference data. Forcing legacy import would forge
data the original users never produced (semantic mismatch).

Decision (ADR-0020):
  - Reclassify IMPORT -> REFERENCE_ONLY via migration 000044 (idempotent).
  - Legacy source mappings remain documented for lineage trail.
  - MVP_4_ROADMAP section 2.1 amended with explicit out-of-scope note.

4 alternatives considered + rejected: Wave-2 import (semantic mismatch),
computed views (collides with user-editable design intent), status quo
(silent-skip anti-pattern), hybrid (exception fatigue).

Closes CW-B60-B forensic gap. Combined with CW-B61 (S934), engine now
has zero unexplained silent paths in the Wave-1 happy path.

Refs: ADR-0020, CW-B60-B bias_registry entry, migration 000044.
'@

$bodyC = @'
S935 phase C empirical re-read of qa_artifacts/x18_4_bisect_iter_12.txt
shows the /showcase build failure is "TypeError: d.createContext is not
a function" -- NOT a Next 15 RSC bundle threshold (that was a narrative
bias, CW-B58 lesson). True root cause hypotheses:

1. React peer-dep mismatch (two React instances in bundle).
2. "use client" missing on a Radix-UI component in @heuresys/ui.
3. CJS/ESM interop drift (tsup dual output).

3-path strategy (G then A then F):
  - Path G (10 min quick-win): pnpm.overrides for react + react-dom +
    @types/react + @types/react-dom in package.json. Forces single React
    instance. If fixes -> close CW-B59 MITIGATED.
  - Path A revised (1-2h): scripts/bisect-cw-b59-createctx.ps1 -- message-
    grep bisect (NOT exit-code-only as X18.4 iter scripts did), looking
    for "createContext is not a function" marker.
  - Path F fallback (4-6h): split @heuresys/ui in 3 sub-packages.

Pre-step: scripts/restore-showcase-routes.ps1 -- moves _disabled_showcase_X18
back to apps/web/src/app/showcase (auto-resolves CODE-5 if Path G works).

CW-B59 status flipped "deferred-proper-fix" -> "partial-mitigation-S935-
investigation-shipped". Full resolution after live test on Windows.

Refs: CW-B59 bias_registry entry, docs/cw-b59-true-root-cause-2026-05-26.md,
qa_artifacts/x18_4_bisect_iter_12.txt (empirical evidence).
'@

$bodyE = @'
Procedural deliverables for S935 phase E:
  - docs/github/branch-protection.md: canonical branch protection rules
    (linear history + status checks gating S935 F + force-push disabled
    + admin-included). Apply script + verification commands.
  - docs/github/dependabot-triage-2026-05-26.md: 4-bucket triage matrix
    MERGE_NOW / MERGE_BATCH / DEFER_MAJOR / CLOSE_DUPLICATE + qs dual-
    resolution verify + pnpm audit gate + defer-major decision log.
  - apps/api/src/config/env.ts: MFA_ENCRYPTION_KEY now has min 32 byte
    validation + soft-warn (NOT hard-fail per back-compat) when absent
    in NODE_ENV=production. Mirror CW-B61 observability doctrine.

R11 secret hygiene preserved (no literal secrets in YAML / docs).

Refs: docs/github/, apps/api/src/config/env.ts.
'@

$bodyF = @'
6 GitHub Actions workflows shipped (runs-on: [self-hosted, oci-vm]):
  - typecheck.yml: all 4 workspaces strict TS pass
  - lint.yml: ESLint flat config 9.x clean
  - i18n-parity.yml: it/en JSON parity
  - test-integration.yml: 41 vitest integration tests (DB-backed)
  - build-web.yml: Next.js production build (catches React peer-dep drift)
  - playwright-smoke.yml: E2E smoke suite

Path-based scoping aggressive (docs/cowork commits skip CI -> zero
cumulative GH minutes for doc-only pushes). Concurrency per-ref with
cancel-in-progress where safe.

R11 secret hygiene via runner systemd EnvironmentFile
(/etc/heuresys-runner.env, mode 600 root-owned). NO literal secrets in YAML.

Setup docs:
  - docs/ci/self-hosted-runners-setup.md: 9-section procedure (OCI VM
    prerequisites, runner registration via gh, EnvironmentFile, pre-job
    seed check, verification, maintenance, Windows backup deferred).
  - docs/ci/workflows-overview.md: inventory + scoping + failure handling
    + manual dispatch + template for adding new workflows.

Backup Windows runner: DEFERRED S936+ (OCI uptime >99.9% in 2026).

Refs: .github/workflows/*.yml, docs/ci/.
'@

$bodyD = @'
S935 phase D -- 3 inline cleanup fixes + 2 deferred items documented:

CODE-2 (apps/api dead scripts):
  - Removed "test:integration" (referenced vitest.integration.config.ts
    that does not exist).
  - Removed "openapi:generate" (referenced scripts/generate-openapi.ts
    that does not exist).
  - Root package.json: removed pnpm filter-call openapi:generate (dead).

CODE-3 (Tailwind 4 source-scan portability):
  - apps/web/src/app/globals.css @source path changed from
    "../../../../../ux-design-shared/ui/src/**/*.{ts,tsx}" (working-copy
    dependent, non-portable) to
    "node_modules/@heuresys/ui/dist/**/*.{js,mjs}" (npm-resolved, portable
    across machines including CI runners).

CODE-7 (apps/web dead vitest script):
  - Removed "test": "vitest run" from apps/web/package.json (apps/web has
    only Playwright E2E in tests/e2e/*.spec.ts, no vitest unit tests).
  - test:e2e retained.

CODE-5 (DEFERRED auto-coordinated with phase C):
  - scripts/restore-showcase-routes.ps1 (S935 C) MOVES _disabled_showcase_X18
    -> apps/web/src/app/showcase, auto-resolving CODE-5 if Path G works.

CODE-10 (i18n discovery DEFERRED):
  - docs/preflight-residual-todo.md section 2 documents approach + effort
    (~2-4h once UI surface stabilizes post-MVP-4 streams).

CODE-6 (queries.ts refactor 47 routes): explicitly OUT OF SCOPE -- high-
risk architectural refactor, doctrine already respected, deferred S936+.

Refs: docs/preflight-residual-todo.md.
'@

$bodyZ = @'
Cowork S935 closure deliverables:
  - bias_registry.md: CW-B60 entry reclassified (A+B both MITIGATED via
    CW-B61 S934 + ADR-0020 S935 B). CW-B59 status flipped to
    "partial-mitigation-S935-investigation-shipped" per S935 C reframe.
    CW-B61 entry consolidated. Tally: 60 catalogued / 42 mitigated.
    Next available: CW-B62.
  - HANDOFF_FRESH_SESSION.md: section 0ter updated with S935 outcome
    (all 6 phases shipped + 2 tags), section 1.5 P0 status final.
  - .handoff/STATE.md: S935 closure section appended.
  - sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md: full report
    (outcome per phase, findings critici, R14 audit, invariants check,
    ship instructions, S936 next candidates).
  - cowork_reserved/auto-ship/run-all-s935.ps1: this script (master ship).

Refs: bias_registry section 2 + 5; HANDOFF section 0ter + 1.5; STATE;
session report.
'@

# =============================================================================
# PHASE A - S934 CW-B60-A engine silent-skip observability
# =============================================================================
if (Test-ShouldRun "A") {
    Write-Log "=== PHASE A: S934 CW-B60-A engine silent-skip ===" "Cyan"
    Invoke-Gates "A" @("typecheck-api", "lint-api", "test-cw-b60-a")
    Invoke-CommitPhase "A" `
        @(
            "apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts",
            "apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts",
            "apps/api/test/upsert-sql-cw-b60-a-silent-skip.test.ts",
            "cowork_reserved/ship-cw-b60-a.ps1"
        ) `
        "feat(api): S934 CW-B60-A - engine silent-skip observability fix (audit + WARN + 3 tests)" `
        $bodyA
}

# =============================================================================
# PHASE B - S935 CW-B60-B Wave-2 scope ADR
# =============================================================================
if (Test-ShouldRun "B") {
    Write-Log "=== PHASE B: S935 CW-B60-B Wave-2 scope ADR ===" "Cyan"
    Invoke-Gates "B" @("typecheck-api")
    Invoke-CommitPhase "B" `
        @(
            "docs/architecture/adr/0020_wave2_scope_application_level_targets.md",
            "docs/architecture/ADR_INDEX.md",
            "db/migrations/000044_cw_b60_b_reclassify_application_level_targets.sql",
            "docs/MVP_4_ROADMAP.md"
        ) `
        "feat(db): S935 B CW-B60-B - ADR-0020 reclassify 3 application-level targets to REFERENCE_ONLY (migration 000044)" `
        $bodyB
}

# =============================================================================
# PHASE C - S935 DEFER-F /showcase Path A bisect (revised root cause)
# =============================================================================
if (Test-ShouldRun "C") {
    Write-Log "=== PHASE C: S935 DEFER-F /showcase root cause refrain ===" "Cyan"
    Invoke-Gates "C" @()
    Invoke-CommitPhase "C" `
        @(
            "docs/cw-b59-true-root-cause-2026-05-26.md",
            "package.json",
            "scripts/restore-showcase-routes.ps1",
            "scripts/bisect-cw-b59-createctx.ps1"
        ) `
        "feat(web): S935 C CW-B59 reframed - Path G React overrides + Path A revised bisect scripts" `
        $bodyC

    Write-Log "[TAG] applying v0.3.4-p0-closed (post-C, 3 P0 closed)..." "Yellow"
    & git tag -a "v0.3.4-p0-closed" -m "v0.3.4 - 3 P0 closed: CW-B60-A (S934) + CW-B60-B (S935 B) + CW-B59 reframed (S935 C partial mitigation)"
    if ($LASTEXITCODE -ne 0) { throw "git tag v0.3.4-p0-closed FAILED" }
    Write-Log "[TAG] v0.3.4-p0-closed applied" "Green"
}

# =============================================================================
# PHASE E - S935 SEC base
# =============================================================================
if (Test-ShouldRun "E") {
    Write-Log "=== PHASE E: S935 SEC base ===" "Cyan"
    Invoke-Gates "E" @("typecheck-api")
    Invoke-CommitPhase "E" `
        @(
            "docs/github/branch-protection.md",
            "docs/github/dependabot-triage-2026-05-26.md",
            "apps/api/src/config/env.ts"
        ) `
        "feat(sec): S935 E SEC base - branch protection rules + Dependabot triage doc + MFA env validation" `
        $bodyE
}

# =============================================================================
# PHASE F - S935 CI workflows + OCI VM self-hosted runner setup
# =============================================================================
if (Test-ShouldRun "F") {
    Write-Log "=== PHASE F: S935 CI workflows + runners ===" "Cyan"
    Invoke-Gates "F" @()
    Invoke-CommitPhase "F" `
        @(
            ".github/workflows/typecheck.yml",
            ".github/workflows/lint.yml",
            ".github/workflows/i18n-parity.yml",
            ".github/workflows/test-integration.yml",
            ".github/workflows/build-web.yml",
            ".github/workflows/playwright-smoke.yml",
            "docs/ci/self-hosted-runners-setup.md",
            "docs/ci/workflows-overview.md"
        ) `
        "feat(ci): S935 F CI workflows + OCI VM self-hosted runner setup" `
        $bodyF
}

# =============================================================================
# PHASE D - S935 pre-flight residual cleanup
# =============================================================================
if (Test-ShouldRun "D") {
    Write-Log "=== PHASE D: S935 pre-flight residual cleanup ===" "Cyan"
    Invoke-Gates "D" @("typecheck-api", "typecheck-web", "lint-web")
    Invoke-CommitPhase "D" `
        @(
            "apps/api/package.json",
            "apps/web/package.json",
            "apps/web/src/app/globals.css",
            "package.json",
            "docs/preflight-residual-todo.md"
        ) `
        "chore: S935 D pre-flight residual cleanup - CODE-2/3/7 inline (CODE-5/10 deferred)" `
        $bodyD
}

# =============================================================================
# PHASE Z - Closure
# =============================================================================
if (Test-ShouldRun "Z") {
    Write-Log "=== PHASE Z: S935 closure ===" "Cyan"
    Invoke-Gates "Z" @()
    Invoke-CommitPhase "Z" `
        @(
            "cowork_reserved/bias_registry.md",
            "cowork_reserved/HANDOFF_FRESH_SESSION.md",
            ".handoff/STATE.md",
            "sessioni/session_2026-05-26_s935/S935_SESSION_REPORT.md",
            "cowork_reserved/auto-ship/run-all-s935.ps1"
        ) `
        "docs(cowork): S935 closure - bias_registry consolidation + HANDOFF refresh + session report + master ship script" `
        $bodyZ

    Write-Log "[TAG] applying v0.4.0-mvp4-ready (post-Z, MVP-4 ready)..." "Yellow"
    & git tag -a "v0.4.0-mvp4-ready" -m "v0.4.0-mvp4-ready - 3 P0 closed + SEC base + CI workflows + residual cleanup. Ready to start MVP-4 streams per docs/MVP_4_ROADMAP.md"
    if ($LASTEXITCODE -ne 0) { throw "git tag v0.4.0-mvp4-ready FAILED" }
    Write-Log "[TAG] v0.4.0-mvp4-ready applied" "Green"
}

# -----------------------------------------------------------------------------
# Push
# -----------------------------------------------------------------------------
if (-not $NoPush) {
    Write-Log "Pushing origin main --follow-tags (R12 compliant)..." "Yellow"
    & git push origin main --follow-tags
    if ($LASTEXITCODE -ne 0) { throw "git push FAILED" }
    Write-Log "[PUSH] origin/main + tags pushed" "Green"
} else {
    Write-Log "[SKIP PUSH] -NoPush flag set; commits and tags are local-only. Run 'git push origin main --follow-tags' manually." "Yellow"
}

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
Write-Log "" "White"
Write-Log "=== S935 MASTER SHIP COMPLETE ===" "Green"
Write-Log "HEAD: $(& git rev-parse --short HEAD)" "Cyan"
Write-Log "Tags: v0.3.4-p0-closed, v0.4.0-mvp4-ready" "Cyan"
Write-Log "Log: $logFile" "Cyan"
Write-Log "" "White"
Write-Log "Next steps (S936):" "Yellow"
Write-Log "  1. Verify CI workflows partono + green on GitHub Actions UI." "Yellow"
Write-Log "  2. Try CW-B59 Path G: pwsh scripts/restore-showcase-routes.ps1 then pnpm --filter @heuresys/web build" "Yellow"
Write-Log "  3. Register OCI VM runner per docs/ci/self-hosted-runners-setup.md section 3" "Yellow"
Write-Log "  4. Pick MVP-4 stream from docs/MVP_4_ROADMAP.md" "Yellow"
