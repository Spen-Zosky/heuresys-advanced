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

# La superficie di Codex e' legittimamente non tracciata e NON e' di Claude (CLAUDE.md,
# sezione "Codex read-only audit channel"): non e' sporcizia da ripulire, e contarla
# rendeva il working tree ROSSO a ogni avvio senza che ci fosse niente da fare.
# Fonte UNICA della lista: scripts/lib/superficie-codex.txt, letta anche da
# docs/kb/tools/status_dashboard.py. Una sola definizione, due lettori.
$codexVoci = @()
$codexFile = Join-Path $ProjectRoot 'scripts/lib/superficie-codex.txt'
if (Test-Path $codexFile) {
    $codexVoci = @(Get-Content -LiteralPath $codexFile |
                   ForEach-Object { $_.Trim() } |
                   Where-Object { $_ -and -not $_.StartsWith('#') })
}
$dirtyMio = @(); $dirtyCodex = @()
foreach ($riga in $dirty) {
    if ($riga.Length -lt 4) { $dirtyMio += $riga; continue }
    $p = $riga.Substring(3).Trim().Trim('"')
    $suo = $false
    foreach ($v in $codexVoci) {
        if ($v.EndsWith('/')) {
            if ($p -eq $v.TrimEnd('/') -or $p.StartsWith($v)) { $suo = $true; break }
        } elseif ($p -eq $v) { $suo = $true; break }
    }
    if ($suo) { $dirtyCodex += $riga } else { $dirtyMio += $riga }
}
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

# 5. Session journal (P4, design §11.4): rotate at boot so a pending/decision/interrupted logged
#    mid-session survives a context compaction. If non-empty at boot, the previous session died
#    without a close → preserve it as .recovered + flag it; then start a clean journal.
$journalMsg = '[OK]   session journal ready'
try {
    $journal = Join-Path $ProjectRoot '.handoff\session-journal.ndjson'
    if ((Test-Path $journal) -and ((Get-Item $journal).Length -gt 0)) {
        $jn = @(Get-Content -LiteralPath $journal -ErrorAction SilentlyContinue).Count
        $recovered = Join-Path $ProjectRoot '.handoff\session-journal.recovered.ndjson'
        Move-Item -LiteralPath $journal -Destination $recovered -Force
        $journalMsg = "[!]    session journal: $jn entry da una sessione non chiusa -> .recovered (consolidare al close)"
    }
    if (-not (Test-Path $journal)) { New-Item -ItemType File -Path $journal -Force | Out-Null }
} catch {}

