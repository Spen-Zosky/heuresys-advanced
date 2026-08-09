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

echo
echo "── i divieti assoluti (regola di Enzo, 2026-08-09) ──"
#
# «un worker committa nel suo ramo ma non ha facolta di trasferire su main e di fare
# operazioni sul repo github. Tutte le attivita di controllo finale e di effettiva
# chiusura sono responsabilita della sessione gov.»

cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-112","perimetro":["apps/api/test"]}
EOF

cmd_atteso() {               # cmd_atteso <exit atteso> <comando> <descrizione>
  local atteso="$1" comando="$2" desc="$3"
  local corpo; corpo="$("$PY" -c "import json,sys;print(json.dumps({'tool_name':'Bash','tool_input':{'command':sys.argv[1]}}))" "$comando")"
  printf '%s' "$corpo" | (cd "$ALBERO" && CLAUDE_PROJECT_DIR="$ALBERO" "$PY" "$GUARDIA" recinto >/dev/null 2>&1)
  local e=$?
  if [[ "$e" == "$atteso" ]]; then PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s
' "$desc"
  else FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s  (atteso %s, ottenuto %s) :: %s
' "$desc" "$atteso" "$e" "$comando"; fi
}

# --- non pubblica, non tocca main, non agisce su GitHub
cmd_atteso 2 "git push" "non pubblica"
cmd_atteso 2 "git push origin gov/w1:main" "non pubblica NEMMENO il proprio ramo su main"
cmd_atteso 2 "git push --force origin main" "tanto meno con la forza"
cmd_atteso 2 "gh pr merge 60 --squash" "non fa merge su GitHub"
cmd_atteso 2 "gh pr create --title x --body y" "non apre PR"
cmd_atteso 2 "git checkout main" "non passa su main"
cmd_atteso 2 "git merge main" "non fonde main"
cmd_atteso 2 "git branch -D gov/w1" "non cancella rami"

# --- non distrugge
cmd_atteso 2 "git reset --hard HEAD~3" "non riscrive la storia con la forza"
cmd_atteso 2 "git checkout -- ." "non butta via tutte le modifiche"
cmd_atteso 2 "git clean -fdx" "non ripulisce i non tracciati (ci sono i segreti)"
cmd_atteso 2 "rm -rf apps" "niente rm -rf"

# --- non tocca produzione e servizi
cmd_atteso 2 "pnpm db:reset" "non azzera il database"
cmd_atteso 2 "psql -c 'DROP TABLE sys.sys_users'" "non fa DROP"
cmd_atteso 2 "bash scripts/close-propagate.sh --auto-deploy" "non fa deploy"
cmd_atteso 2 "ssh linux-pc 'systemctl restart heuresys-api'" "non tocca i servizi remoti"

# --- non riscrive la sorveglianza che lo governa
cmd_atteso 2 "sed -i 's/x/y/' .claude/settings.local.json" "non riscrive la configurazione"
cmd_atteso 2 "echo '{}' > .claude/settings.local.json" "nemmeno per redirezione"
cmd_atteso 2 "rm -f .zp/diario.ndjson" "non cancella il proprio diario"

# --- ma il suo mestiere lo fa
cmd_atteso 0 "git add -A && git commit -m 'Z-112: lavoro'" "COMMITTA sul proprio ramo"
cmd_atteso 0 "git status --porcelain" "guarda lo stato"
cmd_atteso 0 "pnpm test" "fa girare i test"
cmd_atteso 0 "gh pr list --state open" "LEGGE da GitHub"
cmd_atteso 0 "psql -c 'SELECT count(*) FROM sys.sys_users'" "interroga il database"
cmd_atteso 0 "sed -i 's/a/b/' apps/api/test/x.ts" "modifica DENTRO il perimetro"
cmd_atteso 0 "echo x > apps/api/test/y.ts" "scrive dentro il perimetro per redirezione"

# --- e non esce dal recinto per vie traverse
cmd_atteso 2 "sed -i 's/a/b/' apps/web/x.tsx" "sed fuori perimetro"
cmd_atteso 2 "echo ciao > apps/web/z.tsx" "redirezione fuori perimetro"
cmd_atteso 2 "cp /tmp/a apps/web/b.tsx" "copia fuori perimetro"
cmd_atteso 2 "git status && rm -rf apps/web" "un divieto nascosto dietro un comando innocuo"

# Questi due ISOLANO una difesa sola. Servono perche le altre prove sono coperte da
# DUE difese (divieto assoluto + bersaglio fuori perimetro): togliendone una restano
# verdi, e una prova che resta verde quando il codice peggiora non e una prova.

# Isola lo split sui separatori: COPIA_VERSO ancora la fine del segmento, quindi senza
# split il bersaglio nel PRIMO comando non si vede affatto.
# NOTA ONESTA: questa prova NON isola lo split come speravo — con o senza, il caso
# resta verde, perche i bersagli si cercano con espressioni ancorate a fine segmento
# e un `&&` le ferma comunque. Resta utile come caso di comportamento; lo split ha
# una sua ragione (i divieti si cercano segmento per segmento) che qui non si vede.
cmd_atteso 2 "cp /tmp/a apps/web/x.tsx && echo fatto" "un bersaglio fuori recinto nel primo di due comandi"

