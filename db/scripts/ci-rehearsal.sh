#!/usr/bin/env bash
# ============================================================================
# db/scripts/ci-rehearsal.sh — #165 parte ②: la prova generale della CI, in locale.
#
# PERCHE' ESISTE
# --------------
# `heuresys_ci` (linux-pc) e' un clone di produzione CONGELATO al provisioning e
# riportato a HEAD riapplicando le migrazioni. Ha quindi lo schema completo ma NON
# i dati che arrivano da uno script di import: una tabella creata da migrazione e
# popolata da script e' PRESENTE E VUOTA su CI. Ogni post-condizione che conta righe
# vede in produzione un numero e su CI uno zero — ed e' verde in locale, rossa in CI.
#
# In S1048 e' costato tre giri di CI (~25 minuti l'uno) per scoprire OTTO assert della
# stessa classe, due alla volta. Questo script li mostra tutti insieme in un paio di
# minuti, prima del push.
#
# COSA FA
# -------
# Fa una COPIA di `heuresys_ci` — il database vero della CI, che vive su questa stessa
# macchina — ci applica l'intera catena `db/migrations/*.sql` e guarda cosa si rompe.
# E' esattamente il passo «Apply migrations (idempotent, brings the clone to HEAD)» di
# .github/workflows/test-integration.yml, con lo stesso database e lo stesso ruolo, ma
# senza i 25 minuti di coda dietro le altre cinque workflow.
#
# La copia si fa con `createdb --template`, che e' una copia di file: 595 MB in pochi
# secondi. L'originale non viene mai toccato — la CI puo' girare mentre la prova gira.
#
# Perche' RI-applicare una catena gia' applicata trova qualcosa: 166 dei 277 file non
# trasformano il database, lo CONTROLLANO. Le post-condizioni rigirano tutte a ogni
# passata, ed e' li' che S1048 e' andato rosso tre volte.
#
# DUE MODI
#   (default)     copia di heuresys_ci  — la riproduzione FEDELE della CI.
#   --from-zero   database vergine      — piu' severo: nessun dato, nemmeno quelli che
#                 la CI ha. Risponde a «la catena si ricostruisce dal nulla?». Misurato
#                 il 2026-08-07: NO, si ferma alla 000049, che pretende dati che nessuna
#                 migrazione crea. E' un fatto architetturale registrato, non un difetto
#                 di questo script, e sta fuori dal mandato di #165.
#
# DOVE GIRA
# ---------
# Su una macchina con PostgreSQL 16, l'estensione `vector` e `sudo -u postgres` non
# interattivo. Misurato: `linux-pc` (il gemello PROD, ed E' la macchina su cui gira
# la CI — quindi e' anche l'unica che ha `heuresys_ci`). NON gira su Windows: li' manca
# una credenziale superuser locale.
#
# Uso (sulla macchina bersaglio):
#     bash db/scripts/ci-rehearsal.sh
#     bash db/scripts/ci-rehearsal.sh --migrations-from 61f582b6^   # la catena com'era
#     bash db/scripts/ci-rehearsal.sh --from-zero                   # il modo severo
#     bash db/scripts/ci-rehearsal.sh --keep                        # non distruggere alla fine
#
# Da Windows, in una riga:
#     ssh linux-pc 'cd ~/heuresys-advanced && bash db/scripts/ci-rehearsal.sh'
#
# Esce 0 se la catena si applica intera e le sentinelle sono a zero; 1 altrimenti.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
PGPORT_LOCAL="${REHEARSAL_PGPORT:-5432}"
TEMPLATE_DB="${CI_REHEARSAL_TEMPLATE:-heuresys_ci}"
KEEP=0; MIG_REF=""; MODE="like-ci"

while [ $# -gt 0 ]; do
  case "$1" in
    --keep)              KEEP=1 ;;
    --from-zero)         MODE="from-zero" ;;
    --like-ci)           MODE="like-ci" ;;
    --migrations-from)   MIG_REF="${2:?--migrations-from vuole un riferimento git}"; shift ;;
    -h|--help)           sed -n '2,55p' "$0"; exit 0 ;;
    *) echo "argomento sconosciuto: $1" >&2; exit 1 ;;
  esac
  shift