# 5b. Session id (#191): il numero di QUESTA sessione, fissato ADESSO perche' adesso e' l'unico
#     momento in cui la risposta e' univoca — nessuna chiusura in volo, quindi l'ultimo commit
#     `handoff S<N>` e' certamente quello della sessione PRECEDENTE, e questa e' N+1. A chiusura
#     avvenuta lo stesso calcolo diventa ambiguo (l'ultimo handoff e' quello di QUESTA), ed e' il
#     motivo per cui il rendiconto delle chiusure ha attribuito 159 righe su 171 a "S?".
#
#     Il valore lo calcola `close-log.sh sessione`, non una seconda implementazione qui: due
#     derivazioni dello stesso numero divergono, e il giorno in cui divergono nessuna delle due
#     e' credibile. Il file va RIMOSSO prima di derivare, altrimenti si rileggerebbe il numero
#     della sessione precedente e il boot lo confermerebbe per sempre.
#     Fallimento = nessun file: close-log torna al proprio ripiego. Mai peggio di prima.
#
#     TRAPPOLA WINDOWS, misurata qui il 2026-08-15 e non a memoria: in PowerShell `bash` NON e'
#     il bash di Git, e' `C:\WINDOWS\system32\bash.exe` — quello di WSL, che su questa macchina
#     non ha distribuzioni e risponde in UTF-16 «sottosistema Windows per Linux non ha
#     distribuzioni installate». Il bash giusto si ricava da dove sta `git`, mai per path fisso.
$sessionMsg = ''
try {
    $sidFile = Join-Path $ProjectRoot '.handoff\session-id'
    $clog    = Join-Path $ProjectRoot 'scripts\close-log.sh'
    # Il bash di Git si cerca in PIU' posti, e ognuno ha una ragione. Misurato qui il
    # 2026-08-24: `git` risolveva a `C:\Git\mingw64\bin\git.exe`, quindi il vecchio calcolo
    # (due livelli su + `bin\bash.exe`) puntava a `C:\Git\mingw64\bin\bash.exe`, che NON
    # esiste — il bash sta in `C:\Git\bin` e in `C:\Git\usr\bin`. Git for Windows mette git
    # in `<root>\cmd` OPPURE in `<root>\mingw64\bin` a seconda dell'installazione, quindi un
    # solo candidato non basta: si provano tutti e vince il primo che esiste davvero.
    $gitExe  = (Get-Command git -ErrorAction SilentlyContinue).Source
    $bashExe = $null
    if ($gitExe) {
        $d = Split-Path $gitExe -Parent
        $radici = @((Split-Path $d -Parent), (Split-Path (Split-Path $d -Parent) -Parent)) |
                  Where-Object { $_ } | Select-Object -Unique
        foreach ($r in $radici) {
            foreach ($sub in @('bin\bash.exe', 'usr\bin\bash.exe')) {
                $c = Join-Path $r $sub
                # MAI `C:\WINDOWS\system32\bash.exe`: e' quello di WSL, che su questa macchina
                # non ha distribuzioni e risponde in UTF-16 (trappola misurata il 2026-08-15).
                if ((Test-Path $c) -and ($c -notlike '*\System32\*')) { $bashExe = $c; break }
            }
            if ($bashExe) { break }
        }
    }
    if (-not (Test-Path $clog)) {
        # I DUE RAMI CHE TACEVANO. Un boot che non riusciva a derivare la sessione lasciava
        # `.handoff/session-id` col valore VECCHIO e non diceva nulla: misurato il 2026-08-24,
        # il file era fermo a S1064 da QUINDICI sessioni, e ogni passo di chiusura di quelle
        # sessioni e' finito nel diario sotto il numero sbagliato. Un fallimento silenzioso e'
        # peggio di un errore: sembra che sia andato bene, e nessuno torna a guardare.
        $sessionMsg = "[!]    sessione NON DERIVABILE: close-log.sh non trovato - .handoff/session-id resta com'era"
    } elseif (-not $bashExe) {
        $sessionMsg = "[!]    sessione NON DERIVABILE: bash di Git non trovato (git=$gitExe) - .handoff/session-id resta com'era"
    } else {
        Remove-Item -LiteralPath $sidFile -Force -ErrorAction SilentlyContinue
        Push-Location $ProjectRoot
        $sid = (& $bashExe 'scripts/close-log.sh' sessione 2>$null | Select-Object -First 1)
        Pop-Location
        if ($sid -match '^S[0-9A-Za-z?]+$' -and $sid -ne 'S?') {
            [System.IO.File]::WriteAllText($sidFile, "$sid`n")
            $sessionMsg = "[OK]   sessione $sid (depositata in .handoff/session-id)"
        } else {
            $sessionMsg = "[!]    sessione NON DERIVABILE: il rendiconto della chiusura dira' S?"
        }
    }
} catch { $sessionMsg = "[!]    sessione NON DERIVABILE (errore al boot): il rendiconto dira' S?" }

# 5c. L'EREDITA' DELLA SESSIONE PRECEDENTE (#229, S1079 — mandato di Enzo).
#     «L'avvio di una sessione deve rilevare lo stato effettivo del repo preso in eredita'
#     dalla sessione precedente, senza omettere alcuna lettura.»
#
#     La lettura che mancava: una chiusura INTERROTTA. Il diario registrava solo i passi
#     completati, quindi una corsa uccisa a meta' lasciava una traccia identica a una corsa
#     breve e riuscita — misurato il 2026-08-24 su una corsa uccisa a 10 minuti, che il
#     rendiconto mostrava come «1 passi». La sessione successiva ereditava un lavoro monco
#     e non aveva modo di saperlo.
#
#     Sta QUI, nel hook che gira da se', e non in `session_start.py`: quest'ultimo lo eseguo
#     seguendo un'istruzione, e un'istruzione si puo' omettere. Un'eredita' che si scopre solo
#     se qualcuno si ricorda di guardarla non e' un'eredita' rilevata.
$ereditaMsg = ''
try {
    if ($bashExe -and (Test-Path $clog)) {
        Push-Location $ProjectRoot
        $rep = (& $bashExe 'scripts/close-log.sh' report 2>$null) -join "`n"
        Pop-Location
        if ($rep -match 'CORSE INTERROTTE') {
            # Si riportano gli identificativi, non il solo allarme: «qualcosa e' interrotto»
            # senza dire COSA obbliga a rifare l'indagine ogni volta.
            $righe = @($rep -split "`n" | Where-Object { $_ -match '^\s{6}\S+\s+ultimo passo' })
            $ereditaMsg = "[!]    EREDITA': $($righe.Count) chiusura/e INTERROTTA/E dalla sessione precedente"
            foreach ($r in $righe) { $ereditaMsg += "`n     $($r.Trim())" }
            $ereditaMsg += "`n       -> bash scripts/close-log.sh report   (la corsa e' stata UCCISA, non e' finita)"
        } else {
            $ereditaMsg = "[OK]   eredita': nessuna chiusura interrotta in sospeso"
        }
    } else {
        # Anche qui: non si tace. Non aver potuto guardare non e' «a posto».
        $ereditaMsg = "[!]    EREDITA' NON LETTA: manca bash o close-log.sh - non so se una chiusura e' rimasta a meta'"
    }
} catch { $ereditaMsg = "[!]    EREDITA' NON LETTA (errore al boot): non so se una chiusura e' rimasta a meta'" }

