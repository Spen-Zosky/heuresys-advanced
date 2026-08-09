#!/usr/bin/env bash
# gov-chiudi.sh — il controllo finale di un lavoro, eseguito da GOV.
#
# REGOLA DI ENZO (2026-08-09, ribadita)
# ------------------------------------
#   «un worker committa nel suo ramo ma non ha facolta' di trasferire su main e di
#    fare operazioni sul repo github. Tutte le attivita' di controllo finale e di
#    effettiva chiusura sono responsabilita' della sessione gov che ha lanciato il
#    runner e i worker.»
#
# Quindi: cio' che un lavoratore scrive in `last-outcome.json` e' una PROPOSTA.
# Questo comando e' l'istruttoria che la accetta o la respinge — e la fa girare gov,
# nel repo principale, con gli stessi cancelli di una sessione canonica.
#
# COSA NON FA, MAI
# ----------------
# Non fa merge. Non tocca main. Non pubblica. Produce un VERDETTO scritto; portare
# il lavoro su main resta un atto separato, presidiato, che qualcuno decide dopo
# aver letto il verdetto.
#
# COME SI LEGGE L'ESITO
# ---------------------
#   0  verdetto VERDE   — il lavoro regge a tutti i controlli
#   1  verdetto ROSSO   — almeno un controllo ha detto no (il motivo e' nel verdetto)
#   2  non istruibile   — manca qualcosa per giudicare (ramo assente, esito assente)
#
# Un verdetto verde NON significa «portalo su main»: significa «non ho trovato
# ragioni per non farlo». La differenza conta.
#
#   bash scripts/gov-chiudi.sh 2                    # il lavoratore 2
#   bash scripts/gov-chiudi.sh 2 --veloce           # salta i test (istruttoria parziale)
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 2
# shellcheck source=/dev/null
. "$REPO/scripts/gov-lib.sh"
PY="${ZP_PYTHON:-python}"

N="${1:-}"; shift || true
VELOCE=0
for a in "$@"; do [[ "$a" == "--veloce" ]] && VELOCE=1; done
[[ -n "$N" ]] || { echo "uso: gov-chiudi.sh <numero-lavoratore> [--veloce]" >&2; exit 2; }

ALBERO="$(gov_worktree_base "$REPO")/w$N"
RAMO="gov/w$N"
VERDETTI="$REPO/.zp/verdetti"; mkdir -p "$VERDETTI"

log()  { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }
RILIEVI=()
rilievo() { RILIEVI+=("$1"); log "  ROSSO: $1"; }

[[ -d "$ALBERO" ]] || { log "non istruibile: l'albero $ALBERO non esiste"; exit 2; }

# --- di chi e' questo lavoro -------------------------------------------------
CLUSTER="$( "$PY" -c "
import json,sys
try: print(json.load(open(sys.argv[1],encoding='utf-8')).get('cluster',''))
except Exception: print('')" "$ALBERO/.zp/incarico.json" 2>/dev/null )"
ESITO_PROPOSTO="$( "$PY" -c "
import json,sys
try: print(json.load(open(sys.argv[1],encoding='utf-8')).get('outcome',''))
except Exception: print('')" "$ALBERO/.zp/last-outcome.json" 2>/dev/null )"

log "istruttoria del lavoratore $N — cluster ${CLUSTER:-?} — propone «${ESITO_PROPOSTO:-nessun esito}»"

# --- 1. il perimetro: cio' che ha DAVVERO toccato ----------------------------
# Prima di qualunque test. Se ha lavorato fuori dal recinto, il resto e' rumore:
# non si sa nemmeno se ha pestato i piedi a un altro lavoratore.
if [[ -n "$CLUSTER" ]]; then
  FUORI="$(gov_fuori_perimetro "$REPO" "$ALBERO" "$CLUSTER")"
  if [[ -n "$FUORI" ]]; then
    rilievo "ha toccato $(echo "$FUORI" | grep -c .) file fuori dal perimetro dichiarato:"
    echo "$FUORI" | sed 's/^/           /'
  else
    log "  perimetro rispettato"
  fi
else
  rilievo "nessun incarico nell'albero: non si sa quale perimetro doveva rispettare"
fi

# --- 2. il diario: cosa e' successo davvero ----------------------------------
DIARIO="$ALBERO/.zp/diario.ndjson"
if [[ -f "$DIARIO" ]]; then
  RIFIUTI="$(grep -c '"azione": "rifiutata"' "$DIARIO" 2>/dev/null || echo 0)"
  log "  diario: $(wc -l < "$DIARIO") azioni, $RIFIUTI rifiutate dal recinto"
  # Un rifiuto non e' di per se' una colpa — puo' essere un tentativo legittimo
  # fermato da un perimetro troppo stretto. Ma va LETTO, non ignorato.
  [[ "${RIFIUTI:-0}" -gt 0 ]] && log "         (leggi: python scripts/hooks/gov_worker_guard.py leggi $ALBERO)"
else
  rilievo "nessun diario: non c'e' modo di verificare cosa ha fatto"
fi

