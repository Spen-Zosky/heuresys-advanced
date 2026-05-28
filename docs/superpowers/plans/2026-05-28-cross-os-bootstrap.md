# Cross-OS Idempotent Bootstrap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a re-runnable, idempotent bootstrap system that clones, installs, and runs heuresys-advanced reproducibly on Windows, Mac (Darwin Intel / hackintosh), and Linux (arm64 + amd64) — server role via systemd, workstation roles via on-demand dev against the central VM DB over an SSH tunnel.

**Architecture:** Twin-by-role scripts (repo `.ps1`+`.sh` convention). `scripts/vm-bootstrap.sh` = Linux server (systemd, local DB, public, **already built** at `2ccaaf9`). `scripts/dev-bootstrap.sh` = Unix workstation (Mac + Linux desktop, OS-aware). `scripts/dev-bootstrap.ps1` = Windows workstation. Workstations tunnel `localhost:5433`→`VM:5432`, run API `:3001` / web `:3000` on-demand, never destroy local git work.

**Tech Stack:** bash + PowerShell 5.1 · nvm / fnm · corepack pnpm 9.15 · Node 22 · systemd (server) · OpenSSH tunnel · pnpm-lock.yaml (verified cross-platform: win32-x64, linux-x64/arm64, darwin-x64/arm64).

**Spec:** `docs/superpowers/specs/2026-05-28-cross-os-bootstrap-design.md`.

---

## Context & verified facts (do not re-derive)

| Fact | Value | Source |
|---|---|---|
| Server bootstrap | `scripts/vm-bootstrap.sh` + `deploy/systemd/*.service` exist | commit `2ccaaf9` (unpushed) |
| Lockfile cross-platform | x64 + arm64 + darwin variants present for esbuild/swc/rollup/lightningcss/sharp | grep `pnpm-lock.yaml` |
| Repo convention | `db/scripts/*.{ps1,sh}` twins; `.gitattributes` forces `eol=lf` | read |
| Workstation ports | API `3001`, web `3000` (repo defaults) | `.env.example` |
| Server ports | API `8013`, web `3013` (public, ufw + OCI SL open) | live VM |
| DB | central native PG on VM `:5432`; workstations tunnel `:5433`→`:5432` | ADR-0010/RD-25 |
| `.env` keys | `POSTGRES_HOST/PORT`, `PORT`, `ADMIN_ORIGIN`, `NEXT_PUBLIC_API_BASE_URL`, secrets | grep (names only) |
| SSH host alias | `oracle-vm-default` (key in agent / `~/.ssh`) | `~/.ssh/config` |
| Testable hosts | Windows (here), Linux arm64 (OCI VM), Mac Darwin (SSH `mac-local`) | — |
| Not testable | Linux amd64 (no host) → by-construction | — |

**Domain note (TDD adaptation):** these are deploy/shell artifacts, not unit-testable functions. The "test" for each task is the **integration verification on the real target host**: run the script, assert the healthy end-state, then **run it again** and assert the same state (the idempotency contract). The spec's verification matrix is the test plan.

---

## File structure

| File | Responsibility | Status |
|---|---|---|
| `scripts/vm-bootstrap.sh` | Linux server bootstrap | exists `2ccaaf9` — verify only |
| `deploy/systemd/heuresys-advanced-{api,web}.service` | server unit templates | exists `2ccaaf9` |
| `scripts/dev-bootstrap.sh` | Unix workstation (Mac + Linux desktop) | **create** |
| `scripts/dev-bootstrap.ps1` | Windows workstation | **create** |
| `deploy/README.md` | per-OS usage + secret provisioning + idempotency notes | **create** |
| `docs/kb/SOT_BACKLOG.md`, `SOT_STATE.md` | record the deploy capability | **modify** |

---

## Task 0: Verify the server bootstrap on the VM (idempotent re-run)

**Files:** none (verification of existing `2ccaaf9`). Requires push (script does `git fetch`+`reset --hard origin/main`).

- [ ] **Step 1: Push the pending commits (GATED — needs explicit Enzo OK per project policy)**