# 6. State coherence reality-check (P7, design §11.7): run the handoff lint READ-ONLY and surface
#    its verdict, so the action menu is not built on already-drifted state (a concurrent session
#    may have left it incoherent before this one started).
#
#    DUPLICAZIONE DELIBERATA (Z-030, misurata S1030). status_dashboard.sec_drift() ri-esegue gli
#    stessi check in-process, quindi al boot il lint gira due volte. Misurato prima di decidere:
#    handoff_lint.py --warn-only = 375/395/815 ms su tre run; session_start.py completo = 4.2 s.
#    Il costo della duplicazione e' ~0.4 s — NON e' il collo di bottiglia del boot (quello erano
#    i round del modello, chiusi dal consolidamento in session_start.py). Condividere il verdetto
#    via cache su file introdurrebbe una possibile bugia sul guardiano della coerenza dello stato
#    per risparmiare quei 0.4 s: rapporto rischio/beneficio sbagliato. Le due invocazioni restano
#    indipendenti di proposito — questa vale anche se la sessione non apre mai il menu, quella del
#    dashboard vale anche in uso stand-alone (`pnpm status`) dopo modifiche ai file di stato.
$lintMsg = '[--]   handoff-lint not run (python/script absent)'
try {
    $lintPy = Join-Path $ProjectRoot 'docs\kb\tools\handoff_lint.py'
    if ((Get-Command python -ErrorAction SilentlyContinue) -and (Test-Path $lintPy)) {
        Push-Location $ProjectRoot
        $lintOut = & python $lintPy --warn-only 2>&1
        Pop-Location
        $lintFails = @($lintOut | Select-String -Pattern '^FAIL ')
        if ($lintFails.Count -eq 0) {
            $lintMsg = '[OK]   stato coerente (handoff-lint)'
        } else {
            $detail = ($lintFails | ForEach-Object { '       ' + $_.Line }) -join "`n"
            $lintMsg = "[!]    stato DRIFTATO: $($lintFails.Count) FAIL (handoff-lint)`n$detail"
        }
    }
} catch {}

$codexCoda = if ($dirtyCodex.Count -gt 0) { " - $($dirtyCodex.Count) voci di Codex, attese per contratto" } else { '' }
$treeMsg = if ($dirtyMio.Count -gt 0) { "[!]    working tree DIRTY ($($dirtyMio.Count) file miei)$codexCoda" }
           elseif ($dirtyCodex.Count -gt 0) { "[OK]   working tree pulito$codexCoda" }
           else { '[OK]   working tree clean' }
$pushMsg = if ($unpushed.Count -gt 0) { "[!]    $($unpushed.Count) commit(s) unpushed" }       else { '[OK]   synced with origin' }

Write-Output '=== HEURESYS BOOT (project hook) ==='
Write-Output $tunnelMsg
Write-Output $pgpassMsg
Write-Output $dbMsg
Write-Output "branch $branch @ $head"
Write-Output $treeMsg
Write-Output $pushMsg
Write-Output $journalMsg
if ($sessionMsg) { Write-Output $sessionMsg }
if ($ereditaMsg) { Write-Output $ereditaMsg }
Write-Output $lintMsg
Write-Output '==================================='
