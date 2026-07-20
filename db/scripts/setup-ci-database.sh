#!/usr/bin/env bash
# ============================================================================
# db/scripts/setup-ci-database.sh — D-08: isolated CI database.
#
# Provisions/refreshes `heuresys_ci` on the VM by cloning schema+data from the
# PROD DB `heuresys_advanced`, so CI NEVER runs its integration/E2E suites
# against production. Given D-52 (per-file transactional rollback) the CI DB does
# not drift run-to-run, so a one-time clone + periodic refresh is enough — this
# script is NOT run per CI job, but on demand (or from a scheduled timer).
#
# Runs on the VM as a user with `sudo -u postgres`. Idempotent + safe re-run:
# it drops+recreates the CI DB objects via `pg_restore --clean`.
#
# Usage:  bash db/scripts/setup-ci-database.sh   [SRC_DB=heuresys_advanced] [CI_DB=heuresys_ci]
# ============================================================================
set -euo pipefail

SRC_DB="${SRC_DB:-heuresys_advanced}"
CI_DB="${CI_DB:-heuresys_ci}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
RUNTIME_ROLE="${RUNTIME_ROLE:-heuresys}"

pg() { sudo -u postgres psql "$@"; }

echo "[setup-ci-db] target=$CI_DB  source=$SRC_DB  host=$PGHOST:$PGPORT  role=$RUNTIME_ROLE"

# Guard: never let SRC and CI be the same (would nuke PROD).
if [ "$SRC_DB" = "$CI_DB" ]; then
  echo "[setup-ci-db] FATAL: SRC_DB == CI_DB ($CI_DB) — refusing to clone onto PROD" >&2
  exit 1
fi

# 1. Ensure heuresys_ci exists (owned by the runtime role so grants are simple).
if pg -tAc "SELECT 1 FROM pg_database WHERE datname='$CI_DB'" | grep -q 1; then
  echo "[setup-ci-db] $CI_DB exists — refreshing (clean restore)"
else
  echo "[setup-ci-db] creating $CI_DB (owner=$RUNTIME_ROLE)"
  sudo -u postgres createdb -O "$RUNTIME_ROLE" "$CI_DB"
fi

# 2. Clone schema+data PROD -> CI. Read-only dump of PROD; --clean drops+recreates
#    objects in CI first, so a refresh over an existing heuresys_ci is idempotent.
echo "[setup-ci-db] cloning $SRC_DB -> $CI_DB (pg_dump -Fc | pg_restore --clean)"
sudo -u postgres pg_dump -Fc "$SRC_DB" \
  | sudo -u postgres pg_restore -d "$CI_DB" \
      --clean --if-exists --no-owner --role="$RUNTIME_ROLE"

# 3. Make sure the runtime role can use everything (belt-and-suspenders after --no-owner).
pg -d "$CI_DB" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA sys, staging, brownfield, audit TO ${RUNTIME_ROLE};
GRANT ALL ON ALL TABLES    IN SCHEMA sys, staging, brownfield, audit TO ${RUNTIME_ROLE};
GRANT ALL ON ALL SEQUENCES IN SCHEMA sys, staging, brownfield, audit TO ${RUNTIME_ROLE};
SQL

# 4. Smoke: the runtime role can read a core table.
pg -d "$CI_DB" -tAc "SELECT count(*) FROM sys.sys_users" >/dev/null \
  && echo "[setup-ci-db] OK — $CI_DB ready, isolated from PROD ($SRC_DB untouched)"
