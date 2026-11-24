#!/usr/bin/env bash
# deploy/postgres/assegna-password-agenti.sh — B2
# Da' una password a `heuresys_agenti`, gli accende il LOGIN e la deposita in
# ~/.config/claude-agenti/db-agenti.env (modo 600). Va eseguito SULLA VM.
# La password non viene mai stampata ne' passata come argomento.
#
# USO: bash deploy/postgres/assegna-password-agenti.sh [--ruota]
#
# IDEMPOTENTE (P5, 24/11/2026). Senza opzioni NON ruota mai:
#   - il file ha gia' una password e `heuresys_agenti` entra con quella -> non cambia niente;
#   - il file ce l'ha ma il ruolo non la accetta -> si riapplica AL RUOLO quella del file,
#     che non si tocca (e' quella che gli agenti stanno usando);
#   - il file non c'e' o non ha la password -> se ne crea una (prima assegnazione).
# Con `--ruota` se ne crea una nuova comunque (il comportamento di prima del 24/11).
# Host e porta del controllo: POSTGRES_HOST/POSTGRES_PORT, come psql-agenti.sh.
set -euo pipefail

uso() { echo "[agenti-pw] uso: assegna-password-agenti.sh [--ruota]" >&2; exit 2; }
RUOTA=0
[ $# -le 1 ] || uso
case "${1:-}" in
  '')      ;;
  --ruota) RUOTA=1 ;;
  *)       uso ;;
esac

RUOLO="heuresys_agenti"
DB="heuresys_advanced"
DIR="$HOME/.config/claude-agenti"
FILE="$DIR/db-agenti.env"

sudo -u postgres psql -tAqc "SELECT 1 FROM pg_roles WHERE rolname='$RUOLO'" | grep -q 1 \
  || { echo "[agenti-pw] ERRORE: $RUOLO non esiste, esegui prima ruolo-agenti.sql" >&2; exit 1; }

# Valore di una chiave del file senza stamparlo (vince l'ultima riga, via il CR).
valore() {  # $1 = chiave
  [ -f "$FILE" ] || return 0
  sed -n "s/^$1=//p" "$FILE" | tail -n 1 | tr -d '\r'
}

# Il ruolo entra DAVVERO con questa password? PGPASSWORD come psql-agenti.sh, mai argv.
accetta() {  # $1 = password
  [ -n "$1" ] || return 1
  local r
  r="$(PGPASSWORD="$1" PGCONNECT_TIMEOUT=5 psql -X -w -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
         -U "$RUOLO" -d "$DB" -tAqc 'select 1' 2>/dev/null)" || return 1
  [ "$(printf '%s' "$r" | tr -d '[:space:]')" = "1" ]
}

applica_al_ruolo() {  # $1 = password (32 esadecimali: niente da citare), via stdin
  printf "ALTER ROLE %s LOGIN PASSWORD '%s';\n" "$RUOLO" "$1" | sudo -u postgres psql -q -d "$DB" -f -
}

scrivi_file() {  # $1 = password
  mkdir -p "$DIR"; chmod 700 "$DIR"
  local tmp
  tmp="$(mktemp)"
  printf 'POSTGRES_AGENT_USER=%s\nPOSTGRES_AGENT_PASSWORD=%s\n' "$RUOLO" "$1" > "$tmp"
  install -m 600 "$tmp" "$FILE"
  rm -f "$tmp"
}

verifica_finale() {  # $1 = messaggio di riuscita
  if accetta "$(valore POSTGRES_AGENT_PASSWORD)"; then
    echo "[agenti-pw] ok — $1"
  else
    echo "[agenti-pw] ERRORE: $RUOLO non entra con la password di $FILE" >&2
    exit 1
  fi
}

ATTUALE="$(valore POSTGRES_AGENT_PASSWORD)"
if [ "$RUOTA" = 0 ] && [ -n "$ATTUALE" ]; then
  # Si riapplica solo il formato che questo script produce (32 esadecimali): e' anche cio'
  # che rende sicuro metterla fra apici nell'ALTER ROLE.
  if ! printf '%s' "$ATTUALE" | grep -qxE '[0-9a-f]{32}'; then
    unset ATTUALE
    echo "[agenti-pw] ERRORE: la password in $FILE non e' nel formato di questo script: non la uso. Per crearne una nuova: --ruota" >&2
    exit 1
  fi
  fatto=""
  if ! accetta "$ATTUALE"; then
    applica_al_ruolo "$ATTUALE"
    fatto="riapplicata al ruolo la password gia' in $FILE (il file non cambia)"
  fi
  if [ "$(valore POSTGRES_AGENT_USER)" != "$RUOLO" ]; then
    scrivi_file "$ATTUALE"
    fatto="${fatto:+$fatto; }POSTGRES_AGENT_USER riscritto in $FILE, stessa password"
  fi
  unset ATTUALE
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password di $FILE (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

PW="$(openssl rand -hex 16)"
[ ${#PW} -eq 32 ] || { echo "[agenti-pw] ERRORE: password di lunghezza sbagliata" >&2; exit 1; }
applica_al_ruolo "$PW"
scrivi_file "$PW"
unset PW
if [ "$RUOTA" = 1 ]; then
  verifica_finale "password RUOTATA: $RUOLO ha LOGIN, credenziale nuova in $FILE"
else
  verifica_finale "$RUOLO ha LOGIN, credenziale in $FILE"
fi
