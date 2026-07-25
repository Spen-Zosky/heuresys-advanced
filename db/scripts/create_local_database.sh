#!/usr/bin/env bash
# =============================================================================
# db/scripts/create_local_database.sh
# -----------------------------------------------------------------------------
# CANONICAL — Model A (localhost native PostgreSQL on Linux/macOS/Windows-Bash).
#
# Creates the PostgreSQL role, database and canonical schemas
# (sys + aux: brownfield, staging, audit). Idempotent: every object
# uses IF NOT EXISTS or a DO-block guard.
#
# For Model B (OCI VM oracle-vm-default, current per ADR-0010 RD-25) use
# `setup_oci_vm_database.sh` instead.
#
# Reads connection parameters from .env at repo root.
# Requires: psql in PATH.
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "[create_local_database] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"
: "${POSTGRES_SUPERUSER:?missing}"
: "${POSTGRES_SUPERUSER_PASSWORD:?missing — Model B users should run setup_oci_vm_database.sh instead}"

export PGPASSWORD="$POSTGRES_SUPERUSER_PASSWORD"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_SUPERUSER" -v ON_ERROR_STOP=1)

# 1. Role
echo "[create_local_database] Ensuring role '$POSTGRES_USER'..."
"${PSQL[@]}" -d postgres -c "
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}' CREATEDB;
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}' CREATEDB;
  END IF;
END
\$\$;"

# 2. Database
DB_EXISTS=$("${PSQL[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")
if [[ -z "${DB_EXISTS}" ]]; then
  echo "[create_local_database] Creating database '${POSTGRES_DB}'..."
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C.UTF-8';"
else
  echo "[create_local_database] Database '${POSTGRES_DB}' already exists, skipping CREATE."
fi

# 3. Schemas
echo "[create_local_database] Ensuring schemas sys/staging/brownfield/audit..."
"${PSQL[@]}" -d "${POSTGRES_DB}" -c "
CREATE SCHEMA IF NOT EXISTS sys        AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS staging    AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS audit      AUTHORIZATION ${POSTGRES_USER};
GRANT USAGE ON SCHEMA sys, staging, brownfield, audit TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT USAGE, SELECT ON SEQUENCES TO ${POSTGRES_USER};
"

# 4. Extensions
echo "[create_local_database] Ensuring extensions..."
"${PSQL[@]}" -d "${POSTGRES_DB}" -c "
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
"

# pg_stat_statements needs BOTH the extension (above) and the library preloaded at
# cluster level — otherwise the view exists but every read fails with SQLSTATE 55000,
# which is exactly how GET /v1/observability/slow-queries turned CI red in S1029.
# shared_preload_libraries is cluster-wide, requires a restart, and is NEVER carried
# by a dump — so it can only be checked here, not inherited from a clone.
if ! "${PSQL[@]}" -d "${POSTGRES_DB}" -tAc "SELECT 1 FROM pg_stat_statements LIMIT 1" >/dev/null 2>&1; then
  echo "[create_local_database] WARNING: pg_stat_statements is installed but NOT preloaded."
  echo "  The B7 slow-queries endpoint will degrade to an empty panel until you run, as superuser:"
  echo "    ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';   # append, do not overwrite"
  echo "    <restart postgresql>"
fi

echo ""
echo "OK: role=${POSTGRES_USER}, database=${POSTGRES_DB}, schemas=(sys, staging, brownfield, audit), extensions=(pgcrypto, uuid-ossp, pg_trgm, pg_stat_statements)"
echo "Next step: ./db/scripts/migrate.sh"