```bash
git -C /d/heuresys-advanced push origin main   # 2ccaaf9 (bootstrap) + 1fb719a (spec) + this plan
```
Expected: `91f9571..<head>  main -> main`.

- [ ] **Step 2: Run the server bootstrap on the VM (first idempotent re-run over the manual setup)**

Run:
```bash
ssh -o BatchMode=yes oracle-vm-default 'bash /home/ubuntu/heuresys-advanced/scripts/vm-bootstrap.sh'
```
Expected tail: `is-active` → `active`/`active`; `api /healthz OK`; `Done. API http://80.225.82.207:8013 | Web http://80.225.82.207:3013`.

- [ ] **Step 3: Run it AGAIN — assert idempotency (same healthy state, no errors)**

Run the same command a second time.
Expected: identical healthy end-state; prereqs report nothing to install; services restart cleanly; `/healthz OK`. Any divergence is a bug to fix in `vm-bootstrap.sh`.

- [ ] **Step 4: External re-confirm**

Run (from Windows):
```bash
curl -s -m 8 http://80.225.82.207:8013/readyz; echo
curl -s -m 10 http://80.225.82.207:3013/api/healthz; echo
```
Expected: `{"status":"ready","checks":{"database":"ok"}}` and `{"status":"ok"}`.

- [ ] **Step 5: No commit** (verification only). If a fix was needed, commit `fix(deploy): <what> in vm-bootstrap.sh` and re-run Steps 2-4.

---

## Task 1: `scripts/dev-bootstrap.sh` — Unix workstation (Mac + Linux desktop)

