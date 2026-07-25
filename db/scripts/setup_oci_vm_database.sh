#!/usr/bin/env bash
# =============================================================================
# db/scripts/setup_oci_vm_database.sh
# -----------------------------------------------------------------------------
# MODEL B (OCI VM oracle-vm-default) — one-shot DB bootstrap via SSH.
#
# Used when PostgreSQL runs on the OCI VM with peer auth for `postgres`
# superuser (current setup per ADR-0010 RD-25). This script connects via
# SSH to `oracle-vm-default` and runs `sudo -u postgres psql` on the VM
# to:
#   1. ensure role `heuresys` exists with the .env password (idempotent)
#   2. create database `heuresys_advanced` owned by `heuresys`
#      (side-by-side with the existing `heuresys_platform` legacy DB)
#   3. create canonical schemas (sys, staging, brownfield, audit)
#   4. enable extensions (pgcrypto, uuid-ossp, pg_trgm)
#
# After this script, subsequent `migrate.sh` / `migrate.ps1` and
# `validate_database.sh` / `.ps1` operate via the SSH tunnel as the
# `heuresys` role (no superuser needed).
#
# Idempotent — safe to re-run.
#
# Prerequisites:
#   - SSH host alias `oracle-vm-default` configured (~/.ssh/config)
#   - sudo NOPASSWD or sudoers preconfigured for the SSH user
#   - PostgreSQL 16 cluster running on the VM (verified once at 2026-05-16)
#
# Reads .env at repo root for POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD.
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
[[ -f "$ENV_FILE" ]] || { echo "[setup_oci_vm_database] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"

SSH_HOST="${OCI_SSH_HOST:-oracle-vm-default}"

echo "[setup_oci_vm_database] Bootstrapping ${POSTGRES_DB} on ${SSH_HOST} (role=${POSTGRES_USER})..."

# Build the SQL payload — escape single quotes in password
ESCAPED_PWD="${POSTGRES_PASSWORD//\'/\'\'}"

# Step 1+2: role + DB. CREATE DATABASE cannot run inside DO block, so split.
ssh -o ConnectTimeout=10 "${SSH_HOST}" "sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c \"
DO \\\$\\\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}') THEN
    CREATE ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${ESCAPED_PWD}' CREATEDB;
  ELSE
    ALTER ROLE ${POSTGRES_USER} WITH LOGIN PASSWORD '${ESCAPED_PWD}';
  END IF;
END
\\\$\\\$;
\""

DB_EXISTS=$(ssh "${SSH_HOST}" "sudo -n -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\"" || true)
if [[ -z "${DB_EXISTS}" ]]; then
  echo "[setup_oci_vm_database] Creating database '${POSTGRES_DB}'..."
  ssh "${SSH_HOST}" "sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c \"CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER} ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C.UTF-8'\""
else
  echo "[setup_oci_vm_database] Database '${POSTGRES_DB}' already exists, skipping CREATE."
fi

# Step 3: schemas (need to run inside the new database, still as postgres for AUTHORIZATION)
echo "[setup_oci_vm_database] Ensuring schemas sys/staging/brownfield/audit..."
ssh "${SSH_HOST}" "sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d ${POSTGRES_DB} -c \"
CREATE SCHEMA IF NOT EXISTS sys        AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS staging    AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS brownfield AUTHORIZATION ${POSTGRES_USER};
CREATE SCHEMA IF NOT EXISTS audit      AUTHORIZATION ${POSTGRES_USER};
GRANT USAGE ON SCHEMA sys, staging, brownfield, audit TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, staging, brownfield, audit
  GRANT USAGE, SELECT ON SEQUENCES TO ${POSTGRES_USER};
\""

# Step 4: extensions (run as postgres — heuresys may not have CREATE EXTENSION privilege)
echo "[setup_oci_vm_database] Ensuring extensions..."
ssh "${SSH_HOST}" "sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d ${POSTGRES_DB} -c \"
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS \\\"uuid-ossp\\\";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
\""

# Step 4b: pg_stat_statements also needs the library preloaded at CLUSTER level.
# Idempotent and APPENDING: overwriting shared_preload_libraries would silently
# unload anything else already preloaded. Restart only when the value changed.
echo "[setup_oci_vm_database] Ensuring pg_stat_statements is preloaded (cluster-level)..."
ssh "${SSH_HOST}" "
  cur=\$(sudo -n -u postgres psql -tAc \"SHOW shared_preload_libraries\" | tr -d ' ')
  case \",\$cur,\" in
    *,pg_stat_statements,*) echo '  already preloaded: '\"\$cur\" ;;
    *) sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c \"ALTER SYSTEM SET shared_preload_libraries = '\${cur:+\$cur,}pg_stat_statements'\" &&
       sudo -n systemctl restart postgresql &&
       sleep 4 &&
       echo '  preloaded now: '\"\$(sudo -n -u postgres psql -tAc 'SHOW shared_preload_libraries')\" ;;
  esac
"

echo ""
echo "OK: VM=${SSH_HOST}, role=${POSTGRES_USER}, database=${POSTGRES_DB}, schemas=(sys, staging, brownfield, audit), extensions=(pgcrypto, uuid-ossp, pg_trgm, pg_stat_statements)"
echo ""
echo "Next steps from your local machine:"
echo "  1. Open SSH tunnel:  ssh -L 5433:localhost:5432 ${SSH_HOST}"
echo "  2. Apply migrations: ./db/scripts/migrate.sh   (or migrate.ps1 on Windows)"
echo "  3. Validate:         ./db/scripts/validate_database.sh"
