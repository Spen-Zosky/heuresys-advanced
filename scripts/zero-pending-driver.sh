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

# --- apertura e raccolta della sessione ------------------------------------------
#
# Stanno qui, e non altrove, perche' il driver non si puo' far partire per provarlo:
# all'avvio si ferma sui guard-rail. Il comando e' sostituibile con ZP_CLAUDE_CMD,
# cosi' una batteria puo' mettere al posto di `claude` un finto che scrive un esito e
# muore — e provare l'orchestrazione senza aprire sessioni vere.

avvia_sessione() {           # <modo> <corsia> <ore> <budget> <permessi> -> pid in ULTIMO_PID
  local modo="$1" corsia="$2" ore="$3" budget="$4" permessi="$5"

  mkdir -p "$REPO/.zp"
  # Si cancella l'esito PRIMA: se resta quello del giro precedente, una sessione
  # troncata verrebbe letta come una che ha chiuso bene.
  rm -f "$REPO/.zp/last-outcome.json" "$REPO/.zp/durata-s"

  # stderr su FILE e non mescolato allo stdout: con `2>&1` una riga di warning rompe
  # il JSON, il costo torna 0 e il tetto di spesa non scatta mai (rilievo B3).
  #
  # PERCHE' `MSYS2_ARG_CONV_EXCL` E NON `MSYS_NO_PATHCONV`. Git Bash traduce gli
  # argomenti che sembrano percorsi Unix quando lancia un eseguibile Windows: senza
  # difese, `/zero-pending-loop ...` arriva a claude come `C:/Git/zero-pending-loop`
  # e la skill non viene mai invocata. Ma `MSYS_NO_PATHCONV=1` spegne la traduzione
  # per TUTTO e resta nell'ambiente della sessione figlia — dove gli hook del progetto
  # ricevono `/d/...` non convertito e non trovano piu' i propri file: misurato, la
  # sessione moriva a zero turni con «can't open file D:\d\...». Questa forma esclude
  # il SOLO comando slash e lascia intatto il resto.
  ( cd "$REPO"
    _t0=$(date +%s)
    MSYS2_ARG_CONV_EXCL="/zero-pending-loop" "${ZP_CLAUDE_CMD:-claude}" -p \
      "/zero-pending-loop $modo --lane $corsia --budget-ore $ore" \
      --output-format json --max-budget-usd "$budget" --permission-mode "$permessi" \
      > ".zp/last-response.json" 2> ".zp/last-stderr.log"
    echo $(( $(date +%s) - _t0 )) > ".zp/durata-s"
  ) &
  # Il pid si consegna in una VARIABILE, non su stdout. Con `$( )` la funzione girerebbe
  # in una sottoshell: il figlio sarebbe suo e non del driver, e `wait` risponderebbe
  # «pid non e' un figlio di questa shell» (exit 127) — il driver crederebbe di aver
  # aspettato e leggerebbe «troncato» su una sessione ancora viva.
  ULTIMO_PID=$!
}

raccogli_sessione() {        # -> "esito|costo|prossimo|durata_s"
  local py="${ZP_PYTHON:-python}"
  local costo esito prossimo durata

  # Sempre da dentro il repo, con percorsi RELATIVI: in Git Bash un percorso assoluto
  # e' in forma MSYS (/d/...) e Python su Windows non sa aprirlo.
  costo="$( cd "$REPO" && "$py" -c "
import json,sys
try: print(json.load(sys.stdin).get('total_cost_usd') or 0)
except Exception: print(0)" < ".zp/last-response.json" 2>/dev/null || echo 0 )"

  if [[ -f "$REPO/.zp/last-outcome.json" ]]; then
    esito="$( cd "$REPO" && "$py" -c "
import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('outcome',''))" 2>/dev/null )"
    prossimo="$( cd "$REPO" && "$py" -c "
import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('next',''))" 2>/dev/null )"
  else
    esito="troncato"; prossimo="recover"
  fi
  durata="$(cat "$REPO/.zp/durata-s" 2>/dev/null || echo 0)"
  case "$durata" in ''|*[!0-9]*) durata=0 ;; esac
  printf '%s|%s|%s|%s\n' "${esito:-troncato}" "${costo:-0}" "${prossimo:-}" "$durata"
}