**Files:**
- Create: `scripts/dev-bootstrap.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/dev-bootstrap.sh — idempotent dev-workstation bootstrap for
# heuresys-advanced on a Unix host: macOS/Darwin on Intel (native or OpenCore)
# or Linux desktop (arm64/amd64). Talks to the central VM DB over an SSH tunnel
# and runs the stack on-demand (no persistent services, no local DB).
#
# Re-runnable. Ensures prerequisites (assumes brew/apt + git), pins Node 22 via
# nvm + corepack pnpm, clones-or-updates WITHOUT destroying local work,
# normalises the tunnel .env, ensures the SSH tunnel, installs deps. Ends in a
# "ready" state; pass --run to launch `pnpm dev` in the foreground.
#
# Secrets (.env + .secrets/*.pem) are out-of-band (never committed).
# Overridable env: REPO_DIR REPO_URL BRANCH NODE_MAJOR SSH_HOST DB_PORT API_PORT WEB_PORT NVM_VERSION
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/heuresys-advanced}"
REPO_URL="${REPO_URL:-https://github.com/Spen-Zosky/heuresys-advanced.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SSH_HOST="${SSH_HOST:-oracle-vm-default}"
DB_PORT="${DB_PORT:-5433}"      # local tunnel port -> VM:5432
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"
NVM_VERSION="${NVM_VERSION:-v0.40.1}"
RUN=0; [ "${1:-}" = "--run" ] && RUN=1

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
OS="$(uname -s)"   # Linux | Darwin

# portable in-place sed (GNU on Linux, BSD on macOS)
sed_i() { if sed --version >/dev/null 2>&1; then sed -i -E "$@"; else sed -i '' -E "$@"; fi; }

ensure_pkg() {  # $1 = command to check, $2 = package name
  command -v "$1" >/dev/null 2>&1 && return 0
  if [ "$OS" = "Darwin" ]; then
    command -v brew >/dev/null 2>&1 || { echo "Homebrew required (https://brew.sh)" >&2; exit 1; }
    brew install "$2"
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$2"
  else
    echo "install '$2' manually (no brew/apt found)" >&2; exit 1
  fi
}

# 0. prerequisites
log "prerequisites ($OS)"
ensure_pkg git git
ensure_pkg curl curl
if [ "$OS" = "Linux" ]; then
  command -v gcc     >/dev/null 2>&1 || ensure_pkg gcc build-essential
  command -v python3 >/dev/null 2>&1 || ensure_pkg python3 python3
fi
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  log "install nvm $NVM_VERSION"
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
fi
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
log "node $NODE_MAJOR via nvm + corepack pnpm"
nvm install "$NODE_MAJOR" >/dev/null
nvm use "$NODE_MAJOR" >/dev/null
node --version
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
corepack enable >/dev/null 2>&1 || true
PNPM="$NODE_BIN/pnpm"

# 1. clone-or-update (NEVER destroy local work)
log "repo: $REPO_DIR @ $BRANCH"
if [ -d "$REPO_DIR/.git" ]; then
  dirty="$(git -C "$REPO_DIR" status --porcelain)"
  ahead="$(git -C "$REPO_DIR" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  if [ -z "$dirty" ] && [ "$ahead" = "0" ]; then
    git -C "$REPO_DIR" pull --ff-only
  else
    echo "  local changes/commits present — skipping git update (your work is safe)"
  fi
else
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
git -C "$REPO_DIR" log --oneline -1

# 2. secrets (out-of-band)
log "secrets: .env + .secrets/*.pem"
miss=0
for f in .env .secrets/jwt_private.pem .secrets/jwt_public.pem; do
  [ -f "$REPO_DIR/$f" ] || { echo "  MISSING: $REPO_DIR/$f"; miss=1; }
done
if [ "$miss" = 1 ]; then
  echo "  Provide secrets out-of-band, e.g. from a machine that has them:" >&2
  echo "    scp .env        <this-host>:$REPO_DIR/.env" >&2
  echo "    scp -r .secrets <this-host>:$REPO_DIR/" >&2
  exit 1
fi
chmod 700 "$REPO_DIR/.secrets" 2>/dev/null || true
chmod 600 "$REPO_DIR/.env" "$REPO_DIR/.secrets/"*.pem 2>/dev/null || true

# 3. normalise .env for tunnel/dev (idempotent)
log "env: POSTGRES_HOST=localhost, POSTGRES_PORT=$DB_PORT, PORT=$API_PORT"
sed_i "s|^POSTGRES_HOST=.*|POSTGRES_HOST=localhost|" "$REPO_DIR/.env"
sed_i "s|^POSTGRES_PORT=.*|POSTGRES_PORT=$DB_PORT|" "$REPO_DIR/.env"
sed_i "s|^PORT=.*|PORT=$API_PORT|" "$REPO_DIR/.env"

# 4. ensure SSH tunnel localhost:DB_PORT -> VM:5432 (idempotent)
log "tunnel: localhost:$DB_PORT -> $SSH_HOST:5432"
tunnel_up() { (exec 3<>"/dev/tcp/localhost/$DB_PORT") 2>/dev/null; }
if tunnel_up; then
  echo "  already up"
else
  ssh -o ConnectTimeout=15 -fN -L "$DB_PORT:localhost:5432" "$SSH_HOST" 2>/dev/null || true
  sleep 2
  if tunnel_up; then
    echo "  opened"
  else
    echo "  could NOT open tunnel non-interactively. Run manually:" >&2
    echo "    ssh -fN -L $DB_PORT:localhost:5432 $SSH_HOST" >&2
    echo "  (first load the OCI key: ssh-add ~/.ssh/<oci_key>)" >&2
  fi
fi

# 5. install deps (reproducible, cross-platform lockfile)
log "deps: pnpm install --frozen-lockfile"
cd "$REPO_DIR"
"$PNPM" --version
"$PNPM" install --frozen-lockfile

# 6. ready / run
log "ready"
node --version; "$PNPM" --version
if [ "$RUN" = 1 ]; then
  log "run: pnpm dev (foreground)"
  exec "$PNPM" dev
else
  echo
  echo "Ready. Start dev with:"
  echo "  cd $REPO_DIR && $NODE_BIN/pnpm dev"
  echo "(API :$API_PORT, web :$WEB_PORT; DB via tunnel :$DB_PORT -> $SSH_HOST:5432)"
fi
```

- [ ] **Step 2: Local syntax + line-ending check (on Windows dev box, Git Bash)**

