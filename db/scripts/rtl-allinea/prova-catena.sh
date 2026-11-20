#!/usr/bin/env bash
# Chiusura di ogni J di testi (20/11/2026): dopo aver applicato lo script alla COPIA di prova, la catena delle migrazioni deve riapplicarsi (migrate.sh exit 0).
# Perche': la catena si riapplica a ogni deploy; un testo tradotto che una migrazione legge (caso «Company-wide» della 000357) la fa uscire rossa e blocca il rilascio.
# Uso: bash prova-catena.sh <file .env della copia di prova>     (per il banco: ~/prove-heuresys-advanced/<nome>/.env, dopo `banco-verifica.sh su <nome>`)
# Rifiuta heuresys_advanced, heuresys_ci e qualunque database che non sia di prova (nome con «banco» o «prova»).
set -euo pipefail
ENV="${1:?uso: prova-catena.sh <file .env della copia di prova>}"
[ -f "$ENV" ] || { echo "manca $ENV" >&2; exit 2; }
DB="$(grep -E '^POSTGRES_DB=' "$ENV" | tail -1 | cut -d= -f2 | tr -d '"')"
case "$DB" in *banco*|*prova*) ;; *) echo "RIFIUTO: $DB non e' un database di prova" >&2; exit 3 ;; esac
QUI="$(cd "$(dirname "$0")" && pwd)"
RADICE="$(cd "$QUI/../../.." && pwd)"
bash "$RADICE/db/scripts/migrate.sh" "$ENV" > "${TMPDIR:-/tmp}/prova-catena.$$.log" 2>&1 && { echo "catena ok su $DB (migrate.sh exit 0)"; rm -f "${TMPDIR:-/tmp}/prova-catena.$$.log"; } \
  || { echo "ROSSO: la catena delle migrazioni non si riapplica su $DB; ultime righe:" >&2; tail -8 "${TMPDIR:-/tmp}/prova-catena.$$.log" >&2; exit 1; }
