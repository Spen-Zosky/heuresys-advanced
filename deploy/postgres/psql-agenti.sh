#!/usr/bin/env bash
# deploy/postgres/psql-agenti.sh — B2
# psql come `heuresys_agenti` (solo righe, niente DROP/TRUNCATE/ALTER/CREATE).
# Gli agenti usano questo al posto di psql con l'utente proprietario.
# USO: bash deploy/postgres/psql-agenti.sh -c "select 1"
set -euo pipefail
FILE="$HOME/.config/claude-agenti/db-agenti.env"
[ -f "$FILE" ] || { echo "[psql-agenti] manca $FILE: esegui assegna-password-agenti.sh" >&2; exit 1; }
set -a; . "$FILE"; set +a
PGPASSWORD="$POSTGRES_AGENT_PASSWORD" exec psql -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
  -U "$POSTGRES_AGENT_USER" -d "${POSTGRES_DB:-heuresys_advanced}" -w "$@"
