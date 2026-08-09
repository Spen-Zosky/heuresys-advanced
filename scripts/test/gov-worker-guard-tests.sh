#!/usr/bin/env bash
# gov-worker-guard-tests.sh — recinto e diario di una sessione-lavoratore (#173 fase 2).
#
# Ogni caso gira in un finto albero temporaneo: niente tocca il repo.
#
#   bash scripts/test/gov-worker-guard-tests.sh
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GUARDIA="$REPO/scripts/hooks/gov_worker_guard.py"
PY="${ZP_PYTHON:-python}"

PASSATI=0; FALLITI=0
esito_atteso() {             # esito_atteso <exit atteso> <descrizione> <json payload> [dir]
  local atteso="$1" desc="$2" corpo="$3" dir="${4:-$ALBERO}"
  local out; out="$(printf '%s' "$corpo" | CLAUDE_PROJECT_DIR="$dir" "$PY" "$GUARDIA" recinto 2>&1)"
  local e=$?
  if [[ "$e" == "$atteso" ]]; then
    PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s\n' "$desc"
  else
    FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s  (atteso exit %s, ottenuto %s) %s\n' "$desc" "$atteso" "$e" "${out:0:70}"
  fi
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ALBERO="$TMP/albero"; mkdir -p "$ALBERO/.zp" "$ALBERO/apps/api/test" "$ALBERO/apps/web/src" "$ALBERO/docs"
NORMALE="$TMP/normale"; mkdir -p "$NORMALE/apps/api"

# I percorsi dentro il payload JSON devono avere la STESSA FORMA di quelli che
# l'hook riceve nell'ambiente. Bash converte le variabili in forma nativa quando
# lancia un eseguibile Windows, ma non tocca le stringhe dentro un JSON: con un
# percorso in forma Unix da una parte e in forma Windows dallaltra, i due finiscono
# su dischi diversi, il confronto non e calcolabile e il recinto blocca — per la
# ragione sbagliata. Nella realta Claude Code passa percorsi coerenti; qui li si
# rende coerenti a mano.
nativo() { cygpath -m "$1" 2>/dev/null || echo "$1"; }
ALBERO_N="$(nativo "$ALBERO")"
NORMALE_N="$(nativo "$NORMALE")"

echo "── il recinto ──"

# Una sessione SENZA incarico e' una sessione normale: non si tocca.
esito_atteso 0 "senza incarico non si filtra niente" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$NORMALE_N"'/apps/api/x.ts"}}' "$NORMALE"

cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-112","lavoratore":2,"perimetro":["apps/api/test","apps/api/vitest.config.ts"]}
EOF

esito_atteso 0 "dentro il perimetro si scrive" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/test/nuovo.test.ts"}}'
esito_atteso 0 "e anche sul file singolo dichiarato" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/vitest.config.ts"}}'

# IL CASO CHE HA GENERATO TUTTO: quattro file in apps/web/ con perimetro apps/api/.
esito_atteso 2 "fuori dal perimetro si viene RIFIUTATI" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/web/src/x.tsx"}}'
esito_atteso 2 "anche modificando, non solo creando" \
  '{"tool_name":"Edit","tool_input":{"file_path":"'"$ALBERO_N"'/docs/nota.md"}}'

# Confine di segmento: apps/api/testing NON e' apps/api/test.
mkdir -p "$ALBERO/apps/api/testing"
esito_atteso 2 "«apps/api/testing» non e' dentro «apps/api/test»" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/testing/x.ts"}}'

# Il lavoratore deve poter scrivere il PROPRIO stato, o non puo' dire com'e' andata.
esito_atteso 0 "il proprio stato in .zp/ resta scrivibile" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/.zp/last-outcome.json"}}'

# Leggere ed eseguire non sono filtrati: il recinto guarda le SCRITTURE.
esito_atteso 0 "leggere non e' filtrato" \
  '{"tool_name":"Read","tool_input":{"file_path":"'"$ALBERO_N"'/apps/web/src/x.tsx"}}'

# Incarico rotto: qui si BLOCCA, al contrario della modalita' lab. Un processo non
# presidiato che non sa cosa puo' toccare non scrive.
echo '{ rotto' > "$ALBERO/.zp/incarico.json"
esito_atteso 2 "incarico illeggibile: si blocca, non si lascia passare" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/test/x.ts"}}'

# Perimetro vuoto: chi non ha dichiarato dove lavora, non scrive.
echo '{"cluster":"Z-999","perimetro":[]}' > "$ALBERO/.zp/incarico.json"
esito_atteso 2 "perimetro vuoto non autorizza niente" \
  '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/test/x.ts"}}'

echo
echo "── il diario ──"

cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-112","lavoratore":2,"perimetro":["apps/api/test"]}
EOF
rm -f "$ALBERO/.zp/diario.ndjson"

annota_una() {               # annota_una <json>
  printf '%s' "$1" | CLAUDE_PROJECT_DIR="$ALBERO" "$PY" "$GUARDIA" diario >/dev/null 2>&1
}
annota_una '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/test/a.ts"}}'
annota_una '{"tool_name":"Bash","tool_input":{"command":"pnpm test && echo fatto"}}'
annota_una '{"tool_name":"Read","tool_input":{"file_path":"'"$ALBERO_N"'/README.md"}}'
printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/web/x.tsx"}}' \
  | CLAUDE_PROJECT_DIR="$ALBERO" "$PY" "$GUARDIA" recinto >/dev/null 2>&1

RIGHE=$(wc -l < "$ALBERO/.zp/diario.ndjson" 2>/dev/null || echo 0)
verifica() { if [[ "$1" == "$2" ]]; then PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s\n' "$3"
             else FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s (atteso «%s», ottenuto «%s»)\n' "$3" "$1" "$2"; fi }

verifica "4" "$RIGHE" "ogni azione lascia una riga (3 eseguite + 1 rifiutata)"
verifica "1" "$(grep -c '"azione": "rifiutata"' "$ALBERO/.zp/diario.ndjson")" "il rifiuto e' annotato, non solo negato"
verifica "1" "$(grep -c 'pnpm test' "$ALBERO/.zp/diario.ndjson")" "i comandi eseguiti si ritrovano nel diario"
if grep -q '"quando"' "$ALBERO/.zp/diario.ndjson"; then
  PASSATI=$((PASSATI+1)); echo "[PASSA   ] ogni riga porta l'orario"
else FALLITI=$((FALLITI+1)); echo "[FALLISCE] manca l'orario"; fi

# Il diario e' APPEND: una seconda azione non riscrive la prima.
annota_una '{"tool_name":"Bash","tool_input":{"command":"git status"}}'
verifica "5" "$(wc -l < "$ALBERO/.zp/diario.ndjson")" "il diario si accoda, non si riscrive"

# E una sessione normale non lo alimenta.
rm -f "$NORMALE/.zp/diario.ndjson" 2>/dev/null
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  | CLAUDE_PROJECT_DIR="$NORMALE" "$PY" "$GUARDIA" diario >/dev/null 2>&1
if [[ -f "$NORMALE/.zp/diario.ndjson" ]]; then
  FALLITI=$((FALLITI+1)); echo "[FALLISCE] una sessione senza incarico non deve scrivere un diario"
else PASSATI=$((PASSATI+1)); echo "[PASSA   ] una sessione senza incarico non lascia diario"; fi

echo
echo "$PASSATI passati, $FALLITI falliti"
[[ "$FALLITI" == "0" ]]
