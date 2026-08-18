#!/usr/bin/env bash
# ============================================================================
# scripts/ci-rosso-di-chi.sh — #217 I7: UN ROSSO DELLA CI E' NOSTRO O DI GITHUB?
#
# LA MISURA CHE HA DECISO QUESTO STRUMENTO (2026-08-18). Il 429 esiste ed e'
# documentato: il 2026-08-17 alle 13:31 cinque workflow sono morti insieme perche'
# `codeload.github.com` ha rifiutato il download di `actions/checkout` con
# «429 Too Many Requests», dopo che il runner aveva gia' ritentato TRE volte con
# backoff automatico (24s, 13s). Ma e' accaduto **una volta sola** su 40 corse, 34
# delle quali riuscite.
#
# QUINDI IL 429 NON SI CURA, e va detto invece di fingere un intervento:
#   - la causa e' un rate limit di codeload.github.com, fuori dal nostro controllo;
#   - il runner ritenta gia' da se', quindi la resilienza c'e';
#   - le action sono pinnate per SHA per ragioni di sicurezza, e vendorizzarle per
#     aggirare un episodio isolato aggiungerebbe superficie da mantenere.
#
# IL COSTO VERO ERA UN ALTRO: quando accade, un rosso di GitHub e' indistinguibile
# da un rosso del progetto, e chi chiude si ferma a leggere i log a mano. Il diario
# di S1064 lo dice testualmente: «7 corse morte in Set up job, nessun difetto del
# progetto. Tutte rilanciate». Quello e' cio' che si automatizza.
#
# QUESTO SCRIPT NON AMMORBIDISCE NESSUN CANCELLO. `ci-gate.sh` continua a
# considerare rosso un rosso: un rosso che si auto-assolve non e' un cancello. Qui
# si DIAGNOSTICA soltanto, per chi deve decidere se rilanciare o correggere.
#
# Uso:
#   bash scripts/ci-rosso-di-chi.sh                 # l'ultima corsa non riuscita su main
#   bash scripts/ci-rosso-di-chi.sh <run-id>        # una corsa precisa
#   bash scripts/ci-rosso-di-chi.sh --limite 40     # quante corse guardare
#
# Verdetto (vocabolario chiuso, come verifica-deploy.sh):
#   PROGETTO       — il rosso e' nostro: si corregge, non si rilancia
#   INFRASTRUTTURA — 429/rete/runner: si rilancia (`gh run rerun <id> --failed`)
#   NON-VERIFICATO — non si e' potuto guardare. NON vuol dire «a posto».
# ============================================================================
set -uo pipefail

LIMITE=40
RUN_ID=""
while [ $# -gt 0 ]; do
  case "$1" in
    --limite) LIMITE="${2:?--limite richiede un numero}"; shift 2 ;;
    -*) echo "uso: ci-rosso-di-chi.sh [<run-id>] [--limite N]" >&2; exit 2 ;;
    *)  RUN_ID="$1"; shift ;;
  esac
done

# Seam di prova (stessa convenzione di CI_GATE_FIXTURE): un file col log al posto della
# rete, cosi' la batteria puo' verificare la diagnosi senza gh e senza GitHub. Serve
# perche' le due prove che contano — «sa dire INFRASTRUTTURA» e «sa dire PROGETTO» —
# devono restare eseguibili su ogni macchina, non solo dove c'e' una corsa rossa a tiro.
if [ -n "${CI_LOG_FIXTURE:-}" ]; then
  LOG="$(cat "$CI_LOG_FIXTURE" 2>/dev/null || true)"
  RUN_ID="${RUN_ID:-fixture}"
  [ -n "$LOG" ] || { echo "NON-VERIFICATO — fixture illeggibile: $CI_LOG_FIXTURE"; exit 2; }
elif ! command -v gh >/dev/null 2>&1; then
  echo "NON-VERIFICATO — gh non e' disponibile su questa macchina"
  exit 2
fi

if [ -z "${CI_LOG_FIXTURE:-}" ] && [ -z "$RUN_ID" ]; then
  RUN_ID="$(gh run list --branch main --limit "$LIMITE" \
              --json databaseId,conclusion,workflowName,createdAt 2>/dev/null \
            | python -c '
import json, sys
try: d = json.load(sys.stdin)
except Exception: sys.exit()
for r in d:
    if r.get("conclusion") in ("failure", "startup_failure", "timed_out"):
        print(r["databaseId"]); break
')"
fi

if [ -z "$RUN_ID" ] && [ -z "${CI_LOG_FIXTURE:-}" ]; then
  echo "PROGETTO — nessuna corsa non riuscita fra le ultime $LIMITE su main (niente da diagnosticare)"
  exit 0
fi

if [ -z "${CI_LOG_FIXTURE:-}" ]; then
  LOG="$(gh run view "$RUN_ID" --log-failed 2>/dev/null || true)"
fi
if [ -z "$LOG" ]; then
  echo "NON-VERIFICATO — non ho potuto leggere il log della corsa $RUN_ID"
  exit 2
fi

# Le firme dell'infrastruttura. Sono volutamente POCHE e specifiche: un elenco largo
# assolverebbe rossi veri, che e' il danno peggiore che questo strumento possa fare.
#
# ⚠ LE PARENTESI VANNO PROTETTE, e la prima stesura non lo faceva: in una regex estesa
# `429 (Too Many Requests)` e' «429 seguito dal GRUPPO Too Many Requests», quindi non
# combacia con la stringa vera, che le parentesi ce le ha. La firma piu' importante era
# CIECA, e il caso reale del 17 agosto e' stato riconosciuto solo grazie alle altre due.
# Un pattern che compila e non aggancia niente e' il difetto gia' incontrato in S1069.
FIRME='429 \(Too Many Requests\)|Failed to download action|Failed to download archive|The runner has received a shutdown signal|The self-hosted runner .* lost communication|Error: The operation was canceled'

TROVATE="$(printf '%s' "$LOG" | grep -oE "$FIRME" | sort | uniq -c | sort -rn || true)"
if [ -n "$TROVATE" ]; then
  echo "INFRASTRUTTURA — corsa $RUN_ID: il rosso non e' del progetto"
  printf '%s\n' "$TROVATE" | sed 's/^/    /'
  echo "    rilancia:  gh run rerun $RUN_ID --failed"
  exit 0
fi

echo "PROGETTO — corsa $RUN_ID: nessuna firma d'infrastruttura nei log falliti."
echo "    Il rosso si corregge, non si rilancia (R3)."
printf '%s' "$LOG" | grep -iE '##\[error\]' | head -5 | sed 's/^/    /'
exit 1
