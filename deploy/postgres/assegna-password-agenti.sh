#!/usr/bin/env bash
# deploy/postgres/assegna-password-agenti.sh — B2
# Da' una password a `heuresys_agenti`, gli accende il LOGIN e la deposita in
# ~/.config/claude-agenti/db-agenti.env (modo 600). Va eseguito SULLA VM.
# La password non viene mai stampata ne' passata come argomento. Rieseguito, RUOTA.
set -euo pipefail

RUOLO="heuresys_agenti"
DB="heuresys_advanced"
DIR="$HOME/.config/claude-agenti"
FILE="$DIR/db-agenti.env"

sudo -u postgres psql -tAqc "SELECT 1 FROM pg_roles WHERE rolname='$RUOLO'" | grep -q 1 \
  || { echo "[agenti-pw] ERRORE: $RUOLO non esiste, esegui prima ruolo-agenti.sql" >&2; exit 1; }

PW="$(openssl rand -hex 16)"
[ ${#PW} -eq 32 ] || { echo "[agenti-pw] ERRORE: password di lunghezza sbagliata" >&2; exit 1; }

printf "ALTER ROLE %s LOGIN PASSWORD '%s';\n" "$RUOLO" "$PW" | sudo -u postgres psql -q -d "$DB" -f -

mkdir -p "$DIR"; chmod 700 "$DIR"
tmp="$(mktemp)"
printf 'POSTGRES_AGENT_USER=%s\nPOSTGRES_AGENT_PASSWORD=%s\n' "$RUOLO" "$PW" > "$tmp"
install -m 600 "$tmp" "$FILE"
rm -f "$tmp"; unset PW
echo "[agenti-pw] ok — $RUOLO ha LOGIN, credenziale in $FILE"
