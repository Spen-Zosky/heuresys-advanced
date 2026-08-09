#!/usr/bin/env bash
# zero-pending-driver - il loop del zero-pending-loop.
#
# Non ragiona sul merito del lavoro: apre una sessione, legge com'e' andata, ne apre
# un'altra. Tutta l'intelligenza sta nella skill; qui sta la continuita'.
#
# Il punto centrale: ogni invocazione di `claude -p` nasce con contesto vergine. E'
# quello il /clear, ottenuto per costruzione invece che per comando, e per questo lo
# stato deve stare su file e non in conversazione.
#
# Opzioni
#   --lane <corsia>        quale corsia di lavoro
#   --lavoratori <n>       quanti cluster in parallelo (1 = comportamento di sempre)
#   --prepara-alberi <n>   prepara n alberi di lavoro e esce (passo presidiato)
#   --max-iterations <n>   quanti giri al massimo
#   --window <finestra>    finestra oraria in cui e' ammesso lavorare
#   --permission-mode <m>  modalita' permessi di claude -p
#   --budget-usd <n>       spesa massima per GIRO, in dollari
#   --tetto-usd <n>        spesa massima CUMULATA della corsa, in dollari
#   --dry-run              stampa cosa farebbe e si ferma
#
# I due flag di spesa possono solo ABBASSARE i valori di zp.config.yaml, mai alzarli:
# la config e' il soffitto. Un valore piu' alto viene accettato e ridotto, dicendolo.
#
# Vedi .claude/skills/zero-pending-loop/references/driver.md
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

# I pezzi della modalita' gov (#173) stanno in un file a parte, sorgibile e quindi
# provabile senza far partire il driver — che all'avvio si ferma sui guard-rail.
# shellcheck source=/dev/null
. "$REPO/scripts/gov-lib.sh"

ZP="$REPO/.zp"
LOCK="$ZP/driver.lock"
LOCKS="$ZP/locks"
STOP="$ZP/STOP"
CURSORE="$ZP/cursor.json"
ESITO="$ZP/last-outcome.json"
GIRI="$ZP/runs.ndjson"
CFG="$REPO/.claude/skills/zero-pending-loop/references/zp.config.yaml"
PY="${ZP_PYTHON:-python}"

CORSIA="safe"; MAX_ITER=""; FINESTRA=""; DRY=0; PERMESSI=""; LAVORATORI=""; PREPARA=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lane)            CORSIA="$2"; shift 2 ;;
    --max-iterations)  MAX_ITER="$2"; shift 2 ;;
    --window)          FINESTRA="$2"; shift 2 ;;
    --permission-mode) PERMESSI="$2"; shift 2 ;;
    --budget-usd)      BUDGET_CHIESTO="$2"; shift 2 ;;
    --tetto-usd)       TETTO_CHIESTO="$2"; shift 2 ;;
    --lavoratori)      LAVORATORI="$2"; shift 2 ;;
    --prepara-alberi)  PREPARA="$2"; shift 2 ;;
    --dry-run)         DRY=1; shift ;;
    -h|--help)         sed -n '2,23p' "$0"; exit 0 ;;
    *) echo "opzione sconosciuta: $1" >&2; exit 2 ;;
  esac
done

# TRAPPOLA VERIFICATA: in Git Bash i path assoluti sono in forma MSYS (/d/...) e Python
# su Windows non sa aprirli. Quindi non si passa MAI un path assoluto a Python: si usa
# zp_state, che il path se lo calcola da solo a partire da __file__.
cfg() {
  local valore
  valore="$("$PY" docs/kb/tools/zp_state.py config "$1" 2>/dev/null)" || {
    echo "ERRORE: non riesco a leggere la config ($1). Python: $PY" >&2
    return 1
  }
  echo "$valore"
}

log()  { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }
muori(){ log "STOP: $*"; rm -f "$LOCK"; exit "${2:-1}"; }

