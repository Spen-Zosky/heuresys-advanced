<#
.SYNOPSIS
  Supervised SSH tunnel  localhost:5433 -> oracle-vm-default:5432 (PostgreSQL).
.DESCRIPTION
  Target of the Windows scheduled task "HeuresysTunnel5433" (At-Logon). Keeps the
  DB tunnel up across reboots: opens it via the no-passphrase, capability-restricted
  key 'heuresys-tunnel' (ADR-0021), and restarts it with backoff if it drops.
  If the port is already held (e.g. opened by session-boot.ps1) it idles, acting as
  a pure supervisor. Idempotent, never blocks on a passphrase.
.NOTES
  PowerShell 5.1 compatible. Logs to %LOCALAPPDATA%\heuresys\tunnel-keepalive.log.
#>
[CmdletBinding()]
param(
    [int]$LocalPort = 5433,
    [string]$SshHost = 'heuresys-tunnel',
    [string]$LogFile = "$env:LOCALAPPDATA\heuresys\tunnel-keepalive.log"
)

$ErrorActionPreference = 'Continue'

$logDir = Split-Path -Parent $LogFile
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
function Write-Log([string]$m) { "{0}  {1}" -f (Get-Date -Format o), $m | Out-File -FilePath $LogFile -Append -Encoding ascii }

$ssh = "$env:WINDIR\System32\OpenSSH\ssh.exe"
if (-not (Test-Path $ssh)) { $ssh = 'ssh' }

function Test-Tunnel { Test-NetConnection localhost -Port $LocalPort -InformationLevel Quiet -WarningAction SilentlyContinue }

Write-Log "keepalive start (port $LocalPort -> ${SshHost}:5432)"
$backoff = 5
while ($true) {
    if (Test-Tunnel) { Start-Sleep -Seconds 15; continue }

    Write-Log 'tunnel down -> opening'
    $start = Get-Date
    # -N (no remote command); ServerAlive*/ExitOnForwardFailure come from the ssh config alias.
    # Forward to 127.0.0.1 (NOT localhost): permitopen on the restricted key is IP-literal (ADR-0021).
    & $ssh -N -L "${LocalPort}:127.0.0.1:5432" $SshHost 2>> $LogFile
    $code = $LASTEXITCODE
    $ranSec = ((Get-Date) - $start).TotalSeconds
    Write-Log ("ssh exited code={0} after {1:N0}s" -f $code, $ranSec)

    if ($ranSec -gt 60) { $backoff = 5 } else { $backoff = [Math]::Min($backoff * 2, 60) }
    Start-Sleep -Seconds $backoff
}
