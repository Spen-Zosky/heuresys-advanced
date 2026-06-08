#!/usr/bin/env bash
#
# scripts/env-key-merge.sh — additive key-merge of the LOCAL .env into a remote .env.
#
# Adds ONLY keys present locally but ABSENT on the remote (with the local value); it
# NEVER overwrites a key the remote already has. By construction the per-machine
# topology values (POSTGRES_HOST/PORT/SSL, PORT, HOST, COOKIE_SECURE, *_BASE_URL,
# ADMIN_ORIGIN, …) — set on each box at bootstrap — stay intact; only genuinely new
# keys (new secrets / feature flags introduced during local dev) get propagated.
#
# Backs up the remote .env first. The pushed local .env temp is deleted right after
# the merge (secret hygiene). Run from the local PC.
#
# Usage:  bash scripts/env-key-merge.sh <ssh_host> <remote_repo_path>
# Overridable env: LOCAL_ENV
set -euo pipefail
export MSYS_NO_PATHCONV=1

SSH_HOST="${1:?usage: env-key-merge.sh <ssh_host> <remote_repo_path>}"
REMOTE_REPO="${2:?usage: env-key-merge.sh <ssh_host> <remote_repo_path>}"
LOCAL_ENV="${LOCAL_ENV:-$(git rev-parse --show-toplevel)/.env}"

[ -f "$LOCAL_ENV" ] || { echo "local .env not found: $LOCAL_ENV" >&2; exit 1; }

remote_env="$REMOTE_REPO/.env"
stamp="$(date +%Y%m%dT%H%M%SZ)"
tmp="/tmp/.env.local-keys.$stamp"

scp -q "$LOCAL_ENV" "$SSH_HOST:$tmp"
ssh -o BatchMode=yes "$SSH_HOST" "
  set -e
  if [ ! -f '$remote_env' ]; then
    echo 'remote .env missing — run vm-bootstrap.sh first' >&2; rm -f '$tmp'; exit 1
  fi
  cp '$remote_env' '$remote_env.bak-$stamp'
  added=0
  while IFS= read -r line; do
    case \"\$line\" in ''|'#'*) continue ;; esac
    key=\"\${line%%=*}\"
    [ \"\$key\" = \"\$line\" ] && continue                  # no '=' → not a var line
    if ! grep -qE \"^\${key}=\" '$remote_env'; then
      printf '%s\n' \"\$line\" >> '$remote_env'
      added=\$((added+1))
    fi
  done < '$tmp'
  rm -f '$tmp'
  echo \"  [.env] added \$added new key(s) to $remote_env (backup .bak-$stamp; existing keys untouched)\"
"
