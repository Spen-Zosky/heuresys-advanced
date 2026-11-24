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
#     che non si tocca (e' quella che gli agenti stanno usando), se il server risponde;
#   - il file non c'e' o non ha la password, e il ruolo nemmeno -> se ne crea una;
#   - il file non ce l'ha ma il ruolo si' (per esempio: lanciato da un altro utente, con
#     un'altra HOME) -> esce 1 senza toccare niente: sarebbe una rotazione.
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

# Valore di una chiave del file senza stamparlo (vince l'ultima riga, come quando
# psql-agenti.sh lo carica; via il CR).
valore() {  # $1 = chiave
  [ -f "$FILE" ] || return 0
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1=//p" "$FILE" | tail -n 1 | tr -d '\r'
}

# Il ruolo entra DAVVERO con questa password? PGPASSWORD come psql-agenti.sh, mai argv.
accetta() {  # $1 = password
  [ -n "$1" ] || return 1
  local r
  r="$(PGPASSWORD="$1" PGCONNECT_TIMEOUT=5 psql -X -w -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
         -U "$RUOLO" -d "$DB" -tAqc 'select 1' 2>/dev/null)" || return 1
  [ "$(printf '%s' "$r" | tr -d '[:space:]')" = "1" ]
}
risponde() {  # «password rifiutata» non e' «server irraggiungibile»
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q -t 5 -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}"
  else
    sudo -u postgres psql -tAqc 'select 1' >/dev/null 2>&1
  fi
}
ha_password() {
  sudo -u postgres psql -tAqc "SELECT 1 FROM pg_authid WHERE rolname='$RUOLO' AND rolpassword IS NOT NULL" | grep -q 1
}

# Via stdin, mai argv; nella stessa transazione niente log dell'istruzione e niente
# pg_stat_statements (ne conserverebbero il testo). ON_ERROR_STOP: se l'ALTER fallisce,
# il file non si scrive. La password e' di 32 esadecimali: niente da citare.
applica_al_ruolo() {  # $1 = password
  printf "BEGIN;\nSET LOCAL log_statement = 'none';\nSET LOCAL log_min_duration_statement = -1;\nSET LOCAL log_min_error_statement = 'panic';\nSET LOCAL pg_stat_statements.track_utility = off;\nALTER ROLE %s LOGIN PASSWORD '%s';\nCOMMIT;\n" \
    "$RUOLO" "$1" | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" -f - >/dev/null
}

TMP_F=""
trap '[ -z "$TMP_F" ] || rm -f "$TMP_F"' EXIT
sostituisci_file() {  # stdin = contenuto nuovo; temporaneo nella stessa cartella, mv atomico
  mkdir -p "$DIR"; chmod 700 "$DIR"
  TMP_F="$(mktemp "$FILE.XXXXXX")"
  cat > "$TMP_F"
  chmod 600 "$TMP_F"
  mv -f "$TMP_F" "$FILE"
  TMP_F=""
}
scrivi_file() {  # $1 = password
  printf 'POSTGRES_AGENT_USER=%s\nPOSTGRES_AGENT_PASSWORD=%s\n' "$RUOLO" "$1" | sostituisci_file
}
scrivi_utente() {  # solo la riga dell'utente; le altre restano
  { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_AGENT_USER=' "$FILE" || true
    printf 'POSTGRES_AGENT_USER=%s\n' "$RUOLO"
  } | sostituisci_file
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
  fatto=""
  if ! accetta "$ATTUALE"; then
    if ! risponde; then
      unset ATTUALE
      echo "[agenti-pw] ERRORE: il server su ${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5432} non risponde: non tocco il ruolo" >&2
      exit 1
    fi
    # Si riapplica solo il formato che questo script produce (32 esadecimali): e' anche
    # cio' che rende sicuro metterla fra apici nell'ALTER ROLE.
    if ! printf '%s' "$ATTUALE" | grep -qxE '[0-9a-f]{32}'; then
      unset ATTUALE
      echo "[agenti-pw] ERRORE: $RUOLO non accetta la password di $FILE, che non e' nel formato di questo script: non la riapplico. Per crearne una nuova: --ruota" >&2
      exit 1
    fi
    applica_al_ruolo "$ATTUALE"
    fatto="riapplicata al ruolo la password gia' in $FILE (il file non cambia)"
  fi
  unset ATTUALE
  if [ "$(valore POSTGRES_AGENT_USER)" != "$RUOLO" ]; then
    scrivi_utente
    fatto="${fatto:+$fatto; }POSTGRES_AGENT_USER riscritto in $FILE, password intatta"
  fi
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password di $FILE (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

if [ "$RUOTA" = 0 ] && ha_password; then
  echo "[agenti-pw] ERRORE: $FILE non ha la password ma $RUOLO ne ha gia' una nel cluster: crearne una nuova sarebbe una rotazione. Se e' voluta: --ruota" >&2
  exit 1
fi

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
