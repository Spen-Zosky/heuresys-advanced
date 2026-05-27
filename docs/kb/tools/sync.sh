#!/usr/bin/env bash
# sync.sh — Re-allinea KB heuresys-advanced (indice + graphify + delta wiki) all'HEAD corrente.
# Parte CHEAP (indice/mirror/grafo) sempre; la parte LLM (ingestion wiki) resta manuale,
# qui viene solo REPORTATA come delta. Idempotente.
#
# Usage:
#   docs/kb/tools/sync.sh            # full: indice + manifest + mirror + graphify update + delta wiki
#   docs/kb/tools/sync.sh --graph-only   # salta il report delta wiki (per hook/background)
#   docs/kb/tools/sync.sh --quiet        # output minimale
set -euo pipefail

REPO="D:/heuresys-advanced"
TOOLS="$REPO/docs/kb/tools"
VAULT="C:/Users/enzospenuso/wiki-space/heuresys-advanced-wiki"
MIRROR="C:/Users/enzospenuso/wiki-space/heuresys-advanced-graph/src-mirror"
SKILL="C:/Users/enzospenuso/wiki-factory/.claude/skills/llm-wiki/scripts"
export PATH="/c/Users/enzospenuso/.local/bin:$PATH"

GRAPH_ONLY=0; QUIET=0
for a in "$@"; do
  case "$a" in
    --graph-only) GRAPH_ONLY=1 ;;
    --quiet) QUIET=1 ;;
  esac
done
log() { [ "$QUIET" -eq 1 ] || echo "$@"; }

cd "$REPO"
log "[sync] 1/4 indice percorsi…";        python "$TOOLS/build_index.py" >/dev/null
log "[sync] 2/4 manifest prosa (wiki)…";   python "$TOOLS/build_linked_manifest.py" >/dev/null
log "[sync] 3/4 mirror symlink (graph)…";  python "$TOOLS/build_graph_mirror.py" >/dev/null
log "[sync] 4/4 graphify update (AST)…";   graphify update "$MIRROR" 2>&1 | tail -1
log "[sync] hub viz…";                      python "$TOOLS/build_graph_hub.py" >/dev/null

if [ "$GRAPH_ONLY" -eq 0 ]; then
  echo "[sync] delta wiki (prosa da ri-ingerire — lavoro LLM, non automatico):"
  python "$SKILL/compute_delta_linked.py" "$VAULT" "$VAULT/linked_sources.yaml" 2>/dev/null \
    | python -c "import sys,json;d=json.load(sys.stdin);print(f\"  new={len(d['new'])} modified={len(d['modified'])} removed={len(d['removed'])} broken={len(d['broken'])} unchanged={d['unchanged_count']}\");[print('   +',p) for p in (d['new']+d['modified'])[:40]]"
  echo "[sync] per ingerire i delta: apri sessione wiki ('start wiki session heuresys-advanced-wiki') e 'ingest'."
fi
log "[sync] grafo allineato. graph.json: $MIRROR/graphify-out/graph.json"
