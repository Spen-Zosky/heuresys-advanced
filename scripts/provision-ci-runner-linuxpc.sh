#!/usr/bin/env bash
# ============================================================================
# scripts/provision-ci-runner-linuxpc.sh — D-08 F5: 2nd self-hosted runner
# OFF-PROD on linux-pc (the x86_64 PROD twin, 192.168.1.11).
#
# Closes the CI SPOF: until S1022 the ONLY runner was the OCI VM — i.e. the
# PROD host itself (queue contention + secrets-on-prod + resource risk).
# This script provisions linux-pc as runner `linux-pc-runner` with labels
# `off-prod,linux-pc`; the heavy DB-gate workflows (test-integration,
# playwright-smoke, build-web) target `[self-hosted, off-prod]` and hit the
# twin's LOCAL PostgreSQL (heuresys_ci, cloned from the local heuresys_advanced
# 1:1 clone) — PROD is never touched by CI again.
#
# Runs ON linux-pc as `enzo`. Uses ONLY the scoped sudoers grants of
# /etc/sudoers.d/heuresys-provision: (postgres) ALL + (root) systemctl,
# install, apt-get, apt, loginctl. No blanket sudo required.
#
# Idempotent + safe re-run: every step checks before acting.
#
# Usage (from the Windows dev host — token piped via stdin, never echoed, R10;
# the script travels via scp because stdin carries the token):
#   scp scripts/provision-ci-runner-linuxpc.sh linux-pc:/tmp/
#   gh api -X POST 'repos/{owner}/{repo}/actions/runners/registration-token' --jq .token \
#     | MSYS_NO_PATHCONV=1 ssh linux-pc 'RUNNER_TOKEN=$(cat) bash /tmp/provision-ci-runner-linuxpc.sh'
#
# Or on linux-pc directly:  RUNNER_TOKEN=<token> bash scripts/provision-ci-runner-linuxpc.sh
# Re-run without token (config step skipped if already registered).
#
# Env overrides: RUNNER_VERSION, RUNNER_NAME, RUNNER_LABELS, RUNNER_DIR,
#                REPO_DIR, REFRESH_ENV=1 (rebuild /etc/heuresys-runner.env)
# ============================================================================
set -euo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.336.0}"
RUNNER_SHA256="${RUNNER_SHA256:-04cf0be1aff4c3ec3554466c39124ca250e3effd8873bb7e8d68535aa9505d5d}"
RUNNER_NAME="${RUNNER_NAME:-linux-pc-runner}"
RUNNER_LABELS="${RUNNER_LABELS:-off-prod,linux-pc}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"
REPO_URL="${REPO_URL:-https://github.com/Spen-Zosky/heuresys-advanced}"
REPO_DIR="${REPO_DIR:-$HOME/heuresys-advanced}"
UNIT="actions.runner.Spen-Zosky-heuresys-advanced.${RUNNER_NAME}.service"
ENVFILE=/etc/heuresys-runner.env

log() { echo "[provision-ci-runner] $*"; }

# ----------------------------------------------------------------------------
# 0. Preconditions
# ----------------------------------------------------------------------------
[ "$(uname -m)" = "x86_64" ] || { log "FATAL: expected x86_64, got $(uname -m)"; exit 1; }
sudo -n systemctl is-system-running >/dev/null 2>&1 || { log "FATAL: scoped sudo (systemctl) not available non-interactively"; exit 1; }
[ -f "$REPO_DIR/.env" ] || { log "FATAL: $REPO_DIR/.env missing (twin not provisioned?)"; exit 1; }

# ----------------------------------------------------------------------------
# 1. Playwright/chromium OS deps (Ubuntu 22.04 package names; lock-timeout
#    instead of fuser-wait — fuser is not in the sudoers scope)
# ----------------------------------------------------------------------------
log "apt deps (chromium libs)"
sudo -n apt-get -o DPkg::Lock::Timeout=180 update -qq || log "WARN: apt update failed (offline mirror?) — continuing, install may still hit cache"
sudo -n apt-get -o DPkg::Lock::Timeout=180 install -y -qq \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2

