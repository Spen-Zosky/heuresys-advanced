#!/usr/bin/env bash
#
# scripts/sync-memory-tree.sh — mirror the LOCAL Claude memory tree for this project
# to a remote machine (Mac/VM) so Claude sessions there share the same memories.
#
# The Claude project-dir slug (~/.claude/projects/<slug>/) is derived from the repo's
# ABSOLUTE path, which differs per machine — so the local slug can't be reused. We
# prefer an EXISTING *heuresys-advanced* project dir on the target; otherwise we derive
# a slug from the remote repo path (Claude replaces path separators with '-').
# Transport: tar-over-ssh (rsync is absent in Git Bash on Windows). Additive overwrite
# (local PC = source of truth); never deletes remote-only files.
#
# Usage:  bash scripts/sync-memory-tree.sh <ssh_host> <remote_repo_path>
# Overridable env: LOCAL_MEM
set -euo pipefail
export MSYS_NO_PATHCONV=1

SSH_HOST="${1:?usage: sync-memory-tree.sh <ssh_host> <remote_repo_path>}"
REMOTE_REPO="${2:?usage: sync-memory-tree.sh <ssh_host> <remote_repo_path>}"
LOCAL_MEM="${LOCAL_MEM:-$HOME/.claude/projects/D--heuresys-advanced/memory}"

[ -d "$LOCAL_MEM" ] || { echo "local memory dir not found: $LOCAL_MEM" >&2; exit 1; }

# Slug Claude would derive from the remote repo path (separators -> '-').
derived_slug="$(printf '%s' "$REMOTE_REPO" | sed 's#[/\\:]#-#g')"

# Resolve the target memory dir: existing project dir wins, else the derived slug.
remote_mem="$(ssh -o BatchMode=yes "$SSH_HOST" "
  base=\"\$HOME/.claude/projects\"
  found=\"\$(ls -d \"\$base\"/*heuresys-advanced*/ 2>/dev/null | head -1)\"
  if [ -n \"\$found\" ]; then printf '%s' \"\${found%/}/memory\"; else printf '%s' \"\$base/$derived_slug/memory\"; fi
")"

n="$(ls -1 "$LOCAL_MEM" | grep -c . || true)"
echo "  [memory] mirroring $n file(s) -> $SSH_HOST:$remote_mem"
ssh -o BatchMode=yes "$SSH_HOST" "mkdir -p '$remote_mem'"
tar czf - -C "$LOCAL_MEM" . | ssh -o BatchMode=yes "$SSH_HOST" "tar xzf - -C '$remote_mem'"
echo "  [memory] done (additive overwrite; remote-only files kept)"