done

log()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
say()  { printf '[rehearsal] %s\n' "$*"; }
die()  { printf '\033[31m[FATALE]\033[0m %s\n' "$*" >&2; exit 1; }

command -v sudo >/dev/null || die "serve sudo (per parlare come postgres)"
sudo -n -u postgres psql -p "$PGPORT_LOCAL" -tAc 'SELECT 1' >/dev/null 2>&1 \
  || die "'sudo -n -u postgres psql' non funziona su questa macchina: la prova gira su linux-pc o sulla VM, non su Windows."
[ -f "$ENV_FILE" ] || die ".env non trovato in $ENV_FILE (serve solo per ruolo e password del runtime)"

# Ruolo e password del runtime si prendono dal .env della macchina: la catena deve
# girare con lo STESSO ruolo non-superuser con cui gira in CI e in produzione, altrimenti
# la prova non prova niente (un superuser non incontra mai un errore di permessi).
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
ROLE="${POSTGRES_USER:?POSTGRES_USER assente dal .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD assente dal .env}"

DB="heuresys_rehearsal_$(date -u +%Y%m%d_%H%M%S)_$$"
# GUARDIA: il nome deve appartenere allo spazio della prova. Il controllo e' sul
# PREFISSO, non sulla non-vuotezza: una variabile vuota passerebbe un test di
# esistenza e farebbe un `dropdb ""`, che e' esattamente il caso da escludere.
case "$DB" in
  heuresys_rehearsal_*) ;;
  *) die "nome del database di prova fuori dallo spazio consentito: '$DB'" ;;
esac

cleanup() {
  if [ "$KEEP" = 1 ]; then
    say "database di prova CONSERVATO: $DB (rimuovilo con: sudo -u postgres dropdb $DB)"
    return
  fi
  case "$DB" in heuresys_rehearsal_*) sudo -u postgres dropdb --force --if-exists -p "$PGPORT_LOCAL" "$DB" >/dev/null 2>&1 || true ;; esac
  rm -f "${ENV_TMP:-}" 2>/dev/null || true
  [ -n "${MIG_TMP:-}" ] && rm -rf "$MIG_TMP"
  # `return 0` OBBLIGATORIO: in un trap EXIT l'esito dell'ULTIMO comando diventa il codice
  # d'uscita dello script. La riga qui sopra esce 1 quando MIG_TMP e' vuoto (il caso
  # normale), quindi la prova generale usciva 1 pur dichiarando VERDE. Un cancello che
  # sbaglia il proprio esito e' rotto tanto quanto uno che sbaglia la misura.
  return 0
}
trap cleanup EXIT

# --- 1. il database della prova ---------------------------------------------------------
if [ "$MODE" = "like-ci" ]; then
  sudo -u postgres psql -p "$PGPORT_LOCAL" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='$TEMPLATE_DB'" | grep -q 1 \
    || die "$TEMPLATE_DB non esiste su questa macchina: la riproduzione fedele gira dove vive il database della CI (linux-pc). Con --from-zero non serve."
  # `createdb --template` pretende ZERO connessioni sul modello. Se la CI sta girando,
  # si aspetta: NON si terminano le connessioni di una corsa in volo per fare una prova.
  busy="$(sudo -u postgres psql -p "$PGPORT_LOCAL" -tAc \
          "SELECT count(*) FROM pg_stat_activity WHERE datname='$TEMPLATE_DB'")"
  [ "$busy" = "0" ] || die "$TEMPLATE_DB ha $busy connessione/i aperte (corsa CI in volo?) — riprova fra qualche minuto."
  log "copia di $TEMPLATE_DB -> $DB (copia di file, l'originale non si tocca)"
  t_copy0=$(date +%s)
  sudo -u postgres createdb -p "$PGPORT_LOCAL" -O "$ROLE" -T "$TEMPLATE_DB" "$DB"
  say "copia fatta in $(( $(date +%s) - t_copy0 ))s"
