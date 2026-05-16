#!/usr/bin/env bash
# =============================================================================
# db/scripts/reset_local_database.sh
# -----------------------------------------------------------------------------
# DEV-ONLY destructive helper for Model A (localhost).
# Drops POSTGRES_DB and recreates it empty.
# =============================================================================
set -euo pipefail

ENV_FILE=""
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force|-f) FORCE=1 ;;
    *) ENV_FILE="$arg" ;;
  esac
done
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "[reset] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_SUPERUSER:?missing}"
: "${POSTGRES_SUPERUSER_PASSWORD:?missing — for Model B (OCI VM) drop manually via SSH}"

echo "WARNING: this will DROP database '${POSTGRES_DB}' on ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo "         and recreate it empty. All data in that database will be LOST."

if [[ $FORCE -ne 1 ]]; then
  read -r -p "Type 'yes' to continue: " reply
  [[ "$reply" == "yes" ]] || { echo "Aborted."; exit 0; }
fi

export PGPASSWORD="${POSTGRES_SUPERUSER_PASSWORD}"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_SUPERUSER" -v ON_ERROR_STOP=1)

echo "[reset] Terminating active connections..."
"${PSQL[@]}" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();"

echo "[reset] Dropping database '${POSTGRES_DB}'..."
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"

echo "[reset] Re-creating database empty..."
bash "$(dirname "$0")/create_local_database.sh" "$ENV_FILE"

echo ""
echo "OK: database '${POSTGRES_DB}' reset. Run migrate.sh to re-apply migrations."
