#!/usr/bin/env bash
# Prova del caricatore dopo la 000456, su una COPIA usa-e-getta (gemello). Rosso prima, verde dopo:
#   bash db/scripts/pacchetto/prova-caricatore-000456.sh <database_sorgente_con_il_pacchetto_in_testo> <copia_prova_nuova> <pacchetto.json> <caricatore_vecchio.mjs>
# 1) il caricatore NUOVO rilegge uguale sulla copia ancora in testo;
# 2) dopo la 000456 il caricatore VECCHIO deve dare differenze (date e istanti come oggetti Date);
# 3) dopo la 000456 il caricatore NUOVO deve rileggere uguale. La copia non viene cancellata.
set -uo pipefail
SRC="${1:?sorgente}"; DB="${2:?copia}"; PK="${3:?pacchetto}"; VECCHIO="${4:?caricatore vecchio}"
[[ "$DB" =~ _prova[0-9]*$ ]] || { echo "rifiuto: $DB non finisce in _prova<N>"; exit 2; }
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PGUSER=heuresys PGHOST=localhost
[ -d "$HOME/.nvm/versions/node" ] && export PATH="$(ls -d "$HOME"/.nvm/versions/node/v22*/bin | tail -1):$PATH"
sudo -n -u postgres createdb -O heuresys -T "$SRC" "$DB" || exit 2
nuovo() { node "$AQUI/accogli-pacchetto.mjs" rileggi "$DB" "$PK" "$1" >/dev/null 2>&1; r=$?; if [ -s "$1" ]; then echo "$r"; else echo "senza-esito"; fi; }
vecchio() { node "$VECCHIO" rileggi "$DB" "$PK" "$1" >/dev/null 2>&1; r=$?; if [ -s "$1" ]; then echo "$r"; else echo "senza-esito"; fi; }
ok=0; ko=0
verifica() { if [ "$2" = "$3" ]; then echo "  OK   $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
U="$(mktemp -d)"
verifica "testo + caricatore nuovo: rilegge uguale (rc 0)" "$(nuovo "$U/a.json")" "0"
psql -h localhost -U heuresys -w -d "$DB" -q -v ON_ERROR_STOP=1 -f "$AQUI/../../migrations/000456_pacchetto_date_e_istante_tipizzati.sql" >/dev/null 2>&1 || { echo "migrazione fallita"; exit 3; }
verifica "tipizzato + caricatore VECCHIO: differenze (rc 1)" "$(vecchio "$U/b.json")" "1"
verifica "tipizzato + caricatore NUOVO: rilegge uguale (rc 0)" "$(nuovo "$U/c.json")" "0"
for f in a b c; do echo "  $f: $(grep -o '"percorsi_con_differenze": *[0-9]*' "$U/$f.json" | head -1)"; done
echo "[prova-caricatore-000456] ok=$ok rossi=$ko copia=$DB esiti in $U"
[ "$ko" -eq 0 ]
