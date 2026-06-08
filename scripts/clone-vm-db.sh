#!/usr/bin/env bash
#
# scripts/clone-vm-db.sh — refresh a local PostgreSQL DB with a full clone of the VM's
# real `heuresys_advanced`. Streams pg_dump (VM, custom format) -> pg_restore (local) over
# SSH. Idempotent full refresh (`--clean --if-exists` drops+recreates objects, so the local
# DB matches the VM's CURRENT state). Re-runnable on demand.
#
# Runs on a self-hosted box that has: a local DB (created by setup-local-pg.sh), `.pgpass`
# for the loopback role, and SSH to the VM (alias `oracle-vm-default`). The VM's
# `sudo -u postgres pg_dump` is passwordless there.
#
# Usage:  bash scripts/clone-vm-db.sh
# Overridable env: VM_HOST  DB_NAME  POSTGRES_PORT  POSTGRES_USER  (else read from .env)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }

VM_HOST="${VM_HOST:-oracle-vm-default}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-heuresys_advanced}}"
PORT="${POSTGRES_PORT:-5432}"
DBUSER="${POSTGRES_USER:-heuresys}"

echo "[clone-vm-db] $VM_HOST:$DB_NAME  ->  local 127.0.0.1:$PORT/$DB_NAME  (drop+recreate objects)"
echo "[clone-vm-db] streaming pg_dump | pg_restore ..."
set +e
ssh -o BatchMode=yes "$VM_HOST" "sudo -u postgres pg_dump -Fc '$DB_NAME'" \
  | pg_restore --clean --if-exists --no-owner --no-acl --role="$DBUSER" \
      -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME"
rc=${PIPESTATUS[1]}
set -e
# pg_restore exits non-zero on benign "already exists / does not exist" notices on first run;
# treat a populated DB as success and surface a real failure otherwise.
[ "$rc" -ne 0 ] && echo "[clone-vm-db] pg_restore exit=$rc (benign notices possible on first run — verifying below)"

echo "[clone-vm-db] sanity row-counts (local vs VM):"
for t in sys.sys_users sys.sys_positions sys.sys_attendance; do
  loc="$(psql -h 127.0.0.1 -p "$PORT" -U "$DBUSER" -d "$DB_NAME" -tAc "SELECT count(*) FROM $t" 2>/dev/null || echo '?')"
  vm="$(ssh -o BatchMode=yes "$VM_HOST" "sudo -u postgres psql -d '$DB_NAME' -tAc \"SELECT count(*) FROM $t\"" 2>/dev/null || echo '?')"
  printf '  %-26s local=%-7s vm=%-7s %s\n' "$t" "$loc" "$vm" "$([ "$loc" = "$vm" ] && echo OK || echo DIFF)"
done
echo "[clone-vm-db] done"
