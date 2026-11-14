#!/usr/bin/env bash
#
# scripts/vm-rollback.sh — D-08 (F-8/9/12): one-command APP rollback of the last vm-deploy.
#
# Rolls the app back to <sha> (default: pg_dump_snapshots/LAST_GOOD_SHA — the last deploy
# whose probe gate passed): git checkout --detach <sha> → install → build → restart →
# probe. STANDALONE by design: it must not source vm-deploy.sh, because after a failed
# deploy origin/main IS the broken sha — this script rebuilds the known-good tree as-is.
#
# The DB is NOT touched: migrations are additive/idempotent by doctrine (CLAUDE.md), so a
# rolled-back app runs fine on the newer schema. If a migration itself broke data, restore
# the pre-deploy snapshot MANUALLY (destructive — always confirm with Enzo first):
#   sudo -u postgres pg_restore -d heuresys_advanced --clean --if-exists <dump>
#
# Usage:  bash scripts/vm-rollback.sh [<sha>]
# Overridable env: REPO_DIR PUBLIC_HOST API_PORT WEB_PORT NODE_MAJOR
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/heuresys-advanced}"
PUBLIC_HOST="${PUBLIC_HOST:-80.225.82.207}"
API_PORT="${API_PORT:-8013}"
WEB_PORT="${WEB_PORT:-3013}"
NODE_MAJOR="${NODE_MAJOR:-22}"

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# Copia rilasciata (D1, docs/piani/PIANO_turni-advanced-datastore_20261110.md): la produzione gira dal
# collegamento SERVIZIO_LINK. Tornare indietro e' rimettere il collegamento sulla copia precedente (o su
# quella data come argomento, una cartella) e riavviare: niente checkout, niente build.
SERVIZIO_LINK="${SERVIZIO_LINK:-$HOME/heuresys-servizio/advanced-produzione}"
if [ -L "$SERVIZIO_LINK" ]; then
  ATTUALE="$(readlink -f "$SERVIZIO_LINK")"
  DEST="${1:-$(cat "$ATTUALE/.rilascio/precedente" 2>/dev/null || true)}"
  [ -n "$DEST" ] && [ -d "$DEST" ] || { echo "ERROR: nessuna copia precedente registrata in $ATTUALE/.rilascio/precedente; passa la cartella" >&2; exit 1; }
  log "rollback: $SERVIZIO_LINK $ATTUALE -> $DEST"
  bash "$ATTUALE/scripts/rilascio-copia.sh" punta "$SERVIZIO_LINK" "$DEST"
  sudo systemctl restart heuresys-advanced-api.service; sleep 4
  sudo systemctl restart heuresys-advanced-web.service
  systemctl is-enabled --quiet heuresys-agent-gateway.service 2>/dev/null && sudo systemctl restart heuresys-agent-gateway.service
  if [ -f "$DEST/.rilascio/commit" ]; then cp "$DEST/.rilascio/commit" "$DEST/pg_dump_snapshots/LAST_GOOD_SHA"
  else git -C "$DEST" rev-parse HEAD > "$DEST/pg_dump_snapshots/LAST_GOOD_SHA"; fi
  curl -fsS --retry 45 --retry-delay 1 --retry-connrefused --retry-all-errors -m 8 "http://localhost:$API_PORT/readyz" >/dev/null \
    && echo "  api /readyz OK" || { echo "  api /readyz FAILED" >&2; exit 1; }
  exit 0
fi

SHA="${1:-}"
if [ -z "$SHA" ]; then
  SHA="$(cat "$REPO_DIR/pg_dump_snapshots/LAST_GOOD_SHA" 2>/dev/null || true)"
fi
if [ -z "$SHA" ]; then
  echo "ERROR: no <sha> argument and no pg_dump_snapshots/LAST_GOOD_SHA — nothing to roll back to." >&2
  exit 1
fi

# Node via nvm (same relax-strict-mode dance as vm-deploy.sh).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
set +euo pipefail
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use "$NODE_MAJOR" >/dev/null
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -euo pipefail
export PATH="$NODE_BIN:$PATH"
echo "node=$(node -v) pnpm=$(pnpm -v)"

log "rollback: checkout --detach $SHA"
git -C "$REPO_DIR" checkout --detach "$SHA" --quiet
git -C "$REPO_DIR" log --oneline -1

cd "$REPO_DIR"
log "deps: pnpm install --frozen-lockfile (lockfile of the rolled-back sha)"
CI=true pnpm install --frozen-lockfile

log "build: clean shared → api → web (same pipeline as vm-deploy step 3)"
rm -rf "$REPO_DIR/packages/shared/dist" "$REPO_DIR/packages/shared/tsconfig.tsbuildinfo"
pnpm --filter @heuresys/shared build
pnpm --filter @heuresys/api build
NODE_ENV=production \
NEXT_PUBLIC_API_PROXY_BASE_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_BASE_URL="http://$PUBLIC_HOST:$API_PORT/v1" \
pnpm --filter @heuresys/web build

log "restart"
sudo systemctl restart heuresys-advanced-api.service
sleep 4
sudo systemctl restart heuresys-advanced-web.service
sleep 5

log "verify (probe gate)"
OK=1
if curl -fsS --retry 45 --retry-delay 1 --retry-connrefused --retry-all-errors -m 8 "http://localhost:$API_PORT/readyz" >/dev/null; then
  echo "  api /readyz OK"
else
  echo "  api /readyz FAILED — journalctl -u heuresys-advanced-api -n 50" >&2
  OK=0
fi
code=$(curl -s -o /dev/null -m 25 -w '%{http_code}' "http://localhost:$WEB_PORT/login" || echo ERR)
echo "  web /login HTTP $code"
[ "$code" = "200" ] || OK=0

if [ "$OK" != 1 ]; then
  echo "ROLLBACK PROBE FAILED — the rolled-back sha does not come up either. Investigate" >&2
  echo "journalctl; consider the pre-deploy DB snapshot (manual pg_restore, destructive)." >&2
  exit 1
fi

echo
echo "Rolled back to $SHA (detached HEAD). When main is fixed+pushed, return with:"
echo "  git -C $REPO_DIR checkout main && bash scripts/vm-deploy.sh"