[[ -z "$MAX_ITER" ]] && MAX_ITER="$(cfg budget.max_iterations_default)"
[[ -z "$MAX_ITER" ]] && MAX_ITER=12
[[ -z "$FINESTRA" ]] && FINESTRA="$(cfg interrupt_resume.window)"
# I permessi vengono dalla CONFIG, non da un valore scritto qui: e' una decisione
# di sicurezza e deve stare dove si legge e si revoca, accanto alle altre.
[[ -z "$PERMESSI" ]] && PERMESSI="$(cfg permessi.modalita_lavoratore)"
[[ -z "$PERMESSI" ]] && PERMESSI="acceptEdits"
BUDGET_GIRO="$(cfg budget.max_budget_usd_per_iteration)"; [[ -z "$BUDGET_GIRO" ]] && BUDGET_GIRO=12
TETTO_TOT="$(cfg budget.hard_stop_usd_total)";            [[ -z "$TETTO_TOT" ]] && TETTO_TOT=120

# --- budget per-corsa: la config e' un SOFFITTO, non un valore predefinito ------------
# `--budget-usd` e `--tetto-usd` permettono di spendere MENO per una corsa specifica.
# Non permettono di spendere di piu': un valore oltre il soffitto viene accettato e
# ridotto, con una riga di log che lo dice. Cosi' chi lancia non si trova una corsa
# rifiutata per un numero sbagliato, ma nemmeno un tetto scavalcato di nascosto.
# Il confronto e' in centesimi interi perche' bash non sa confrontare i decimali.
# Il messaggio va su STDERR, non su stdout: questa funzione viene chiamata dentro
# `$( )`, e tutto cio' che scrive su stdout FINISCE NEL VALORE. Con `log` normale il
# budget diventava la stringa «04:38:27 richiesti $99 ... 12». Verificato applicando.
clamp_usd() {                     # clamp_usd <chiesto> <soffitto> <etichetta> -> valore
  local chiesto="$1" soffitto="$2" etichetta="$3"
  case "$chiesto" in
    ''|*[!0-9.]*|*.*.*) log "ATTENZIONE: $etichetta '$chiesto' non e' un numero: uso il soffitto \$$soffitto" >&2
                        echo "$soffitto"; return ;;
  esac
  local c s
  c=$(awk -v v="$chiesto"  'BEGIN{printf "%d", v*100 + 0.5}')
  s=$(awk -v v="$soffitto" 'BEGIN{printf "%d", v*100 + 0.5}')
  if (( c > s )); then
    log "richiesti \$$chiesto di $etichetta, la config ne ammette \$$soffitto: uso \$$soffitto" >&2
    echo "$soffitto"
  else
    echo "$chiesto"
  fi
}
[[ -n "${BUDGET_CHIESTO:-}" ]] && BUDGET_GIRO="$(clamp_usd "$BUDGET_CHIESTO" "$BUDGET_GIRO" 'budget per giro')"
[[ -n "${TETTO_CHIESTO:-}"  ]] && TETTO_TOT="$(clamp_usd  "$TETTO_CHIESTO"  "$TETTO_TOT"  'tetto della corsa')"
# I valori risolti si dichiarano QUI, prima dei guard-rail: se una guardia ferma la
# corsa, chi l'ha lanciata deve comunque vedere che spesa era stata concessa. Prima
# comparivano solo nella riga di riepilogo, che con il freno inserito non si raggiunge.
[[ -n "${BUDGET_CHIESTO:-}${TETTO_CHIESTO:-}" ]] &&
  log "spesa concessa a questa corsa: \$$BUDGET_GIRO per giro, \$$TETTO_TOT di tetto"
