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
echo "── lucchetto sulla configurazione ──"
#
# Il censimento riscrive zp.config.yaml per intero. Se gira mentre dei lavoratori
# leggono classi e perimetri, gli sposta il pavimento sotto i piedi.

CFGL="$TMP/cfglock"
prova 1 "a riposo la configurazione non risulta occupata" gov_config_occupata "$CFGL"
prova 0 "il censimento la prende"                          gov_config_prendi "$CFGL" "censimento"
prova 0 "e adesso risulta occupata"                        gov_config_occupata "$CFGL"
prova 1 "un secondo censimento non parte"                  gov_config_prendi "$CFGL" "secondo"
gov_config_rilascia "$CFGL"
prova 1 "rilasciata, torna libera"                         gov_config_occupata "$CFGL"
# Un censimento morto a metà non deve bloccare per sempre chi viene dopo.
printf '999997\n2020-01-01T00:00:00\nmorto\n' > "$CFGL/config.lock"
prova 1 "un censimento morto non blocca nessuno"           gov_config_occupata "$CFGL"
prova 0 "e il suo lucchetto si recupera"                   gov_config_prendi "$CFGL" "dopo il morto"
gov_config_rilascia "$CFGL"

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
echo "── avvio e raccolta dei lavoratori ──"
#
# Con un finto `claude`: l'orchestrazione si prova senza aprire sessioni vere e
# senza toccare il freno di sicurezza. Il finto registra il comando che riceve,
# cosi' si vede se il cluster assegnato ci arriva davvero.

FINTO="$TMP/finto-claude.sh"
cat > "$FINTO" <<'FINTO_EOF'
#!/usr/bin/env bash
# Finto `claude`: scrive cio' che scriverebbe una sessione, poi muore.
#   FINTO_ESITO=<outcome>  FINTO_COSTO=<usd>  FINTO_MUTO=1 (non scrive l'esito)
comando=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p) comando="$2"; shift 2 ;;
    *)  shift ;;
  esac
done
mkdir -p .zp
printf '%s\n' "$comando" > .zp/comando-ricevuto.txt
printf '{"total_cost_usd": %s, "result": "finto"}\n' "${FINTO_COSTO:-1.5}"
[[ "${FINTO_MUTO:-0}" == "1" ]] && exit 0
printf '{"outcome": "%s", "next": "continue"}\n' "${FINTO_ESITO:-cluster-closed}" > .zp/last-outcome.json
exit 0
FINTO_EOF
chmod +x "$FINTO"
export ZP_CLAUDE_CMD="$FINTO"

L1="$TMP/lav1"; L2="$TMP/lav2"; mkdir -p "$L1" "$L2"

# Due lavoratori insieme, con esiti e costi DIVERSI: se lo stato fosse condiviso,
# il secondo sovrascriverebbe il primo e i due risultati sarebbero uguali.
P1="$(FINTO_ESITO=cluster-closed     FINTO_COSTO=2.25 gov_avvia_lavoratore "$L1" Z-230 resume safe 4 12 acceptEdits)"
P2="$(FINTO_ESITO=cluster-interrotto FINTO_COSTO=0.75 gov_avvia_lavoratore "$L2" Z-112 resume safe 4 12 acceptEdits)"
wait "$P1" 2>/dev/null; wait "$P2" 2>/dev/null

R1="$(gov_raccogli_lavoratore "$L1" | cut -d"|" -f1-3)"
R2="$(gov_raccogli_lavoratore "$L2" | cut -d"|" -f1-3)"
prova_uguale "cluster-closed|2.25|continue"     "$R1" "il primo lavoratore riporta il PROPRIO esito"
prova_uguale "cluster-interrotto|0.75|continue" "$R2" "il secondo riporta il suo, diverso dal primo"

prova 0 "al lavoratore arriva il cluster assegnato" grep -q "\-\-cluster Z-230" "$L1/.zp/comando-ricevuto.txt"
prova 0 "e a ciascuno il SUO, non quello dell'altro" grep -q "\-\-cluster Z-112" "$L2/.zp/comando-ricevuto.txt"
prova 1 "i due non si sono scambiati il cluster"     grep -q "Z-112" "$L1/.zp/comando-ricevuto.txt"

# Una sessione troncata non scrive l'esito: va letta come troncata, non come chiusa.
L3="$TMP/lav3"; mkdir -p "$L3"
P3="$(FINTO_MUTO=1 FINTO_COSTO=9.99 gov_avvia_lavoratore "$L3" Z-999 resume safe 4 12 acceptEdits)"
wait "$P3" 2>/dev/null
prova_uguale "troncato|9.99|recover" "$(gov_raccogli_lavoratore "$L3" | cut -d"|" -f1-3)" \
             "senza esito scritto si legge «troncato», e il costo si legge lo stesso"

# E il giro dopo non deve ereditare l'esito del giro prima: e' il modo silenzioso
# in cui un troncamento diventerebbe un «chiuso bene».
P4="$(FINTO_MUTO=1 FINTO_COSTO=0.10 gov_avvia_lavoratore "$L1" Z-230 resume safe 4 12 acceptEdits)"
wait "$P4" 2>/dev/null
prova_uguale "troncato|0.1|recover" "$(gov_raccogli_lavoratore "$L1" | cut -d"|" -f1-3)" \
             "l'esito del giro precedente non sopravvive al giro nuovo"

# La durata la misura il lavoratore, non chi aspetta: e' il numero da cui si capisce
# se il parallelo conviene, quindi non puo' essere il tempo del piu' lento dato a tutti.
L4="$TMP/lav4"; mkdir -p "$L4"
FINTO_LENTO="$TMP/finto-lento.sh"
sed 's|^printf .{"total_cost_usd|sleep 2
&|' "$FINTO" > "$FINTO_LENTO" 2>/dev/null || cp "$FINTO" "$FINTO_LENTO"
printf '#!/usr/bin/env bash
sleep 2
mkdir -p .zp
printf %s
 "{\\"total_cost_usd\\": 1}"
printf %s > .zp/last-outcome.json "{\\"outcome\\":\\"cluster-closed\\",\\"next\\":\\"continue\\"}"
' > "$FINTO_LENTO"
chmod +x "$FINTO_LENTO"
P5="$(ZP_CLAUDE_CMD="$FINTO_LENTO" gov_avvia_lavoratore "$L4" Z-500 resume safe 4 12 acceptEdits)"
wait "$P5" 2>/dev/null
DUR="$(gov_raccogli_lavoratore "$L4" | cut -d'|' -f4)"
if [[ "$DUR" -ge 2 ]] 2>/dev/null; then
  PASSATI=$((PASSATI+1)); printf '[PASSA   ] %s
' "la durata la misura chi lavora (${DUR}s per 2s di lavoro)"
else
  FALLITI=$((FALLITI+1)); printf '[FALLISCE] la durata la misura chi lavora  (attesa >=2, ottenuta «%s»)
' "$DUR"
fi

unset ZP_CLAUDE_CMD

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
