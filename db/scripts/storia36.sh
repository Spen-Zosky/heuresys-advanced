#!/usr/bin/env bash
# ============================================================================
# db/scripts/storia36.sh — entrypoint UNICO del programma storia36
# Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (sezione "tre modi")
#
# Modi:
#   costruzione                     — esegue i seed db/seeds/storia36/*.sql in ordine
#                                     lessicale (ognuno idempotente) + custodia finale.
#                                     Exit != 0 finché la batteria non è tutta verde
#                                     (attesa: verde pieno solo a fine C12).
#   custodia [--repair-missing]     — ri-esegue TUTTE le batterie sul DB com'è OGGI e
#                                     produce qa_artifacts/storia36/custodia-<data>.md
#                                     con triage a 3 esiti da compilare per ogni rosso.
#                                     --repair-missing: ri-esegue prima i seed (idempotenti:
#                                     ricreano SOLO ciò che manca), poi verifica.
#   avanzamento [--window-end=...]  — estende la storia dalle punte in cui si è
#                                     fermata fino a IERI (o alla data data), con
#                                     le stesse regole e le stesse chiavi naturali
#                                     della costruzione: presenze, assenze, buste
#                                     paga e handoff dei mesi interi; poi ri-esegue
#                                     07_approvals.sql, che DERIVA le approvazioni
#                                     dai fatti nuovi; poi la custodia.
#                                     Idempotente: due corse di fila = 0 righe.
#
# Flag comuni: --window-end=YYYY-MM-DD (default: calcolato nel SQL = FINE MESE
#   CORRENTE — il DB è produzione viva, i dati organici del mese in corso non
#   sono violazioni; mai una costante nei check).
# La custodia esegue anche i SELFTEST (falsificabilità dei check).
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"

log()  { echo "[storia36] $*"; }
err()  { echo "[storia36] ERRORE: $*" >&2; }

usage() {
  grep '^#' "$0" | sed -n '2,31p' | sed 's/^# \{0,1\}//'
}

[[ -f "$ENV_FILE" ]] || { err ".env non trovato: $ENV_FILE"; exit 1; }
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a
: "${POSTGRES_HOST:?POSTGRES_HOST mancante in .env}"
: "${POSTGRES_PORT:?POSTGRES_PORT mancante in .env}"
: "${POSTGRES_DB:?POSTGRES_DB mancante in .env}"
: "${POSTGRES_USER:?POSTGRES_USER mancante in .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD mancante in .env}"
export PGPASSWORD="$POSTGRES_PASSWORD"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -v ON_ERROR_STOP=1)

MODE="${1:-}"
[[ -n "$MODE" ]] && shift || true
WINDOW_END=""
REPAIR=0
FORZA=0
for arg in "$@"; do
  case "$arg" in
    --repair-missing)  REPAIR=1 ;;
    --forza)           FORZA=1 ;;
    --window-end=*)    WINDOW_END="${arg#*=}" ;;
    *) err "flag sconosciuto: $arg"; usage; exit 1 ;;
  esac
done

WFLAG=()
[[ -n "$WINDOW_END" ]] && WFLAG=(-v "window_end=$WINDOW_END")

ADV_SEED="13_avanzamento.sql"

