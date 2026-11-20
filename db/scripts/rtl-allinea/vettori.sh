#!/usr/bin/env bash
# Guardia dei vettori (classe J3, 19/11/2026): uno script che cambia nome o descrizione di una competenza, di una mansione o l'etichetta ESCO
# lascia il vettore calcolato sul testo vecchio, e la migrazione 000342 (vista sys.v_embedding_impronta_non_combacia, impronta sha256 del testo) blocca il rilascio.
# Uso:
#   vettori.sh --verifica  ["<comando psql>"]   rosso (exit 1) se esiste anche un solo vettore con impronta non combaciante; elenca quanti per tabella. Sola lettura.
#   vettori.sh --ricalcola ["<comando psql>"]   lancia pnpm embeddings:backfill (salto per impronta: ricalcola solo le righe toccate), poi --verifica.
# Il comando psql di default e' quello della VM (sudo -n -u postgres psql -X -d heuresys_advanced). Per una copia: "sudo -n -u postgres psql -X -d <copia>"
# e, per il ricalcolo, POSTGRES_DB=<copia> nell'ambiente di pnpm. Mai su heuresys_ci.
set -euo pipefail
MODO="${1:?uso: vettori.sh --verifica|--ricalcola [comando psql]}"
PSQL="${2:-sudo -n -u postgres psql -X -d heuresys_advanced}"
verifica() {
  local out; out="$($PSQL -At -F ' ' -c "SELECT tabella, count(*) FROM sys.v_embedding_impronta_non_combacia GROUP BY 1 ORDER BY 1")"
  if [ -n "$out" ]; then echo "ROSSO: vettori con impronta non combaciante (tabella, righe):" >&2; echo "$out" >&2; return 1; fi
  echo "vettori ok: 0 non combaciano"
}
case "$MODO" in
  --verifica) verifica ;;
  --ricalcola)
    verifica && { echo "niente da ricalcolare"; exit 0; } || true
    ( cd "$(git rev-parse --show-toplevel)" && pnpm embeddings:backfill )
    verifica ;;
  *) echo "uso: vettori.sh --verifica|--ricalcola [comando psql]" >&2; exit 2 ;;
esac
