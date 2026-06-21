#!/usr/bin/env bash
#
# scripts/journal-append.sh — append one entry to the session journal (design §11.4 / P4).
#
# The journal (.handoff/session-journal.ndjson) is ROTATED at boot (session-boot.ps1) and
# CONSOLIDATED at close (handoff skill Step 3), so a pending / decision / deferral / interrupted
# flow that emerges mid-session SURVIVES a context compaction — the close consolidates from the
# journal instead of reconstructing from memory (closes design gap #4 at the root).
#
# Append a line WHENEVER such a fact emerges, e.g.:
#   bash scripts/journal-append.sh pending  "#42"   "users-export endpoint still missing tests"
#   bash scripts/journal-append.sh decision "ADR"   "chose option B (vacant drop) for D3"
#   bash scripts/journal-append.sh defer    "#9"    "100X audit → dedicated session, Enzo go"
#   bash scripts/journal-append.sh interrupted "#7" "stopped at apps/api/.../service.ts:88, next: wire route"
#
# Usage: bash scripts/journal-append.sh <pending|decision|defer|interrupted|note> <ref> <note...>
# Dependency-free (no jq): JSON is hand-escaped.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
J="$ROOT/.handoff/session-journal.ndjson"

kind="${1:?usage: journal-append.sh <pending|decision|defer|interrupted|note> <ref> <note...>}"; shift
ref="${1:-}"; [ "$#" -gt 0 ] && shift || true
note="$*"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$ROOT/.handoff"
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
printf '{"ts":"%s","kind":"%s","ref":"%s","note":"%s"}\n' \
  "$ts" "$(esc "$kind")" "$(esc "$ref")" "$(esc "$note")" >> "$J"
echo "  [journal] +$kind ${ref:-} -> $J"
