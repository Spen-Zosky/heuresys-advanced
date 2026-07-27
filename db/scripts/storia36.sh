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
#   avanzamento                     — estende la storia al mese corrente (finestra MOBILE).
#                                     NON ANCORA DISPONIBILE — arriva col C12.
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
  grep '^#' "$0" | sed -n '2,25p' | sed 's/^# \{0,1\}//'
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
for arg in "$@"; do
  case "$arg" in
    --repair-missing)  REPAIR=1 ;;
    --window-end=*)    WINDOW_END="${arg#*=}" ;;
    *) err "flag sconosciuto: $arg"; usage; exit 1 ;;
  esac
done

WFLAG=()
[[ -n "$WINDOW_END" ]] && WFLAG=(-v "window_end=$WINDOW_END")

run_seeds() {
  local n=0
  for f in "$REPO_ROOT"/db/seeds/storia36/*.sql; do
    [[ -e "$f" ]] || { err "nessun seed in db/seeds/storia36/"; exit 1; }
    log "seed: $(basename "$f")"
    "${PSQL[@]}" -f "$f"
    n=$((n+1))
  done
  log "seed eseguiti: $n (tutti idempotenti — ri-esecuzione = delta 0)"
}

# Esegue una batteria di verifica SENZA abortire lo script; ritorna l'exit psql.
# Output completo accodato a $2 (log grezzo per il report).
run_battery() {
  local file="$1" rawlog="$2" rc=0
  log "batteria: $(basename "$file")"
  "${PSQL[@]}" "${WFLAG[@]}" -v selftest=1 -f "$file" >>"$rawlog" 2>&1 || rc=$?
  return $rc
}

custodia() {
  local today report rawlog overall=0
  today="$(date +%F)"
  mkdir -p "$REPO_ROOT/qa_artifacts/storia36"
  report="$REPO_ROOT/qa_artifacts/storia36/custodia-$today.md"
  rawlog="$(mktemp)"

  if [[ "$REPAIR" -eq 1 ]]; then
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
    err "avanzamento: non ancora disponibile — cluster C12 richiesto (estensione mensile della storia, finestra mobile)"
    exit 2
    ;;
  *)
    usage
    exit 1
    ;;
esac