LAV_MAX="$(cfg gov.lavoratori_max)";     [[ -z "$LAV_MAX" ]] && LAV_MAX=3
[[ -z "$LAVORATORI" ]] && LAVORATORI="$(cfg gov.lavoratori_default)"
[[ -z "$LAVORATORI" ]] && LAVORATORI=1
case "$LAVORATORI" in ''|*[!0-9]*) log "«$LAVORATORI» non e' un numero di lavoratori: uso 1"; LAVORATORI=1 ;; esac
if (( LAVORATORI > LAV_MAX )); then
  log "richiesti $LAVORATORI lavoratori, la config ne ammette $LAV_MAX: uso $LAV_MAX"
  LAVORATORI=$LAV_MAX
fi
(( LAVORATORI < 1 )) && LAVORATORI=1

STALE_H="$(cfg interrupt_resume.resume_stale_after_hours)"; [[ -z "$STALE_H" ]] && STALE_H=24
ORE_MAX="$(cfg budget.max_effort_hours_per_cluster)"; [[ -z "$ORE_MAX" ]] && ORE_MAX=4
CLASSIFICATI="$(cfg meta.clusters_classified)"

mkdir -p "$ZP"

# --- autenticazione: si toglie di mezzo SOLO la chiave API utente ---------------------
# Sul PC Windows di Enzo esiste una ANTHROPIC_API_KEY a livello UTENTE, stantia e non
# piu' valida. Scavalca il login ad abbonamento: ogni `claude -p` la eredita e muore con
# «401 API key is invalid». Scoperto dal primo collaudo presidiato dell'impianto
# (2026-08-03) — avrebbe rotto la corsa notturna al primo giro vero, e in modo muto,
# perche' il driver avrebbe solo visto sessioni che falliscono.
#
# La plancia si difende gia' da sola; questa e' la stessa difesa nel driver, che si
# lancia anche a mano. Politica decisa da Enzo: si spoglia SOLO la API key e si PRESERVA
# ANTHROPIC_AUTH_TOKEN, che e' la via dell'abbonamento; in sua assenza vale il login
# claude.ai della CLI.
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  log "trovata ANTHROPIC_API_KEY nell'ambiente: la tolgo per questa corsa (scavalca il login ad abbonamento)"
  unset ANTHROPIC_API_KEY
fi

# --- preparazione degli alberi di lavoro (passo presidiato, non una corsa) ------------
# Sta PRIMA dei guard-rail perche' non apre nessuna sessione e non tocca il repo: crea
# cartelle fuori da esso e finisce. L'installazione delle dipendenze e' cara e va vista
# succedere, per questo e' un comando a se' e non un effetto collaterale di una corsa.
if [[ -n "$PREPARA" ]]; then
  case "$PREPARA" in ''|*[!0-9]*) log "«$PREPARA» non e' un numero di alberi"; exit 2 ;; esac
  for n in $(seq 1 "$PREPARA"); do
    D="$(gov_worktree_prepara "$REPO" "$n")" || { log "albero $n: non riesco a crearlo"; exit 1; }
    log "albero $n: $D"
    if gov_worktree_pronto "$D"; then
      log "  dipendenze gia' presenti"
    else
      log "  installo le dipendenze (una tantum, puo' volerci qualche minuto)"
      ( cd "$D" && pnpm install --frozen-lockfile ) || { log "  installazione fallita"; exit 1; }
    fi
  done
  log "alberi pronti. Ora: bash scripts/zero-pending-driver.sh --lavoratori $PREPARA ..."
  exit 0
fi

# ---------------------------------------------------------------- guard-rail

[[ -f "$STOP" ]] && { log "il freno e' tirato ($STOP). Togli il file e rilancia."; exit 0; }

AUTORIZZATO="$(cfg meta.autorizzato_non_presidiato)"
if [[ "$AUTORIZZATO" != "True" && "$AUTORIZZATO" != "true" ]]; then
  log "freno di sicurezza inserito (meta.autorizzato_non_presidiato: false)."
  log "La review CLI del 2026-07-25 ha lasciato aperti rilievi che rendono l'esecuzione"
  log "non presidiata rischiosa: classificazione che ammette cluster di produzione in"
  log "corsia safe, prove autodichiarate, self-test che non vede le regressioni."
  log "L'elenco e la condizione per togliere il freno sono in zp.config.yaml (meta)."
  exit 3
