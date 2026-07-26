# scripts/dev-whoami.ps1
# Z-262 — mostra le credenziali di accesso di un utente (Windows).
#
#   .\scripts\dev-whoami.ps1 mario.rossi@rtl-bank.org
#   .\scripts\dev-whoami.ps1 mario.rossi@rtl-bank.org -Watch
#
# E' un WRAPPER: la derivazione vive tutta in scripts/dev-whoami.mjs, unica
# implementazione. Qui non si calcola nulla — se un giorno questo file provasse
# a derivare per conto suo, divergerebbe e produrrebbe password che il server
# rifiuta senza dire perche'.

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Email,

    [switch] $Watch
)

# Gli eseguibili nativi scrivono su stderr anche quando va tutto bene: con
# "Stop" qualunque riga informativa diventerebbe un errore terminante.
$ErrorActionPreference = "Continue"

$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$pnpm = (Get-Command pnpm -ErrorAction SilentlyContinue).Source
if (-not $pnpm) {
    Write-Host "pnpm non trovato nel PATH." -ForegroundColor Red
    exit 127
}

# Le dipendenze (otpauth, pg, dotenv) vivono in apps/api: lo script gira di la',
# stesso schema gia' usato da `db:encrypt-totp` in package.json.
$argsList = "--filter @heuresys/api exec node scripts/dev-whoami.mjs $Email"
if ($Watch) { $argsList += " --watch" }

& $pnpm $argsList.Split(" ")
exit $LASTEXITCODE
