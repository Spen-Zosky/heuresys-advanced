#!/usr/bin/env bash
# ============================================================================
# db/scripts/ci-rehearsal-census.sh — #166: QUANTE migrazioni non reggono da zero?
#
# `ci-rehearsal.sh --from-zero` risponde «la catena si ferma alla 000049». Non basta
# per decidere: una singola post-condizione che pretende dati e' una toppa, cinquanta
# sono una revisione della dottrina. Serve il CONTEGGIO, e per averlo bisogna passare
# oltre il primo errore invece di fermarsi.
#
# Applica i file UNO PER UNO su un database vergine e va avanti quando uno fallisce.
# Il risultato e' l'elenco dei file che non reggono, con il messaggio di ognuno.
#
# ⚠️ I FALLIMENTI A VALLE SONO RUMORE, ed e' dichiarato: se un file non crea le sue
# righe, un file successivo che le pretende cade di conseguenza. Il numero da leggere
# non e' «quanti falliscono» ma «quanti falliscono per una ragione PROPRIA» — per
# questo si stampa il messaggio di ciascuno, non solo il totale.
#
# DUE TRAPPOLE GIA' CADUTE QUI, ENTRAMBE PRODUCEVANO UN FALSO VERDE (S1049):
#   1. la variabile `PORT` e' occupata dal `.env` (API_PORT/WEB_PORT): la porta si
#      fissa DOPO aver sorgente il file, e con un nome che il .env non usa;
#   2. l'esito si legge dal CODICE DI USCITA di psql, non cercando «ERROR» nei
#      messaggi — un errore di connessione ha un altro prefisso, non combaciava, e il
#      censimento dichiarava «290 applicate, 0 cadute» senza aver eseguito niente.
#
# E' uno strumento di MISURA, non un cancello: non entra in nessuna catena. Uso:
#     bash db/scripts/ci-rehearsal-census.sh          # censimento completo
#     bash db/scripts/ci-rehearsal-census.sh --keep   # conserva il database
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

[ -f "$ENV_FILE" ] || { echo "[censimento] .env non trovato" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
ROLE="${POSTGRES_USER:?}"; export PGPASSWORD="${POSTGRES_PASSWORD:?}"
REH_PORT="${REHEARSAL_PGPORT:-5432}"

DB="heuresys_rehearsal_censimento_$$"
case "$DB" in heuresys_rehearsal_*) ;; *) echo "nome fuori spazio consentito" >&2; exit 1 ;; esac
cleanup() { [ "$KEEP" = 1 ] || sudo -u postgres dropdb --force --if-exists -p "$REH_PORT" "$DB" >/dev/null 2>&1; }
trap cleanup EXIT

sudo -u postgres psql -p "$REH_PORT" -tAc "SELECT 1" >/dev/null 2>&1 || {
  echo "[censimento] FATALE: nessun PostgreSQL raggiungibile sulla porta $REH_PORT" >&2; exit 2; }

echo "[censimento] database vergine $DB (porta $REH_PORT)"
sudo -u postgres createdb -p "$REH_PORT" -O "$ROLE" "$DB" || exit 2
for e in $(grep -rhoiE 'CREATE EXTENSION IF NOT EXISTS +"?[a-z0-9_-]+"?' "$ROOT"/db/migrations/*.sql \
           | sed -E 's/.*NOT EXISTS +"?([a-z0-9_-]+)"?.*/\1/I' | sort -u); do
  sudo -u postgres psql -p "$REH_PORT" -d "$DB" -qc "CREATE EXTENSION IF NOT EXISTS \"$e\" CASCADE" >/dev/null 2>&1
done

ok=0; ko=0
for f in "$ROOT"/db/migrations/*.sql; do
  nome="$(basename "$f")"
  err="$(psql -h 127.0.0.1 -p "$REH_PORT" -U "$ROLE" -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 >/dev/null)"
  rc=$?
  if [ "$rc" = 0 ]; then
    ok=$((ok + 1))
  else
    ko=$((ko + 1))
    msg="$(printf '%s' "$err" | grep -iE 'error|errore' | head -1 | cut -c1-220)"
    printf '  KO  %-56s %s\n' "$nome" "${msg:-(uscita $rc senza messaggio)}"
  fi
done

echo
echo "============================================================"
echo " applicate: $ok      cadute: $ko      totale: $((ok + ko))"
echo "============================================================"
if [ "$ko" = 0 ]; then
  echo "La catena si ricostruisce dal nulla."
else
  echo "Le cadute a valle sono rumore: leggi i MESSAGGI, non il numero."
fi