Run:
```bash
bash -n scripts/dev-bootstrap.sh && echo "syntax OK"
grep -lU $'\r' scripts/dev-bootstrap.sh && echo "CRLF!" || echo "LF clean"
```
Expected: `syntax OK` and `LF clean`.

- [ ] **Step 3: Commit the script (executable)**

```bash
git add --chmod=+x scripts/dev-bootstrap.sh
git commit -m "feat(deploy): dev-bootstrap.sh — Unix workstation bootstrap (Mac + Linux desktop)"
```

- [ ] **Step 4: Verify on the Mac (Darwin) — the integration test**

Provision secrets to the Mac clone target, then run:
```bash
# from Windows: push first so the Mac can clone the committed script
git push origin main
# on the Mac (via SSH), clone target defaults to ~/heuresys-advanced
ssh mac-local 'PATH=/usr/local/bin:/opt/homebrew/bin:$PATH; \
  git clone -q https://github.com/Spen-Zosky/heuresys-advanced.git ~/heuresys-advanced 2>/dev/null; \
  bash ~/heuresys-advanced/scripts/dev-bootstrap.sh'
```
Expected first run: stops at "secrets MISSING" (clone has no .env/.secrets). This proves the secret gate works.

Then provision secrets and re-run:
```bash
scp .env        mac-local:'~/heuresys-advanced/.env'
scp -r .secrets mac-local:'~/heuresys-advanced/'
ssh mac-local 'PATH=/usr/local/bin:/opt/homebrew/bin:$PATH; bash ~/heuresys-advanced/scripts/dev-bootstrap.sh'
```
Expected: prereqs OK (brew path), Node 22 via nvm, tunnel `localhost:5433` opened (or "already up"), `pnpm install --frozen-lockfile` resolves **darwin-x64** natives, ends "Ready".

- [ ] **Step 5: Idempotency assertion on the Mac (run again)**

Run the same `ssh mac-local ... dev-bootstrap.sh` a second time.
Expected: "already up" tunnel, nothing re-installed, identical "Ready". Divergence = bug to fix.

- [ ] **Step 6: Functional assertion on the Mac (`--run`, then probe)**

Run (background the dev server, probe, stop):
```bash
ssh mac-local 'PATH=/usr/local/bin:/opt/homebrew/bin:$PATH; cd ~/heuresys-advanced; \
  nohup bash scripts/dev-bootstrap.sh --run >/tmp/hadv-dev.log 2>&1 & \
  for i in $(seq 1 40); do sleep 3; curl -fsS -m 3 http://localhost:3001/healthz >/dev/null 2>&1 && break; done; \
  curl -s -m 5 http://localhost:3001/healthz; echo; curl -s -m 5 http://localhost:3001/readyz; echo; \
  pkill -f "tsx watch src/server.ts"; pkill -f "heuresys-advanced"'
```
Expected: `{"status":"ok"}` and `{"status":"ready","checks":{"database":"ok"}}` (DB reached over the tunnel). If a fix was needed, amend `dev-bootstrap.sh`, re-commit, re-run Steps 4-6.

---

## Task 2: `scripts/dev-bootstrap.ps1` — Windows workstation

**Files:**
- Create: `scripts/dev-bootstrap.ps1`

- [ ] **Step 1: Write the script**

