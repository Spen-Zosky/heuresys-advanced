#!/usr/bin/env bash
# scripts/dev-bootstrap.sh — idempotent dev-workstation bootstrap for
# heuresys-advanced on a Unix host: macOS/Darwin on Intel (native or OpenCore)
# or Linux desktop (arm64/amd64). Talks to the central VM DB over an SSH tunnel
# and runs the stack on-demand (no persistent services, no local DB).
#
# Re-runnable. Ensures prerequisites (assumes brew/apt + git), pins Node 22 via
# nvm + corepack pnpm, clones-or-updates WITHOUT destroying local work,
# normalises the tunnel .env, ensures the SSH tunnel, installs deps. Ends in a
# "ready" state; pass --run to launch `pnpm dev` in the foreground.
#
# Secrets (.env + .secrets/*.pem) are out-of-band (never committed).
# Overridable env: REPO_DIR REPO_URL BRANCH NODE_MAJOR SSH_HOST DB_PORT API_PORT WEB_PORT NVM_VERSION
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/heuresys-advanced}"
REPO_URL="${REPO_URL:-https://github.com/Spen-Zosky/heuresys-advanced.git}"
BRANCH="${BRANCH:-main}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SSH_HOST="${SSH_HOST:-oracle-vm-default}"
DB_PORT="${DB_PORT:-5433}"      # local tunnel port -> VM:5432
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"
NVM_VERSION="${NVM_VERSION:-v0.40.1}"
RUN=0; [ "${1:-}" = "--run" ] && RUN=1

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
OS="$(uname -s)"   # Linux | Darwin

# portable in-place sed (GNU on Linux, BSD on macOS)
sed_i() { if sed --version >/dev/null 2>&1; then sed -i -E "$@"; else sed -i '' -E "$@"; fi; }

ensure_pkg() {  # $1 = command to check, $2 = package name
  command -v "$1" >/dev/null 2>&1 && return 0
  if [ "$OS" = "Darwin" ]; then
    command -v brew >/dev/null 2>&1 || { echo "Homebrew required (https://brew.sh)" >&2; exit 1; }
    brew install "$2"
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -qq
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$2"
  else
    echo "install '$2' manually (no brew/apt found)" >&2; exit 1
  fi
}

# 0. prerequisites
log "prerequisites ($OS)"
ensure_pkg git git
ensure_pkg curl curl
if [ "$OS" = "Linux" ]; then
  command -v gcc     >/dev/null 2>&1 || ensure_pkg gcc build-essential
  command -v python3 >/dev/null 2>&1 || ensure_pkg python3 python3
fi
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  log "install nvm $NVM_VERSION"
  curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
fi
log "node $NODE_MAJOR via nvm + corepack pnpm"
# nvm.sh + nvm commands return non-zero internally (e.g. nvm_ls_current); they
# are NOT safe under `set -e`/`set -u`/`pipefail`. Relax around them.
set +euo pipefail
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install "$NODE_MAJOR" >/dev/null
nvm use "$NODE_MAJOR" >/dev/null
NODE_BIN="$(dirname "$(nvm which "$NODE_MAJOR")")"
set -euo pipefail
[ -n "$NODE_BIN" ] && [ -x "$NODE_BIN/node" ] || { echo "nvm Node $NODE_MAJOR not resolved" >&2; exit 1; }
node --version
corepack enable >/dev/null 2>&1 || true
PNPM="$NODE_BIN/pnpm"

# 1. clone-or-update (NEVER destroy local work)
log "repo: $REPO_DIR @ $BRANCH"
if [ -d "$REPO_DIR/.git" ]; then
  dirty="$(git -C "$REPO_DIR" status --porcelain)"
  ahead="$(git -C "$REPO_DIR" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  if [ -z "$dirty" ] && [ "$ahead" = "0" ]; then
    git -C "$REPO_DIR" pull --ff-only
  else
    echo "  local changes/commits present — skipping git update (your work is safe)"
  fi
else
  git clone --quiet "$REPO_URL" "$REPO_DIR"
fi
git -C "$REPO_DIR" log --oneline -1

# 2. secrets (out-of-band)
log "secrets: .env + .secrets/*.pem"
miss=0
for f in .env .secrets/jwt_private.pem .secrets/jwt_public.pem; do
  [ -f "$REPO_DIR/$f" ] || { echo "  MISSING: $REPO_DIR/$f"; miss=1; }
done
if [ "$miss" = 1 ]; then
  echo "  Provide secrets out-of-band, e.g. from a machine that has them:" >&2
  echo "    scp .env        <this-host>:$REPO_DIR/.env" >&2
  echo "    scp -r .secrets <this-host>:$REPO_DIR/" >&2
  exit 1
fi
chmod 700 "$REPO_DIR/.secrets" 2>/dev/null || true
chmod 600 "$REPO_DIR/.env" "$REPO_DIR/.secrets/"*.pem 2>/dev/null || true

# 3. normalise .env for tunnel/dev (idempotent)
log "env: POSTGRES_HOST=localhost, POSTGRES_PORT=$DB_PORT, PORT=$API_PORT"
sed_i "s|^POSTGRES_HOST=.*|POSTGRES_HOST=localhost|" "$REPO_DIR/.env"
sed_i "s|^POSTGRES_PORT=.*|POSTGRES_PORT=$DB_PORT|" "$REPO_DIR/.env"
sed_i "s|^PORT=.*|PORT=$API_PORT|" "$REPO_DIR/.env"

# 4. ensure SSH tunnel localhost:DB_PORT -> VM:5432 (idempotent)
log "tunnel: localhost:$DB_PORT -> $SSH_HOST:5432"
tunnel_up() { (exec 3<>"/dev/tcp/localhost/$DB_PORT") 2>/dev/null; }
if tunnel_up; then
  echo "  already up"
else
  ssh -o ConnectTimeout=15 -fN -L "$DB_PORT:localhost:5432" "$SSH_HOST" 2>/dev/null || true
  sleep 2
  if tunnel_up; then
    echo "  opened"
  else
    echo "  could NOT open tunnel non-interactively. Run manually:" >&2
    echo "    ssh -fN -L $DB_PORT:localhost:5432 $SSH_HOST" >&2
    echo "  (first load the OCI key: ssh-add ~/.ssh/<oci_key>)" >&2
  fi
fi

# 5. install deps (reproducible, cross-platform lockfile)
log "deps: pnpm install --frozen-lockfile"
cd "$REPO_DIR"
"$PNPM" --version
"$PNPM" install --frozen-lockfile

# 6. ready / run
log "ready"
node --version; "$PNPM" --version
if [ "$RUN" = 1 ]; then
  log "run: pnpm dev (foreground)"
  exec "$PNPM" dev
else
  echo
  echo "Ready. Start dev with:"
  echo "  cd $REPO_DIR && $NODE_BIN/pnpm dev"
  echo "(API :$API_PORT, web :$WEB_PORT; DB via tunnel :$DB_PORT -> $SSH_HOST:5432)"
fi
