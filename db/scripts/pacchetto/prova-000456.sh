#!/usr/bin/env bash
# Prova della 000456 (date e istante del pacchetto tipizzati) su una COPIA usa-e-getta. Gira sul gemello.
#   bash db/scripts/pacchetto/prova-000456.sh <database_sorgente_con_il_pacchetto> <copia_prova_nuova>
# La copia deve finire in _prova<N>, non esistere, e NON viene cancellata (la elenca chi la lancia).
# Esiti attesi: andata, idempotenza, ritorno esatto, guardia che rifiuta un valore sporco, caricatore che rilegge uguale.
set -euo pipefail
SRC="${1:?database sorgente}"; DB="${2:?copia di prova}"
[[ "$DB" =~ _prova[0-9]*$ ]] || { echo "rifiuto: $DB non finisce in _prova<N>"; exit 2; }
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$AQUI/../../migrations/000456_pacchetto_date_e_istante_tipizzati.sql"
INV="$AQUI/inversa-000456.sql"
P="psql -h localhost -U heuresys -w -v ON_ERROR_STOP=1 -X -q"
ok=0; ko=0
verifica() { if [ -z "$2" ] || [ -z "$3" ]; then echo "  ROSSO $1: misura vuota (una prova che non misura non e' verde)"; ko=$((ko+1)); elif [ "$2" = "$3" ]; then echo "  OK   $1"; ok=$((ok+1)); else echo "  ROSSO $1: atteso [$3] letto [$2]"; ko=$((ko+1)); fi; }
tipi() { $P -d "$DB" -Atc "select string_agg(data_type, ',' order by column_name) from information_schema.columns where table_schema='sys' and column_name in ('blueprint_content_package_source_created_at','blueprint_content_ccnl_effective','blueprint_content_ccnl_institute_valid_from')"; }
valori() { $P -d "$DB" -Atc "select coalesce((select string_agg(blueprint_content_package_source_created_at::text, '|') from sys.sys_blueprint_content_packages),'') || '#' || coalesce((select string_agg(blueprint_content_ccnl_effective::text, '|' order by blueprint_content_ccnl_code) from sys.sys_blueprint_content_ccnl),'') || '#' || coalesce((select string_agg(blueprint_content_ccnl_institute_valid_from::text, '|' order by blueprint_content_ccnl_institute_ccnl_code, blueprint_content_ccnl_institute_ordinal) from sys.sys_blueprint_content_ccnl_institutes),'')"; }

conta() { $P -d "$1" -Atc "select (select count(blueprint_content_ccnl_effective) from sys.sys_blueprint_content_ccnl)||'/'||(select count(blueprint_content_ccnl_institute_valid_from) from sys.sys_blueprint_content_ccnl_institutes)||'/'||(select count(blueprint_content_package_source_created_at) from sys.sys_blueprint_content_packages)"; }
sudo -n -u postgres createdb -O heuresys -T "$SRC" "$DB"
echo "[prova-000456] copia $DB da $SRC"
T0="$(tipi)"; V0="$(valori)"
verifica "prima: le tre colonne sono testo" "$T0" "text,character varying,character varying"
$P -d "$DB" -f "$MIG" 2>&1 | sed 's/^/    /'
verifica "andata: date, date, timestamptz" "$(tipi)" "date,date,timestamp with time zone"
verifica "andata: righe e valori non nulli intatti" "$(conta "$DB")" "$(conta "$SRC")"
$P -d "$DB" -f "$MIG" 2>&1 | sed 's/^/    /'
verifica "idempotenza: la seconda passata non cambia i tipi" "$(tipi)" "date,date,timestamp with time zone"
$P -d "$DB" -f "$INV" 2>&1 | sed 's/^/    /'
verifica "ritorno: di nuovo testo" "$(tipi)" "$T0"
verifica "ritorno: stessi valori, carattere per carattere" "$(valori)" "$V0"
$P -d "$DB" -f "$MIG" >/dev/null 2>&1
# rosso: un valore che non e' una data non deve passare
$P -d "$DB" -f "$INV" >/dev/null 2>&1
$P -d "$DB" -c "UPDATE sys.sys_blueprint_content_ccnl SET blueprint_content_ccnl_effective='ieri' WHERE blueprint_content_ccnl_code=(select min(blueprint_content_ccnl_code) from sys.sys_blueprint_content_ccnl)"
if $P -d "$DB" -f "$MIG" >/dev/null 2>&1; then verifica "guardia: rifiuta un valore sporco" "ha convertito" "ha rifiutato"; else verifica "guardia: rifiuta un valore sporco" "ha rifiutato" "ha rifiutato"; fi
verifica "guardia: dopo il rifiuto la colonna e' ancora testo" "$($P -d "$DB" -Atc "select data_type from information_schema.columns where column_name='blueprint_content_ccnl_effective'")" "text"
echo "[prova-000456] ok=$ok rossi=$ko copia=$DB"
[ "$ko" -eq 0 ]
