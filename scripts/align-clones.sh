#!/usr/bin/env bash
#
# scripts/align-clones.sh — make Mac and/or the VM TRUE CLONES of the local repo.
#
# "Full alignment" doctrine: the remotes become idempotent clones of the local PC repo
# (modulo OS/arch), INCLUDING the gitignored payload that `git pull` never carries:
#   1. hard git sync      reset --hard origin/main + clean -fd  (preserves gitignored files)
#   2. deps               pnpm install --frozen-lockfile -r     (exact lockfile match)
#   3. secrets + data     sync-gitignored-to-vm.sh              (.secrets/*.pem + brownfield/seed/qa/.apify)
#   4. .env key-merge     env-key-merge.sh                      (adds new keys, preserves per-machine topology)
#   5. Claude memories    sync-memory-tree.sh                   (~/.claude/projects/<slug>/memory)
#   6. (VM + --deploy)    vm-deploy.sh                          (prod build + db:migrate + restart)
#
# The remotes are reset to origin/main, so LOCAL COMMITS MUST BE PUSHED FIRST.
# Run from the local PC (Git Bash on Windows).
#
# Usage:  bash scripts/align-clones.sh <mac|vm|all> [--deploy]
#   bash scripts/align-clones.sh all --deploy   # align both + redeploy PROD
#   bash scripts/align-clones.sh mac            # Mac clone only (dev box, no build)
#   bash scripts/align-clones.sh vm             # VM clone payload only (no build/restart)
set -euo pipefail
export MSYS_NO_PATHCONV=1   # Git Bash: keep POSIX paths in remote command strings intact

TARGETS_ARG="${1:?usage: align-clones.sh <mac|vm|all> [--deploy]}"
DEPLOY=0; [ "${2:-}" = "--deploy" ] && DEPLOY=1

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
SCRIPTS="$ROOT/scripts"

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# Remotes reset to origin/main — refuse to run if local has unpushed commits (the
# clones would silently miss them). Override only if you know what you're doing.
git fetch origin --quiet
if [ -n "$(git rev-list origin/main..HEAD 2>/dev/null || true)" ] && [ "${ALIGN_ALLOW_UNPUSHED:-0}" != 1 ]; then
  echo "ERROR: local HEAD is ahead of origin/main — push first (clones reset to origin/main)." >&2
  echo "       Override with ALIGN_ALLOW_UNPUSHED=1 to align to the pushed state anyway." >&2
  exit 1
fi

# Per-target config.
mac_cfg() { HOST=mac-local;         REPO=/Users/enzo/heuresys-advanced;  NVMUSE=default; }
vm_cfg()  { HOST=oracle-vm-default; REPO=/home/ubuntu/heuresys-advanced; NVMUSE=22; }

align_one() {
  local kind="$1"; "${kind}_cfg"

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

  log "[$kind] secrets + gitignored config (lean: heavy DATA + per-machine transient excluded)"
  # A runtime clone needs .secrets/ + small config (.apify), NOT: heavy regenerable working
  # data (pg_dump_snapshots ~GB, brownfield/seed extracts, qa/graphify), nor per-machine
  # transient state (logs, .claude/worktrees, cowork/* state, sessioni logs, playwright .auth).
  SSH_HOST="$HOST" DEST_DIR="$REPO" \
    EXTRA_EXCLUDE_RE='(^|/)pg_dump_snapshots/|(^|/)legacy_data/|(^|/)extracted/|(^|/)graphify-(db-input|out)/|^qa_artifacts/|(^|/)_inspection_artifacts/|(^|/)db_snapshots/|\.(dump|backup|log)$|^\.claude/|^cowork_(code_exchange|reserved)/|^sessioni/|(^|/)\.auth/' \
    bash "$SCRIPTS/sync-gitignored-to-vm.sh"

  log "[$kind] .env key-merge"
  bash "$SCRIPTS/env-key-merge.sh" "$HOST" "$REPO"

  log "[$kind] Claude memory tree"
  bash "$SCRIPTS/sync-memory-tree.sh" "$HOST" "$REPO"

  if [ "$kind" = vm ] && [ "$DEPLOY" = 1 ]; then
    log "[vm] PROD deploy (build + db:migrate + restart)"
    ssh -o BatchMode=yes "$HOST" "cd '$REPO' && bash scripts/vm-deploy.sh"
  fi

  log "[$kind] DONE"
}

case "$TARGETS_ARG" in
  mac) align_one mac ;;
  vm)  align_one vm ;;
  all) align_one mac; align_one vm ;;
  *) echo "unknown target: $TARGETS_ARG (use mac|vm|all)" >&2; exit 1 ;;
esac

log "alignment complete"
