#!/usr/bin/env bash
#
# scripts/vm-bootstrap.sh — idempotent bootstrap for running heuresys-advanced
# on a Linux host (Ubuntu/Debian, arm64 OR amd64) as persistent systemd
# dev-mode services.
#
# Architecture-agnostic: nvm fetches the right Node build, and the committed
# pnpm-lock.yaml carries every platform variant of the native deps (esbuild,
# @next/swc, rollup, lightningcss, sharp — both linux-x64 and linux-arm64), so
# `pnpm install --frozen-lockfile` resolves correctly on either CPU.
#
# Safe to re-run. It ensures prerequisites (git/curl/build tools, nvm, pnpm via
# corepack), clones/updates the repo, pins Node, installs deps, normalises the
# two VM-specific .env values, renders + installs the systemd unit templates,
# and (re)starts the services.
#
# Secrets (.env, .secrets/*.pem) are NEVER in git. Transfer them out-of-band
# (scp from the dev machine) before the first run; this script only verifies
# they exist and fixes the VM-local DB port + API port.
#
# Overridable via env:
#   REPO_DIR REPO_URL BRANCH NODE_MAJOR PUBLIC_HOST API_PORT WEB_PORT DB_PORT
set -euo pipefail

REPO_DIR="${REPO_DIR:-/home/ubuntu/heuresys-advanced}"
REPO_URL="${REPO_URL:-https://github.com/Spen-Zosky/heuresys-advanced.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PUBLIC_HOST="${PUBLIC_HOST:-80.225.82.207}"
API_PORT="${API_PORT:-8013}"
WEB_PORT="${WEB_PORT:-3013}"
DB_PORT="${DB_PORT:-5432}"   # native PostgreSQL on the host (no SSH tunnel here)
NVM_VERSION="${NVM_VERSION:-v0.40.1}"

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

