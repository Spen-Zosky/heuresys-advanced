#!/usr/bin/env bash
#
# scripts/provision-linux-pc.sh — provision the `linux-pc` (192.168.1.11, Zorin/Ubuntu
# x86_64, user enzo) as an AUTONOMOUS PROD TWIN of the OCI VM: local PostgreSQL runtime
# (full clone of the VM's real DB), prod build, systemd services, LAN-accessible.
#
# ISOLATED / on-demand: this is NOT wired into align-clones provisioning. Run it explicitly.
# Orchestrated from the local PC (Git Bash). Idempotent. Captures the exact working
# sequence (incl. the deps discovered on first run: pgvector, libpq-dev).
#
# PREREQUISITE (one-time, manual — needs the enzo password on linux-pc):
#   sudo tee /etc/sudoers.d/heuresys-provision  with:
#     enzo ALL=(postgres) NOPASSWD: ALL
#     enzo ALL=(root) NOPASSWD: /usr/bin/systemctl, /usr/bin/install, /usr/bin/apt-get, /usr/bin/apt, /usr/bin/loginctl
#
# The Claude-ecosystem overwrite (~/.claude from Windows) is a SEPARATE concern — see
# the handoff notes / reference_linux_pc_prod_twin memory; not done here.
#
# Usage:  MSYS_NO_PATHCONV=1 bash scripts/provision-linux-pc.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1

HOST="${HOST:-linux-pc}"
REPO="${REPO:-/home/enzo/heuresys-advanced}"
LAN_HOST="${LAN_HOST:-192.168.1.11}"
API_PORT="${API_PORT:-8013}"
WEB_PORT="${WEB_PORT:-3013}"
GIT_URL="${GIT_URL:-https://github.com/Spen-Zosky/heuresys-advanced.git}"
LOCAL_ROOT="$(git rev-parse --show-toplevel)"

log() { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }

log "[1.1] SSH alias to the VM (for the DB clone) + repo clone/pull"
ssh -o BatchMode=yes "$HOST" "
  grep -q 'Host oracle-vm-default' ~/.ssh/config 2>/dev/null || printf '\nHost oracle-vm-default\n    HostName 80.225.82.207\n    User ubuntu\n    IdentityFile ~/.ssh/oci_recovery_ed25519\n    StrictHostKeyChecking accept-new\n' >> ~/.ssh/config
  chmod 600 ~/.ssh/config
  if [ -d '$REPO/.git' ]; then git -C '$REPO' fetch origin --quiet && git -C '$REPO' reset --hard origin/main && git -C '$REPO' clean -fd;
  else git clone --quiet '$GIT_URL' '$REPO'; fi
  git -C '$REPO' rev-parse --short HEAD
"

log "[1.2] secrets + PROD-local .env"
tar -C "$LOCAL_ROOT" -czf - .secrets | ssh -o BatchMode=yes "$HOST" "tar -C '$REPO' -xzf -"
cat "$LOCAL_ROOT/.env" | ssh -o BatchMode=yes "$HOST" "cat > '$REPO/.env'"
ssh -o BatchMode=yes "$HOST" "cd '$REPO'
  for kv in POSTGRES_HOST=localhost POSTGRES_PORT=5432 NODE_ENV=production HOST=0.0.0.0 PORT=$API_PORT PUBLIC_HOST=$LAN_HOST COOKIE_SECURE=false TRUST_PROXY=false ADMIN_ORIGIN=http://$LAN_HOST:$WEB_PORT; do
    k=\${kv%%=*}; if grep -qE \"^\${k}=\" .env; then sed -i \"s|^\${k}=.*|\${kv}|\" .env; else printf '%s\n' \"\$kv\" >> .env; fi
  done"

log "[1.4/1.5] local PG setup + clone the VM DB (+ deps: pgvector, libpq-dev, build-essential)"
ssh -o BatchMode=yes "$HOST" "
  sudo apt-get install -y postgresql-16-pgvector build-essential libpq-dev python3 >/dev/null 2>&1 || true
  cd '$REPO' && bash scripts/setup-local-pg.sh && bash scripts/clone-vm-db.sh
"