ZP="$REPO/.zp"
LOCK="$ZP/driver.lock"
STOP="$ZP/STOP"
CURSORE="$ZP/cursor.json"
ESITO="$ZP/last-outcome.json"
GIRI="$ZP/runs.ndjson"
CFG="$REPO/.claude/skills/zero-pending-loop/references/zp.config.yaml"
PY="${ZP_PYTHON:-python}"

CORSIA="safe"; MAX_ITER=""; FINESTRA=""; DRY=0; PERMESSI=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lane)            CORSIA="$2"; shift 2 ;;
    --max-iterations)  MAX_ITER="$2"; shift 2 ;;
    --window)          FINESTRA="$2"; shift 2 ;;
    --permission-mode) PERMESSI="$2"; shift 2 ;;
    --budget-usd)      BUDGET_CHIESTO="$2"; shift 2 ;;
    --tetto-usd)       TETTO_CHIESTO="$2"; shift 2 ;;
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

# ---------------------------------------------------------------- guard-rail

[[ -f "$STOP" ]] && { log "il freno e' tirato ($STOP). Togli il file e rilancia."; exit 0; }

# IL FRENO GOVERNA IL NON PRESIDIATO — ed e' cio' che il suo nome dice.
#
# [S1052, decisione di Enzo] Fino a oggi `meta.autorizzato_non_presidiato` fermava OGNI
# corsa, anche una sorvegliata. Ne nasceva un blocco circolare, misurato: il freno
# pretendeva `Z-250` chiuso · `Z-250` si chiude solo con «una corsa presidiata conclusa»
# registrata in `runs.ndjson` · quella corsa la fa questo driver · questo driver era
# fermato dal freno. La condizione pretendeva l'effetto prima della causa, quindi non
# proteggeva: bloccava e basta.
#
# Ora una corsa in corsia `full-presidiata` non passa da questo cancello. NON e' un
# aggiramento: il non presidiato resta bloccato esattamente come prima, e il presidio e'
# la garanzia che il nome del freno gia' presupponeva. Gli altri guard-rail — cluster
# classificati, strumenti presenti, repo pulito, lock, STOP — restano in vigore per
# tutti, questa corsia compresa.
PRESIDIATA=0
[[ "$CORSIA" == "full-presidiata" ]] && PRESIDIATA=1

AUTORIZZATO="$(cfg meta.autorizzato_non_presidiato)"
if [[ "$PRESIDIATA" == "1" ]]; then
  log "corsia PRESIDIATA: il freno 'autorizzato_non_presidiato' non si applica (governa il non presidiato)."
  log "  il freno resta INSERITO per ogni altra corsia; gli altri guard-rail valgono anche qui."
