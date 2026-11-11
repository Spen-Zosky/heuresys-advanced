#!/usr/bin/env bash
# Voce 8: carica le etichette italiane PREFERRED delle professioni ESCO dal datastore (sola lettura, VM) nella colonna
# esco_occupation_mapping_esco_label_it di advanced. Idempotente (sovrascrive con lo stesso valore). Non scrive nel datastore.
# Uso: F_etichette_esco_it.sh <comando-psql-di-destinazione>   es. "psql -d rtl_persone_20261110 -X"  (la copia sul gemello)
# Il TSV viene letto dal datastore con: psql -h /var/run/postgresql -p 5435 -U ubuntu -d heuresys_datastore (utente ubuntu, VM).
set -euo pipefail
DEST="${1:?comando psql di destinazione}"
TSV="$(mktemp)"; trap 'rm -f "$TSV"' EXIT
psql -h /var/run/postgresql -p 5435 -U ubuntu -d heuresys_datastore -At -F $'\t' \
  -c "select concept_public_uri, replace(concept_label_text, E'\t', ' ') from datastore_pub.datastore_label_v1 where concept_public_uri like 'http://data.europa.eu/esco/occupation/%' and concept_label_lang='it' and concept_label_kind='PREFERRED'" > "$TSV"
{ echo "BEGIN; CREATE TEMP TABLE it(uri text, lab text) ON COMMIT DROP; COPY it FROM STDIN;"; cat "$TSV"; printf '\\.\n';
  echo "UPDATE sys.sys_esco_occupation_mappings m SET esco_occupation_mapping_esco_label_it = left(i.lab,300) FROM it i WHERE m.esco_occupation_mapping_esco_uri = i.uri AND m.esco_occupation_mapping_esco_label_it IS DISTINCT FROM left(i.lab,300);"
  echo "COMMIT; SELECT count(*) AS caricate, count(*) FILTER (WHERE esco_occupation_mapping_esco_uri LIKE 'http://data.europa.eu/esco/occupation/%') AS esco, count(esco_occupation_mapping_esco_label_it) AS con_it FROM sys.sys_esco_occupation_mappings;"; } | $DEST