# ----------------------------------------------------------------------------
# 2. Download + extract the runner (checksum-verified)
# ----------------------------------------------------------------------------
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
if [ ! -f ./config.sh ]; then
  TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
  log "downloading runner v${RUNNER_VERSION} (x64)"
  curl -fsSL -o "$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
  echo "${RUNNER_SHA256}  ${TARBALL}" | sha256sum -c - || { log "FATAL: checksum mismatch"; exit 1; }
  tar xzf "$TARBALL"
  rm -f "$TARBALL"
else
  log "runner package already extracted — skip download"
fi

# ----------------------------------------------------------------------------
# 3. Register with GitHub (one-time; .runner marks a configured runner)
# ----------------------------------------------------------------------------
if [ ! -f .runner ]; then
  [ -n "${RUNNER_TOKEN:-}" ] || { log "FATAL: not registered and RUNNER_TOKEN not provided"; exit 1; }
  log "registering runner '$RUNNER_NAME' (labels: $RUNNER_LABELS)"
  ./config.sh \
    --url "$REPO_URL" \
    --token "$RUNNER_TOKEN" \
    --name "$RUNNER_NAME" \
    --labels "$RUNNER_LABELS" \
    --work _work \
    --unattended
else
  log "runner already registered — skip config.sh"
fi

# runsvc.sh is what the systemd unit execs (same thing svc.sh install copies)
if [ ! -f ./runsvc.sh ]; then
  cp ./bin/runsvc.sh ./runsvc.sh && chmod +x ./runsvc.sh
fi

# ----------------------------------------------------------------------------
# 4. /etc/heuresys-runner.env — DB creds from the twin's .env + fresh JWT
#    keypair/cookie/MFA secrets generated HERE (no dev-secret transfer, R10).
#    systemd EnvironmentFile gotcha (S937): PEM newlines must be DOUBLE-escaped
#    (\\n) — systemd unescapes to literal \n, env.ts converts \n -> newline.
# ----------------------------------------------------------------------------
if [ ! -f "$ENVFILE" ] || [ "${REFRESH_ENV:-0}" = "1" ]; then
  log "building $ENVFILE"
  PGUSER_VAL=$(grep -E '^POSTGRES_USER=' "$REPO_DIR/.env" | head -1 | cut -d= -f2-)
  PGPASS_VAL=$(grep -E '^POSTGRES_PASSWORD=' "$REPO_DIR/.env" | head -1 | cut -d= -f2-)
  [ -n "$PGUSER_VAL" ] && [ -n "$PGPASS_VAL" ] || { log "FATAL: POSTGRES_USER/PASSWORD not found in twin .env"; exit 1; }

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$TMP/priv.pem" 2>/dev/null
  openssl rsa -in "$TMP/priv.pem" -pubout -out "$TMP/pub.pem" 2>/dev/null
  ESC='import sys;print(open(sys.argv[1]).read().replace(chr(10),chr(92)+chr(92)+chr(110)),end="")'
  PRIV=$(python3 -c "$ESC" "$TMP/priv.pem")
  PUB=$(python3 -c "$ESC" "$TMP/pub.pem")
  COOKIE=$(openssl rand -base64 48 | tr -d '\n')
  MFA=$(openssl rand -base64 32 | tr -d '\n')

  umask 077
  cat > "$TMP/runner.env" <<EOF
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=heuresys_advanced
POSTGRES_DATABASE=heuresys_advanced
POSTGRES_USER=$PGUSER_VAL
POSTGRES_PASSWORD=$PGPASS_VAL
PGPASSWORD=$PGPASS_VAL
POSTGRES_SCHEMA=sys
POSTGRES_SSL=disable
COOKIE_SECRET=$COOKIE
ADMIN_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/v1
MFA_ENCRYPTION_KEY=$MFA
JWT_PRIVATE_KEY=$PRIV
JWT_PUBLIC_KEY=$PUB
LOG_LEVEL=warn
NODE_ENV=test
NEXT_TELEMETRY_DISABLED=1
EOF
  sudo -n install -m 600 -o root -g root "$TMP/runner.env" "$ENVFILE"
  log "$ENVFILE installed (root:root 600)"
