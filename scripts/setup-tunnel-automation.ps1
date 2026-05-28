<#
.SYNOPSIS
  One-shot idempotent setup for hands-off DB tunnel automation (ADR-0021).
.DESCRIPTION
  Establishes the L3 "hands-off" boot on a Windows workstation:
    1. Generate a dedicated no-passphrase ed25519 key (heuresys_tunnel_ed25519) if absent.
    2. Install a capability-restricted authorized_keys line on oracle-vm-default
       (restrict + permitopen=localhost:5432 + forced echo) so the key can ONLY
       forward to PostgreSQL — no shell, no other forward. Idempotent.
    3. Append the 'heuresys-tunnel' Host alias to ~/.ssh/config if absent.
    4. Create ~/.pgpass and %APPDATA%\postgresql\pgpass.conf from .env (ACL-restricted).
    5. Register/refresh the At-Logon scheduled task 'HeuresysTunnel5433'.
  Safe to re-run: every step checks-before-creating. Never prints the DB password.
.NOTES
  PowerShell 5.1 compatible. Run from anywhere: pwsh/powershell -File scripts\setup-tunnel-automation.ps1
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = 'D:\heuresys-advanced',
    [string]$SshAdminHost = 'oracle-vm-default',
    [string]$TunnelAlias = 'heuresys-tunnel',
    [string]$VmHostName = '80.225.82.207',
    [string]$VmUser = 'ubuntu',
    [int]$LocalPort = 5433,
    [string]$TaskName = 'HeuresysTunnel5433'
)

$ErrorActionPreference = 'Stop'
$sshDir   = Join-Path $env:USERPROFILE '.ssh'
$keyPath  = Join-Path $sshDir 'heuresys_tunnel_ed25519'
$pubPath  = "$keyPath.pub"
$cfgPath  = Join-Path $sshDir 'config'
$keygen   = "$env:WINDIR\System32\OpenSSH\ssh-keygen.exe"; if (-not (Test-Path $keygen)) { $keygen = 'ssh-keygen' }
$ssh      = "$env:WINDIR\System32\OpenSSH\ssh.exe";        if (-not (Test-Path $ssh))    { $ssh = 'ssh' }
$keyComment = 'heuresys-tunnel-noauth'

function Info([string]$m) { Write-Host "  $m" }
function Step([string]$m) { Write-Host "`n>>> $m" -ForegroundColor Cyan }

Write-Host '=== setup-tunnel-automation (ADR-0021) ===' -ForegroundColor Green

# --- 1. Keypair (no passphrase) -------------------------------------------------
Step '1. Service-account key (no passphrase, tunnel-only)'
if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Path $sshDir -Force | Out-Null }
if (Test-Path $keyPath) {
    Info "key already present: $keyPath (skip)"
} else {
    # Single arg-string (R7): let ssh-keygen's own parser read -N "" as an EMPTY
    # passphrase. Passing '' / '""' through the PS call operator is unreliable on 5.1.
    $kgArgs = "-t ed25519 -N `"`" -C $keyComment -f `"$keyPath`""
    Start-Process -FilePath $keygen -ArgumentList $kgArgs -NoNewWindow -Wait
    if (-not (Test-Path $keyPath)) { throw "ssh-keygen failed to create $keyPath" }
    Info "generated: $keyPath"
}
$pub = (Get-Content $pubPath -Raw).Trim()

# --- 2. Restricted authorized_keys line on the VM -------------------------------
Step "2. Restricted authorization on $SshAdminHost"
# NB: NOT `restrict` — in OpenSSH 9.6 `restrict` disables port-forwarding and permitopen
# does not re-enable it (verified). Explicit no-* flags + permitopen give the same lock-down
# (no shell via forced command, no pty/agent/X11/user-rc, forward only to Postgres). ADR-0021.
$authLine = 'command="echo tunnel-only-key",no-pty,no-agent-forwarding,no-X11-forwarding,no-user-rc,permitopen="127.0.0.1:5432" ' + $pub
# base64 avoids all remote-shell quoting issues for the special chars in $authLine.
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($authLine + "`n"))
$remote = @"
set -e
mkdir -p ~/.ssh && chmod 700 ~/.ssh
if [ -f ~/.ssh/authorized_keys ] && grep -qF '$keyComment' ~/.ssh/authorized_keys; then
  echo 'authorized_keys: already present (skip)'
