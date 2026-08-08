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

# Gli schemi ausiliari sono `staging`, `reference_sync`, `audit` — NON piu'
# `brownfield`, ritirato dalla migrazione 000297 (#164 F4). Finche' questo script
# lo nominava, il blocco dei GRANT moriva sulla prima riga con «lo schema
# "brownfield" non esiste» e il ruolo della CI restava senza permessi: il clone
# risultava completo (parity OK) e inservibile.

echo "[setup-ci-db] target=$CI_DB  source=$SRC_DB  host=$PGHOST:$PGPORT  role=$RUNTIME_ROLE"

# Guard: never let SRC and CI be the same (would nuke PROD).
if [ "$SRC_DB" = "$CI_DB" ]; then
  echo "[setup-ci-db] FATAL: SRC_DB == CI_DB ($CI_DB) — refusing to clone onto PROD" >&2
  exit 1
fi

# 1. Drop + recreate the CI DB from scratch. A VIRGIN target replaces the old
#    `--clean` refresh path, whose DROP/CREATE EXTENSION statements ran as the
#    non-superuser runtime role and failed silently — S1023 root-cause of 29
#    ignored restore errors: the `vector` extension was never created, so all
#    4 sys.*_embeddings tables were missing from the CI DB (274 vs 270 tables).
#    NOTE: --force terminates any live CI connection — do not run mid-CI-job.
echo "[setup-ci-db] dropping + recreating $CI_DB (owner=$RUNTIME_ROLE)"
sudo -u postgres dropdb --force --if-exists "$CI_DB"
sudo -u postgres createdb -O "$RUNTIME_ROLE" "$CI_DB"

# 2a. Pre-create the source DB's extensions as SUPERUSER (dynamic: whatever the
#     source has, the clone gets). The restore's own `CREATE EXTENSION IF NOT
#     EXISTS` statements then no-op with a notice instead of failing.
sudo -u postgres psql -d "$SRC_DB" -tAc "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'" \
| while IFS= read -r ext; do
  [ -n "$ext" ] || continue
  echo "[setup-ci-db] pre-creating extension: $ext"
  sudo -u postgres psql -d "$CI_DB" -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS \"$ext\" CASCADE" >/dev/null
done

# 2b. Clone schema+data PROD -> CI into the virgin DB. Restore runs as the
#     runtime role (--role), which does NOT own the pre-created extensions, so
#     `COMMENT ON EXTENSION` entries would fail — filter exactly those out of
#     the TOC (they are cosmetic; real schema/table comments are kept). Same
#     for `DEFAULT ACL` entries (`ALTER DEFAULT PRIVILEGES FOR ROLE postgres`,
#     present on the VM's PROD DB): only postgres may set them, and they only
#     affect FUTURE objects created by postgres — meaningless in a CI clone.
#     Any OTHER restore error fails the script under `set -euo pipefail` — no
#     more silently-ignored errors.
echo "[setup-ci-db] cloning $SRC_DB -> $CI_DB (pg_dump -Fc, TOC-filtered pg_restore)"
DUMP_TMP="$(mktemp /tmp/setup-ci-db.XXXXXX.dump)"
TOC_TMP="$(mktemp /tmp/setup-ci-db.XXXXXX.toc)"
trap 'rm -f "$DUMP_TMP" "$TOC_TMP"' EXIT
chmod 644 "$DUMP_TMP" "$TOC_TMP"
sudo -u postgres pg_dump -Fc "$SRC_DB" > "$DUMP_TMP"
sudo -u postgres pg_restore -l "$DUMP_TMP" | grep -vE 'COMMENT - EXTENSION|DEFAULT ACL' > "$TOC_TMP"
sudo -u postgres pg_restore -d "$CI_DB" --no-owner --role="$RUNTIME_ROLE" -L "$TOC_TMP" "$DUMP_TMP"
rm -f "$DUMP_TMP" "$TOC_TMP"

# 2c. Structural parity gate: the clone must have exactly the source's tables
#     and extensions. A mismatch is FATAL (a partial CI DB gives green-but-
#     meaningless or mysteriously-red CI).
count_tables() { pg -d "$1" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname IN ('sys','staging','reference_sync','audit')"; }
count_ext()    { pg -d "$1" -tAc "SELECT count(*) FROM pg_extension"; }
SRC_T=$(count_tables "$SRC_DB"); CI_T=$(count_tables "$CI_DB")
SRC_E=$(count_ext "$SRC_DB");    CI_E=$(count_ext "$CI_DB")
if [ "$SRC_T" != "$CI_T" ] || [ "$SRC_E" != "$CI_E" ]; then
  echo "[setup-ci-db] FATAL: parity mismatch — tables $SRC_T(src) vs $CI_T(ci), extensions $SRC_E(src) vs $CI_E(ci)" >&2
  exit 1
fi
echo "[setup-ci-db] parity OK — $CI_T tables, $CI_E extensions (source-identical)"

# 3. Make sure the runtime role can use everything (belt-and-suspenders after --no-owner).
pg -d "$CI_DB" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA sys, staging, reference_sync, audit TO ${RUNTIME_ROLE};
GRANT ALL ON ALL TABLES    IN SCHEMA sys, staging, reference_sync, audit TO ${RUNTIME_ROLE};
GRANT ALL ON ALL SEQUENCES IN SCHEMA sys, staging, reference_sync, audit TO ${RUNTIME_ROLE};
SQL

# 4. Smoke: the runtime role can read a core table.
pg -d "$CI_DB" -tAc "SELECT count(*) FROM sys.sys_users" >/dev/null \
  && echo "[setup-ci-db] OK — $CI_DB ready, isolated from PROD ($SRC_DB untouched)"
