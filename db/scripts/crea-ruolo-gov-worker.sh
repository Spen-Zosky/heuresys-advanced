#!/usr/bin/env bash
# crea-ruolo-gov-worker.sh — l'identita' di database di un lavoratore di gov.
#
# PERCHE' ESISTE (V2 dell'analisi di sicurezza, 2026-08-09)
# --------------------------------------------------------
# L'albero di lavoro isola i FILE, non i DATI: fino a oggi il `.env` di un
# lavoratore era una copia di quello del repo, quindi puntava al PostgreSQL di
# produzione — 162 utenti veri, 5.641 buste paga, due tenant. Un errore dentro
# un'operazione legittima sarebbe stato irreversibile.
#
# Il rimedio NON e' un hook che vieta le query di scrittura: un hook lo si aggira,
# e comunque non distingue una DELETE legittima da una sbagliata. Il rimedio e'
# un'identita' che **il DBMS stesso** impedisce di usare per scrivere. Se la
# garanzia sta nel database, non c'e' comando che la tolga.
#
# E' lo stesso pattern gia' in casa per `codex_auditor`, con una differenza: quella
# credenziale e' di Codex e il CLAUDE.md vieta di riusarla o copiarla. Questa e'
# separata, e serve a un altro mestiere.
#
# CONSEGUENZA DI PROCESSO, da dire chiara: un cluster che per chiudersi deve
# SCRIVERE sul database non puo' girare in corsia non presidiata. Non e' una
# limitazione dello strumento: e' la definizione della corsia. Quel cluster non e'
# di classe A o B, e va fatto presidiato.
#
# Idempotente: si puo' rilanciare. Se il ruolo esiste, ne aggiorna i vincoli e la
# password senza toccare altro.
#
#   bash db/scripts/crea-ruolo-gov-worker.sh              # sulla VM, via ssh
#   bash db/scripts/crea-ruolo-gov-worker.sh --verifica   # solo controlla
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEGRETO="$REPO/.secrets/gov-worker.pass"
RUOLO="gov_worker"
HOST_SSH="${GOV_DB_SSH:-oracle-vm-default}"
DB="${GOV_DB_NAME:-heuresys_advanced}"

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }

# Il psql da usare: sulla VM si passa da sudo -u postgres; da Windows si passa per ssh.
psql_super() {
  # shellcheck disable=SC2029
  MSYS_NO_PATHCONV=1 ssh -o ConnectTimeout=15 "$HOST_SSH" \
    "sudo -n -u postgres psql -d $DB -v ON_ERROR_STOP=1 -tA -c \"$1\""
}

if [[ "${1:-}" == "--verifica" ]]; then
  log "verifico i vincoli del ruolo $RUOLO"
  psql_super "SELECT rolname || ' | login=' || rolcanlogin || ' | super=' || rolsuper
              || ' | createdb=' || rolcreatedb || ' | createrole=' || rolcreaterole
              || ' | bypassrls=' || rolbypassrls
              || ' | config=' || coalesce(array_to_string(rolconfig,' '),'(nessuna)')
              FROM pg_roles WHERE rolname='$RUOLO'"
  log "permessi di scrittura che NON deve avere (atteso: 0 righe)"
  psql_super "SELECT table_schema || '.' || table_name || ' -> ' || privilege_type
              FROM information_schema.role_table_grants
              WHERE grantee='$RUOLO' AND privilege_type <> 'SELECT' LIMIT 20"
  exit 0
fi

# --- la password: si genera qui e non si stampa MAI --------------------------
# Vive in .secrets/, che e' gitignorato. Se esiste gia' non si tocca: rigenerarla a
# ogni corsa lascerebbe indietro gli alberi gia' preparati.
mkdir -p "$REPO/.secrets"
if [[ -s "$SEGRETO" ]]; then
  log "password gia' presente in .secrets/ (non la rigenero)"
else
  head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32 > "$SEGRETO"
  chmod 600 "$SEGRETO" 2>/dev/null || true
  log "password generata e salvata in .secrets/gov-worker.pass"
fi
PASSWORD="$(cat "$SEGRETO")"

log "creo o aggiorno il ruolo $RUOLO su $HOST_SSH/$DB"

# I vincoli sono dichiarati sul RUOLO, non sulla connessione: valgono comunque, anche
# se chi si collega ci prova diversamente. `default_transaction_read_only` e' la
# garanzia principale; i timeout impediscono che un lavoratore impantanato tenga
# occupato il database di tutti.
psql_super "
DO \\\$\\\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$RUOLO') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '$RUOLO', '$PASSWORD');
  ELSE
    EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', '$RUOLO', '$PASSWORD');
  END IF;
END
\\\$\\\$;
ALTER ROLE $RUOLO NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
ALTER ROLE $RUOLO SET default_transaction_read_only = on;
ALTER ROLE $RUOLO SET statement_timeout = '120s';
ALTER ROLE $RUOLO SET lock_timeout = '5s';
ALTER ROLE $RUOLO SET idle_in_transaction_session_timeout = '300s';
GRANT CONNECT ON DATABASE $DB TO $RUOLO;
GRANT USAGE ON SCHEMA sys, audit, reference_sync, staging, public TO $RUOLO;
GRANT SELECT ON ALL TABLES IN SCHEMA sys, audit, reference_sync, staging, public TO $RUOLO;
ALTER DEFAULT PRIVILEGES IN SCHEMA sys, audit, reference_sync, staging, public
  GRANT SELECT ON TABLES TO $RUOLO;
SELECT 'ruolo pronto';
" || { log "ERRORE: creazione del ruolo fallita"; exit 1; }

log "fatto. La password NON e' stata stampata: sta in .secrets/gov-worker.pass"
log "verifica con: bash db/scripts/crea-ruolo-gov-worker.sh --verifica"