# Isola lautoprotezione: qui .claude E DENTRO il perimetro, quindi solo il divieto
# esplicito puo fermarlo. Se lautoprotezione sparisce, questo passa.
cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-999","perimetro":["apps/api/test",".claude"]}
EOF
mkdir -p "$ALBERO/.claude"
cmd_atteso 2 "echo '{}' > .claude/settings.local.json" "la sorveglianza non si riscrive NEMMENO se .claude e nel perimetro"
cmd_atteso 2 "sed -i s/a/b/ .claude/settings.local.json" "idem per sed"
cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-112","perimetro":["apps/api/test"]}
EOF

echo "── il diario ──"

# [S1052] Il diario NON vive piu' nell'albero: il sorvegliato non custodisce il proprio
# registro (B1). Questi cinque controlli guardavano dentro `$ALBERO/.zp/` e sono diventati
# rossi nel momento in cui il diario e' uscito — trovati eseguendo la batteria, non
# ipotizzati. `GOV_DIARI` sposta la cartella dentro l'area temporanea del test: senza,
# il test scriverebbe accanto agli alberi VERI e sporcherebbe il disco di lavoro.
export GOV_DIARI="$TMP/diari"
DIARIO_ATTESO="$GOV_DIARI/$(basename "$ALBERO").ndjson"

cat > "$ALBERO/.zp/incarico.json" <<EOF
{"cluster":"Z-112","lavoratore":2,"perimetro":["apps/api/test"]}
EOF
rm -f "$DIARIO_ATTESO" "$ALBERO/.zp/diario.ndjson"

annota_una() {               # annota_una <json>
  printf '%s' "$1" | CLAUDE_PROJECT_DIR="$ALBERO" "$PY" "$GUARDIA" diario >/dev/null 2>&1
}
annota_una '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/api/test/a.ts"}}'
annota_una '{"tool_name":"Bash","tool_input":{"command":"pnpm test && echo fatto"}}'
annota_una '{"tool_name":"Read","tool_input":{"file_path":"'"$ALBERO_N"'/README.md"}}'
printf '%s' '{"tool_name":"Write","tool_input":{"file_path":"'"$ALBERO_N"'/apps/web/x.tsx"}}' \
  | CLAUDE_PROJECT_DIR="$ALBERO" "$PY" "$GUARDIA" recinto >/dev/null 2>&1

RIGHE=$(wc -l < "$DIARIO_ATTESO" 2>/dev/null || echo 0)
verifica() { if [[ "$1" == "$2" ]]; then PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s\n' "$3"
             else FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s (atteso «%s», ottenuto «%s»)\n' "$3" "$1" "$2"; fi }

verifica "4" "$RIGHE" "ogni azione lascia una riga (3 eseguite + 1 rifiutata)"
verifica "1" "$(grep -c '"azione": "rifiutata"' "$DIARIO_ATTESO" 2>/dev/null || true)" "il rifiuto e' annotato, non solo negato"
verifica "1" "$(grep -c 'pnpm test' "$DIARIO_ATTESO" 2>/dev/null || true)" "i comandi eseguiti si ritrovano nel diario"
if grep -q '"quando"' "$DIARIO_ATTESO" 2>/dev/null; then
  PASSATI=$((PASSATI+1)); echo "[PASSA   ] ogni riga porta l'orario"
else FALLITI=$((FALLITI+1)); echo "[FALLISCE] manca l'orario"; fi

# IL PUNTO DI B1: il diario sta FUORI dall'albero, cioe' fuori dalla portata di chi
# viene sorvegliato. Se un giorno tornasse dentro, questo controllo lo dice.
if [[ -f "$ALBERO/.zp/diario.ndjson" ]]; then
  FALLITI=$((FALLITI+1)); echo "[FALLISCE] il diario e' tornato DENTRO l'albero del sorvegliato"
else PASSATI=$((PASSATI+1)); echo "[PASSA   ] il diario vive fuori dall'albero del sorvegliato"; fi

# Il diario e' APPEND: una seconda azione non riscrive la prima.
annota_una '{"tool_name":"Bash","tool_input":{"command":"git status"}}'
verifica "5" "$(wc -l < "$DIARIO_ATTESO")" "il diario si accoda, non si riscrive"

# E una sessione normale non lo alimenta.
NORMALE_DIARIO="$GOV_DIARI/$(basename "$NORMALE").ndjson"
rm -f "$NORMALE_DIARIO" "$NORMALE/.zp/diario.ndjson" 2>/dev/null
printf '%s' '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  | CLAUDE_PROJECT_DIR="$NORMALE" "$PY" "$GUARDIA" diario >/dev/null 2>&1
if [[ -f "$NORMALE_DIARIO" || -f "$NORMALE/.zp/diario.ndjson" ]]; then
  FALLITI=$((FALLITI+1)); echo "[FALLISCE] una sessione senza incarico non deve scrivere un diario"
else PASSATI=$((PASSATI+1)); echo "[PASSA   ] una sessione senza incarico non lascia diario"; fi

echo
echo "$PASSATI passati, $FALLITI falliti"
[[ "$FALLITI" == "0" ]]
