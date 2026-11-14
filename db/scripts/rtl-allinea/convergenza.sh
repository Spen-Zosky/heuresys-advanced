#!/usr/bin/env bash
# Misura la convergenza degli script dell'allineamento RTL: su un database GIA' allineato (copia usa-e-getta) ogni script,
# rieseguito, non deve cambiare nessuna riga (updated_at compreso) ne' aggiungere righe ai giornali di annullamento.
# Impronta stretta = impronta.sql SENZA l'esclusione di updated_at/updated_by. Sola scrittura sulla copia indicata.
# Uso: bash convergenza.sh "<comando psql senza -f>" <cartella-log> [script ...]   (senza script: tutti, nell'ordine di applica.sh)
# Esito: 0 se nessuno script cambia niente, 1 altrimenti (l'elenco per script e' su stdout).
set -euo pipefail
PSQL="${1:?comando psql}"; LOG="${2:?cartella log}"; shift 2; mkdir -p "$LOG"
QUI="$(cd "$(dirname "$0")" && pwd)"
STRETTA="$LOG/impronta_stretta.sql"
sed "s/ - 'updated_at' - 'updated_by'//" "$QUI/impronta.sql" > "$STRETTA"
if [ $# -gt 0 ]; then ELENCO="$*"; else
  ELENCO="$(grep -oE 'for f in [^;]+; do' "$QUI/applica.sh" | sed -E 's/^for f in //; s/; do$//')"
fi
$PSQL -X -At -f - < "$STRETTA" > "$LOG/prima.txt"
rosso=0
for f in $ELENCO; do
  $PSQL -v ON_ERROR_STOP=1 -f - < "$QUI/$f.sql" > "$LOG/$f.out" 2>&1 || { echo "$f: ERRORE (vedi $LOG/$f.out)"; exit 2; }
  $PSQL -X -At -f - < "$STRETTA" > "$LOG/dopo.txt"
  diff=$(diff "$LOG/prima.txt" "$LOG/dopo.txt" | grep -E '^>' | cut -d'|' -f1 | sed 's/^> //' | tr '\n' ' ' || true)
  if [ -n "$diff" ]; then echo "$f: CAMBIA $diff"; rosso=1; else echo "$f: converge"; fi
  mv "$LOG/dopo.txt" "$LOG/prima.txt"
done
exit $rosso