log "[2.1] build x86_64 (pnpm install + shared/api/web prod, NEXT_PUBLIC -> LAN)"
ssh -o BatchMode=yes "$HOST" "cd '$REPO'
  export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm use 22 >/dev/null; corepack enable 2>/dev/null || true
  pnpm install --frozen-lockfile
  rm -rf packages/shared/dist packages/shared/tsconfig.tsbuildinfo && pnpm --filter @heuresys/shared build
  pnpm --filter @heuresys/api build
  NODE_ENV=production NEXT_PUBLIC_API_PROXY_BASE_URL=http://localhost:$API_PORT NEXT_PUBLIC_API_BASE_URL=http://$LAN_HOST:$API_PORT/v1 pnpm --filter @heuresys/web build
"

log "[2.2] systemd units (User=enzo, LAN host) + start"
ssh -o BatchMode=yes "$HOST" "cd '$REPO'
  export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; nvm use 22 >/dev/null
  NODE_BIN=\"\$(dirname \"\$(nvm which 22)\")\"; tmp=\$(mktemp -d)
  for svc in api web scraping insights; do
    sed -e \"s#@@REPO_DIR@@#$REPO#g\" -e \"s#@@NODE_BIN@@#\$NODE_BIN#g\" \
        -e \"s#@@PUBLIC_HOST@@#$LAN_HOST#g\" -e \"s#@@API_PORT@@#$API_PORT#g\" -e \"s#@@WEB_PORT@@#$WEB_PORT#g\" \
        -e 's#User=ubuntu#User=enzo#g' -e 's#Group=ubuntu#Group=enzo#g' \
        \"$REPO/deploy/systemd/heuresys-advanced-\$svc.service\" > \"\$tmp/\$svc.service\"
    sudo install -m 644 -o root -g root \"\$tmp/\$svc.service\" \"/etc/systemd/system/heuresys-advanced-\$svc.service\"
    [ -f \"$REPO/deploy/systemd/heuresys-advanced-\$svc.timer\" ] && sudo install -m 644 -o root -g root \"$REPO/deploy/systemd/heuresys-advanced-\$svc.timer\" \"/etc/systemd/system/heuresys-advanced-\$svc.timer\"
  done
  rm -rf \"\$tmp\"; sudo systemctl daemon-reload
  sudo systemctl enable --now heuresys-advanced-api.service >/dev/null 2>&1; sleep 6
  sudo systemctl enable --now heuresys-advanced-web.service >/dev/null 2>&1; sleep 7
  sudo systemctl enable --now heuresys-advanced-scraping.timer heuresys-advanced-insights.timer >/dev/null 2>&1
  systemctl is-active heuresys-advanced-api heuresys-advanced-web heuresys-advanced-scraping.timer heuresys-advanced-insights.timer
"

log "[2.2b] pg_stat_statements preloaded a livello di CLUSTER (prerequisito CI)"
# `shared_preload_libraries` è cluster-level, richiede un restart e NON viaggia in
# nessun dump: clonare il DB dalla VM porta l'extension ma non il preload. Senza di
# esso la view esiste e ogni lettura fallisce con SQLSTATE 55000 — è così che la CI
# è diventata rossa in S1029 (GET /v1/observability/slow-queries → 500). Qui è reso
# idempotente e APPENDING: sovrascrivere il parametro scaricherebbe in silenzio
# eventuali altre librerie preloadate.
ssh -o BatchMode=yes "$HOST" "
  cur=\$(sudo -n -u postgres psql -tAc 'SHOW shared_preload_libraries' | tr -d ' ')
  case \",\$cur,\" in
    *,pg_stat_statements,*) echo '  già preloaded: '\"\$cur\" ;;
    *) sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c \"ALTER SYSTEM SET shared_preload_libraries = '\${cur:+\$cur,}pg_stat_statements'\" &&
       sudo -n systemctl restart postgresql && sleep 4 &&
       echo '  preloaded ora: '\"\$(sudo -n -u postgres psql -tAc 'SHOW shared_preload_libraries')\" ;;
  esac
  # l'extension va creata in OGNI database usato: PROD gemello + database della CI
  for db in heuresys_advanced heuresys_ci; do
    sudo -n -u postgres psql -d \"\$db\" -c 'CREATE EXTENSION IF NOT EXISTS pg_stat_statements' >/dev/null 2>&1 \
      && echo \"  extension ok su \$db\" || echo \"  (db \$db assente — salto)\"
  done
