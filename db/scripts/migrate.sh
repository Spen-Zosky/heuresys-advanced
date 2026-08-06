#!/usr/bin/env bash
# =============================================================================
# db/scripts/migrate.sh
# -----------------------------------------------------------------------------
# Applies db/migrations/*.sql in lexical order; idempotent audit upsert.
# Works for Model A (localhost) and Model B (OCI VM via tunnel).
# =============================================================================
set -euo pipefail

ENV_FILE="${1:-$(cd "$(dirname "$0")/../.." && pwd)/.env}"
MIG_DIR="$(cd "$(dirname "$0")/../migrations" && pwd 2>/dev/null || echo "$(dirname "$0")/../migrations")"
[[ -f "$ENV_FILE" ]] || { echo "[migrate] .env not found at $ENV_FILE" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

: "${POSTGRES_HOST:?missing}"
: "${POSTGRES_PORT:?missing}"
: "${POSTGRES_DB:?missing}"
: "${POSTGRES_USER:?missing}"
: "${POSTGRES_PASSWORD:?missing}"

export PGPASSWORD="${POSTGRES_PASSWORD}"
PSQL=(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1)

if [[ ! -d "$MIG_DIR" ]]; then
  echo "[migrate] No migrations directory at $MIG_DIR (yet). Nothing to apply."
  exit 0
fi

shopt -s nullglob
files=( "$MIG_DIR"/*.sql )
shopt -u nullglob
if [[ ${#files[@]} -eq 0 ]]; then
  echo "[migrate] db/migrations/ is empty. Nothing to apply."
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# UNA SOLA CONNESSIONE PER L'INTERA CATENA
#
# La stesura precedente apriva DUE connessioni per file — una per applicarlo, una
# per registrarlo nel ledger. Misurato sul tunnel SSH (S1043): aprire una
# connessione costa ~1,12 s, eseguire una query su una connessione aperta ~0,08 s.
# Con 263 file facevano 526 connessioni, cioe' ~590 secondi di sola apertura di
# canale su 985 totali: il 60% del tempo era bussare alla porta, non lavorare.
#
# Ora l'intera catena viaggia in UN unico flusso verso UNA psql. Ogni file resta
# nella propria transazione (BEGIN/COMMIT espliciti attorno, esattamente come
# faceva `-1`), quindi la semantica non cambia: se uno fallisce, ON_ERROR_STOP
# ferma tutto e i precedenti restano committati — identico a prima.
#
# Il contenuto dei file viene EMESSO nel flusso (`cat`) invece di essere incluso
# con `\i`: dentro lo standard input un path non viene convertito da MSYS, quindi
# `\i /d/...` fallirebbe su Git Bash mentre `-f` funzionava. Emettendo il testo il
# problema non si pone su nessuna piattaforma.
#
# La durata resta misurata per-file, ma dal DATABASE (`clock_timestamp()` prima e
# dopo), non dall'orologio della shell: e' il tempo vero di esecuzione, senza la
# latenza di rete che prima ci finiva dentro.
# ─────────────────────────────────────────────────────────────────────────────
# ─────────────────────────────────────────────────────────────────────────────
# MIGRAZIONI UNA-TANTUM (#140)
#
# La catena viene ri-applicata INTERAMENTE a ogni deploy, e questo e' voluto: 166
# dei 271 file portano una post-condizione che verifica un invariante e fa fallire
# il deploy se e' violato. Quel 61% non trasforma il database, lo CONTROLLA, e
# spegnerlo per "non rieseguire le migrazioni gia' fatte" sarebbe stato un pessimo
# affare: e' proprio una di quelle verifiche ad aver fatto scoprire #140.
#
# Il guasto e' un altro: alcune migrazioni descrivono un PASSAGGIO, non uno stato
# desiderato — archiviano righe, ri-tipizzano un'unita', revocano un insieme. Farle
# rigirare le fa disfare o duplicare cio' che le migrazioni successive hanno fatto.
#
# Un file dichiara di essere di quella natura con, in testa:
#     -- @migrate: once
#
# e viene saltato solo se DUE fatti sono veri insieme: e' marcato once, ED e' gia'
# registrato con la STESSA impronta. Un file modificato dopo l'applicazione torna
# a essere applicato da se'. Senza marcatore non cambia nulla: e' il comportamento
# di sempre, quindi le 166 verifiche restano.
#
# MIGRATE_FORCE_ALL=1 riesegue tutto, marcatori inclusi: e' la "richiesta esplicita
# e motivata" per rifare una catena da capo. Su un database nuovo il registro e'
# vuoto e nulla viene mai saltato — CI e cloni freschi non sono toccati.
#
# Il registro si legge in UNA query prima del ciclo: sul tunnel una connessione
# costa ~1,12 s (misura S1043 qui sopra), 271 interrogazioni sarebbero 5 minuti di
# sola apertura di canale.
# ─────────────────────────────────────────────────────────────────────────────
FORCE_ALL="${MIGRATE_FORCE_ALL:-0}"
declare -A LEDGER=()
if [[ "$FORCE_ALL" != "1" ]]; then
  # `|| true`: su un database nuovo la tabella non esiste ancora e non e' un errore.
  while IFS='|' read -r l_file l_sha; do
    [[ -n "$l_file" ]] && LEDGER["$l_file"]="$l_sha"
  done < <("${PSQL[@]}" -tA -F'|' -c \
      "SELECT file_name, sha256 FROM sys.sys_schema_migrations" 2>/dev/null | tr -d '\r' || true)
fi

# La decisione si prende QUI, fuori dalla pipe: `flusso | psql` mette la funzione in
# una subshell, e un contatore incrementato li' dentro non sopravvive al `|`. Il
# ciclo che segue legge soltanto.
declare -A SHA=() SKIP=()
for f in "${files[@]}"; do
  fname=$(basename "$f")
  SHA["$fname"]=$(sha256sum "$f" | awk '{print $1}')
  # Il marcatore si cerca solo nella TESTATA: piu' avanti sarebbe prosa, e una
  # migrazione che PARLA di `@migrate: once` non deve auto-marcarsi.
  if [[ "$FORCE_ALL" != "1" ]] \
     && head -20 "$f" | grep -qE '^--[[:space:]]*@migrate:[[:space:]]*once[[:space:]]*$' \
     && [[ "${LEDGER[$fname]:-}" == "${SHA[$fname]}" ]]; then
    SKIP["$fname"]=1
  fi
done
skipped=${#SKIP[@]}
applied=$(( ${#files[@]} - skipped ))

if (( skipped > 0 )); then
  echo "[migrate] $skipped migrazione/i una-tantum gia' applicate: saltate."
  for fname in "${!SKIP[@]}"; do echo "           - $fname"; done | sort
  echo "[migrate] per rifarle comunque: MIGRATE_FORCE_ALL=1"
fi
[[ "$FORCE_ALL" == "1" ]] && echo "[migrate] MIGRATE_FORCE_ALL=1 — riapplico TUTTO, marcatori ignorati."

# MIGRATE_DRY_RUN=1: dice cosa farebbe e si ferma. Esiste perche' la decisione di
# saltare va poter essere ISPEZIONATA senza applicare 271 file a un database vero —
# ed e' cio' che rende verificabile il meccanismo invece che solo dichiarato.
if [[ "${MIGRATE_DRY_RUN:-0}" == "1" ]]; then
  echo "[migrate] DRY-RUN — nessuna modifica al database."
  echo "[migrate] applicherebbe $applied file, salterebbe $skipped."
  exit 0
fi

flusso() {
  local f fname sha
  for f in "${files[@]}"; do
    fname=$(basename "$f")
    sha="${SHA[$fname]}"
    if [[ -n "${SKIP[$fname]:-}" ]]; then
      # NIENTE APOSTROFI in questa riga: il testo finisce nello stdin di psql, che
      # legge `\echo` come meta-comando e su un apostrofo apre una stringa che non
      # chiude mai — "unterminated quoted string" a ogni salto. Colto dalla prova
      # dei due giri consecutivi, non da una rilettura del codice.
      printf '%s\n' "\echo [migrate] SALTATA $fname (una-tantum, con la stessa impronta del registro)"
      continue
    fi
    # `\echo` va nell'ARGOMENTO e non nel formato: printf interpreterebbe `\e`
    # come carattere di escape e la riga arriverebbe storpiata.
    printf '%s
' "\echo [migrate] applying $fname (sha256=${sha:0:12})"
    printf '%s
' "SELECT set_config('hrx.t0', clock_timestamp()::text, false);"
    printf '%s
' "BEGIN;"
    cat "$f"
    printf '
%s
' "COMMIT;"
    # Il ledger si scrive DOPO il commit del file, fuori dalla sua transazione: se
    # il file fallisce, ON_ERROR_STOP interrompe e la riga non viene scritta.
    cat <<LEDGER
DO \$LEDGER\$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='sys' AND table_name='sys_schema_migrations') THEN
    INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_at, applied_by, duration_ms)
    VALUES ('${fname}', '${sha}', now(), current_user,
            (EXTRACT(epoch FROM clock_timestamp() - current_setting('hrx.t0')::timestamptz) * 1000)::int)
    ON CONFLICT (file_name) DO UPDATE
       SET sha256      = EXCLUDED.sha256,
           applied_at  = EXCLUDED.applied_at,
           applied_by  = EXCLUDED.applied_by,
           duration_ms = EXCLUDED.duration_ms;
  END IF;
END
\$LEDGER\$;
LEDGER
  done
}

flusso | "${PSQL[@]}" -f -
echo ""
if (( skipped > 0 )); then
  echo "OK: $applied migrations applied, $skipped skipped (una-tantum gia' applicate)."
else
  echo "OK: $applied migrations applied."
fi