```powershell
#Requires -Version 5.1
<#
  scripts/dev-bootstrap.ps1 — idempotent dev-workstation bootstrap for
  heuresys-advanced on Windows. Central VM DB over an SSH tunnel; on-demand dev
  (no local DB, no persistent service). Re-runnable.
  Secrets (.env + .secrets) are out-of-band (never committed).
  -Run launches `pnpm dev`.
#>
[CmdletBinding()]
param(
  [string]$RepoDir   = "$env:USERPROFILE\heuresys-advanced",
  [string]$RepoUrl   = "https://github.com/Spen-Zosky/heuresys-advanced.git",
  [string]$Branch    = "main",
  [int]   $NodeMajor = 22,
  [string]$SshHost   = "oracle-vm-default",
  [int]   $DbPort    = 5433,
  [int]   $ApiPort   = 3001,
  [int]   $WebPort   = 3000,
  [switch]$Run
)
$ErrorActionPreference = "Stop"
function Log([string]$m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

# 0. prerequisites (assume winget present)
Log "prerequisites"
function Ensure-Cmd([string]$cmd, [string]$wingetId) {
  if (Get-Command $cmd -ErrorAction SilentlyContinue) { return }
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install --silent --accept-source-agreements --accept-package-agreements -e --id $wingetId
  } else { throw "Install '$cmd' manually (winget not found)" }
}
Ensure-Cmd git Git.Git
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client missing. Enable: Settings > Apps > Optional Features > OpenSSH Client"
}

# Node 22: prefer an existing Node >= NodeMajor, else fnm
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) {
  $v = (node --version).TrimStart('v')
  if ([version]$v -ge [version]"$NodeMajor.0.0") { $nodeOk = $true }
}
if (-not $nodeOk) {
  Ensure-Cmd fnm Schniz.fnm
  fnm install $NodeMajor
  fnm env --shell powershell | Out-String | Invoke-Expression
  fnm use $NodeMajor
}
node --version
corepack enable 2>$null

# 1. clone-or-update (NEVER destroy local work)
Log "repo: $RepoDir @ $Branch"
if (Test-Path "$RepoDir\.git") {
  $dirty = git -C $RepoDir status --porcelain
  $ahead = git -C $RepoDir rev-list --count "@{u}..HEAD" 2>$null
  if ((-not $dirty) -and ($ahead -in @("0", $null))) { git -C $RepoDir pull --ff-only }
  else { Write-Host "  local changes/commits present - skipping git update (your work is safe)" }
} else {
  git clone --quiet $RepoUrl $RepoDir
}
git -C $RepoDir log --oneline -1

# 2. secrets (out-of-band)
Log "secrets: .env + .secrets\*.pem"
$miss = @()
foreach ($f in @(".env", ".secrets\jwt_private.pem", ".secrets\jwt_public.pem")) {
  if (-not (Test-Path "$RepoDir\$f")) { $miss += $f }
}
if ($miss.Count -gt 0) {
  $miss | ForEach-Object { Write-Host "  MISSING: $RepoDir\$_" }
  throw "Provide .env + .secrets out-of-band (copy from another checkout / scp), then re-run."
}

# 3. normalise .env for tunnel/dev (idempotent)
Log "env: POSTGRES_HOST=localhost, POSTGRES_PORT=$DbPort, PORT=$ApiPort"
$envPath = "$RepoDir\.env"
$c = Get-Content $envPath
$c = $c -replace '^POSTGRES_HOST=.*', 'POSTGRES_HOST=localhost'
$c = $c -replace '^POSTGRES_PORT=.*', "POSTGRES_PORT=$DbPort"
$c = $c -replace '^PORT=.*', "PORT=$ApiPort"
Set-Content -Path $envPath -Value $c -Encoding utf8

# 4. ensure SSH tunnel localhost:DbPort -> VM:5432 (idempotent)
Log "tunnel: localhost:$DbPort -> $SshHost:5432"
if (Test-NetConnection localhost -Port $DbPort -InformationLevel Quiet) {
  Write-Host "  already up"
} else {
  # Windows OpenSSH has no reliable -f; background via Start-Process instead.
  Start-Process ssh -ArgumentList @("-N","-L","${DbPort}:localhost:5432",$SshHost) -WindowStyle Hidden
  Start-Sleep -Seconds 3
  if (Test-NetConnection localhost -Port $DbPort -InformationLevel Quiet) { Write-Host "  opened" }
  else { Write-Host "  could NOT open; run manually: ssh -N -L ${DbPort}:localhost:5432 $SshHost" }
}

# 5. install deps
Log "deps: pnpm install --frozen-lockfile"
Push-Location $RepoDir
try { pnpm --version; pnpm install --frozen-lockfile } finally { Pop-Location }

# 6. ready / run
if ($Run) {
  Log "run: pnpm dev"
  Push-Location $RepoDir
  try { pnpm dev } finally { Pop-Location }
} else {
  Write-Host "`nReady. Start dev:  Set-Location '$RepoDir'; pnpm dev"
  Write-Host "(API :$ApiPort, web :$WebPort; DB via tunnel :$DbPort -> $SshHost:5432)"
}
```

- [ ] **Step 2: Syntax check (PowerShell parse)**

Run:
```powershell
$null = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path scripts\dev-bootstrap.ps1), [ref]$null, [ref]$null); "parse OK"
```
Expected: `parse OK` (no parse exceptions).

- [ ] **Step 3: Commit**

```bash
git add scripts/dev-bootstrap.ps1
git commit -m "feat(deploy): dev-bootstrap.ps1 — Windows workstation bootstrap"
```

- [ ] **Step 4: Verify on this Windows machine (fresh target dir, integration test)**

Use a throwaway target so the primary checkout at `D:\heuresys-advanced` is untouched:
```powershell
$T = "$env:TEMP\hadv-bootstrap-test"
pwsh -File scripts\dev-bootstrap.ps1 -RepoDir $T
```
Expected first run: stops at "secrets MISSING" (fresh clone). Proves the gate.

Provision secrets from the existing checkout, then re-run:
```powershell
Copy-Item D:\heuresys-advanced\.env "$T\.env"
Copy-Item D:\heuresys-advanced\.secrets "$T\.secrets" -Recurse -Force
pwsh -File scripts\dev-bootstrap.ps1 -RepoDir $T
```
Expected: Node ≥22 detected (or fnm install), corepack pnpm, tunnel `localhost:5433` up, `pnpm install --frozen-lockfile` resolves **win32-x64** natives, "Ready".

- [ ] **Step 5: Idempotency assertion (run again)**

```powershell
pwsh -File scripts\dev-bootstrap.ps1 -RepoDir $T
```
Expected: "already up" tunnel, no reinstall, identical "Ready".

- [ ] **Step 6: Functional assertion (`-Run`, probe, stop)**

```powershell
$T = "$env:TEMP\hadv-bootstrap-test"
$p = Start-Process pwsh -ArgumentList "-File","scripts\dev-bootstrap.ps1","-RepoDir",$T,"-Run" -PassThru -WindowStyle Hidden
foreach ($i in 1..40) { Start-Sleep 3; try { if ((Invoke-WebRequest http://localhost:3001/healthz -TimeoutSec 3).StatusCode -eq 200) { break } } catch {} }
(Invoke-WebRequest http://localhost:3001/healthz -TimeoutSec 5).Content
(Invoke-WebRequest http://localhost:3001/readyz -TimeoutSec 5).Content
Get-CimInstance Win32_Process | Where-Object CommandLine -like '*hadv-bootstrap-test*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```
Expected: `{"status":"ok"}` and `{"status":"ready","checks":{"database":"ok"}}`. If a fix is needed, amend `dev-bootstrap.ps1`, re-commit, re-run Steps 4-6. Then clean up: `Remove-Item -LiteralPath "\\?\$T" -Recurse -Force`.

---

## Task 3: `deploy/README.md` — operator documentation

**Files:**
- Create: `deploy/README.md`

- [ ] **Step 1: Write the README**

````markdown
# Deploying / running heuresys-advanced

Idempotent bootstrap, by host role. All scripts are safe to re-run.

## Secrets (always required, never in git)
Every host needs `.env` + `.secrets/{jwt_private,jwt_public}.pem` placed in the
repo root, transferred out-of-band (the scripts verify and stop if missing):
```
scp .env        <host>:<repo>/.env
scp -r .secrets <host>:<repo>/
```

## Linux server (OCI VM / any amd64 Linux) — public, systemd
```bash
bash scripts/vm-bootstrap.sh          # API :8013, web :3013, systemd units, ufw
```
Manage: `sudo systemctl {status,restart} heuresys-advanced-{api,web}` ·
`journalctl -u heuresys-advanced-api -f`.
Override: `REPO_DIR=... PUBLIC_HOST=... API_PORT=... WEB_PORT=... bash scripts/vm-bootstrap.sh`.

## Mac (Darwin Intel / OpenCore) or Linux desktop — dev, on-demand
```bash
bash scripts/dev-bootstrap.sh         # prepares, ensures tunnel; prints run cmd
bash scripts/dev-bootstrap.sh --run   # also launches `pnpm dev` (API :3001, web :3000)
```
DB is reached over an SSH tunnel `localhost:5433 -> oracle-vm-default:5432`.

## Windows — dev, on-demand (PowerShell)
```powershell
pwsh -File scripts\dev-bootstrap.ps1            # prepares, ensures tunnel
pwsh -File scripts\dev-bootstrap.ps1 -Run       # also launches `pnpm dev`
```

## Idempotency
Re-running any script converges to the same state: prereqs install only what's
missing; workstation clone uses `pull --ff-only` and **skips if you have local
work**; the server clone uses `reset --hard` (ephemeral); `.env` is normalised
to canonical values; `pnpm install --frozen-lockfile` is deterministic.

## Cross-platform note
`pnpm-lock.yaml` carries native variants for win32-x64, linux-x64, linux-arm64,
darwin-x64 and darwin-arm64, so `--frozen-lockfile` resolves on every target.
````

- [ ] **Step 2: Commit**

```bash
git add deploy/README.md
git commit -m "docs(deploy): per-OS bootstrap usage + idempotency notes"
```

---

## Task 4: Bookkeeping + push

**Files:**
- Modify: `docs/kb/SOT_BACKLOG.md`, `docs/kb/SOT_STATE.md`

- [ ] **Step 1: Record the capability in SOT_BACKLOG.md**

Add a row under the verified-state table:
```markdown
| **B-XX** | ✅ **FATTO** 2026-05-28 | cross-OS idempotent bootstrap: `scripts/vm-bootstrap.sh` (Linux server, systemd, public 8013/3013) + `scripts/dev-bootstrap.sh` (Mac/Linux-desktop) + `scripts/dev-bootstrap.ps1` (Windows); central VM DB via tunnel; `deploy/README.md`. Verified live on arm64 VM + Mac + Windows; amd64 by-construction (cross-platform lockfile). | — |
```

- [ ] **Step 2: Note the deploy entrypoints in SOT_STATE.md** (§ infra/runtime)

Add one line:
```markdown
- **Deploy**: `scripts/{vm-bootstrap.sh, dev-bootstrap.sh, dev-bootstrap.ps1}` + `deploy/` — idempotent per-OS bootstrap (server systemd / workstation tunnel+dev). See `deploy/README.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/kb/SOT_BACKLOG.md docs/kb/SOT_STATE.md
git commit -m "docs(kb): record cross-OS bootstrap capability"
```

- [ ] **Step 4: Push (GATED — explicit Enzo OK)**

```bash
git push origin main
```
Expected: all deploy commits land on `origin/main`; the VM/Mac/Windows verifications (Tasks 0/1/2) can re-pull and confirm against the pushed HEAD.

---

## Self-review notes

- **Spec coverage:** roles matrix → Tasks 0/1/2; per-OS adapters (brew/apt, GNU/BSD sed, fnm/nvm, OpenSSH `-f` vs Start-Process) → in the script bodies; DB tunnel model → Steps "ensure tunnel"; idempotency contract → re-run assertions (Task 0 S3, Task 1 S5, Task 2 S5); verification matrix → live on arm64/Mac/Windows, amd64 documented by-construction (deploy/README + spec); out-of-scope (no local DB, no workstation persistence, no showcase) honored.
- **Placeholder scan:** `B-XX` in Task 4 is the only placeholder — assign the next free backlog id at execution time. All script bodies are complete.
- **Type/name consistency:** ports (API 3001/web 3000 workstation, 8013/3013 server), `DB_PORT` 5433 workstation / 5432 server, `oracle-vm-default`, `$NODE_BIN/pnpm` (corepack) consistent across scripts, README, and spec.
- **Refinement vs spec:** workstation clone uses `pull --ff-only` + skip-if-dirty (not `reset --hard`) to protect local commits — spec updated to match (idempotency §).
