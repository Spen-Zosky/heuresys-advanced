#!/usr/bin/env bash
#
# scripts/sync-memory-tree.sh — mirror the LOCAL Claude memory tree for this project
# to a remote machine (Mac/VM) so Claude sessions there share the same memories.
#
# The Claude project-dir slug (~/.claude/projects/<slug>/) is derived from the repo's
# ABSOLUTE path, which differs per machine — so the local slug can't be reused. We
# prefer an EXISTING *heuresys-advanced* project dir on the target (resolved with `find`,
# which — unlike a shell glob — never triggers zsh's nomatch error); otherwise we derive
# a slug from the remote repo path. Transport: tar-over-ssh (rsync absent in Git Bash).
#
# FULL mode (default): mirror every local memory file (additive overwrite; remote-only
# files kept). DELTA mode: set MEM_INCLUDE to a newline list of filenames to send and/or
# MEM_DELETE to a newline list of filenames to remove on the remote.
#
# Usage:  bash scripts/sync-memory-tree.sh <ssh_host> <remote_repo_path>
# Overridable env: LOCAL_MEM  MEM_INCLUDE  MEM_DELETE
set -euo pipefail
export MSYS_NO_PATHCONV=1

SSH_HOST="${1:?usage: sync-memory-tree.sh <ssh_host> <remote_repo_path>}"
REMOTE_REPO="${2:?usage: sync-memory-tree.sh <ssh_host> <remote_repo_path>}"
LOCAL_MEM="${LOCAL_MEM:-$HOME/.claude/projects/D--heuresys-advanced/memory}"

[ -d "$LOCAL_MEM" ] || { echo "local memory dir not found: $LOCAL_MEM" >&2; exit 1; }

# Slug Claude would derive from the remote repo path (separators -> '-').
derived_slug="$(printf '%s' "$REMOTE_REPO" | sed 's#[/\\:]#-#g')"

# Resolve the target memory dir: existing project dir wins (find = zsh-safe), else derive.
remote_mem="$(ssh -o BatchMode=yes "$SSH_HOST" "
  base=\"\$HOME/.claude/projects\"
  found=\"\$(find \"\$base\" -maxdepth 1 -type d -name '*heuresys-advanced*' 2>/dev/null | head -1)\"
  if [ -n \"\$found\" ]; then printf '%s' \"\$found/memory\"; else printf '%s' \"\$base/$derived_slug/memory\"; fi
")"

# Which local files to send: MEM_INCLUDE (delta) or all (full).
if [ -n "${MEM_INCLUDE:-}" ]; then send_list="$MEM_INCLUDE"; mode=delta
else send_list="$(cd "$LOCAL_MEM" && ls -1)"; mode=full; fi
n_send="$(printf '%s\n' "$send_list" | grep -c . || true)"

ssh -o BatchMode=yes "$SSH_HOST" "mkdir -p '$remote_mem'"
if [ "$n_send" -gt 0 ]; then
  printf '%s\n' "$send_list" | grep -v '^$' \
    | tar czf - -C "$LOCAL_MEM" -T - \
    | ssh -o BatchMode=yes "$SSH_HOST" "tar xzf - -C '$remote_mem'"
fi

# Propagate deletions (delta mode), batched into one ssh call. Bare filenames only.
n_del=0
if [ -n "${MEM_DELETE:-}" ]; then
  del_cmd="cd '$remote_mem' || exit 0"
  while IFS= read -r df; do
    [ -n "$df" ] || continue
    case "$df" in */*|*..*) continue ;; esac
    del_cmd="$del_cmd; rm -f -- \"$df\""; n_del=$((n_del + 1))
  done <<< "$MEM_DELETE"
  [ "$n_del" -gt 0 ] && ssh -o BatchMode=yes "$SSH_HOST" "$del_cmd"
fi

echo "  [memory] $mode: sent $n_send, deleted $n_del -> $SSH_HOST:$remote_mem"
