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
# Usage:      bash scripts/env-key-merge.sh <ssh_host> <remote_repo_path>
# Test mode:  ENV_MERGE_LOCAL=1 bash scripts/env-key-merge.sh <target_env> <source_env>
#             (D-19) runs the same merge function locally on two files — no ssh —
#             and prints the added-key count. Used by scripts/test/run-shell-tests.sh.
# Overridable env: LOCAL_ENV
set -euo pipefail
export MSYS_NO_PATHCONV=1

# Single merge implementation — exercised locally by the D-19 test gate and
# serialized to the remote via `declare -f` (one source, no heredoc copy to drift).
# Appends to $1 (target env file) every KEY=VALUE line of $2 (source) whose KEY is
# absent from the target; echoes the number of keys added. CRLF-tolerant: CR is
# stripped so a Windows-authored local .env never plants \r into a Linux remote
# .env value (cousin of the S979 marker-CRLF lesson).
merge_env_into() {
  local target="$1" src="$2" added=0 line key
  # Dev/test-only neutralization + gate switches that must NEVER reach a remote: a
  # local value would silently flip a PROD control. MFA_ENFORCEMENT_ENABLED (S989);
  # the 4 boolean gate flags added by QW-J2 (WS-J F-J-3) — all now enum-parsed, but a
  # stray dev value must not propagate additively to a PROD host missing the key.
  # S1023 additions: VOYAGE_API_KEY (D-12 — a per-call-cost API key must never
  # silently reach a remote); PROM_METRICS_ENABLED (D-09 — per-host observability
  # control, set deliberately by provision-prometheus-vm.sh); TENANT_PROVISION_ENABLED
  # (D-14 F2 kill-switch — same flip-risk class as the QW-J2 gates).
  # Space-padded for whole-word containment match.
  local denylist=" MFA_ENFORCEMENT_ENABLED MATCHING_FREETEXT_ENABLED API_DOCS_ENABLED COOKIE_SECURE TRUST_PROXY VOYAGE_API_KEY PROM_METRICS_ENABLED TENANT_PROVISION_ENABLED "
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in ''|'#'*) continue ;; esac
    key="${line%%=*}"
    [ "$key" = "$line" ] && continue                  # no '=' → not a var line
    case "$denylist" in *" $key "*) continue ;; esac  # never propagate dev-only switches
    if ! grep -q "^${key}=" "$target"; then
      printf '%s\n' "$line" >> "$target"
      added=$((added+1))
    fi
  done < "$src"
  echo "$added"
}

if [ "${ENV_MERGE_LOCAL:-0}" = 1 ]; then
  merge_env_into "${1:?test mode: env-key-merge.sh <target_env> <source_env>}" \
                 "${2:?test mode: env-key-merge.sh <target_env> <source_env>}"
  exit 0
fi

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
  $(declare -f merge_env_into)
  added=\$(merge_env_into '$remote_env' '$tmp')
  rm -f '$tmp'
  echo \"  [.env] added \$added new key(s) to $remote_env (backup .bak-$stamp; existing keys untouched)\"
"
