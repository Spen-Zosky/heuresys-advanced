#!/usr/bin/env bash
#
# scripts/vm-deploy.sh — fast PRODUCTION redeploy of heuresys-advanced on the VM.
#
# The VM is the PRODUCTION environment (not a dev box) — the single live DBMS lives
# here and dev machines (Windows/Mac) use it directly or via the SSH tunnel without
# a local copy. So the web app is always served from a pre-built `.next` (next build
# → next start): pages are instant, no on-demand dev compile.
#
# This is the routine-update path: pull → install → next build → restart.
# (vm-bootstrap.sh is the heavier first-time / full setup; it does the same build.)
# Safe to re-run (idempotent). Run on the VM:  bash scripts/vm-deploy.sh
#
# Overridable via env: REPO_DIR BRANCH PUBLIC_HOST API_PORT WEB_PORT NODE_MAJOR RESTART_API
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/heuresys-advanced}"
BRANCH="${BRANCH:-main}"
PUBLIC_HOST="${PUBLIC_HOST:-80.225.82.207}"
API_PORT="${API_PORT:-8013}"
WEB_PORT="${WEB_PORT:-3013}"
NODE_MAJOR="${NODE_MAJOR:-22}"
RESTART_API="${RESTART_API:-1}"   # set 0 to skip restarting the API (web-only deploy)

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# Node via nvm (the services run on this Node; argon2 native ABI must match).
# nvm.sh is NOT safe under set -e/-u/pipefail (it runs commands that return
# non-zero by design, e.g. nvm_ls_current) — relax strict mode around it.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +euo pipefail
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_MAJOR" >/dev/null
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -euo pipefail
[ -x "$NODE_BIN/node" ] || { echo "nvm Node $NODE_MAJOR not resolved" >&2; exit 1; }
export PATH="$NODE_BIN:$PATH"
echo "node=$(node -v) pnpm=$(pnpm -v)"

# 1. Sync the repo to the authoritative remote (prod box: no local edits expected;
#    gitignored .env/.secrets are preserved by reset).
log "sync: $BRANCH @ origin"
git -C "$REPO_DIR" fetch origin --quiet
git -C "$REPO_DIR" checkout "$BRANCH" --quiet
git -C "$REPO_DIR" reset --hard "origin/$BRANCH" --quiet
git -C "$REPO_DIR" log --oneline -1

# 2. Deps (reproducible) + the @heuresys/shared dist (prepare).
log "deps: pnpm install --frozen-lockfile"
cd "$REPO_DIR"
pnpm install --frozen-lockfile

# 3. Production builds: API (tsup bundle → node dist/server.js) + web (next build).
#    Web NEXT_PUBLIC_* are inlined at BUILD time and MUST match the systemd unit's
#    values — derived here from PUBLIC_HOST/API_PORT.
log "build: production api (tsup) + web (next build)"
pnpm --filter @heuresys/api build
NODE_ENV=production \
NEXT_PUBLIC_API_PROXY_BASE_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_BASE_URL="http://$PUBLIC_HOST:$API_PORT/v1" \
pnpm --filter @heuresys/web build

# 4. Restart services (api first so the web's proxy target is up).
log "restart"
if [ "$RESTART_API" = 1 ]; then
  sudo systemctl restart heuresys-advanced-api.service
  sleep 4
fi
sudo systemctl restart heuresys-advanced-web.service
sleep 5

# 5. Verify.
log "verify"
systemctl is-active heuresys-advanced-api heuresys-advanced-web || true
if curl -fsS -m 8 "http://localhost:$API_PORT/readyz" >/dev/null; then
  echo "  api /readyz OK"
else
  echo "  api /readyz FAILED — journalctl -u heuresys-advanced-api -n 50" >&2
fi
code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "http://localhost:$WEB_PORT/login" || echo ERR)
t=$(curl -s -o /dev/null -m 25 -w '%{time_total}' "http://localhost:$WEB_PORT/login" || echo ERR)
echo "  web /login HTTP $code in ${t}s (prod = sub-second)"
echo
echo "Done. Web http://$PUBLIC_HOST:$WEB_PORT  |  API http://$PUBLIC_HOST:$API_PORT"
