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
# [S1052] Il diario vive FUORI dall'albero (B1: il sorvegliato non custodisce il proprio
# registro). Cercandolo solo dentro, l'istruttoria emetteva il rilievo «nessun diario:
# non c'e' modo di verificare cosa ha fatto» su lavoratori che ne avevano uno pieno —
# 135 azioni per w1. Un verdetto con dentro un rilievo inventato non vale: chi lo legge
# non sa piu' quali degli altri credere.
DIARIO_FUORI="${GOV_DIARI:-$(dirname "$ALBERO")/../heuresys-gov-diari}/$(basename "$ALBERO").ndjson"
DIARIO="$ALBERO/.zp/diario.ndjson"
[[ -f "$DIARIO_FUORI" ]] && DIARIO="$DIARIO_FUORI"
if [[ -f "$DIARIO" ]]; then
  # `grep -c` stampa gia' `0` quando non trova nulla, MA esce 1: il vecchio
  # `|| echo 0` ne aggiungeva un secondo, la variabile diventava "0\n0" e la riga 89
  # moriva con «arithmetic syntax error». Non si era mai visto perche' il lavoratore 1
  # aveva un rifiuto nel diario; e' bastato istruire il lavoratore 2, che ne ha zero.
  # `|| true` tiene l'uscita non-zero senza aggiungere output.
  RIFIUTI="$(grep -c '"azione": "rifiutata"' "$DIARIO" 2>/dev/null || true)"
  RIFIUTI="${RIFIUTI:-0}"
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

# L'IDENTITA' CON CUI SI GIUDICA
# ------------------------------
# I test di integrazione SCRIVONO: creano fixture, fanno login veri, fanno INSERT.
# L'albero di un lavoratore parla al database come `gov_worker`, che e' in sola
# lettura per costruzione — ed e' giusto che lo sia, e' il recinto di sicurezza.
# Ma il cancello `test`, girando li', era impossibile da superare per QUALUNQUE
# lavoro: misurato, `cannot execute INSERT in a read-only transaction`. Un cancello
# che nessuno puo' passare non giudica niente, e il suo rosso non dice nulla.
#
# L'istruttoria la esegue GOV, che ha l'identita' piena. Si impone qui, per la sola
# durata dei cancelli, senza toccare il .env dell'albero: dotenv/Vite non sovrascrive
# le variabili gia' presenti nell'ambiente. Verificato prima di scriverlo:
# `actors-profile` passa 9/9 con questa identita', 6/9 senza.
if [[ -f "$REPO/.env" ]]; then
  IDENT_USER="$(grep -E '^POSTGRES_USER=' "$REPO/.env" | head -1 | cut -d= -f2-)"
  IDENT_PASS="$(grep -E '^POSTGRES_PASSWORD=' "$REPO/.env" | head -1 | cut -d= -f2-)"
  if [[ -n "$IDENT_USER" && -n "$IDENT_PASS" ]]; then
    export POSTGRES_USER="$IDENT_USER" POSTGRES_PASSWORD="$IDENT_PASS"
    log "  identita' di giudizio: $IDENT_USER (i cancelli scrivono; il lavoratore resta in sola lettura)"
  else
    rilievo "in $REPO/.env manca POSTGRES_USER o POSTGRES_PASSWORD: il cancello test sarebbe rosso per costruzione, non per difetto"
  fi
else
  rilievo "manca $REPO/.env: senza identita' piena il cancello test e' rosso per costruzione, non per difetto"
fi

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
  # NIENTE `-s`: misurato, `pnpm -s run` sopprime l'output degli script figli (0 byte
  # contro 4.690 a parita' di comando), ed e' il motivo per cui il primo verdetto ha
  # saputo dire «test e' rosso» ma non quali test. `pnpm -s exec` invece lo lascia
  # passare — la differenza sta in `run`, ed e' costata due ipotesi sbagliate.
  cancello "typecheck"  pnpm typecheck
  cancello "lint"       pnpm lint
  cancello "test"       pnpm test
fi

# --- 5. le evidenze devono poter fallire -------------------------------------
# Si riusa `zp_evidence`, che rifiuta gia' `echo`/`printf`/`true` come prova e
# pretende due livelli diversi: una prova che non puo' dire di no non e' una prova.
# DUE difetti corretti qui, non uno (misurati il 2026-08-09):
#   1. si cercavano le prove dentro `last-outcome.json`. Il lavoratore le scrive in
#      `.zp/prove/<cluster>.json`, e `zp_evidence` si interroga per CLUSTER;
#   2. `zp_evidence` derivava la radice da dove sta il proprio file: lanciato dal repo
#      principale guardava `<repo>/.zp/prove/` e diceva «nessuna prova registrata» con
#      il file di prove presente e valido nell'albero. Da qui `ZP_ROOT`.
# Il risultato era un cancello CIECO: passava sempre, e taceva. Ora un lavoro che ha
# PRODOTTO qualcosa senza portare prove valide riceve un RILIEVO, cioe' un rosso.
if [[ -f "$REPO/docs/kb/tools/zp_evidence.py" && -n "$CLUSTER" ]]; then
  if EV="$(ZP_ROOT="$ALBERO" "$PY" docs/kb/tools/zp_evidence.py valida "$CLUSTER" 2>&1)"; then
    log "  evidenze: ammesse ($CLUSTER)"
  elif [[ "${COMMIT:-0}" != "0" || "${SPORCO:-0}" != "0" ]]; then
    rilievo "evidenze insufficienti per $CLUSTER: $(echo "$EV" | head -1)"
  else
    log "  evidenze: $(echo "$EV" | head -1) — nessuna produzione da sostenere, non e' un rilievo"
  fi
elif [[ -z "$CLUSTER" ]]; then
  log "  evidenze: nessun cluster dichiarato, niente da validare"
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