run_seeds() {
  local n=0
  for f in "$REPO_ROOT"/db/seeds/storia36/*.sql; do
    [[ -e "$f" ]] || { err "nessun seed in db/seeds/storia36/"; exit 1; }
    # l'avanzamento è un MODO a sé (finestra mobile), non un passo della
    # costruzione: la costruzione produce la finestra storica progettata,
    # l'avanzamento la porta a ieri quando lo si chiede.
    [[ "$(basename "$f")" == "$ADV_SEED" ]] && continue
    log "seed: $(basename "$f")"
    "${PSQL[@]}" -f "$f"
    n=$((n+1))
  done
  log "seed eseguiti: $n (tutti idempotenti — ri-esecuzione = delta 0)"
  log "nota: $ADV_SEED non fa parte della costruzione — usare 'storia36.sh avanzamento'"
}

# Estende la storia fino a ieri (o a --window-end) e ri-deriva ciò che dipende
# dai fatti nuovi. Ogni passo è idempotente: una seconda corsa scrive 0 righe.
avanzamento() {
  # ------------------------------------------------------------------------
  # GUARDIA (D-STORIA-B, Enzo 2026-08-24 — voce #226)
  #
  # L'avanzamento SCRIVE, e il bersaglio viene dal .env DELLA MACCHINA (righe
  # 44-52). Sul gemello di produzione (linux-pc) quel .env punta al CLONE, che
  # `clone-vm-db.sh` sovrascrive e che deve restare 1:1 con la produzione: un
  # clone che si scrive la propria storia diverge, e chi confronta le due
  # macchine vede differenze che non esistono (e' la specie di D-86).
  #
  # Il timer NON e' installato "solo sulla VM": `scripts/vm-deploy.sh` (righe
  # 268-278) installa e fa `enable --now` di OGNI unit di deploy/systemd/ su
  # ENTRAMBE le macchine. E' voluto — questa guardia e' cio' che rende innocua
  # l'installazione sul gemello, dove l'unit gira ogni notte e non scrive nulla.
  #
  # Perche' il .env e non il nome dell'host: un controllo su hostname sarebbe
  # D-39 un'altra volta («due default che valevano su una macchina sola»), gia'
  # corretto derivando host e utente invece di cablarli. E il default e' NON
  # scrivere: una macchina nuova non comincia da se' ad allungare una storia.
  #
  # `:-0` NON e' cosmetico: lo script ha `set -euo pipefail`, e un riferimento
  # nudo a una variabile assente abortirebbe con exit != 0 — cioe' un timer
  # FALLITO ogni notte sul gemello, che e' esattamente il rumore che questa
  # guardia deve evitare. Qui si esce 0, dicendolo.
  #
  # `--forza` copre il lancio a mano: `avanzamento` e' un comando documentato
  # nel CLAUDE.md, quindi ci si arriva anche per copia-incolla sulla macchina
  # sbagliata. Una guardia che coprisse solo il timer lascerebbe aperta la
  # strada piu' probabile per un errore umano.
  # ------------------------------------------------------------------------
  if [[ "${STORIA36_AVANZAMENTO:-0}" != "1" && "$FORZA" -eq 0 ]]; then
    log "avanzamento NON eseguito: questa macchina non lo dichiara."
    log "  STORIA36_AVANZAMENTO non vale 1 in $ENV_FILE"
    log "  bersaglio che avrebbe scritto: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
    log "  E' il comportamento previsto ovunque tranne che sulla produzione: su un"
    log "  clone la storia divergerebbe senza che nessuno se ne accorga."
    log "  Per eseguirlo comunque da questa macchina, ora: --forza"
    return 0
  fi
  if [[ "$FORZA" -eq 1 && "${STORIA36_AVANZAMENTO:-0}" != "1" ]]; then
    log "avanzamento FORZATO (--forza) su una macchina che non lo dichiara —"
    log "  bersaglio: $POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
  fi

  local adv="$REPO_ROOT/db/seeds/storia36/$ADV_SEED"
  local appr="$REPO_ROOT/db/seeds/storia36/07_approvals.sql"
  [[ -f "$adv" ]] || { err "$ADV_SEED non trovato"; exit 1; }

  log "avanzamento: estendo la storia (finestra: ${WINDOW_END:-ieri})"
  "${PSQL[@]}" "${WFLAG[@]}" -f "$adv"

  # Ciò che è DERIVATO dai fatti non si riscrive qui: si ri-esegue il seed che
  # possiede la regola (tutti idempotenti — sui fatti vecchi scrivono 0 righe).
  # Regola anti-drift AP-01: una regola, un posto solo.
  #   01 → i saldi ferie seguono le presenze nuove
  #   04 → la maturita' di una lacuna si misura sulla FRONTIERA, non
  #        sull'orologio: spostandola, lacune che erano recenti diventano mature
  #        e le loro azioni non possono restare «proposte» (check C4f). La
  #        regola che le fa evolvere vive nel C4 e legge la frontiera da se'
  #        (`staging.storia36_c4_frontier()`), quindi si ri-esegue il seed
  #        invece di duplicarne la regola qui. Aggiunto il 2026-08-08: senza,
  #        ogni avanzamento lasciava C4f rosso e la custodia falliva.
  #   07 → le approvazioni nascono dalle richieste nuove
  # L'ordine conta: 04 prima di 07, perche' le approvazioni delle edizioni
  # formative derivano dalle edizioni che il 04 puo' aver appena creato.
  local derived=(
    "$REPO_ROOT/db/seeds/storia36/01_attendance_timeoff.sql"
    "$REPO_ROOT/db/seeds/storia36/04_learning.sql"
    "$appr"
  )
  for d in "${derived[@]}"; do
    [[ -f "$d" ]] || continue
    log "avanzamento: ri-derivo da $(basename "$d")"
    "${PSQL[@]}" -f "$d"
  done

  log "avanzamento: verifico con la custodia"
  custodia
}

# Esegue una batteria di verifica SENZA abortire lo script; ritorna l'exit psql.
# Output completo accodato a $2 (log grezzo per il report).
run_battery() {
  local file="$1" rawlog="$2" rc=0
  log "batteria: $(basename "$file")"
  "${PSQL[@]}" "${WFLAG[@]}" -v selftest=1 -f "$file" >>"$rawlog" 2>&1 || rc=$?
  return $rc
}

# ----------------------------------------------------------------------------
# Retention dei report della custodia (D-STORIA-B, #226).
# Con la cadenza GIORNALIERA dell'avanzamento (che termina chiamando custodia)
# questa directory guadagna un file al giorno: ~30 al mese, senza fine. Sono
# gitignored (.gitignore:123), quindi non sporcano l'albero di lavoro, ma
# nessuno li pota. Si tengono gli ultimi $KEEP.
#
# Tre precauzioni, perche' qui si cancella:
#   · la selezione e' un ELENCO costruito, non un jolly passato a rm;
#   · ogni nome deve combaciare con custodia-YYYY-MM-DD.md ESATTO — un file
#     messo li' a mano da una persona non viene toccato;
#   · i nomi sono ISO, quindi l'ordine lessicale del glob E' quello cronologico
#     e i primi dell'elenco sono i piu' vecchi.
# Non serve un rollback: il report si ri-genera eseguendo la custodia.
# ----------------------------------------------------------------------------
prune_reports() {
  local dir="$REPO_ROOT/qa_artifacts/storia36" keep=30 f n
  local buoni=() vecchi=()
  shopt -s nullglob
  # Si FILTRA prima e si conta dopo. L'ordine opposto e' un difetto vero, visto
  # rosso sul banco di prova il 2026-08-24: il glob `custodia-*.md` cattura anche
  # un file che la guardia sul nome poi salva (es. `custodia-NOTE-di-enzo.md`),
  # e contando prima del filtro `n` risultava piu' grande del dovuto — su 35
  # report + 1 estraneo ne cancellava 6 invece di 5, lasciandone 29 invece di 30.
  # Un errore silenzioso: nessun messaggio, solo un report in meno.
  for f in "$dir"/custodia-*.md; do
    [[ "$(basename "$f")" =~ ^custodia-[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$ ]] || continue
    buoni+=("$f")
  done
  shopt -u nullglob
  (( ${#buoni[@]} > keep )) || return 0
  n=$(( ${#buoni[@]} - keep ))
  # nomi ISO: l'ordine lessicale del glob E' quello cronologico, i primi sono i
  # piu' vecchi. Si cancella un ELENCO costruito, mai un jolly passato a rm.
  vecchi=("${buoni[@]:0:$n}")
  rm -f -- "${vecchi[@]}"
  log "retention: rimossi ${#vecchi[@]} report oltre gli ultimi $keep"
}

custodia() {
  local today report rawlog overall=0
  today="$(date +%F)"
  mkdir -p "$REPO_ROOT/qa_artifacts/storia36"
  report="$REPO_ROOT/qa_artifacts/storia36/custodia-$today.md"
  rawlog="$(mktemp)"

  if [[ "$REPAIR" -eq 1 ]]; then
    # #189 — le funzioni staging.storia36_check_* PRIMA dei seed, non dopo.
    # Dodici seed su quattordici le invocano come post-condizione, ma a crearle e' la
    # batteria, che gira dopo: su un database dove una di quelle funzioni non c'e'
    # ancora la riparazione si spezza a meta' e non e' atomica (misurato in S1062 su
    # 06_reorg.sql -> storia36_check_c6a). Caricarle prima costa una frazione di secondo
    # ed e' idempotente: sono tutte CREATE OR REPLACE.
    log "--repair-missing: carico le funzioni di verifica PRIMA dei seed (#189)"
    "${PSQL[@]}" "${WFLAG[@]}" -v solo_definizioni=1 -q \
      -f "$SCRIPT_DIR/verify-storia36.sql" >/dev/null \
      || { err "impossibile creare le funzioni di verifica: la riparazione si fermerebbe a meta'"; exit 1; }
    log "--repair-missing: ri-eseguo i seed (idempotenti) prima della verifica"
    run_seeds
  fi

  local batteries=(
    "$SCRIPT_DIR/verify-storia36.sql"
    "$SCRIPT_DIR/verify-storia36-dossier.sql"
    "$SCRIPT_DIR/verify-storia36-person.sql"
  )
  declare -A results
  for b in "${batteries[@]}"; do
    if [[ ! -f "$b" ]]; then
      results["$(basename "$b")"]="SKIP (non ancora creata — arriva con i cluster)"
      continue
    fi
    echo "===== $(basename "$b") =====" >>"$rawlog"
    if run_battery "$b" "$rawlog"; then
      results["$(basename "$b")"]="VERDE"
    else
      results["$(basename "$b")"]="ROSSO"
      overall=1
    fi
  done

  {
    echo "# storia36 — custodia $today"
    echo
    echo "> Generato da \`db/scripts/storia36.sh custodia\`. Finestra: ${WINDOW_END:-"default (fine mese corrente, calcolata nel SQL)"}."
    echo "> Triage OBBLIGATORIO a tre esiti per ogni check rosso:"
    echo "> (a) **dato mancante** → \`--repair-missing\` (i seed ricreano SOLO ciò che manca)"
    echo "> (b) **check troppo rigido** smentito da evoluzione legittima → si corregge il CHECK, non il dato (nota qui)"
    echo "> (c) **rottura vera** → item di riparazione nel register."
    echo "> MAI riparazione automatica di righe modificate: \`staging.storia36_runs\` + chiavi \`STORIA36::\` dicono cosa era seminato."
    echo
    echo "## Esito batterie"
    echo
    echo "| Batteria | Esito |"
    echo "|---|---|"
    for b in "${batteries[@]}"; do
      echo "| $(basename "$b") | ${results[$(basename "$b")]} |"
    done
    echo
    echo "## Dettaglio check ([OK]/[ROSSO] dalle batterie)"
    echo
    echo '```'
    grep -E '\[OK\]|\[ROSSO\]|SELFTEST|EXCEPTION|ERROR' "$rawlog" || true
    echo '```'
    echo
    echo "## Triage dei rossi (compilare: esito a/b/c + azione)"
    echo
    if [[ "$overall" -eq 0 ]]; then
      echo "_Nessun rosso — niente da triagare._"
    else
      grep -E '\[ROSSO\]' "$rawlog" | sed 's/^/- [ ] DA TRIAGARE: /' || true
    fi
    echo
    echo "<details><summary>Log grezzo completo</summary>"
    echo
    echo '```'
    cat "$rawlog"
    echo '```'
    echo "</details>"
  } >"$report"

  rm -f "$rawlog"
  log "report: ${report#"$REPO_ROOT"/}"
  prune_reports
  if [[ "$overall" -eq 0 ]]; then
    log "custodia VERDE"
  else
    err "custodia con check ROSSI — triage richiesto nel report"
  fi
  return $overall
}

case "$MODE" in
  costruzione)
    run_seeds
    custodia
    ;;
  custodia)
    custodia
    ;;
  avanzamento)
    avanzamento
    ;;
  *)
    usage
    exit 1
    ;;
esac
