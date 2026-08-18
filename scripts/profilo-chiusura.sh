#!/usr/bin/env bash
# ============================================================================
# scripts/profilo-chiusura.sh — #217 I5: LA CHIUSURA E' UN PERCORSO SCELTO,
# non un rito completo.
#
# Enzo, 2026-08-18: la chiusura «richiede tempi lunghi e non adotta strategie
# sufficientemente smart per selezionare le azioni strettamente necessarie in
# ragione delle modifiche generate dalla sessione». La misura gli da' ragione:
# `.handoff/close-log.ndjson` porta ~67 record per sessione, e in S1064 da sola
# 13 `propaga`, 19 `deploy`, 16 `arma`.
#
# COSA FA: guarda la finestra di sessione, la classifica in UN profilo, e dice
# quali passi servono e quali no CON LA RAGIONE. Un passo saltato in silenzio e
# un passo saltato dichiarato sono due cose diverse: il primo e' una dimenticanza
# che sembra un'ottimizzazione.
#
#   documenti  — nessun file di deploy: si committa, si pubblica, si propaga. Basta.
#   codice     — c'e' codice da portare in produzione: si arma e si legge dalle macchine.
#   codice+db  — c'e' anche forma o contenuto del database: in piu' si rinfresca il clone.
#
# ── DUE COSE CHE IL PIANO DICEVA E LA MISURA HA CORRETTO ─────────────────────
#
# 1. Il piano diceva «riusando il router di verify_gate». NO: `lib/deploy-paths.sh`
#    dichiara esplicitamente che i due non vanno fusi, e ha ragione — rispondono a
#    domande diverse («quali PROVE rifare» contro «cosa PROPAGARE») e misurano
#    universi diversi (il working tree contro una finestra di commit). Il profilo
#    si costruisce sulle regex di deploy-paths.sh, importate: zero copie.
#
# 2. La propagazione NON e' un passo del profilo. Enzo, stesso giorno: «il linux-pc
#    resta allineato sempre — non si salta, si adatta il costo». E' gemello di
#    produzione, runner della CI e macchina della verifica lunga: un clone indietro
#    e' un guasto silenzioso, non un risparmio.
#
# ── L'ATLANTE NON SI DECIDE DAI PATH: SI CHIEDE A CHI LO MISURA ──────────────
#    La prima stesura di questo script deduceva il passo dell'atlante dai path di
#    deploy, e la PRIMA esecuzione l'ha smentita: una finestra che tocca solo
#    `scripts/` faceva stampare «esegui — la finestra tocca sorgenti che l'atlante
#    descrive», che e' semplicemente FALSO (i sorgenti sono apps/api/src/modules,
#    apps/web/src/app, packages/shared/src/schemas, db/migrations). Una ragione
#    falsa e' peggio di nessuna ragione: la si legge e ci si crede.
#
#    Quindi si chiede ad `atlas_freshness()` di status_dashboard.py — la stessa
#    misura che il boot stampa da se', e che NON confronta `commit == HEAD` ma
#    l'unica domanda che conta: *dei file che l'atlante descrive, ne e' cambiato
#    qualcuno dopo?* Zero copie, e la risposta e' quella canonica.
#
#    Se lo strumento non risponde, il passo si ESEGUE: si degrada verso il lavoro
#    in piu', mai verso il silenzio.
#
# Uso:
#   bash scripts/profilo-chiusura.sh                 # leggibile
#   bash scripts/profilo-chiusura.sh --eval          # PROFILO=... PASSO_...=... da `eval`
#   bash scripts/profilo-chiusura.sh --finestra <range>   # per i test e per i casi a mano
# ============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/deploy-paths.sh"   # accanto allo script (S1069)

REF="${DEPLOY_ARM_REF:-prod}"
FINESTRA=""
FORMATO="leggibile"
while [ $# -gt 0 ]; do
  case "$1" in
    --eval)     FORMATO="eval"; shift ;;
    --finestra) FINESTRA="${2:?--finestra richiede un range}"; shift 2 ;;
    *) echo "uso: profilo-chiusura.sh [--eval] [--finestra <range>]" >&2; exit 2 ;;
  esac
done

# La finestra e' «cosa non e' ancora in produzione», non «cosa ho fatto in questa sessione»:
# la seconda vive in un marcatore che si puo' perdere, la prima si ri-deriva sempre. E' la
# stessa scelta gia' fatta da close-propagate in #212.
finestra_why=""
if [ -z "$FINESTRA" ]; then
  git fetch --quiet origin "$REF" 2>/dev/null || true
  if git rev-parse --verify -q "origin/$REF" >/dev/null 2>&1; then
    FINESTRA="origin/$REF..HEAD"
    finestra_why="cio' che non e' ancora in produzione"
  else
    FINESTRA="HEAD~1..HEAD"
    finestra_why="RIPIEGO: origin/$REF sconosciuto — guardo solo l'ultimo commit"
  fi
else
  finestra_why="dichiarata da chi chiama"
