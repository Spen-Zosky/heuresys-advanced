#Requires -Version 5.1
<#
  scripts/dev-bootstrap.ps1 - idempotent dev-workstation bootstrap for
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
Log "tunnel: localhost:$DbPort -> ${SshHost}:5432"
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
  Write-Host "(API :$ApiPort, web :$WebPort; DB via tunnel :$DbPort -> ${SshHost}:5432)"
}
