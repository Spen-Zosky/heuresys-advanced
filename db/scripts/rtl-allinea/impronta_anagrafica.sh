#!/usr/bin/env bash
# Impronta MD5 delle 25 tabelle di anagrafica e utenze (ANAGRAFICA.txt). Sola lettura. Uso: bash impronta_anagrafica.sh "<comando psql>"
set -euo pipefail
QUI="$(cd "$(dirname "$0")" && pwd)"; PSQL="${1:?comando psql}"
while read -r t; do
  [ -z "$t" ] && continue
  h=$($PSQL -At -c "SELECT count(*) || '|' || md5(coalesce(string_agg(x::text, ',' ORDER BY x::text), '')) FROM $t x")
  echo "$t|$h"
done < "$QUI/ANAGRAFICA.txt"