fi

if [[ "$CLASSIFICATI" != "True" && "$CLASSIFICATI" != "true" ]]; then
  log "i cluster non sono classificati per raggio d'impatto (meta.clusters_classified: false)."
  log "Senza classificazione nessuna corsia e' autorizzata: e' la precondizione di sicurezza."
  exit 3
fi

for t in zp_state zp_gate zp_evidence zp_zero_check; do
  [[ -f "$REPO/docs/kb/tools/$t.py" ]] || { log "manca docs/kb/tools/$t.py"; exit 3; }
done

# Cio' che il progetto dichiara legittimamente NON TRACCIATO non e' sporcizia.
# `.codex/`, `.codex-review/` e il root `AGENTS.md` sono il canale di sola lettura di
# Codex, e il CLAUDE.md dice a chiare lettere che «non sono file da ripulire e non sono
# di Claude». Il filtro guardava solo `.zp/`, quindi il driver si sarebbe rifiutato di
# partire su QUALUNQUE macchina dove Codex ha lavorato — e nessuno se ne era accorto
# perche' finora nessuna corsa e' mai partita. Si escludono solo i NON TRACCIATI di
# quei percorsi: una modifica a un file tracciato resta sporco, come deve.
# Cio' che il progetto dichiara legittimamente NON TRACCIATO non e' sporcizia.
# `.codex/`, `.codex-review/` e il root `AGENTS.md` sono il canale di sola lettura di
# Codex, e il CLAUDE.md dice a chiare lettere che «non sono file da ripulire e non sono
# di Claude». Il filtro guardava solo `.zp/`, quindi il driver si sarebbe rifiutato di
# partire su QUALUNQUE macchina dove Codex ha lavorato — e non se n'era accorto nessuno
# perche' finora nessuna corsa era mai partita. Si escludono solo i NON TRACCIATI di
# quei percorsi: una modifica a un file tracciato resta sporco, come deve.
IGNORABILI='^\?\? (\.zp/|\.codex/|\.codex-review/|\.agents/|AGENTS\.md$)'
SPORCO="$(git status --porcelain | grep -Ev "$IGNORABILI" || true)"
if [[ -n "$SPORCO" && $DRY -eq 0 ]]; then
  log "il repo ha modifiche non salvate: non parto sopra il lavoro di qualcun altro."
  echo "$SPORCO" | head -10
  exit 4
fi

# LOCK — due difetti corretti in review (S1030), entrambi portavano allo stesso danno:
# due driver che aprono sessioni Claude in parallelo sullo stesso repo.
#
#  (1) `muori()` cancella il lock. Chiamarla qui, dove il lock e' di un ALTRO processo
#      vivo, cancellava il lock del driver in esecuzione: il terzo driver lanciato non
#      trovava piu' nulla e partiva in parallelo al primo. Ora si esce senza toccarlo.
#  (2) fra il test `-f` e la scrittura c'era una finestra in cui due driver avviati
#      insieme passavano entrambi. Ora l'acquisizione e' atomica: `set -o noclobber` fa
#      fallire il redirect se il file esiste gia' — decide il kernel, non il controllo.
#
# Il trap rimuove il lock SOLO se contiene il nostro pid: un driver che esce non deve
# mai portarsi via il lock di un altro.
if [[ -f "$LOCK" ]]; then
  VECCHIO_PID="$(head -1 "$LOCK" 2>/dev/null || echo 0)"
  if kill -0 "$VECCHIO_PID" 2>/dev/null; then
    log "STOP: c'e' gia' un driver in esecuzione (pid $VECCHIO_PID)"
    exit 5          # <- niente rm: quel lock non e' nostro
  fi
  log "lock orfano di un driver morto (pid $VECCHIO_PID): lo recupero"
  rm -f "$LOCK"
  RECUPERO=1