else
  log "database vergine: $DB (ruolo $ROLE, porta $PGPORT_LOCAL)"
  sudo -u postgres createdb -p "$PGPORT_LOCAL" -O "$ROLE" "$DB"
fi

# --- 2. estensioni, pre-create da superuser --------------------------------------------
# Le crea 000001_init_extensions.sql, ma `CREATE EXTENSION` vuole il superuser: il ruolo
# di runtime non ce la fa (stessa ragione per cui setup-ci-database.sh le pre-crea).
# In modo `like-ci` ci sono gia' — l'IF NOT EXISTS le lascia stare — ma il controllo di
# disponibilita' resta utile: se una migrazione nuova ne aggiunge una che questa macchina
# non ha, e' meglio saperlo qui che in CI.
# L'elenco si RICAVA dalle migrazioni invece di essere scritto qui: una migrazione nuova
# che aggiunge un'estensione non deve costringere a ricordarsi di aggiornare questo file.
EXTS="$(grep -rhoiE 'CREATE EXTENSION IF NOT EXISTS +"?[a-z0-9_-]+"?' "$ROOT"/db/migrations/*.sql \
        | sed -E 's/.*NOT EXISTS +"?([a-z0-9_-]+)"?.*/\1/I' | sort -u)"
say "estensioni ricavate dalla catena: $(echo "$EXTS" | tr '\n' ' ')"
for e in $EXTS; do
  sudo -u postgres psql -p "$PGPORT_LOCAL" -d "$DB" -v ON_ERROR_STOP=1 \
    -c "CREATE EXTENSION IF NOT EXISTS \"$e\" CASCADE" >/dev/null \
    || die "estensione '$e' non disponibile su questa macchina — la prova non sarebbe fedele"
done

# --- 3. la catena --------------------------------------------------------------------
# L'env-file si sintetizza: migrate.sh ne pretende uno, e non deve poter sorgere per sbaglio
# il .env vero, che punta alla produzione. Permessi 600, cancellato dal trap.
ENV_TMP="$(mktemp)"; chmod 600 "$ENV_TMP"
{
  printf 'POSTGRES_HOST=%s\n' "127.0.0.1"
  printf 'POSTGRES_PORT=%s\n' "$PGPORT_LOCAL"
  printf 'POSTGRES_DB=%s\n'   "$DB"
  printf 'POSTGRES_USER=%s\n' "$ROLE"
  printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD"
} > "$ENV_TMP"

MIGRATE_SH="$ROOT/db/scripts/migrate.sh"
if [ -n "$MIG_REF" ]; then
  # La catena COM'ERA a un certo commit, estratta senza toccare l'albero di lavoro
  # (niente `git checkout`: e' un divieto, e sarebbe anche un modo per perdere lavoro).
  MIG_TMP="$(mktemp -d)"
  git -C "$ROOT" archive "$MIG_REF" db/migrations db/scripts | tar -x -C "$MIG_TMP"
  MIGRATE_SH="$MIG_TMP/db/scripts/migrate.sh"
  say "catena presa da $MIG_REF: $(ls "$MIG_TMP"/db/migrations/*.sql | wc -l) file"
else
  say "catena dall'albero di lavoro: $(ls "$ROOT"/db/migrations/*.sql | wc -l) file"
fi

log "applico la catena (modo: $MODE)"
t0=$(date +%s)
chain_rc=0
bash "$MIGRATE_SH" "$ENV_TMP" 2>&1 | tail -40 || chain_rc=${PIPESTATUS[0]}
# `tail` maschera l'esito di migrate.sh: si rilegge da PIPESTATUS. Senza questo la prova
# sarebbe sempre verde, cioe' inutile.
t1=$(date +%s)
say "durata catena: $((t1 - t0))s"