"

log "[2.3] archivio off-host dei backup PROD (W0.2) — unit fuori da deploy/systemd/"
# I dump prodotti da backup-db.sh vivono sullo STESSO disco del DB che proteggono: la
# perdita del volume porta via DB e backup insieme. linux-pc è l'unico host di archivio
# disponibile (LAN, dietro NAT), quindi la copia va in PULL: è lui a scaricare, e la VM
# non riceve alcuna credenziale verso di lui. Gli unit stanno in deploy/systemd/solo-linux-pc/
# perché vm-deploy.sh abiliterebbe qualunque timer trovato in deploy/systemd/ ANCHE sulla
# VM, dove questo one-shot non ha senso.
ssh -o BatchMode=yes "$HOST" "cd '$REPO'
  tmp=\$(mktemp -d)
  sed -e \"s#@@REPO_DIR@@#$REPO#g\" -e 's#^User=ubuntu#User=enzo#g' -e 's#^Group=ubuntu#Group=enzo#g' \
      \"$REPO/deploy/systemd/solo-linux-pc/heuresys-backup-pull.service\" > \"\$tmp/heuresys-backup-pull.service\"
  sudo install -m 644 -o root -g root \"\$tmp/heuresys-backup-pull.service\" /etc/systemd/system/heuresys-backup-pull.service
  sudo install -m 644 -o root -g root \"$REPO/deploy/systemd/solo-linux-pc/heuresys-backup-pull.timer\" /etc/systemd/system/heuresys-backup-pull.timer
  rm -rf \"\$tmp\"
  sudo systemctl daemon-reload
  sudo systemctl enable --now heuresys-backup-pull.timer >/dev/null 2>&1
  systemctl is-active heuresys-backup-pull.timer
"

log "[2.4] refresh schedulato del DB clone (Z-022) — unit fuori da deploy/systemd/"
# Il clone del DB della VM era solo on-demand: fra due lanci manuali il gemello e i suoi
# 3 gate CI giravano contro dati via via più vecchi della produzione, senza che la
# divergenza fosse visibile. Timer settimanale (domenica 05:00, Persistent). Gli unit
# stanno in deploy/systemd/solo-linux-pc/ per la stessa ragione del backup-pull: su la VM
# vm-deploy.sh li abiliterebbe, e lì un clone-da-sé-stesso sarebbe distruttivo.
ssh -o BatchMode=yes "$HOST" "cd '$REPO'
  tmp=\$(mktemp -d)
  sed -e \"s#@@REPO_DIR@@#$REPO#g\" -e 's#^User=ubuntu#User=enzo#g' -e 's#^Group=ubuntu#Group=enzo#g' \
      \"$REPO/deploy/systemd/solo-linux-pc/heuresys-advanced-clonedb.service\" > \"\$tmp/heuresys-advanced-clonedb.service\"
  sudo install -m 644 -o root -g root \"\$tmp/heuresys-advanced-clonedb.service\" /etc/systemd/system/heuresys-advanced-clonedb.service
  sudo install -m 644 -o root -g root \"$REPO/deploy/systemd/solo-linux-pc/heuresys-advanced-clonedb.timer\" /etc/systemd/system/heuresys-advanced-clonedb.timer
  rm -rf \"\$tmp\"
  sudo systemctl daemon-reload
  sudo systemctl enable --now heuresys-advanced-clonedb.timer >/dev/null 2>&1
  systemctl is-active heuresys-advanced-clonedb.timer
"

log "[verify] autonomous PROD on the LAN"
echo -n "  api /readyz: "; curl -s -o /dev/null -w '%{http_code}\n' -m 10 "http://$LAN_HOST:$API_PORT/readyz" || echo ERR
echo -n "  web /login:  "; curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' -m 20 "http://$LAN_HOST:$WEB_PORT/login" || echo ERR
log "provisioning complete — linux-pc autonomous PROD twin @ http://$LAN_HOST:$WEB_PORT"