# --- 3. ha prodotto qualcosa? ------------------------------------------------
COMMIT="$(git -C "$ALBERO" rev-list --count "$(git rev-parse main)"..HEAD 2>/dev/null || echo 0)"
SPORCO="$(git -C "$ALBERO" status --porcelain | grep -c . || true)"
log "  produzione: $COMMIT commit sul ramo, $SPORCO file non committati"
if [[ "${COMMIT:-0}" == "0" && "${SPORCO:-0}" == "0" ]]; then
  # Un lavoro che non esiste non puo ricevere un verdetto VERDE. Nella corsa di
  # collaudo il lavoratore 2 non ha prodotto nulla e ha ottenuto verde, perche il
  # controllo guardava solo chi proponeva «cluster-closed». Ma verde significa «non ho
  # trovato ragioni per non portarlo su main»: su cosa, se non ce niente? Qualunque
  # esito proposto, senza produzione listruttoria non puo chiudersi in verde.
  if [[ "$ESITO_PROPOSTO" == "cluster-closed" ]]; then
    rilievo "propone «cluster-closed» ma non ha prodotto nulla: nessun commit, nessun file"
  else
    rilievo "nessun lavoro da giudicare (0 commit, 0 file): esito proposto «${ESITO_PROPOSTO:-nessuno}», e unistruttoria senza oggetto non chiude in verde"
  fi
fi
if [[ "${SPORCO:-0}" -gt 0 ]]; then
  rilievo "$SPORCO file non committati: un lavoro non committato non e' verificabile ne' trasferibile"
fi

# --- 4. i cancelli, gli stessi di una sessione canonica ----------------------
# Girano NELL'ALBERO, non nel repo: si giudica il ramo, non il posto da cui si guarda.
# Il lucchetto della suite e' UNO SOLO, condiviso: protegge il database, non la
# cartella. Senza questa riga l'istruttoria userebbe il lucchetto locale dell'albero
# e potrebbe far girare la suite mentre un'altra gira altrove — lo stesso caso
# misurato il 2026-08-05, dove due suite in parallelo hanno prodotto 14 rossi che
# non erano difetti. Trovato guardando girare la prima istruttoria completa.
export SUITE_LOCK_FILE="$REPO/.zp/suite.lock"

# L'output dei cancelli si CONSERVA. La prima istruttoria completa ha dichiarato
# «test e' rosso» e buttato via l'output: il verdetto diceva CHE era rosso ma non
# QUALE test lo fosse, ne' se il rosso venisse dal lavoratore o fosse gia' sul ramo.
# Un verdetto che non si puo' istruire a sua volta non serve a chi lo legge.
LOG_CANCELLI="$VERDETTI/w$N-cancelli-$(date +%Y%m%d-%H%M%S).log"

cancello() {                  # cancello <etichetta> <comando...>
  local etichetta="$1"; shift
  log "  cancello: $etichetta"
  printf '\n===== %s =====\n' "$etichetta" >> "$LOG_CANCELLI"
  if ( cd "$ALBERO" && "$@" >>"$LOG_CANCELLI" 2>&1 ); then
    log "           verde"
  else
    rilievo "$etichetta e' rosso (output: $LOG_CANCELLI)"
  fi
}

if [[ "$VELOCE" == "1" ]]; then
  log "  --veloce: i cancelli non girano. L'istruttoria e' PARZIALE e il verdetto lo dira'."
  LOG_CANCELLI=""
else
  cancello "typecheck"  pnpm -s typecheck
  cancello "lint"       pnpm -s lint
  cancello "test"       pnpm -s test
fi

# --- 5. le evidenze devono poter fallire -------------------------------------
# Si riusa `zp_evidence`, che rifiuta gia' `echo`/`printf`/`true` come prova e
# pretende due livelli diversi: una prova che non puo' dire di no non e' una prova.
if [[ -f "$REPO/docs/kb/tools/zp_evidence.py" && -f "$ALBERO/.zp/last-outcome.json" ]]; then
  if "$PY" docs/kb/tools/zp_evidence.py --file "$ALBERO/.zp/last-outcome.json" >/dev/null 2>&1; then
    log "  evidenze: ammesse"
  else
    log "  evidenze: non verificabili con zp_evidence (l'esito potrebbe non portarne)"
  fi
fi

# --- il verdetto -------------------------------------------------------------
QUANDO="$(date +%Y-%m-%dT%H:%M:%S)"
FILE="$VERDETTI/w$N-${CLUSTER:-senza-cluster}-$(date +%Y%m%d-%H%M%S).json"
if [[ "${#RILIEVI[@]}" -eq 0 ]]; then
  ESITO="verde"; CODICE=0
else
  ESITO="rosso"; CODICE=1
fi

"$PY" - "$FILE" "$ESITO" "$N" "${CLUSTER:-}" "$ESITO_PROPOSTO" "$QUANDO" "$VELOCE" "${LOG_CANCELLI:-}" "${RILIEVI[@]:-}" <<'PYEOF'
import json, sys
file, esito, n, cluster, proposto, quando, veloce, log_cancelli, *rilievi = sys.argv[1:]
rilievi = [r for r in rilievi if r]
json.dump({
    "verdetto": esito, "lavoratore": int(n), "cluster": cluster,
    "esito_proposto_dal_lavoratore": proposto, "quando": quando,
    "istruttoria_parziale": veloce == "1",
    "output_cancelli": log_cancelli or None,
    "rilievi": rilievi,
    "nota": ("verde non significa «portalo su main»: significa «non ho trovato ragioni "
             "per non farlo». Il trasferimento resta un atto separato e presidiato."),
}, open(file, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PYEOF

log "verdetto ${ESITO^^} — $FILE"
[[ "$VELOCE" == "1" ]] && log "  (istruttoria PARZIALE: i cancelli non sono stati eseguiti)"
log "il lavoro resta su $RAMO. gov-chiudi NON fa merge, per costruzione."
exit "$CODICE"