else
  log "$ENVFILE already present — skip (REFRESH_ENV=1 to rebuild)"
fi

# ----------------------------------------------------------------------------
# 5. systemd unit + EnvironmentFile drop-in (hand-authored — sudo ./svc.sh is
#    outside the sudoers scope). Includes the D-08 F3 resource slice: CI must
#    never starve the twin's own PROD services (api :8013 / web :3013).
# ----------------------------------------------------------------------------
log "installing systemd unit $UNIT"
TMPU=$(mktemp)
cat > "$TMPU" <<EOF
[Unit]
Description=GitHub Actions Runner (Spen-Zosky/heuresys-advanced, ${RUNNER_NAME})
After=network.target

[Service]
ExecStart=${RUNNER_DIR}/runsvc.sh
User=${USER}
WorkingDirectory=${RUNNER_DIR}
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=5min
# D-08 F3 resource slice: leave headroom for the twin's PROD services
MemoryMax=10G
CPUQuota=300%

[Install]
WantedBy=multi-user.target
EOF
sudo -n install -m 644 -o root -g root "$TMPU" "/etc/systemd/system/$UNIT"
rm -f "$TMPU"

sudo -n install -d -m 755 "/etc/systemd/system/${UNIT}.d"
TMPD=$(mktemp)
printf '[Service]\nEnvironmentFile=%s\n' "$ENVFILE" > "$TMPD"
sudo -n install -m 644 -o root -g root "$TMPD" "/etc/systemd/system/${UNIT}.d/override.conf"
rm -f "$TMPD"

sudo -n systemctl daemon-reload
sudo -n systemctl enable "$UNIT" >/dev/null 2>&1 || true
sudo -n systemctl restart "$UNIT"
sleep 3
sudo -n systemctl is-active "$UNIT" || { log "FATAL: runner service not active"; sudo -n systemctl status "$UNIT" --no-pager | tail -20; exit 1; }
log "runner service active"

# ----------------------------------------------------------------------------
# 6. JWT-escaping self-check: read the LIVE service env from /proc (runner runs
#    as $USER, so its environ is readable) and validate the PEM round-trip.
#    No secret value is ever printed.
# ----------------------------------------------------------------------------
MAINPID=$(sudo -n systemctl show -p MainPID --value "$UNIT")
if [ -n "$MAINPID" ] && [ "$MAINPID" != "0" ] && [ -r "/proc/$MAINPID/environ" ]; then
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  node - "$MAINPID" <<'NODEEOF'
const fs = require("fs"), crypto = require("crypto");
const pid = process.argv[2];
const env = fs.readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
const raw = env.find(e => e.startsWith("JWT_PRIVATE_KEY="));
if (!raw) { console.error("JWT_PRIVATE_KEY not in service env"); process.exit(1); }
let v = raw.slice("JWT_PRIVATE_KEY=".length);
v = v.split(String.fromCharCode(92) + "n").join(String.fromCharCode(10));
crypto.createPrivateKey(v);
console.log("[provision-ci-runner] JWT key survives systemd unescaping: OK");
NODEEOF
else
  log "WARN: could not read service environ (pid=$MAINPID) — JWT escaping unverified; the first CI run is the gate"
fi

# ----------------------------------------------------------------------------
# 7. heuresys_ci on the twin's LOCAL PostgreSQL (clone of the local 1:1
#    heuresys_advanced clone — PROD on the VM is never in the path)
# ----------------------------------------------------------------------------
log "provisioning heuresys_ci from local heuresys_advanced"
cd "$REPO_DIR"
bash db/scripts/setup-ci-database.sh

log "DONE — runner '$RUNNER_NAME' (labels: $RUNNER_LABELS) active, heuresys_ci ready"