# 0. Prerequisites (idempotent: only acts on what's missing) ----------------
log "prerequisites: git, curl, build tools, nvm, corepack"
need=()
command -v git     >/dev/null 2>&1 || need+=(git)
command -v curl    >/dev/null 2>&1 || need+=(curl)
command -v gcc     >/dev/null 2>&1 || need+=(build-essential)   # argon2 native fallback
command -v python3 >/dev/null 2>&1 || need+=(python3)
if [ "${#need[@]}" -gt 0 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "  installing: ${need[*]}"
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${need[@]}"
  else
    echo "  missing (${need[*]}) and apt-get not found — install them and re-run." >&2
    exit 1
  fi
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "  installing nvm $NVM_VERSION"
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
fi
# nvm.sh is NOT safe under `set -e`/`set -u`/`pipefail` (it runs commands that
# return non-zero by design, e.g. nvm_ls_current). Relax strict mode around it.
set +euo pipefail
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
set -euo pipefail

# 1. Clone or update (idempotent) ------------------------------------------
log "repo: clone or update -> $REPO_DIR @ $BRANCH"
if [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" fetch origin --quiet
  git -C "$REPO_DIR" checkout "$BRANCH" --quiet
  git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
else
  rmdir "$REPO_DIR" 2>/dev/null || true   # remove an empty placeholder dir, if present
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
git -C "$REPO_DIR" log --oneline -1

# 2. Secrets must already be present (out-of-band; never committed) ---------
log "secrets: verify .env + .secrets/*.pem"
miss=0
for f in .env .secrets/jwt_private.pem .secrets/jwt_public.pem; do
  [ -f "$REPO_DIR/$f" ] || { echo "  MISSING: $REPO_DIR/$f"; miss=1; }
done
if [ "$miss" = 1 ]; then
  cat >&2 <<MSG
  Secrets not present. From the dev machine, e.g.:
    scp .env        ${REPO_DIR##*/}-host:$REPO_DIR/.env
    scp -r .secrets ${REPO_DIR##*/}-host:$REPO_DIR/
  then re-run this script.
MSG
  exit 1
fi
chmod 700 "$REPO_DIR/.secrets"
chmod 600 "$REPO_DIR/.env" "$REPO_DIR/.secrets/"*.pem

# 3. Normalise the two host-specific .env values (idempotent) --------------
log "env: POSTGRES_PORT -> $DB_PORT, PORT -> $API_PORT (host-local)"
sed -i -E "s|^POSTGRES_PORT=.*|POSTGRES_PORT=$DB_PORT|" "$REPO_DIR/.env"
sed -i -E "s|^PORT=.*|PORT=$API_PORT|" "$REPO_DIR/.env"

# 4. Node via nvm + pnpm via corepack (both arch-agnostic) -----------------
log "node: nvm install/use $NODE_MAJOR; pnpm via corepack"
set +e   # nvm commands return non-zero internally; don't let `set -e` abort
nvm install "$NODE_MAJOR" >/dev/null
nvm use "$NODE_MAJOR" >/dev/null
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -e
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN/node" ] || { echo "nvm Node $NODE_MAJOR not resolved" >&2; exit 1; }
node --version
corepack enable >/dev/null 2>&1 || true   # puts the pnpm shim in $NODE_BIN

# 5. Install dependencies (reproducible, cross-platform lockfile) ----------
log "deps: pnpm install --frozen-lockfile"
cd "$REPO_DIR"
"$NODE_BIN/pnpm" --version       # pin via package.json packageManager (corepack)
"$NODE_BIN/pnpm" install --frozen-lockfile

# 5b. Production builds (the VM is the PROD environment, not dev — see SOT).
#     - API: tsup bundle (dist/server.js) → run with plain `node`, no tsx/watcher.
#     - Web: `next build` → `next start` serves the pre-built output (instant pages).
#     Web NEXT_PUBLIC_* are inlined HERE at build time (must match the systemd unit's
#     values), derived from PUBLIC_HOST/API_PORT.
log "build: production api (tsup) + web (next build)"
"$NODE_BIN/pnpm" --filter @heuresys/api build
NODE_ENV=production \
NEXT_PUBLIC_API_PROXY_BASE_URL="http://localhost:$API_PORT" \
NEXT_PUBLIC_API_BASE_URL="http://$PUBLIC_HOST:$API_PORT/v1" \
"$NODE_BIN/pnpm" --filter @heuresys/web build

# 6. Render + install systemd unit templates, then (re)start (idempotent) --
#    api/web are long-running services; `scraping` (cap⑤ P2, D-2) + `insights` (cap③)
#    are one-shots driven by their timers — installed + enabled but NOT started here
#    (the timers fire them).
log "systemd: render templates + install + restart"
tmp="$(mktemp -d)"
for svc in api web scraping insights; do
  sed -e "s#@@REPO_DIR@@#$REPO_DIR#g" \
      -e "s#@@NODE_BIN@@#$NODE_BIN#g" \
      -e "s#@@PUBLIC_HOST@@#$PUBLIC_HOST#g" \
      -e "s#@@API_PORT@@#$API_PORT#g" \
      -e "s#@@WEB_PORT@@#$WEB_PORT#g" \
      "$REPO_DIR/deploy/systemd/heuresys-advanced-$svc.service" \
      > "$tmp/heuresys-advanced-$svc.service"
  sudo install -m 644 -o root -g root "$tmp/heuresys-advanced-$svc.service" \
      "/etc/systemd/system/heuresys-advanced-$svc.service"
done
# the timers are static (no placeholders) — install verbatim.
sudo install -m 644 -o root -g root "$REPO_DIR/deploy/systemd/heuresys-advanced-scraping.timer" \
    "/etc/systemd/system/heuresys-advanced-scraping.timer"
sudo install -m 644 -o root -g root "$REPO_DIR/deploy/systemd/heuresys-advanced-insights.timer" \
    "/etc/systemd/system/heuresys-advanced-insights.timer"
rm -rf "$tmp"
sudo systemctl daemon-reload
sudo systemctl enable heuresys-advanced-api.service heuresys-advanced-web.service >/dev/null
# weekly ESCO reference-sync probe (cap⑤ P2) + daily insights recompute (cap③) —
# enable + start the TIMERS (not the one-shots).
sudo systemctl enable --now heuresys-advanced-scraping.timer >/dev/null
sudo systemctl enable --now heuresys-advanced-insights.timer >/dev/null
sudo systemctl restart heuresys-advanced-api.service
sleep 5
sudo systemctl restart heuresys-advanced-web.service

# 7. Verify ----------------------------------------------------------------
log "verify"
sleep 8
systemctl is-active heuresys-advanced-api heuresys-advanced-web || true
if curl -fsS -m 5 "http://localhost:$API_PORT/healthz" >/dev/null; then
  echo "  api /healthz OK"
else
  echo "  api /healthz FAILED — check: journalctl -u heuresys-advanced-api -n 50" >&2
fi
echo
echo "Done. API http://$PUBLIC_HOST:$API_PORT  |  Web http://$PUBLIC_HOST:$WEB_PORT"
echo "Logs: journalctl -u heuresys-advanced-api -f   (or -web)"
