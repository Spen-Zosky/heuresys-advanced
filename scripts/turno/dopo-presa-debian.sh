#!/usr/bin/env bash
# ============================================================================
# scripts/turno/dopo-presa-debian.sh — il rito `dopo_presa` del turno sulla Debian (guardie GU3 e GU7).
#
# Piano: docs/piani/PIANO_turni-advanced-datastore_20261110.md. Lo lancia `turno prendi` sulla Debian,
# subito dopo aver copiato dalla VM il database di produzione nella copia locale con lo stesso nome.
# In ordine:
#   1. si rifiuta sulla VM: li' il database e' la produzione;
#   2. il .env deve puntare a questa macchina (POSTGRES_HOST localhost o 127.0.0.1): la Debian lavora
#      solo sulla propria copia;
#   3. la copia si segna come copia (COMMENT ON DATABASE), cosi' chi la guarda non la scambia per la
#      produzione nelle dimostrazioni;
#   4. il ruolo applicativo deve entrare con la password del .env (la copia dei ruoli non porta le
#      password): se non entra, gliela si rimette dal .env, passandola da stdin e mai sulla riga di comando;
#   5. le migrazioni del codice non ancora in produzione si applicano alla copia
#      (db/scripts/migrate-if-pending.sh), cosi' la copia ha lo schema del codice che si sta sviluppando.
# Uso:  bash scripts/turno/dopo-presa-debian.sh [--controlla]   (--controlla: solo i passi 1-2, niente scritture)
# Codici: 0 bene · 1 fermato
# ============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT/.env"
VM_HOST="${TURNO_VM_HOST:-main-server-base-configuration}"
riga() { printf '[dopo-presa] %s\n' "$*"; }
ferma() { riga "FERMO: $*" >&2; exit 1; }

[ "$(hostname)" != "$VM_HOST" ] || ferma "questa e' la VM: qui il database e' la produzione, il rito vale solo sui gemelli"
[ -f "$ENV_FILE" ] || ferma "manca $ENV_FILE"
H="$(sed -n 's/^POSTGRES_HOST=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r')"
P="$(sed -n 's/^POSTGRES_PORT=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r')"
D="$(sed -n 's/^POSTGRES_DB=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r')"
U="$(sed -n 's/^POSTGRES_USER=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' \r')"
case "$H" in localhost|127.0.0.1|::1) ;; *) ferma "il .env punta a POSTGRES_HOST=$H: la Debian lavora solo sulla copia locale";; esac
[ -n "$D" ] && [ -n "$U" ] && [ -n "$P" ] || ferma "nel .env mancano POSTGRES_DB, POSTGRES_USER o POSTGRES_PORT"
sudo -n -u postgres psql -X -p "$P" -Atc "select 1 from pg_database where datname = '$D'" postgres 2>/dev/null | grep -q 1 \
  || ferma "il database $D non c'e' sul cluster locale $P: la presa del turno non l'ha copiato"
riga "copia locale: $D sul cluster $P di $(hostname)"
[ "${1:-}" = --controlla ] && exit 0

sudo -n -u postgres psql -X -q -p "$P" -d postgres -c \
  "COMMENT ON DATABASE \"$D\" IS 'COPIA di lavoro su $(hostname), presa del turno del $(date -u +%Y-%m-%dT%H:%M:%SZ): non e'' la produzione'" \
  || ferma "segno di copia non scritto"
riga "segnata come copia"

PW="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$ENV_FILE" | tail -1 | tr -d '\r')"
PW="${PW%\"}"; PW="${PW#\"}"
if ! PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -Atc "select 1" >/dev/null 2>&1; then
  printf '%s' "$PW" | sudo -n -u postgres psql -X -q -p "$P" -d postgres -v ruolo="$U" \
    -c "\\set pw \`cat\`" -c "ALTER ROLE :\"ruolo\" PASSWORD :'pw'" >/dev/null \
    || ferma "password del ruolo $U non rimessa"
  PGPASSWORD="$PW" psql -X -h "$H" -p "$P" -U "$U" -d "$D" -Atc "select 1" >/dev/null 2>&1 || ferma "il ruolo $U non entra neppure dopo"
  riga "ruolo $U: password rimessa dal .env"
fi

riga "migrazioni non ancora in produzione, sulla copia"
bash "$ROOT/db/scripts/migrate-if-pending.sh" "$ENV_FILE" || ferma "migrazioni sulla copia non riuscite"
riga "fatto"
