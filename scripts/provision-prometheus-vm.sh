#!/usr/bin/env bash
# ============================================================================
# scripts/provision-prometheus-vm.sh — D-09 F5: install the local Prometheus
# collector on the OCI VM (ARM64). Idempotent, safe re-run.
#
# What it does:
#   1. checksum-verified download of Prometheus (linux-arm64) → /opt/prometheus
#   2. data dir /var/lib/heuresys-prometheus (owned by the service user)
#   3. renders + installs deploy/systemd/heuresys-prometheus.service
#      (same @@REPO_DIR@@ convention as vm-deploy.sh) + enable --now
#   4. ensures PROM_METRICS_ENABLED=true in the repo .env (additive — the API
#      exposes /metrics loopback-only ONLY when this flag is on; requires an
#      API restart to take effect, done here)
#   5. verify: prometheus target 'heuresys-api' reaches state=up
#
# Run ON the VM:  bash scripts/provision-prometheus-vm.sh
# Env overrides: PROM_VERSION, PROM_SHA256, REPO_DIR, SERVICE_USER
# ============================================================================
set -euo pipefail

PROM_VERSION="${PROM_VERSION:-3.13.1}"
PROM_SHA256="${PROM_SHA256:-fbd8e5e0f6ad2e7d053e717739186caee4fd0cab2cf9335bfc86c292fe2a2bfe}"
REPO_DIR="${REPO_DIR:-/home/ubuntu/heuresys-advanced}"
SERVICE_USER="${SERVICE_USER:-ubuntu}"
DATA_DIR=/var/lib/heuresys-prometheus
UNIT=heuresys-prometheus.service

log() { echo "[provision-prometheus] $*"; }

[ "$(uname -m)" = "aarch64" ] || { log "FATAL: expected aarch64 (OCI VM), got $(uname -m)"; exit 1; }

# 1. binary
if [ ! -x /opt/prometheus/prometheus ] || ! /opt/prometheus/prometheus --version 2>/dev/null | grep -q "$PROM_VERSION"; then
  log "installing prometheus v${PROM_VERSION} (linux-arm64)"
  TARBALL="prometheus-${PROM_VERSION}.linux-arm64.tar.gz"
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  curl -fsSL -o "$TMP/$TARBALL" \
    "https://github.com/prometheus/prometheus/releases/download/v${PROM_VERSION}/${TARBALL}"
  echo "${PROM_SHA256}  $TMP/$TARBALL" | sha256sum -c - || { log "FATAL: checksum mismatch"; exit 1; }
  tar xzf "$TMP/$TARBALL" -C "$TMP"
  sudo mkdir -p /opt/prometheus
  sudo install -m 755 "$TMP/prometheus-${PROM_VERSION}.linux-arm64/prometheus" /opt/prometheus/prometheus
  sudo install -m 755 "$TMP/prometheus-${PROM_VERSION}.linux-arm64/promtool"   /opt/prometheus/promtool
else
  log "prometheus v${PROM_VERSION} already installed"
fi

# 2. data dir
sudo install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 750 "$DATA_DIR"

# 3. unit (rendered like vm-deploy.sh does)
log "installing $UNIT"
TMPU=$(mktemp)
sed -e "s#@@REPO_DIR@@#$REPO_DIR#g" \
    -e "s#^User=ubuntu#User=$SERVICE_USER#g" -e "s#^Group=ubuntu#Group=$SERVICE_USER#g" \
    "$REPO_DIR/deploy/systemd/$UNIT" > "$TMPU"
sudo install -m 644 -o root -g root "$TMPU" "/etc/systemd/system/$UNIT"
rm -f "$TMPU"
# config sanity before (re)start
/opt/prometheus/promtool check config "$REPO_DIR/deploy/prometheus/prometheus.yml"
sudo systemctl daemon-reload
sudo systemctl enable --now "$UNIT"
sudo systemctl restart "$UNIT"

# 4. flag in .env (additive, never duplicated) + API restart to expose /metrics
if grep -qE '^PROM_METRICS_ENABLED=' "$REPO_DIR/.env"; then
  sed -i 's/^PROM_METRICS_ENABLED=.*/PROM_METRICS_ENABLED=true/' "$REPO_DIR/.env"
else
  printf '\nPROM_METRICS_ENABLED=true\n' >> "$REPO_DIR/.env"
fi
log "PROM_METRICS_ENABLED=true — restarting API"
sudo systemctl restart heuresys-advanced-api.service

# 5. verify: API metrics endpoint live + prometheus target up
sleep 8
curl -fsS --retry 30 --retry-delay 2 --retry-connrefused -m 5 http://127.0.0.1:8013/readyz >/dev/null
curl -fsS -m 5 http://127.0.0.1:8013/metrics | head -1 | grep -q "^#" \
  && log "API /metrics live (loopback)"
for i in $(seq 1 12); do
  UP=$(curl -fsS -m 5 "http://127.0.0.1:9091/api/v1/targets" 2>/dev/null \
       | python3 -c 'import json,sys;ts=json.load(sys.stdin)["data"]["activeTargets"];print(sum(1 for t in ts if t["labels"].get("job")=="heuresys-api" and t["health"]=="up"))' 2>/dev/null || echo 0)
  [ "$UP" = "1" ] && { log "OK — prometheus target heuresys-api UP (retention 15d/2GB, 127.0.0.1:9091)"; exit 0; }
  sleep 5
done
log "FATAL: heuresys-api target not up after 60s"; exit 1
