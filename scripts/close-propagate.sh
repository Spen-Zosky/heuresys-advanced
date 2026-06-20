#!/usr/bin/env bash
#
# scripts/close-propagate.sh — the SINGLE canonical close propagation (design §12.2 / §13.3).
#
# Runs BOTH channels that keep the 4 machines (Windows source + mac + vm + linux-pc) true
# clones, so neither can be silently skipped:
#   1. align-clones.sh all      — repo + gitignored payload + .env key-merge + project memories
#                                 (sync-memory-tree) + PROD deploy (vm/linux-pc)
#   2. align-claude-ecosystem.sh all — Claude catalog (CLAUDE.md/skills/commands/settings) + SDK
#                                 + plugin verify-SHA (Opzione C: drift made visible, manual update)
# Then, by policy, refreshes the linux-pc bare-metal DB clone (clone-vm-db.sh) when the session
# touched VM data (or when forced).
#
# Resilience vs fail-loud (§13.3): both channels run with --resilient, so an UNREACHABLE host is
# skipped with a warning (never blocks the close); a channel that FAILS on a REACHABLE host makes
# this script exit non-zero (fail-loud — the close is not clean). The skill `handoff` Step 4b calls
# this; on a red exit it must investigate, never bypass.
#
# Usage (from the Windows PC, Git Bash):
#   bash scripts/close-propagate.sh [--full|--delta] [--deploy|--auto-deploy|--no-deploy]
#                                   [--clone-db|--no-clone-db]
#   defaults: --delta --auto-deploy   clone-db=auto (refresh iff db/migrations|db/seeds changed)
set -euo pipefail
# NOTE: do NOT globally export MSYS_NO_PATHCONV=1 — align-claude-ecosystem.sh manages
# it per-ssh-call (rssh) and its local jq calls on staging-dir POSIX paths need MSYS
# path conversion active. Close-propagate only needs it for its own direct SSH calls.

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"
MARKER="$ROOT/.session-align.marker"
LINUXPC_REPO="${LINUXPC_REPO:-/home/enzo/heuresys-advanced}"

MODE="--delta"; DEPLOY="--auto-deploy"; CLONE_DB="auto"
for a in "$@"; do
  case "$a" in
    --full)        MODE="" ;;            # align-clones full mode = omit --delta
    --delta)       MODE="--delta" ;;
    --deploy)      DEPLOY="--deploy" ;;
    --auto-deploy) DEPLOY="--auto-deploy" ;;
    --no-deploy)   DEPLOY="--no-deploy" ;;
    --resilient)   : ;;                  # accepted for compat; resilience is always on here
    --clone-db)    CLONE_DB="force" ;;
    --no-clone-db) CLONE_DB="skip" ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[31m[FATAL]\033[0m %s\n' "$*" >&2; exit 1; }

FAILED=""

# --- channel 1: repo + payload + memories + deploy -----------------------------------------
log "channel 1/2 — align-clones (repo + payload + memories + PROD deploy)"
if ! bash "$SCRIPTS/align-clones.sh" all $MODE --resilient $DEPLOY; then
  FAILED="$FAILED align-clones"
fi

# --- channel 2: Claude ecosystem (catalog + skills + SDK + plugin verify-SHA) ---------------
log "channel 2/2 — align-claude-ecosystem (catalog + skills + SDK)"
if [ -f "$SCRIPTS/align-claude-ecosystem.sh" ]; then
  eco_mode=""; [ "$MODE" = "--delta" ] && eco_mode="--delta"
  if ! bash "$SCRIPTS/align-claude-ecosystem.sh" all $eco_mode --resilient; then
    FAILED="$FAILED align-claude-ecosystem"
  fi
else
  warn "align-claude-ecosystem.sh absent — ecosystem channel skipped (skill/CLAUDE.md won't propagate)"
fi

# --- linux-pc bare-metal DB refresh (policy §12.3-B: conditional) ---------------------------
need_clone=0
case "$CLONE_DB" in
  force) need_clone=1 ;;
  skip)  need_clone=0 ;;
  auto)
    if [ -f "$MARKER" ]; then
      start_head="$(head -1 "$MARKER" | tr -d '\r')"
      if [ -n "$start_head" ] && \
         [ -n "$(git diff --name-only "$start_head"..HEAD 2>/dev/null | grep -E '^db/(migrations|seeds)/' || true)" ]; then
        need_clone=1
      fi
    fi ;;
esac
if [ "$need_clone" = 1 ]; then
  log "clone-db — linux-pc DB refresh (VM data changed this session / forced)"
  if MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes -o ConnectTimeout=8 linux-pc 'exit 0' 2>/dev/null; then
    if ! MSYS_NO_PATHCONV=1 ssh -o BatchMode=yes linux-pc "cd '$LINUXPC_REPO' && bash scripts/clone-vm-db.sh"; then
      FAILED="$FAILED clone-vm-db"
    fi
  else
    warn "linux-pc unreachable — clone-db skipped (run scripts/clone-vm-db.sh there when up)"
  fi
else
  log "clone-db — skipped (no db/migrations|seeds change this session; pass --clone-db to force)"
fi

# --- fail-loud on any reachable-host channel failure ---------------------------------------
if [ -n "$FAILED" ]; then
  die "close-propagate: channel(s) failed on a reachable host:$FAILED — investigate (close NOT clean)"
fi
log "close-propagate complete (mode=${MODE:-full} deploy=$DEPLOY clone-db=$CLONE_DB)"
