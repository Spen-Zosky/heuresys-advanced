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

SPORCO="$(git status --porcelain | grep -v '^?? \.zp/' || true)"
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
trap 'mio_lock && rm -f "$LOCK"' EXIT
trap 'log "segnale ricevuto: fermo la sessione in volo"; [[ -n "${FIGLIO:-}" ]] && kill -TERM "$FIGLIO" 2>/dev/null; mio_lock && rm -f "$LOCK"; exit 143' INT TERM

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
elif [[ -f "$ESITO" ]]; then
  ULTIMA=$(( ( $(date +%s) - $(stat -c %Y "$ESITO" 2>/dev/null || echo 0) ) / 3600 ))
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

  rm -f "$ESITO"
  INIZIO=$(date +%s)
  # stderr su FILE, non mescolato allo stdout (rilievo B3). Con `2>&1` una sola riga di
  # warning rompeva il JSON, il costo finiva a 0 e il tetto di spesa non scattava mai:
  # misurato, due sessioni da $11.87 contabilizzate $0.00. Il prompt porta anche la
  # CORSIA, che prima non arrivava alla sessione (B5): la sessione sceglieva da sola il
  # default `safe` — una speranza, non una garanzia.
  claude -p "/zero-pending-loop $MODO --lane $CORSIA --budget-ore $ORE_MAX" \
      --output-format json \
      --max-budget-usd "$BUDGET_GIRO" \
      --permission-mode "$PERMESSI" \
      > "$ZP/last-response.json" 2> "$ZP/last-stderr.log" &
  FIGLIO=$!
  wait "$FIGLIO"; CODICE=$?
  FIGLIO=""
  DURATA=$(( $(date +%s) - INIZIO ))

  # parsing via STDIN, non via argv: la riga di comando di Windows si ferma a ~32.767
  # caratteri e una risposta di sessione la supera senza sforzo (misurato: 32.625 passa,
  # 32.687 no). Oltre quel limite il comando falliva e il costo tornava 0, cioe' lo stesso
  # effetto del JSON rotto: tetto di spesa decorativo.
  COSTO="$("$PY" -c "
import json,sys
try: print(json.load(sys.stdin).get('total_cost_usd') or 0)
except Exception: print(0)" < "$ZP/last-response.json" 2>/dev/null || echo 0)"
  if [[ "$COSTO" == "0" || -z "$COSTO" ]]; then
    log "ATTENZIONE: costo non estratto dalla risposta — il tetto di spesa non e' affidabile in questo giro"
    [[ -s "$ZP/last-stderr.log" ]] && log "  stderr: $(tail -1 "$ZP/last-stderr.log" | cut -c1-120)"
  fi

  if [[ -f "$ESITO" ]]; then
    OUT="$("$PY" -c "import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('outcome',''))" 2>/dev/null)"
    PROSSIMO="$("$PY" -c "import json;print(json.load(open('.zp/last-outcome.json',encoding='utf-8')).get('next',''))" 2>/dev/null)"
  else
    OUT="troncato"; PROSSIMO="recover"
  fi

  printf '{"giro":%d,"modo":"%s","esito":"%s","costo_usd":%s,"durata_s":%d,"exit":%d}\n' \
    "$GIRO" "$MODO" "$OUT" "${COSTO:-0}" "$DURATA" "$CODICE" >> "$GIRI"

  log "esito=$OUT  costo=\$$COSTO  durata=${DURATA}s"
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