fi
if ! (set -o noclobber; echo "$$" > "$LOCK") 2>/dev/null; then
  log "STOP: un altro driver ha preso il lock nello stesso istante"
  exit 5
fi
mio_lock() { [[ "$(head -1 "$LOCK" 2>/dev/null || echo 0)" == "$$" ]]; }
# Un handler TERM in bash esegue e RIPRENDE: il driver restava vivo, ma senza lock —
# e chi aveva provato a fermarlo, vedendolo ancora in giro, ne lanciava un secondo.
# Il tentativo di fermarlo era ciò che apriva la concorrenza (rilievo B2 della review).
# Ora il segnale uccide il figlio in volo e termina davvero.
FIGLI=()
trap 'gov_lock_rilascia_tutti "$LOCKS"; mio_lock && rm -f "$LOCK"' EXIT
trap 'log "segnale ricevuto: fermo le sessioni in volo"; for _p in ${FIGLI[@]+"${FIGLI[@]}"}; do kill -TERM "$_p" 2>/dev/null; done; gov_lock_rilascia_tutti "$LOCKS"; mio_lock && rm -f "$LOCK"; exit 143' INT TERM

# VETO SUL DEPLOY (rilievo B4). Il filtro per classe di rischio governa la scelta del
# cluster, non il rito di chiusura: la skill chiude ogni ciclo con `close-propagate
# --auto-deploy`, che fa `git reset --hard` + restart systemd sulla VM di produzione.
# Fuori da una corsia presidiata quel deploy non s'ha da fare, e il divieto dev'essere
# imposto dal codice a valle (close-propagate.sh lo tratta come veto non scavalcabile),
# non chiesto in prosa a un modello.
if [[ "$CORSIA" != "full-presidiata" ]]; then
  export HEURESYS_CLOSE_NODEPLOY=1
  log "corsia '$CORSIA': deploy di produzione disabilitato per l'intera corsa (veto a close-propagate)"
fi

# ---------------------------------------------------------------- modo iniziale

MODO="resume"
if [[ "${RECUPERO:-0}" == "1" && -f "$CURSORE" ]]; then
  MODO="recover"
  log "sessione precedente morta senza chiudere: primo giro in recupero"
elif [[ -f "$GIRI" || -f "$ESITO" ]]; then
  # Si guarda il GIORNALE, non l'ultimo esito. Con i lavoratori in parallelo l'esito
  # lo scrive ciascuno nel proprio albero, e quello del repo principale resta fermo
  # per sempre: dopo un giorno il driver sarebbe rientrato da bootstrap a ogni corsa,
  # per un file che nessuno aggiornava piu'. Il giornale invece cresce in entrambi i
  # modi, perche' lo scrive il driver.
  RIFERIMENTO="$GIRI"; [[ -f "$RIFERIMENTO" ]] || RIFERIMENTO="$ESITO"
  ULTIMA=$(( ( $(date +%s) - $(stat -c %Y "$RIFERIMENTO" 2>/dev/null || echo 0) ) / 3600 ))
  if (( ULTIMA >= STALE_H )); then
    MODO="bootstrap"
    log "ultima chiusura $ULTIMA ore fa (soglia $STALE_H): rientro da bootstrap, il piano puo' essersi mosso"
  fi
else
  MODO="bootstrap"
  log "prima corsa su questo progetto: bootstrap"
fi

nella_finestra() {
  [[ -z "$FINESTRA" ]] && return 0
  local da="${FINESTRA%-*}" a="${FINESTRA#*-}" ora
  ora="$(date +%H:%M)"
  if [[ "$da" < "$a" ]]; then
    [[ "$ora" > "$da" && "$ora" < "$a" ]]
  else   # finestra che scavalca la mezzanotte
    [[ "$ora" > "$da" || "$ora" < "$a" ]]
  fi
}

