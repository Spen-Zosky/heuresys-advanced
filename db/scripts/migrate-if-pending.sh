#!/usr/bin/env bash
#
# db/scripts/migrate-if-pending.sh — run migrate.sh ONLY when a migration is not yet in
# the ledger (sys.sys_schema_migrations: file_name + sha256).
#
# Rationale: the DBMS is shared (the PC reaches it via the tunnel :5433 = the VM's :5432),
# so migrations are normally already applied DURING the dev session. migrate.sh has no
# skip-logic — it re-runs every *.sql each time — so calling it unconditionally at deploy
# is pure overhead. This wrapper makes it a fast no-op and does work ONLY for a genuinely
# new/changed migration. Applies the "propagate only what changed" principle to the DB.
#
# Override: DB_MIGRATE=force (always run) | skip (never run) | auto (default — detect).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ENV_FILE="${1:-$ROOT/.env}"
MODE="${DB_MIGRATE:-auto}"

case "$MODE" in
  skip)  echo "[migrate-if-pending] DB_MIGRATE=skip — skipping"; exit 0 ;;
  force) echo "[migrate-if-pending] DB_MIGRATE=force — running migrate.sh"; exec bash "$HERE/migrate.sh" "$ENV_FILE" ;;
esac

[ -f "$ENV_FILE" ] || { echo "[migrate-if-pending] .env not found at $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
: "${POSTGRES_HOST:?}"; : "${POSTGRES_PORT:?}"; : "${POSTGRES_DB:?}"; : "${POSTGRES_USER:?}"; : "${POSTGRES_PASSWORD:?}"
export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAq)

MIG_DIR="$ROOT/db/migrations"
shopt -s nullglob; files=( "$MIG_DIR"/*.sql ); shopt -u nullglob
[ ${#files[@]} -eq 0 ] && { echo "[migrate-if-pending] no migrations to check"; exit 0; }

# Applied set "file_name:sha256" (empty if the ledger table doesn't exist yet → run full).
applied="$("${PSQL[@]}" -c "SELECT file_name || ':' || sha256 FROM sys.sys_schema_migrations" 2>/dev/null || true)"
if [ -z "$applied" ]; then
  echo "[migrate-if-pending] ledger empty/absent — running full migrate.sh"
  exec bash "$HERE/migrate.sh" "$ENV_FILE"
fi

pending=0
for f in "${files[@]}"; do
  sha="$(sha256sum "$f" | awk '{print $1}')"
  if ! grep -qxF "$(basename "$f"):$sha" <<<"$applied"; then
    pending=$((pending + 1)); echo "[migrate-if-pending] pending: $(basename "$f")"
  fi
done

if [ "$pending" -gt 0 ]; then
  echo "[migrate-if-pending] $pending pending migration(s) — running migrate.sh"
  exec bash "$HERE/migrate.sh" "$ENV_FILE"
fi
echo "[migrate-if-pending] all migrations already applied (ledger sha256 match) — skip"
