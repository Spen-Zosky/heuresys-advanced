#!/usr/bin/env bash
# =============================================================================
# db/scripts/migrate.sh
# -----------------------------------------------------------------------------
# Applies db/migrations/*.sql in lexical order; idempotent audit upsert.
# Works for Model A (localhost) and Model B (OCI VM via tunnel).
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
MIG_DIR="$(cd "$(dirname "$0")/../migrations" && pwd 2>/dev/null || echo "$(dirname "$0")/../migrations")"
[[ -f "$ENV_FILE" ]] || { echo "[migrate] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

if [[ ! -d "$MIG_DIR" ]]; then
  echo "[migrate] No migrations directory at $MIG_DIR (yet). Nothing to apply."
  exit 0
fi

shopt -s nullglob
files=( "$MIG_DIR"/*.sql )
shopt -u nullglob
if [[ ${#files[@]} -eq 0 ]]; then
  echo "[migrate] db/migrations/ is empty. Nothing to apply."
  exit 0
fi

applied=0
for f in "${files[@]}"; do
  fname=$(basename "$f")
  sha=$(sha256sum "$f" | awk '{print $1}')
  echo "[migrate] applying $fname (sha256=${sha:0:12})"
  start_ms=$(date +%s%3N)
  "${PSQL[@]}" -1 -f "$f"
  end_ms=$(date +%s%3N)
  duration=$((end_ms - start_ms))

  "${PSQL[@]}" -c "
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='sys' AND table_name='sys_schema_migrations') THEN
    INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_at, applied_by, duration_ms)
    VALUES ('${fname}', '${sha}', now(), current_user, ${duration})
    ON CONFLICT (file_name) DO UPDATE
       SET sha256      = EXCLUDED.sha256,
           applied_at  = EXCLUDED.applied_at,
           applied_by  = EXCLUDED.applied_by,
           duration_ms = EXCLUDED.duration_ms;
  END IF;
END
\$\$;"
  applied=$((applied + 1))
done

echo ""
echo "OK: $applied migrations applied."