spesa_totale() {
  [[ -f "$GIRI" ]] || { echo 0; return; }
  # path RELATIVO: siamo gia' in $REPO e Python su Windows non digerisce /d/...
  "$PY" -c "
import json
t=0.0
for r in open('.zp/runs.ndjson',encoding='utf-8'):
    r=r.strip()
    if r:
        try: t+=float(json.loads(r).get('costo_usd') or 0)
        except Exception: pass
print(round(t,2))"
}

log "corsia=$CORSIA  giri max=$MAX_ITER  budget/giro=\$$BUDGET_GIRO  tetto=\$$TETTO_TOT  finestra=${FINESTRA:-sempre}"
[[ $DRY -eq 1 ]] && log "DRY-RUN: nessuna sessione verra' aperta"

# ---------------------------------------------------------------- il loop

GIRO=0
while (( GIRO < MAX_ITER )); do
  [[ -f "$STOP" ]] && { log "freno tirato: mi fermo dopo questo controllo"; break; }
  if gov_config_occupata "$ZP"; then
    log "la configurazione e' in riscrittura (censimento in corso, pid $(gov_lock_chi "$ZP" config)):"
    log "non apro lavoratori sopra un piano che sta cambiando. Mi fermo."
    break
  fi
  nella_finestra || { log "fuori dalla finestra $FINESTRA: chiudo qui"; break; }

  SPESA="$(spesa_totale)"
  # Se il confronto non e' calcolabile ci si ferma, non si prosegue (rilievo S7): con
  # SPESA vuota, `float('')` alzava ValueError, l'if diventava falso e il loop continuava
  # — proprio quando il dato che avrebbe dovuto fermarlo mancava.
  if ! "$PY" -c "import sys; float('$SPESA')" 2>/dev/null; then
    log "non riesco a calcolare la spesa (valore: '${SPESA}'): mi fermo per prudenza"; break
  fi
  if "$PY" -c "import sys; sys.exit(0 if float('$SPESA') >= float('$TETTO_TOT') else 1)"; then
    log "tetto di spesa raggiunto (\$$SPESA su \$$TETTO_TOT): mi fermo"; break
  fi

  if "$PY" docs/kb/tools/zp_zero_check.py --json > "$ZP/zero-check.json" 2>/dev/null; then
    log "condizione raggiunta: niente altro da fare in autonomia"
    "$PY" docs/kb/tools/zp_state.py progress --lane "$CORSIA" >/dev/null 2>&1
    break
  fi

  GIRO=$((GIRO + 1))
  log "giro $GIRO/$MAX_ITER  modo=$MODO  speso finora \$$SPESA"

  if [[ $DRY -eq 1 ]]; then
    "$PY" docs/kb/tools/zp_state.py todo --lane "$CORSIA" --budget-ore "$ORE_MAX" || true
    log "dry-run: mi fermo dopo aver mostrato i candidati"
    break
  fi

  # --- chi lavora, e su cosa -----------------------------------------------------
  # Il driver ASSEGNA. Senza, N lavoratori chiamerebbero tutti `zp_state prossimo` e
  # otterrebbero lo stesso cluster: la selezione e' deterministica.
  DIRS=(); CLUSTERS=()
  if (( LAVORATORI > 1 )); then
    ASSEGNATI=()
    while IFS= read -r _z; do [[ -n "$_z" ]] && ASSEGNATI+=("$_z"); done < <(
      gov_assegna "$REPO" "$CORSIA" "$LAVORATORI" "$ORE_MAX")
    if (( ${#ASSEGNATI[@]} < 2 )); then
      # Decisione 3 di Enzo: senza perimetri dichiarati non si va in parallelo, si
      # torna al comportamento di sempre. Non e' un errore e non ferma la corsa.
      log "meno di due cluster con perimetro dichiarato: questo giro va a un lavoratore solo"
    else
      for _i in "${!ASSEGNATI[@]}"; do
        _c="${ASSEGNATI[$_i]}"
        if ! gov_lock_prendi "$LOCKS" "$_c" "driver $$ giro $GIRO"; then
          log "  $_c e' gia' in mano a un altro (pid $(gov_lock_chi "$LOCKS" "$_c")): lo salto"
          continue
        fi
        _d="$(gov_worktree_prepara "$REPO" $((_i + 1)))"
        if [[ -z "$_d" ]] || ! gov_worktree_pronto "$_d"; then
          log "  albero $((_i + 1)) non pronto: lancia prima --prepara-alberi $LAVORATORI"
          gov_lock_rilascia "$LOCKS" "$_c"
          continue
        fi
        # V2: nessun lavoratore parte con le credenziali di produzione in mano. La
        # verifica e' QUI, al momento di lanciarlo, non ereditata dalla preparazione:
        # una guardia che si fida di un passaggio precedente non e' una guardia.
        if ! gov_credenziali_declassate "$_d"; then
          log "  albero $((_i + 1)): ha ancora le credenziali di produzione. NON lo lancio."
          log "  rimedio: bash db/scripts/crea-ruolo-gov-worker.sh, poi --prepara-alberi"
          gov_lock_rilascia "$LOCKS" "$_c"
          continue
        fi
        DIRS+=("$_d"); CLUSTERS+=("$_c")
      done
    fi
  fi
  if (( ${#DIRS[@]} == 0 )); then
    DIRS=("$REPO"); CLUSTERS=("")           # un lavoratore: il repo stesso, come sempre
  fi

  # --- si aprono le sessioni ------------------------------------------------------
  # Il lucchetto della suite e' UNO SOLO per tutti: protegge il database, non la
  # cartella. Senza questa riga ogni albero avrebbe il suo, cioe' nessuna protezione,
  # e si tornerebbe al caso misurato il 2026-08-05 (14 rossi su 232, nessuno vero).
  export SUITE_LOCK_FILE="$ZP/suite.lock"

  INIZIO=$(date +%s)
  FIGLI=()
  for _i in "${!DIRS[@]}"; do
    # SENZA $( ): la sostituzione di comando crea una sottoshell, e il figlio
    # lanciato li' dentro non e' figlio del driver — `wait` risponde «non e' un mio
    # figlio» (127), il driver crede di aver aspettato e legge «troncato» su sessioni
    # ancora vive. Misurato nella prima corsa vera, 2026-08-09.
    gov_avvia_lavoratore "${DIRS[$_i]}" "${CLUSTERS[$_i]}" "$MODO" \
                         "$CORSIA" "$ORE_MAX" "$BUDGET_GIRO" "$PERMESSI"
    FIGLI+=("$GOV_ULTIMO_PID")
    [[ -n "${CLUSTERS[$_i]}" ]] && log "  lavoratore $((_i + 1)) -> ${CLUSTERS[$_i]}  (${DIRS[$_i]})"
  done
  CODICE=0
  for _p in "${FIGLI[@]}"; do
    wait "$_p"; _e=$?
    (( _e > CODICE )) && CODICE=$_e
  done
  FIGLI=()
  DURATA=$(( $(date +%s) - INIZIO ))

  # --- si raccoglie ---------------------------------------------------------------
  # Una riga di giornale PER LAVORATORE, tutte nello stesso file: il tetto di spesa e'
  # cumulativo sulla corsa, non per lavoratore. Con un giornale a testa, due lavoratori
  # spenderebbero due volte il tetto senza che nessuno se ne accorga.
  OUT=""; PROSSIMO=""; TUTTI_FERMI=1; SOMMA_DURATE=0
  for _i in "${!DIRS[@]}"; do
    RACCOLTO="$(gov_raccogli_lavoratore "${DIRS[$_i]}")"
    IFS='|' read -r _out _costo _pross _dur <<< "$RACCOLTO"
    [[ -z "${_dur:-}" || "$_dur" == "0" ]] && _dur="$DURATA"   # nessuna misura propria: il giro
    if [[ "$_costo" == "0" || -z "$_costo" ]]; then
      log "ATTENZIONE: costo non estratto — il tetto di spesa non e' affidabile in questo giro"
      [[ -s "${DIRS[$_i]}/.zp/last-stderr.log" ]] &&
        log "  stderr: $(tail -1 "${DIRS[$_i]}/.zp/last-stderr.log" | cut -c1-120)"
    fi
    # I campi stringa si RIPULISCONO prima di finire in JSON. Un a capo o una
    # virgoletta dentro un valore spezzano la riga a meta', e chi legge la scarta in
    # silenzio: misurato il 2026-08-09, 12 righe su 16 di `runs.ndjson` erano tronche
    # (la prima finiva a `"cluster":"Z-230` piu' un a capo), quindi il registro aveva perso
    # il 75% dei dati e la spesa mostrata era sottostimata senza dirlo.
    _json_ok() { printf '%s' "${1//[$'\r\n\"']/}"; }
    _num_ok()  { case "${1:-}" in ''|*[!0-9.]*) printf '0' ;; *) printf '%s' "$1" ;; esac; }
    printf '{"giro":%d,"modo":"%s","lavoratore":%d,"cluster":"%s","esito":"%s","costo_usd":%s,"durata_s":%d,"exit":%d}\n' \
      "$GIRO" "$(_json_ok "$MODO")" "$((_i + 1))" "$(_json_ok "${CLUSTERS[$_i]}")" \
      "$(_json_ok "$_out")" "$(_num_ok "${_costo:-0}")" "$_dur" "$CODICE" >> "$GIRI"
    log "esito=$_out  costo=\$$_costo  durata=${_dur}s${CLUSTERS[$_i]:+  (${CLUSTERS[$_i]})}"
    [[ -n "${CLUSTERS[$_i]}" ]] && gov_lock_rilascia "$LOCKS" "${CLUSTERS[$_i]}"
    SOMMA_DURATE=$(( SOMMA_DURATE + _dur ))
    case "$_out" in nothing-to-do|blocked) ;; *) TUTTI_FERMI=0 ;; esac
    OUT="$_out"; PROSSIMO="$_pross"
  done
  # Con piu' lavoratori ci si ferma solo se lo dicono TUTTI: altrimenti basterebbe che
  # uno finisse il suo per chiudere la corsa lasciando gli altri a meta'.
  if (( ${#DIRS[@]} > 1 )); then
    if (( TUTTI_FERMI == 1 )); then OUT="nothing-to-do"; else OUT="cluster-closed"; PROSSIMO=""; fi
    # Il guadagno si MISURA: la somma delle durate e' quanto sarebbe costato in fila,
    # il tempo del giro e' quanto e' costato davvero. Nessuna promessa, un rapporto.
    log "giro in ${DURATA}s; in fila sarebbero stati ${SOMMA_DURATE}s -> guadagno $(awk -v a="$SOMMA_DURATE" -v b="$DURATA" 'BEGIN{if(b>0) printf "%.2f", a/b; else print "n/d"}')x"
    for _i in "${!DIRS[@]}"; do
      log "  il lavoro del lavoratore $((_i + 1)) e' sul ramo gov/w$((_i + 1)) (${DIRS[$_i]})"
    done
  fi
  "$PY" docs/kb/tools/zp_state.py progress --lane "$CORSIA" >/dev/null 2>&1

  case "$OUT" in
    cluster-closed|session-closed) MODO="resume" ;;
    cluster-interrupted)           MODO="resume" ;;
    troncato)                      MODO="recover"; log "nessun esito scritto: troncamento, non fallimento" ;;
    nothing-to-do|blocked)         log "la skill dice di fermarsi ($OUT)"; break ;;
    *)                             MODO="resume" ;;
  esac
  [[ "$PROSSIMO" == "stop" ]] && { log "la skill chiede di fermarsi"; break; }
done

log "fine: $GIRO giri, \$$(spesa_totale) spesi in tutto"
[[ -f "$ZP/PROGRESS.md" ]] && log "rapporto in .zp/PROGRESS.md"
exit 0