fi

N_COMMIT="$(git rev-list --count "$FINESTRA" 2>/dev/null || echo 0)"
FILES="$(git diff --name-only "$FINESTRA" 2>/dev/null || true)"
tocca() { [ -n "$(printf '%s\n' "$FILES" | grep -E "$1" || true)" ]; }

if [ "$N_COMMIT" = 0 ] || [ -z "$FILES" ]; then
  PROFILO="documenti"; PROFILO_WHY="finestra vuota: non c'e' niente da portare in produzione"
elif tocca "$CLONE_DB_PATHS_RE"; then
  PROFILO="codice+db"; PROFILO_WHY="la finestra tocca $CLONE_DB_PATHS_RE"
elif tocca "$DEPLOY_PATHS_RE"; then
  PROFILO="codice"; PROFILO_WHY="la finestra tocca $DEPLOY_PATHS_RE, ma non la forma del database"
else
  PROFILO="documenti"; PROFILO_WHY="nessun file su $DEPLOY_PATHS_RE"
fi

case "$PROFILO" in
  documenti)
    P_ARMA=salta;     W_ARMA="niente da portare in produzione"
    P_CLONEDB=salta;  W_CLONEDB="la finestra non tocca $CLONE_DB_PATHS_RE"
    P_VERIFICA=salta; W_VERIFICA="non c'e' nessun deploy da verificare" ;;
  codice)
    P_ARMA=esegui;    W_ARMA="c'e' codice che deve andare in produzione"
    P_CLONEDB=salta;  W_CLONEDB="la finestra non tocca $CLONE_DB_PATHS_RE"
    P_VERIFICA=esegui; W_VERIFICA="si e' armato: l'esito si legge dalle macchine, non si presume" ;;
  codice+db)
    P_ARMA=esegui;    W_ARMA="c'e' codice che deve andare in produzione"
    P_CLONEDB=esegui; W_CLONEDB="forma o contenuto del database cambiati: il clone del gemello e' obsoleto"
    P_VERIFICA=esegui; W_VERIFICA="si e' armato: l'esito si legge dalle macchine, non si presume" ;;
esac

# L'atlante: misurato, non dedotto (vedi la nota in testa). ATLANTE_FORZA=esegui|salta
# scavalca la misura — serve ai test, che non possono dipendere dallo stato vero del repo.
if [ -n "${ATLANTE_FORZA:-}" ]; then
  P_ATLANTE="$ATLANTE_FORZA"; W_ATLANTE="imposto da ATLANTE_FORZA (prova)"
else
  atl="$(python docs/kb/tools/atlante_fresco.py 2>/dev/null || echo indeciso)"
  case "$atl" in
    fresco)  P_ATLANTE=salta;  W_ATLANTE="misurato: nessun sorgente che l'atlante descrive e' cambiato dopo la sua generazione" ;;
    vecchio) P_ATLANTE=esegui; W_ATLANTE="misurato: dei file che l'atlante descrive ne e' cambiato almeno uno" ;;
    *)       P_ATLANTE=esegui; W_ATLANTE="NON MISURABILE (lo strumento non ha risposto) — si rigenera, che e' il lato sicuro" ;;
  esac
fi

# La propagazione non e' negoziabile: sta qui per essere DICHIARATA, non per essere decisa.
P_PROPAGA=esegui
W_PROPAGA="i cloni restano allineati sempre (decisione di Enzo, 2026-08-18) — si adatta il costo, non si salta"

if [ "$FORMATO" = "eval" ]; then
  printf 'PROFILO=%s\n' "$PROFILO"
  printf 'PROFILO_WHY=%q\n' "$PROFILO_WHY"
  printf 'FINESTRA=%q\n' "$FINESTRA"
  printf 'PASSO_ATLANTE=%s\nPASSO_PROPAGA=%s\nPASSO_ARMA=%s\nPASSO_CLONEDB=%s\nPASSO_VERIFICA=%s\n' \
    "$P_ATLANTE" "$P_PROPAGA" "$P_ARMA" "$P_CLONEDB" "$P_VERIFICA"
  exit 0
fi

printf 'PROFILO %s\n' "$PROFILO"
printf '  finestra   %s (%s commit · %s)\n' "$FINESTRA" "$N_COMMIT" "$finestra_why"
printf '  motivo     %s\n' "$PROFILO_WHY"
printf '  passi\n'
printf '    %-16s %-6s — %s\n' atlante         "$P_ATLANTE"  "$W_ATLANTE"
printf '    %-16s %-6s — %s\n' propaga         "$P_PROPAGA"  "$W_PROPAGA"
printf '    %-16s %-6s — %s\n' arma            "$P_ARMA"     "$W_ARMA"
printf '    %-16s %-6s — %s\n' clone-db        "$P_CLONEDB"  "$W_CLONEDB"
printf '    %-16s %-6s — %s\n' verifica-deploy "$P_VERIFICA" "$W_VERIFICA"
