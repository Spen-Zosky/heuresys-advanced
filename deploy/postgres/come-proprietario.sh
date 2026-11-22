#!/usr/bin/env bash
# deploy/postgres/come-proprietario.sh — B2, tappa 3 (2026-11-21)
#
# Esegue un comando con l'ambiente del proprietario `heuresys`: carica il file
# d'ambiente del repo e poi la password da ~/.config/heuresys-proprietario/db.env
# (deploy/postgres/env-proprietario.sh). Serve a seed e provisioning che fanno
# DDL legittimo, dopo che la password e' uscita dall'ambiente degli agenti.
#
# USO: bash deploy/postgres/come-proprietario.sh pnpm tsx db/scripts/seed-test-admin.ts
set -euo pipefail
[ $# -gt 0 ] || { echo "uso: $0 <comando> [argomenti]" >&2; exit 2; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
# shellcheck disable=SC1091
. "$ROOT/deploy/postgres/env-proprietario.sh"
exec "$@"
