<#
.SYNOPSIS
  heuresys-advanced project SessionStart boot check (fallback + status report).
.DESCRIPTION
  Idempotent, fast, non-fatal. Ensures the DB tunnel :5433 is up (re-opens via the
  no-passphrase 'heuresys-tunnel' key if the scheduled task hasn't, ADR-0021),
  verifies .pgpass, smoke-checks the DB, and prints a compact boot status that the
  CLI sees at session start. Complements (does not replace) the global
  session-bootstrap.ps1 informational banner.
.NOTES
  PowerShell 5.1 compatible. Windows-only (uses powershell.exe + OpenSSH client).
#>
[CmdletBinding()]
param(
    [string]$ProjectRoot = 'D:\heuresys-advanced',
    [int]$LocalPort = 5433,
    [string]$SshHost = 'heuresys-tunnel'
)

$ErrorActionPreference = 'SilentlyContinue'

# Self-guard: the Windows-global SessionStart hook fires for EVERY project; only
# act when the CLI's current project is this repo. Exit silently otherwise.
$repoRoot = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { $ProjectRoot }
try { $curProj = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path } catch { exit 0 }
if ($curProj.TrimEnd('\') -ne (Resolve-Path -LiteralPath $repoRoot).Path.TrimEnd('\')) { exit 0 }

$ssh = "$env:WINDIR\System32\OpenSSH\ssh.exe"
if (-not (Test-Path $ssh)) { $ssh = 'ssh' }
function Test-Tunnel { Test-NetConnection localhost -Port $LocalPort -InformationLevel Quiet -WarningAction SilentlyContinue }

# 1. Tunnel — re-open if down (no-passphrase key never prompts).
$up = Test-Tunnel
if (-not $up) {
    Start-Process -FilePath $ssh -ArgumentList "-N -L ${LocalPort}:127.0.0.1:5432 $SshHost" -WindowStyle Hidden
    for ($i = 0; $i -lt 12 -and -not $up; $i++) { Start-Sleep -Milliseconds 600; $up = Test-Tunnel }
}
$tunnelMsg = if ($up) { '[OK]   tunnel :5433 up' }
             else     { '[DOWN] tunnel :5433 — run scripts\setup-tunnel-automation.ps1 (key/agent issue)' }

# 2. pgpass present?
$pgpassWin = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
$pgpassMsg = if (Test-Path $pgpassWin) { '[OK]   pgpass present' }
             else                      { '[--]   pgpass missing — run scripts\setup-tunnel-automation.ps1' }

# 3. DB smoke check (uses pgpass; psql may be absent — non-fatal).
$dbMsg = '[--]   psql not on PATH (DB check skipped)'
if ((Get-Command psql -ErrorAction SilentlyContinue) -and $up) {
    $r = & psql -h localhost -p $LocalPort -U heuresys -d heuresys_advanced -tAc 'select 1' 2>$null
    $dbMsg = if ("$r".Trim() -eq '1') { '[OK]   DB reachable (select 1)' } else { '[DOWN] DB query failed' }
}

# 4. Git snapshot.
Push-Location $ProjectRoot
$branch   = (git rev-parse --abbrev-ref HEAD 2>$null)
$head     = (git log -1 --oneline 2>$null)
$dirty    = @(git status --porcelain 2>$null)
$unpushed = @(git log '@{u}..HEAD' --oneline 2>$null)
Pop-Location

# Session-align marker (delta basis for the handoff close-flow). Create-if-absent so a
# resume/compaction does NOT reset the delta window; the handoff consumes (deletes) it.
# Line 1 = start HEAD sha; remaining lines = memory-dir manifest (for delete detection);
# the file's own mtime marks session start (the `-newer` reference). UTF8 no-BOM so bash
# `head -1` reads a clean sha. Non-fatal.
try {
    $marker = Join-Path $ProjectRoot '.session-align.marker'
    if (-not (Test-Path $marker)) {
        $startHead = (git -C $ProjectRoot rev-parse HEAD 2>$null)
        if ($startHead) {
            $memDir   = Join-Path $env:USERPROFILE '.claude\projects\D--heuresys-advanced\memory'
            $memFiles = @(if (Test-Path $memDir) { Get-ChildItem -LiteralPath $memDir -File -Name } else { @() })
            # LF line endings (no CRLF) so bash `head -1` reads a clean sha.
            [System.IO.File]::WriteAllText($marker, ((@("$startHead") + $memFiles) -join "`n") + "`n")
        }
    }
} catch {}
$treeMsg = if ($dirty.Count -gt 0)    { "[!]    working tree DIRTY ($($dirty.Count) files)" } else { '[OK]   working tree clean' }
$pushMsg = if ($unpushed.Count -gt 0) { "[!]    $($unpushed.Count) commit(s) unpushed" }       else { '[OK]   synced with origin' }

Write-Output '=== HEURESYS BOOT (project hook) ==='
Write-Output $tunnelMsg
Write-Output $pgpassMsg
Write-Output $dbMsg
Write-Output "branch $branch @ $head"
Write-Output $treeMsg
Write-Output $pushMsg
Write-Output '==================================='