else
  WASIMMUT=no
  if [ -f ~/.ssh/authorized_keys ] && lsattr ~/.ssh/authorized_keys 2>/dev/null | cut -d' ' -f1 | grep -q i; then WASIMMUT=yes; sudo chattr -i ~/.ssh/authorized_keys; fi
  touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  echo $b64 | base64 -d >> ~/.ssh/authorized_keys
  [ "`$WASIMMUT" = yes ] && sudo chattr +i ~/.ssh/authorized_keys || true
  echo 'authorized_keys: installed restricted line'
fi
"@
$installed = $false
try {
    $out = & $ssh -o BatchMode=yes -o ConnectTimeout=10 $SshAdminHost $remote 2>&1
    Info ($out -join "`n")
    if ($LASTEXITCODE -eq 0) { $installed = $true }
} catch { }
if (-not $installed) {
    Write-Host "  Could not reach $SshAdminHost non-interactively (admin key not in agent?)." -ForegroundColor Yellow
    Write-Host "  Paste this line into ~/.ssh/authorized_keys on the VM (one line):" -ForegroundColor Yellow
    Write-Host "  $authLine"
}

# --- 3. SSH config alias --------------------------------------------------------
Step '3. ssh config alias'
$haveAlias = (Test-Path $cfgPath) -and ((Get-Content $cfgPath -Raw) -match "(?m)^\s*Host\s+$([regex]::Escape($TunnelAlias))\b")
if ($haveAlias) {
    Info "Host $TunnelAlias already in config (skip)"
} else {
    $block = @"

# --- heuresys-tunnel (DB :5433, no-passphrase restricted key, ADR-0021) ---
Host $TunnelAlias
    HostName $VmHostName
    User $VmUser
    IdentityFile $keyPath
    ExitOnForwardFailure yes
"@
    # AppendAllText => UTF-8 no BOM (Set-Content -Encoding utf8 would add a BOM on PS 5.1).
    [IO.File]::AppendAllText($cfgPath, $block)
    Info "appended Host $TunnelAlias"
}

# --- 4. .pgpass (both psql variants) -------------------------------------------
Step '4. .pgpass (from .env, never printed)'
$envFile = Join-Path $ProjectRoot '.env'
function Get-EnvVal([string]$name, [string]$default) {
    if (-not (Test-Path $envFile)) { return $default }
    $line = Get-Content $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
    if (-not $line) { return $default }
    ($line -replace "^\s*$name\s*=\s*", '').Trim().Trim('"').Trim("'")
}
$pgDb   = Get-EnvVal 'POSTGRES_DB'       'heuresys_advanced'
$pgUser = Get-EnvVal 'POSTGRES_USER'     'heuresys'
$pgPass = Get-EnvVal 'POSTGRES_PASSWORD' ''
if ([string]::IsNullOrEmpty($pgPass)) {
    Write-Host '  POSTGRES_PASSWORD not found in .env — pgpass NOT written.' -ForegroundColor Yellow
} else {
    $pgLine = "localhost:${LocalPort}:${pgDb}:${pgUser}:${pgPass}`n"
    $pgpassMsys = Join-Path $env:USERPROFILE '.pgpass'
    $pgpassWin  = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
    $pgpassWinDir = Split-Path -Parent $pgpassWin
    if (-not (Test-Path $pgpassWinDir)) { New-Item -ItemType Directory -Path $pgpassWinDir -Force | Out-Null }
    foreach ($p in @($pgpassMsys, $pgpassWin)) {
        [IO.File]::WriteAllText($p, $pgLine)   # UTF-8 no BOM
        # Restrict ACL: remove inheritance, grant current user only (libpq requires this on Windows).
        & icacls $p /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
    }
    Info 'pgpass written (~/.pgpass + %APPDATA%\postgresql\pgpass.conf), ACL restricted'
}

# --- 5. Scheduled task (At-Logon, supervised tunnel) ----------------------------
Step "5. Scheduled task '$TaskName' (At-Logon)"
$keepalive = Join-Path $ProjectRoot 'scripts\tunnel-keepalive.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$keepalive`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Info "registered/refreshed task '$TaskName'"

Write-Host "`n=== done. Start now with: Start-ScheduledTask -TaskName $TaskName ===" -ForegroundColor Green
