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

# Self-modify-buffer fix: bash already buffered the OLD vm-deploy.sh into memory before
# the reset above pulled a NEW one. If this commit changed vm-deploy.sh, re-exec the
# freshly-pulled version ONCE (guarded) so the rest of the pipeline runs the update —
# otherwise steps added in the same commit silently don't take effect until the 2nd run.
if [ -z "${VM_DEPLOY_REEXEC:-}" ]; then
  exec env VM_DEPLOY_REEXEC=1 \
    REPO_DIR="$REPO_DIR" BRANCH="$BRANCH" PUBLIC_HOST="$PUBLIC_HOST" \
    API_PORT="$API_PORT" WEB_PORT="$WEB_PORT" NODE_MAJOR="$NODE_MAJOR" RESTART_API="$RESTART_API" \
    bash "$REPO_DIR/scripts/vm-deploy.sh"
fi

# 2. Deps (reproducible, exact lockfile match). Clean-reinstall if the Node ABI changed
#    (native modules argon2/@next/swc/sharp must match NODE_MODULE_VERSION) — a frozen
#    install over a stale node_modules built for another ABI can crash at runtime.
cd "$REPO_DIR"
ABI_SENTINEL="$REPO_DIR/node_modules/.heuresys-node-abi"
CUR_ABI="$(node -p 'process.versions.modules' 2>/dev/null || echo unknown)"
PREV_ABI="$(cat "$ABI_SENTINEL" 2>/dev/null || echo none)"
if [ -d "$REPO_DIR/node_modules" ] && [ "$CUR_ABI" != "$PREV_ABI" ]; then
  log "deps: Node ABI changed ($PREV_ABI -> $CUR_ABI) — clean reinstall of native modules"
  rm -rf "$REPO_DIR/node_modules" "$REPO_DIR"/apps/*/node_modules "$REPO_DIR"/packages/*/node_modules
fi
log "deps: pnpm install --frozen-lockfile"
if ! pnpm install --frozen-lockfile; then
  echo "ERROR: 'pnpm install --frozen-lockfile' failed — pnpm-lock.yaml is out of sync with package.json." >&2
  echo "       Regenerate + commit the lockfile on the PC (run 'pnpm install', commit pnpm-lock.yaml, push), then redeploy." >&2
  exit 1
fi
mkdir -p "$REPO_DIR/node_modules" && printf '%s' "$CUR_ABI" > "$ABI_SENTINEL"

# 2b. Apply DB migrations ONLY if a migration is pending (sha256 vs the sys.sys_schema_migrations
#     ledger). The DBMS is shared (PC tunnel :5433 == this VM's :5432), so it is normally already
#     migrated during dev → fast no-op; runs only for a genuinely unapplied migration.
#     Override: DB_MIGRATE=force|skip|auto (default auto).
log "db: migrate-if-pending"
bash "$REPO_DIR/db/scripts/migrate-if-pending.sh"

# 3. Production builds: shared (clean) → API (tsup bundle → node dist/server.js) → web (next build).
#    @heuresys/shared MUST be built BEFORE api/web because both typecheck against its
#    dist/*.d.ts. `pnpm install` alone does NOT reliably rebuild it: the incremental
#    tsc tsbuildinfo can skip re-emitting .d.ts files that were removed from disk (e.g.
#    a dist file untracked from git), leaving the web typecheck unable to resolve shared
#    types ("has no exported member ..."). Force a CLEAN shared build to avoid that.
log "build: clean @heuresys/shared (rm dist + tsbuildinfo, then tsc)"
rm -rf "$REPO_DIR/packages/shared/dist" "$REPO_DIR/packages/shared/tsconfig.tsbuildinfo"
pnpm --filter @heuresys/shared build

# Web NEXT_PUBLIC_* are inlined at BUILD time and MUST match the systemd unit's
# values — derived here from PUBLIC_HOST/API_PORT.
log "build: production api (tsup) + web (next build)"
pnpm --filter @heuresys/api build
NODE_ENV=production \
NEXT_PUBLIC_API_PROXY_BASE_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_BASE_URL="http://$PUBLIC_HOST:$API_PORT/v1" \
pnpm --filter @heuresys/web build

# 3c. Install/refresh the one-shot + timer units driven by schedulers: scraping (cap⑤ P2,
#     weekly ESCO probe) + insights (cap③, daily recompute). The api/web unit files are
#     installed by vm-bootstrap.sh; these scheduler units are NEW, so the ROUTINE deploy
#     installs them too — otherwise the timers would silently never run. Idempotent:
#     install + enable --now are safe to re-run; the timers (not the one-shots) get enabled.
log "systemd: install scheduler units (scraping cap⑤ P2 + insights cap③)"
swtmp="$(mktemp -d)"
for svc in scraping insights; do
  sed -e "s#@@REPO_DIR@@#$REPO_DIR#g" -e "s#@@NODE_BIN@@#$NODE_BIN#g" \
      "$REPO_DIR/deploy/systemd/heuresys-advanced-$svc.service" \
      > "$swtmp/heuresys-advanced-$svc.service"
  sudo install -m 644 -o root -g root "$swtmp/heuresys-advanced-$svc.service" \
      "/etc/systemd/system/heuresys-advanced-$svc.service"
  sudo install -m 644 -o root -g root "$REPO_DIR/deploy/systemd/heuresys-advanced-$svc.timer" \
      "/etc/systemd/system/heuresys-advanced-$svc.timer"
done
rm -rf "$swtmp"
sudo systemctl daemon-reload
sudo systemctl enable --now heuresys-advanced-scraping.timer >/dev/null
sudo systemctl enable --now heuresys-advanced-insights.timer >/dev/null

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
echo "  scraping.timer: $(systemctl is-active heuresys-advanced-scraping.timer 2>/dev/null || echo inactive)"
echo "  insights.timer: $(systemctl is-active heuresys-advanced-insights.timer 2>/dev/null || echo inactive)"
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