# --- SECONDA PASSATA -------------------------------------------------------------------
# UNA PASSATA NON BASTA, e il progetto l'ha imparato a proprie spese (S1049).
# La catena e' ordinata: se il file N crea un oggetto, il file M<N lo vede solo al giro
# DOPO. La 000284 ha creato una tabella nuova, e la 000062 — che verifica «zero tabelle non
# classificate» e gira molto prima — e' passata comunque alla prima passata, perche' quando
# e' stata valutata la tabella non esisteva ancora. Questa prova generale era VERDE, e la
# catena e' caduta al giro successivo, in produzione: esattamente il difetto che lo
# strumento doveva impedire.
# La seconda passata e' anche la verifica di IDEMPOTENZA, che per questa catena non e'
# opzionale: 166 file su 278 portano una post-condizione e vengono ri-applicati a ogni
# deploy. Costa pochi secondi — la prima passata ha gia' scaldato la cache.
if [ "$chain_rc" = 0 ]; then
  log "seconda passata (una catena si applica due volte, o non si applica)"
  t2=$(date +%s)
  bash "$MIGRATE_SH" "$ENV_TMP" 2>&1 | tail -25 || chain_rc=${PIPESTATUS[0]}
  say "durata seconda passata: $(( $(date +%s) - t2 ))s"
  if [ "$chain_rc" != 0 ]; then
    say "ROTTA ALLA SECONDA PASSATA — quasi sempre significa che un file ha creato un oggetto"
    say "che un file di numero MINORE deve conoscere (registro di riconciliazione, mappa GDPR,"
    say "allowlist). Il rimedio e' emendare QUEL file, non aggiungerne uno dopo."
  fi
fi

if [ "$chain_rc" != 0 ]; then
  if [ "$MODE" = "like-ci" ]; then
    log "ESITO: ROSSO — la catena non passa sul database della CI"
    say "e' la stessa rottura che in CI si scoprirebbe ~25 minuti dopo il push. Correggila e rilancia."
  else
    log "ESITO: ROSSO — la catena non si applica su un database VUOTO (modo severo)"
    say "puo' voler dire due cose diverse: una post-condizione pretende dati che nessuna"
    say "migrazione crea (fatto noto, si ferma alla 000049), oppure e' un difetto vero."
    say "Per sapere se la CI sarebbe rossa, usa il modo predefinito (senza --from-zero)."
  fi
  exit 1
fi

# --- 4. sentinelle -------------------------------------------------------------------
# NON si ri-elencano qui le viste `sys.v_*`: quali siano ALLARMI e quali RENDICONTI e'
# gia' deciso in docs/kb/tools/db_health.py (l'insieme INFORMATIVE — v_reconciliation_status,
# v_reference_translation_coverage, v_pip_completeness, v_organization_unit_integrity
# contano stato, non difetti). Duplicare quella lista qui significherebbe due definizioni
# di «sentinella» che divergono al primo cambiamento. Si invoca lo strumento e basta.
log "sentinelle (docs/kb/tools/db_health.py sul database di prova)"
sent_rc=0
DBH="$ROOT/docs/kb/tools/db_health.py"
PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ] || [ ! -f "$DBH" ]; then
  say "db_health.py o python non disponibili qui — sentinelle NON misurate (non e' un verde)"
  sent_rc=2
else
  PGHOST=127.0.0.1 PGPORT="$PGPORT_LOCAL" PGUSER="$ROLE" PGDATABASE="$DB" \
  PGPASSWORD="$POSTGRES_PASSWORD" "$PY" "$DBH" --sentinelle --compatto || sent_rc=$?
fi

case "$sent_rc" in
  0) : ;;
  2) log "ESITO: PARZIALE — catena verde, sentinelle non misurate"; exit 1 ;;
  *) log "ESITO: ROSSO — la catena si applica ma accende una sentinella"; exit 1 ;;
esac
case "$MODE" in
  like-ci)   log "ESITO: VERDE — catena intera + sentinelle a zero sul database della CI ($((t1 - t0))s di catena)" ;;
  from-zero) log "ESITO: VERDE — catena intera + sentinelle a zero su un database VUOTO ($((t1 - t0))s di catena)" ;;
esac
