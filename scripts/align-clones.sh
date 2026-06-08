#!/usr/bin/env bash
#
# scripts/align-clones.sh — make Mac and/or the VM CLONES of the local repo.
#
# Two modes:
#   FULL  (default)  — `align-clones.sh all [--deploy]`     : full re-clone of the gitignored
#                      payload (secrets, lean data, all memories). The manual catch-up tool.
#   DELTA (--delta)  — used by the session-close (handoff)  : propagate only what THIS session
#                      changed, read from the session marker (.session-align.marker):
#                        • memories created/updated since session start → sync; deleted → rm on remote
#                        • lean gitignored data → sync only if it changed this session
#                        • code → via git reset (already pushed)
#
# Flags:  <mac|vm|all>  [--deploy|--no-deploy|--auto-deploy]  [--delta]  [--resilient]
#   --auto-deploy : deploy the VM only if the session's commits touched deploy-relevant paths
#   --resilient   : skip an unreachable host with a warning instead of failing the run
# The remotes reset to origin/main, so LOCAL COMMITS MUST BE PUSHED FIRST.
# Run from the local PC (Git Bash on Windows).
set -euo pipefail
export MSYS_NO_PATHCONV=1

TARGETS_ARG=""; DEPLOY_FLAG=off; DELTA=0; RESILIENT=0
for a in "$@"; do
  case "$a" in
    mac|vm|all)    TARGETS_ARG="$a" ;;
    --deploy)      DEPLOY_FLAG=on ;;
    --no-deploy)   DEPLOY_FLAG=off ;;
    --auto-deploy) DEPLOY_FLAG=auto ;;
    --delta)       DELTA=1 ;;
    --resilient)   RESILIENT=1 ;;
    *) echo "unknown arg: $a" >&2; exit 1 ;;
  esac
done
[ -n "$TARGETS_ARG" ] || { echo "usage: align-clones.sh <mac|vm|all> [--deploy|--no-deploy|--auto-deploy] [--delta] [--resilient]" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"
MARKER="$ROOT/.session-align.marker"
LOCAL_MEM="${LOCAL_MEM:-$HOME/.claude/projects/D--heuresys-advanced/memory}"
DEPLOY_PATHS_RE='^(apps|packages|db/migrations|db/scripts|scripts|deploy)/'
LEAN_EXCLUDE='(^|/)pg_dump_snapshots/|(^|/)legacy_data/|(^|/)extracted/|(^|/)graphify-(db-input|out)/|^qa_artifacts/|(^|/)_inspection_artifacts/|(^|/)db_snapshots/|\.(dump|backup|log)$|^\.claude/|^cowork_(code_exchange|reserved)/|^sessioni/|(^|/)\.auth/'

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }

# Refuse to run if local has unpushed commits (the clones reset to origin/main).
git fetch origin --quiet
if [ -n "$(git rev-list origin/main..HEAD 2>/dev/null || true)" ] && [ "${ALIGN_ALLOW_UNPUSHED:-0}" != 1 ]; then
  echo "ERROR: local HEAD is ahead of origin/main — push first (clones reset to origin/main)." >&2
  echo "       Override with ALIGN_ALLOW_UNPUSHED=1 to align to the pushed state anyway." >&2
  exit 1
fi

# --- delta computation from the session marker (line 1 = startHead; rest = memory manifest;
#     the marker file's own mtime = session start, used as the -newer reference) ---
START_HEAD=""; HAVE_MARKER=0; MEM_INCLUDE=""; MEM_DELETE=""; DATA_CHANGED=1
if [ "$DELTA" = 1 ]; then
  if [ -f "$MARKER" ]; then
    HAVE_MARKER=1
    START_HEAD="$(head -1 "$MARKER" | tr -d '\r')"   # strip CR (marker may be CRLF from PowerShell)
    if [ -d "$LOCAL_MEM" ]; then
      MEM_INCLUDE="$(find "$LOCAL_MEM" -maxdepth 1 -type f -newer "$MARKER" -printf '%f\n' 2>/dev/null || true)"
      while IFS= read -r mf; do
        [ -n "$mf" ] || continue
        [ -e "$LOCAL_MEM/$mf" ] || MEM_DELETE="${MEM_DELETE}${mf}"$'\n'
      done < <(tail -n +2 "$MARKER" | tr -d '\r')
    fi
    DATA_CHANGED=0
    [ -n "$(find .secrets .apify apps/showcase/src/app/showcase -type f -newer "$MARKER" 2>/dev/null | head -1)" ] && DATA_CHANGED=1
  else
    warn "delta requested but no marker ($MARKER) — full sync + conservative deploy"
  fi
