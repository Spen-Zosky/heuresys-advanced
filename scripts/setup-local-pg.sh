#!/usr/bin/env bash
#
# scripts/setup-local-pg.sh — one-time local PostgreSQL setup for a self-hosted box
# (e.g. the linux-pc PROD twin). Creates the `heuresys` role + the project DB on the
# local PG cluster, enables md5 auth on localhost, writes ~/.pgpass. Idempotent.
#
# Reads creds from .env (POSTGRES_*). Requires passwordless sudo for the `postgres`
# user AND root (pg_hba edit + `systemctl reload postgresql`).
#
# Usage:  bash scripts/setup-local-pg.sh [path/to/.env]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
[ -f "$ENV_FILE" ] || { echo "[setup-local-pg] .env not found at $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${POSTGRES_DB:?}"; : "${POSTGRES_USER:?}"; : "${POSTGRES_PASSWORD:?}"
PORT="${POSTGRES_PORT:-5432}"

PSQL() { sudo -u postgres psql -p "$PORT" -v ON_ERROR_STOP=1 "$@"; }

# Role (create or ensure password).
if [ -z "$(PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname='$POSTGRES_USER'")" ]; then
  PSQL -c "CREATE ROLE \"$POSTGRES_USER\" LOGIN PASSWORD '$POSTGRES_PASSWORD'"
  echo "[setup-local-pg] role $POSTGRES_USER created"
else
  PSQL -c "ALTER ROLE \"$POSTGRES_USER\" LOGIN PASSWORD '$POSTGRES_PASSWORD'"
  echo "[setup-local-pg] role $POSTGRES_USER password ensured"
fi

# Database owned by the role.
if [ -z "$(PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='$POSTGRES_DB'")" ]; then
  PSQL -c "CREATE DATABASE \"$POSTGRES_DB\" OWNER \"$POSTGRES_USER\""
  echo "[setup-local-pg] db $POSTGRES_DB created"
else
  echo "[setup-local-pg] db $POSTGRES_DB already exists"
fi

# pg_hba: md5 for the role on loopback (so pg_restore/psql over TCP work via .pgpass).
HBA="$(sudo -u postgres psql -p "$PORT" -tAc 'SHOW hba_file')"
HBA_LINE="host    $POSTGRES_DB    $POSTGRES_USER    127.0.0.1/32    md5"
if ! sudo -u postgres grep -qF "$HBA_LINE" "$HBA"; then
  echo "$HBA_LINE" | sudo -u postgres tee -a "$HBA" >/dev/null
  sudo systemctl reload postgresql
  echo "[setup-local-pg] pg_hba md5 rule added + reload"
else
  echo "[setup-local-pg] pg_hba rule already present"
fi

# .pgpass (loopback) so non-interactive psql/pg_restore authenticate without prompts.
PGPASS="$HOME/.pgpass"
touch "$PGPASS"; chmod 600 "$PGPASS"
if ! grep -qE "^127\.0\.0\.1:$PORT:$POSTGRES_DB:$POSTGRES_USER:" "$PGPASS"; then
  printf '127.0.0.1:%s:%s:%s:%s\n' "$PORT" "$POSTGRES_DB" "$POSTGRES_USER" "$POSTGRES_PASSWORD" >> "$PGPASS"
fi
echo "[setup-local-pg] .pgpass ensured"

echo "OK: local PG ready — role $POSTGRES_USER, db $POSTGRES_DB on 127.0.0.1:$PORT"
