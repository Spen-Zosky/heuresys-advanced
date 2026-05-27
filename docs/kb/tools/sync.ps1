<#
sync.ps1 — Re-allinea KB heuresys-advanced (indice + graphify + delta wiki) all'HEAD corrente.
Parte CHEAP (indice/mirror/grafo) sempre; la parte LLM (ingestion wiki) resta manuale,
qui solo REPORTATA come delta. Idempotente. Canonico Windows.

Usage:
  .\docs\kb\tools\sync.ps1
  .\docs\kb\tools\sync.ps1 -GraphOnly
  .\docs\kb\tools\sync.ps1 -Quiet
#>
param([switch]$GraphOnly, [switch]$Quiet)
$ErrorActionPreference = 'Stop'

$REPO   = 'D:\heuresys-advanced'
$TOOLS  = Join-Path $REPO 'docs\kb\tools'
$VAULT  = 'C:\Users\enzospenuso\wiki-space\heuresys-advanced-wiki'
$MIRROR = 'C:\Users\enzospenuso\wiki-space\heuresys-advanced-graph\src-mirror'
$SKILL  = 'C:\Users\enzospenuso\wiki-factory\.claude\skills\llm-wiki\scripts'
$graphify = 'C:\Users\enzospenuso\.local\bin\graphify.exe'
if (-not (Test-Path $graphify)) { $graphify = 'graphify' }

function Log($m) { if (-not $Quiet) { Write-Host $m } }

Set-Location $REPO
Log '[sync] 1/4 indice percorsi...';       python "$TOOLS\build_index.py" | Out-Null
Log '[sync] 2/4 manifest prosa (wiki)...';  python "$TOOLS\build_linked_manifest.py" | Out-Null
Log '[sync] 3/4 mirror symlink (graph)...'; python "$TOOLS\build_graph_mirror.py" | Out-Null
Log '[sync] 4/4 graphify update (AST)...';  & $graphify update $MIRROR 2>&1 | Select-Object -Last 1

if (-not $GraphOnly) {
  Write-Host '[sync] delta wiki (prosa da ri-ingerire - lavoro LLM, non automatico):'
  $delta = python "$SKILL\compute_delta_linked.py" $VAULT "$VAULT\linked_sources.yaml" 2>$null | ConvertFrom-Json
  Write-Host ("  new={0} modified={1} removed={2} broken={3} unchanged={4}" -f `
    $delta.new.Count, $delta.modified.Count, $delta.removed.Count, $delta.broken.Count, $delta.unchanged_count)
  ($delta.new + $delta.modified) | Select-Object -First 40 | ForEach-Object { Write-Host "   + $_" }
  Write-Host "[sync] per ingerire i delta: 'start wiki session heuresys-advanced-wiki' poi 'ingest'."
}
Log "[sync] grafo allineato. graph.json: $MIRROR\graphify-out\graph.json"
