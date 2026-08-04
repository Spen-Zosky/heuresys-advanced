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
applied=${#files[@]}

flusso() {
  local f fname sha
  for f in "${files[@]}"; do
    fname=$(basename "$f")
    sha=$(sha256sum "$f" | awk '{print $1}')
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
echo "OK: $applied migrations applied."