fi

# --- deploy decision ---
case "$DEPLOY_FLAG" in
  on)  DEPLOY=1 ;;
  off) DEPLOY=0 ;;
  auto)
    if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ] && [ -n "$START_HEAD" ]; then
      if [ -n "$(git diff --name-only "$START_HEAD"..HEAD 2>/dev/null | grep -E "$DEPLOY_PATHS_RE" || true)" ]; then DEPLOY=1; else DEPLOY=0; fi
    else
      DEPLOY=1   # no reliable delta → conservative: deploy
    fi ;;
esac

mac_cfg() { HOST=mac-local;         REPO=/Users/enzo/heuresys-advanced;  NVMUSE=default; }
vm_cfg()  { HOST=oracle-vm-default; REPO=/home/ubuntu/heuresys-advanced; NVMUSE=22; }
reachable() { ssh -o BatchMode=yes -o ConnectTimeout=8 "$1" 'exit 0' 2>/dev/null; }

SKIPPED=""
align_one() {
  local kind="$1"; "${kind}_cfg"

  if [ "$RESILIENT" = 1 ] && ! reachable "$HOST"; then
    warn "[$kind] $HOST unreachable — skipped (run 'align-clones.sh $kind' when reachable)"
    SKIPPED="$SKIPPED $kind"; return 0
  fi

  log "[$kind] hard git sync + install ($HOST:$REPO)"
  ssh -o BatchMode=yes "$HOST" "
    set -e
    export NVM_DIR=\"\$HOME/.nvm\"
    set +e; . \"\$NVM_DIR/nvm.sh\"; nvm use $NVMUSE >/dev/null; set -e
    command -v pnpm >/dev/null || { echo 'pnpm missing after nvm' >&2; exit 1; }
    cd '$REPO'
    git fetch origin --quiet
    git reset --hard origin/main
    git clean -fd
    git log --oneline -1
    pnpm install --frozen-lockfile -r
  "

  if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ] && [ "$DATA_CHANGED" = 0 ]; then
    log "[$kind] gitignored data — unchanged this session, skip"
  else
    log "[$kind] secrets + gitignored config (lean)"
    SSH_HOST="$HOST" DEST_DIR="$REPO" EXTRA_EXCLUDE_RE="$LEAN_EXCLUDE" bash "$SCRIPTS/sync-gitignored-to-vm.sh"
  fi

  log "[$kind] .env key-merge"
  bash "$SCRIPTS/env-key-merge.sh" "$HOST" "$REPO"

  if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ]; then
    if [ -n "$MEM_INCLUDE" ] || [ -n "$MEM_DELETE" ]; then
      log "[$kind] Claude memory (delta)"
      MEM_INCLUDE="$MEM_INCLUDE" MEM_DELETE="$MEM_DELETE" bash "$SCRIPTS/sync-memory-tree.sh" "$HOST" "$REPO"
    else
      log "[$kind] Claude memory — no changes this session, skip"
    fi
  else
    log "[$kind] Claude memory (full mirror)"
    bash "$SCRIPTS/sync-memory-tree.sh" "$HOST" "$REPO"
  fi

  if [ "$kind" = vm ] && [ "$DEPLOY" = 1 ]; then
    log "[vm] PROD deploy (build + migrate-if-pending + restart)"
    ssh -o BatchMode=yes "$HOST" "cd '$REPO' && bash scripts/vm-deploy.sh"
  elif [ "$kind" = vm ]; then
    log "[vm] deploy skipped (no code change / --no-deploy)"
  fi

  log "[$kind] DONE"
}

case "$TARGETS_ARG" in
  mac) align_one mac ;;
  vm)  align_one vm ;;
  all) align_one mac; align_one vm ;;
esac

# Consume the marker so the next session starts a fresh delta window.
if [ "$DELTA" = 1 ] && [ "$HAVE_MARKER" = 1 ]; then rm -f "$MARKER"; fi

log "alignment complete (deploy=$DEPLOY delta=$DELTA${SKIPPED:+ skipped:$SKIPPED})"