elif [[ "$AUTORIZZATO" != "True" && "$AUTORIZZATO" != "true" ]]; then
  log "freno di sicurezza inserito (meta.autorizzato_non_presidiato: false)."
  log "La review CLI del 2026-07-25 ha lasciato aperti rilievi che rendono l'esecuzione"
  log "non presidiata rischiosa: classificazione che ammette cluster di produzione in"
  log "corsia safe, prove autodichiarate, self-test che non vede le regressioni."
  log "L'elenco e la condizione per togliere il freno sono in zp.config.yaml (meta)."
  log "Per una corsa SORVEGLIATA: --lane full-presidiata (non tocca il freno)."
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
# [S1052] E il RAPPORTO CHE IL DRIVER SCRIVE DA SE'. `.zp/PROGRESS.md` e' tracciato e
# viene riscritto a ogni giro (`zp_state.py progress`): finita una corsa, il file
# risulta modificato e la corsa SUCCESSIVA si rifiutava di partire — il driver
# produceva da solo la condizione che gli impediva di ripartire, e due corse
# consecutive erano impossibili senza un commit a mano. Misurato lanciando la seconda
# corsa presidiata: exit 4 con « M .zp/PROGRESS.md» come unico motivo.
# Si esclude SOLO questo file, e solo se modificato: qualunque altro file tracciato
# resta sporco, come deve.
IGNORABILI_PROPRI='^ ?M+ +\.zp/PROGRESS\.md$'
SPORCO="$(git status --porcelain | grep -Ev "$IGNORABILI" | grep -Ev "$IGNORABILI_PROPRI" || true)"
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
trap 'mio_lock && rm -f "$LOCK"' EXIT
trap 'log "segnale ricevuto: fermo la sessione in volo"; for _p in ${FIGLI[@]+"${FIGLI[@]}"}; do kill -TERM "$_p" 2>/dev/null; done; mio_lock && rm -f "$LOCK"; exit 143' INT TERM

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
  # Si guarda il GIORNALE, non l'ultimo esito: il giornale lo scrive il driver e cresce
  # a ogni giro, mentre l'esito puo' restare fermo e far rientrare da bootstrap a ogni
  # corsa per un file che nessuno aggiorna piu'.
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

  # --- si apre la sessione --------------------------------------------------------
  # Il lucchetto della suite protegge il DATABASE, non la cartella: due suite sullo
  # stesso PostgreSQL si contendono lock e connessioni e producono rossi che non sono
  # difetti (misurato il 2026-08-05: 14 file caduti su 232, nessun test fallito).
  export SUITE_LOCK_FILE="$ZP/suite.lock"

  INIZIO=$(date +%s)
  # SENZA $( ): la sostituzione di comando crea una sottoshell, e il figlio lanciato
  # li' dentro non e' figlio del driver — `wait` risponde «non e' un mio figlio» (127),
  # il driver crede di aver aspettato e legge «troncato» su una sessione ancora viva.
  avvia_sessione "$MODO" "$CORSIA" "$ORE_MAX" "$BUDGET_GIRO" "$PERMESSI"
  FIGLI=("$ULTIMO_PID")
  wait "$ULTIMO_PID"; CODICE=$?
  FIGLI=()
  DURATA=$(( $(date +%s) - INIZIO ))

  # --- si raccoglie ---------------------------------------------------------------
  OUT=""; PROSSIMO=""; TUTTI_FERMI=1; SOMMA_DURATE=0
  for _i in 0; do
    RACCOLTO="$(raccogli_sessione)"
    IFS='|' read -r _out _costo _pross _dur <<< "$RACCOLTO"
    [[ -z "${_dur:-}" || "$_dur" == "0" ]] && _dur="$DURATA"   # nessuna misura propria: il giro
    if [[ "$_costo" == "0" || -z "$_costo" ]]; then
      log "ATTENZIONE: costo non estratto — il tetto di spesa non e' affidabile in questo giro"
      [[ -s "$REPO/.zp/last-stderr.log" ]] &&
        log "  stderr: $(tail -1 "$REPO/.zp/last-stderr.log" | cut -c1-120)"
    fi
    # I campi stringa si RIPULISCONO prima di finire in JSON. Un a capo o una
    # virgoletta dentro un valore spezzano la riga a meta', e chi legge la scarta in
    # silenzio: misurato il 2026-08-09, 12 righe su 16 di `runs.ndjson` erano tronche
    # (la prima finiva a `"cluster":"Z-230` piu' un a capo), quindi il registro aveva perso
    # il 75% dei dati e la spesa mostrata era sottostimata senza dirlo.
    _json_ok() { printf '%s' "${1//[$'\r\n\"']/}"; }
    _num_ok()  { case "${1:-}" in ''|*[!0-9.]*) printf '0' ;; *) printf '%s' "$1" ;; esac; }
    printf '{"giro":%d,"modo":"%s","esito":"%s","costo_usd":%s,"durata_s":%d,"exit":%d}\n' \
      "$GIRO" "$(_json_ok "$MODO")" \
      "$(_json_ok "$_out")" "$(_num_ok "${_costo:-0}")" "$_dur" "$CODICE" >> "$GIRI"
    log "esito=$_out  costo=\$$_costo  durata=${_dur}s"
    SOMMA_DURATE=$(( SOMMA_DURATE + _dur ))
    case "$_out" in nothing-to-do|blocked) ;; *) TUTTI_FERMI=0 ;; esac
    OUT="$_out"; PROSSIMO="$_pross"
  done
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
