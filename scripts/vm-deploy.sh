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
# systemd unit owner. Default ubuntu (the OCI VM). The linux-pc PROD twin runs as 'enzo' —
# align-clones passes SERVICE_USER=enzo PUBLIC_HOST=192.168.1.11 for that leg so the scheduler
# units (and the inlined web URL) are rendered for the right host (design §12.4).
SERVICE_USER="${SERVICE_USER:-ubuntu}"
SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"

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
    SERVICE_USER="$SERVICE_USER" SERVICE_GROUP="$SERVICE_GROUP" \
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

# 2a. Pre-deploy DB safety snapshot (D-08 rollback net). Take a pg_dump -Fc BEFORE the
#     migration step (2b) — the first thing that mutates the live DB — so a bad deploy is
#     restorable (pg_restore). Kept in a dedicated pre-deploy/ dir (distinct from the
#     scheduled R5 daily backups). Fail-loud on an empty/short dump (a silent 0-byte safety
#     net is worse than none → abort the deploy). Skip with PREDEPLOY_BACKUP=skip (fast
#     iteration only). Overridable: PREDEPLOY_DIR, PREDEPLOY_RETAIN (keep newest N).
if [ "${PREDEPLOY_BACKUP:-run}" != "skip" ]; then
  log "db: pre-deploy snapshot (pg_dump -Fc, rollback net)"
  PD_DB="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
  PD_DIR="${PREDEPLOY_DIR:-$REPO_DIR/pg_dump_snapshots/pre-deploy}"
  PD_RETAIN="${PREDEPLOY_RETAIN:-10}"
  mkdir -p "$PD_DIR"
  pd_out="$PD_DIR/${PD_DB}_predeploy_$(date -u +%Y%m%dT%H%M%SZ).dump"
  sudo -u postgres pg_dump -Fc "$PD_DB" > "$pd_out"
  if [ ! -s "$pd_out" ] || [ "$(stat -c %s "$pd_out")" -lt 1024 ]; then
    echo "ERROR: pre-deploy dump is empty/too small ($pd_out) — aborting deploy" >&2
    rm -f "$pd_out"; exit 1
  fi
  echo "  pre-deploy snapshot: $pd_out ($(du -h "$pd_out" | cut -f1))"
  # Retention: keep only the newest N pre-deploy dumps (deploy net, not a long-term archive).
  ls -1t "$PD_DIR/${PD_DB}_predeploy_"*.dump 2>/dev/null | tail -n +"$((PD_RETAIN + 1))" | xargs -r rm -f
  echo "  pre-deploy retention: kept newest $PD_RETAIN"
else
  log "db: pre-deploy snapshot SKIPPED (PREDEPLOY_BACKUP=skip)"
fi

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

# 3c. Render + install ALL systemd units (api/web + EVERY scheduler) from deploy/systemd/.
#     vm-deploy is the SINGLE deploy entrypoint for BOTH the VM (User=ubuntu) and the linux-pc
#     twin (SERVICE_USER=enzo): the sed rewrites User=/Group= + all @@placeholders@@ on EVERY
#     unit — not just the schedulers — so api/web are correct on the twin too (design §12.4;
#     removes the divergence with provision-linux-pc.sh). The 5 placeholders are exactly the
#     ones the sed covers (verified); a unit that still carries an unrendered @@…@@ aborts the
#     deploy (fail-loud > installing a broken unit). Idempotent: re-render + install + enable.
log "systemd: render + install ALL units (api/web + schedulers) — User=$SERVICE_USER (§12.4)"
swtmp="$(mktemp -d)"
render_unit() {  # $1 = absolute path to a template unit file
  local base; base="$(basename "$1")"
  sed -e "s#@@REPO_DIR@@#$REPO_DIR#g" -e "s#@@NODE_BIN@@#$NODE_BIN#g" \
      -e "s#@@PUBLIC_HOST@@#$PUBLIC_HOST#g" -e "s#@@API_PORT@@#$API_PORT#g" -e "s#@@WEB_PORT@@#$WEB_PORT#g" \
      -e "s#^User=ubuntu#User=$SERVICE_USER#g" -e "s#^Group=ubuntu#Group=$SERVICE_GROUP#g" \
      "$1" > "$swtmp/$base"
  if grep -q '@@' "$swtmp/$base"; then
    echo "ERROR: unrendered placeholder in $base — vm-deploy sed does not cover it:" >&2
    grep -n '@@' "$swtmp/$base" >&2; rm -rf "$swtmp"; exit 1
  fi
  sudo install -m 644 -o root -g root "$swtmp/$base" "/etc/systemd/system/$base"
}
for unit in "$REPO_DIR"/deploy/systemd/*.service "$REPO_DIR"/deploy/systemd/*.timer; do
  render_unit "$unit"
done
rm -rf "$swtmp"
sudo systemctl daemon-reload
# api/web are long-running services (restarted in step 4 below); ensure they're enabled at boot.
sudo systemctl enable heuresys-advanced-api.service heuresys-advanced-web.service >/dev/null 2>&1 || true
# every scheduler timer: enable + start now (idempotent — re-run safe).
for t in "$REPO_DIR"/deploy/systemd/*.timer; do
  sudo systemctl enable --now "$(basename "$t")" >/dev/null
done

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
echo "  backup.timer:   $(systemctl is-active heuresys-advanced-backup.timer 2>/dev/null || echo inactive)"
echo "  reindex.timer:  $(systemctl is-active heuresys-advanced-reindex.timer 2>/dev/null || echo inactive)"
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
