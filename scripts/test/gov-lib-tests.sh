#!/usr/bin/env bash
# gov-lib-tests.sh — la batteria di scripts/gov-lib.sh (modalita' gov, #173).
#
# Gira in pochi secondi, non tocca il repo, non apre sessioni: i lock si provano in
# una cartella temporanea, e l'unica cosa vera che crea — un albero di lavoro — la
# crea solo se glielo si chiede con GOV_TEST_WORKTREE=1, perche' costa disco e tempo.
#
#   bash scripts/test/gov-lib-tests.sh
#   GOV_TEST_WORKTREE=1 bash scripts/test/gov-lib-tests.sh     # prova anche l'albero
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=/dev/null
. "$REPO/scripts/gov-lib.sh"

PASSATI=0; FALLITI=0
prova() {                    # prova <atteso 0|1> <descrizione> <comando...>
  local atteso="$1" desc="$2"; shift 2
  "$@" >/dev/null 2>&1
  local esito=$?
  if [[ "$esito" == "$atteso" ]]; then
    PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s\n' "$desc"
  else
    FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s  (atteso exit %s, ottenuto %s)\n' "$desc" "$atteso" "$esito"
  fi
}
prova_uguale() {             # prova_uguale <atteso> <ottenuto> <descrizione>
  if [[ "$1" == "$2" ]]; then
    PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s\n' "$3"
  else
    FALLITI=$((FALLITI+1)); printf '[FALLISCE] %s  (atteso «%s», ottenuto «%s»)\n' "$3" "$1" "$2"
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
LOCKS="$TMP/locks"

echo "── lock per cluster ──"

prova 0 "un cluster libero si prende"                 gov_lock_prendi "$LOCKS" Z-001 "prova"
prova_uguale "$$" "$(gov_lock_chi "$LOCKS" Z-001)"    "il lock dice chi lo tiene"
prova 0 "un cluster diverso non e' bloccato dal primo" gov_lock_prendi "$LOCKS" Z-002 "prova"

# Il caso che conta: un lock TENUTO DA UN VIVO non si prende e non si tocca.
prova 1 "un cluster gia' preso da un vivo si rifiuta" gov_lock_prendi "$LOCKS" Z-001 "secondo"
prova_uguale "$$" "$(gov_lock_chi "$LOCKS" Z-001)"    "e il lock resta di chi ce l'aveva"

# Un lock di un processo MORTO e' un orfano: si recupera, altrimenti il primo
# crollo trasformerebbe il rimedio in un blocco permanente.
printf '999999\n2020-01-01T00:00:00\nmorto\n' > "$LOCKS/Z-003.lock"
prova 0 "il lock di un processo morto si recupera"    gov_lock_prendi "$LOCKS" Z-003 "recupero"
prova_uguale "$$" "$(gov_lock_chi "$LOCKS" Z-003)"    "dopo il recupero il lock e' nostro"

# Rilascio: si rimuove solo il proprio.
printf '999998\n2020-01-01T00:00:00\naltro\n' > "$LOCKS/Z-004.lock"
gov_lock_rilascia "$LOCKS" Z-004
prova 0 "il lock di un altro NON si rilascia"         test -f "$LOCKS/Z-004.lock"
gov_lock_rilascia "$LOCKS" Z-001
prova 1 "il proprio lock si rilascia"                 test -f "$LOCKS/Z-001.lock"

gov_lock_rilascia_tutti "$LOCKS"
prova 1 "rilascia_tutti toglie i propri"              test -f "$LOCKS/Z-002.lock"
prova 0 "rilascia_tutti lascia stare quelli altrui"   test -f "$LOCKS/Z-004.lock"

# Frontiere: argomenti mancanti non devono «riuscire» in silenzio.
prova 2 "senza cluster non si prende nulla"           gov_lock_prendi "$LOCKS" ""
prova 2 "senza cartella non si prende nulla"          gov_lock_prendi "" Z-005

echo
echo "── assegnazione ──"

ASSEGNATI="$(gov_assegna "$REPO" safe 2 4)"
N_ASSEGNATI="$(echo "$ASSEGNATI" | grep -c . || true)"
prova_uguale "2" "$N_ASSEGNATI" "a 2 lavoratori si assegnano 2 cluster"
DISTINTI="$(echo "$ASSEGNATI" | sort -u | grep -c . || true)"
prova_uguale "$N_ASSEGNATI" "$DISTINTI" "i cluster assegnati sono TUTTI DIVERSI"
prova_uguale "3" "$(gov_assegna "$REPO" safe 9 4 | grep -c . || true)" \
             "chiedendone 9 se ne assegnano 3 (il tetto)"

echo
echo "── cartella di lavoro ──"

BASE="$(gov_worktree_base "$REPO")"
case "$BASE" in
  "$REPO"/*) FALLITI=$((FALLITI+1)); echo "[FALLISCE] la base degli alberi e' DENTRO il repo: $BASE" ;;
  *)         PASSATI=$((PASSATI+1)); echo "[PASSA   ] la base degli alberi sta fuori dal repo" ;;
esac

if [[ "${GOV_TEST_WORKTREE:-0}" == "1" ]]; then
  GOV_WORKTREE_BASE="$TMP/alberi"
  export GOV_WORKTREE_BASE
  DIR="$(gov_worktree_prepara "$REPO" 9)"
  prova 0 "l'albero di lavoro nasce"                  test -e "$DIR/.git"
  if [[ -f "$REPO/.env" ]]; then
    prova 0 "porta con se' il .env, che git non porta" test -f "$DIR/.env"
  fi
  if [[ -d "$REPO/.secrets" ]]; then
    prova 0 "porta con se' .secrets/"                  test -d "$DIR/.secrets"
  fi
  prova 1 "e dichiara che l'installazione manca"       gov_worktree_pronto "$DIR"
  git -C "$REPO" worktree remove --force "$DIR" 2>/dev/null
  git -C "$REPO" worktree prune 2>/dev/null
else
  echo "[a mano  ] l'albero di lavoro vero: GOV_TEST_WORKTREE=1 (costa disco e tempo)"
fi

echo
echo "$PASSATI passati, $FALLITI falliti"
[[ "$FALLITI" == "0" ]]
