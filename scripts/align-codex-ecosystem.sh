#!/usr/bin/env bash
#
# scripts/align-codex-ecosystem.sh — clone the portable subset of the Windows Codex
# ecosystem (SoT: ~/.codex) onto oracle-vm-default.
#
# A COSTO ZERO rispetto a align-claude-ecosystem.sh: qui NON esiste un "portable
# catalog" pulito come per Claude. ~/.codex/config.toml su Windows mescola config
# applicativo (model, plugin enabled, marketplaces) con stato macchina-specifico
# (path C:\..., mcp_servers Windows-only come windows-mcp/node_repl, notify .exe,
# CLAUDE_CODE_USE_POWERSHELL_TOOL, sezione [windows], progetti trust locali,
# hooks.state locali) E ALMENO UN SEGRETO (bearer token in mcp_servers.apify,
# osservato 2026-09-22). Propagarlo verbatim romperebbe il Codex della VM e
# perderebbe un segreto in un file remoto. Per questo lo script copia SOLO:
#   AGENTS.md   — dottrina testuale pura, nessun path/segreto macchina-specifico
#   agents/*.toml — definizioni agenti custom (dream-*), nessun path macchina-specifico
# skills/.system/ NON si copia: e' auto-generata dal codex-cli stesso ad ogni
# host (marker .codex-system-skills.marker), verificato 2026-09-22.
# config.toml NON si tocca: resta gestito manualmente per host finche' non si
# separa in un file config puro (nessuno di questi due file esiste oggi).
#
# Usage: align-codex-ecosystem.sh vm [--dry-run]
set -euo pipefail
SRC="$HOME/.codex"
HOST=oracle-vm-default
RHOME=/home/ubuntu
DRY="${2:-}"

rssh() { MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes "$@"; }

[ -f "$SRC/AGENTS.md" ] || { echo "[FATAL] $SRC/AGENTS.md missing" >&2; exit 1; }
[ -d "$SRC/agents" ]    || { echo "[FATAL] $SRC/agents missing" >&2; exit 1; }

if [ "$DRY" = "--dry-run" ]; then
  echo "[dry-run] would copy: AGENTS.md, agents/*.toml -> $HOST:$RHOME/.codex/"
  tar -C "$SRC" -tzf <(tar -C "$SRC" -cz AGENTS.md agents) 2>/dev/null || true
  exit 0
fi

rssh "$HOST" "mkdir -p $RHOME/.codex/agents"
tar -C "$SRC" -cz AGENTS.md agents | rssh "$HOST" "tar -C $RHOME/.codex -xz"
echo "[ok] pushed AGENTS.md + agents/*.toml to $HOST"
rssh "$HOST" "wc -l $RHOME/.codex/AGENTS.md; ls $RHOME/.codex/agents"
