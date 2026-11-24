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
#     che non si tocca (e' quella che gli agenti stanno usando), se il server risponde.
#     La fonte e' il file nella HOME di chi lancia (stampato nel messaggio);
#   - il file non c'e' o non ha la password, e il ruolo nemmeno -> se ne crea una;
#   - il file non ce l'ha ma il ruolo si' (per esempio: lanciato da un altro utente, con
#     un'altra HOME) -> esce 1 senza toccare niente: sarebbe una rotazione.
# Un controllo sul cluster che non riesce non vale mai come «no»: lo script esce 1.
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

# Domanda al cluster che risponde 1 o 0; un errore o altro NON e' uno 0.
chiedi() {  # $1 = SELECT che restituisce 0 o 1
  local r
  r="$(sudo -u postgres psql -X -tAqc "$1" 2>/dev/null)" \
    || { echo "[agenti-pw] ERRORE: non riesco a interrogare il cluster (sudo -u postgres psql): non tocco niente" >&2; exit 1; }
  case "$(printf '%s' "$r" | tr -d '[:space:]')" in
    1) return 0 ;;
    0) return 1 ;;
    *) echo "[agenti-pw] ERRORE: risposta inattesa dal cluster: non tocco niente" >&2; exit 1 ;;
  esac
}

chiedi "SELECT count(*) FROM pg_roles WHERE rolname='$RUOLO'" \
  || { echo "[agenti-pw] ERRORE: $RUOLO non esiste, esegui prima ruolo-agenti.sql" >&2; exit 1; }

# Valore di una chiave del file senza stamparlo (vince l'ultima riga, come quando
# psql-agenti.sh lo carica; via il CR).
valore() {  # $1 = chiave
  [ -f "$FILE" ] || return 0
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1=//p" "$FILE" | tail -n 1 | tr -d '\r'
}
if [ -f "$FILE" ] && grep -q $'\r' "$FILE"; then
  echo "[agenti-pw] ATTENZIONE: $FILE ha fine riga CRLF: psql-agenti.sh ed env-agenti.sh lo leggerebbero con il CR. Lo script lo legge senza, ma il file va corretto" >&2
fi

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
    sudo -u postgres psql -X -tAqc 'select 1' >/dev/null 2>&1
  fi
}

# Via stdin, mai argv; nella stessa transazione niente log dell'istruzione e niente
# pg_stat_statements (ne conserverebbero il testo). ON_ERROR_STOP: se l'ALTER fallisce,
# il file non si scrive. La password e' di 32 esadecimali: niente da citare.
applica_al_ruolo() {  # $1 = password
  printf "BEGIN;\nSET LOCAL log_statement = 'none';\nSET LOCAL log_min_duration_statement = -1;\nSET LOCAL log_min_error_statement = 'panic';\nSET LOCAL pg_stat_statements.track_utility = off;\nALTER ROLE %s LOGIN PASSWORD '%s';\nCOMMIT;\n" \
    "$RUOLO" "$1" | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f - >/dev/null
}

# Il file nuovo si PREPARA prima di toccare il ruolo (temporaneo nella stessa cartella,
# modo 600); dopo l'ALTER resta solo il mv.
TMP_F=""
trap '[ -z "$TMP_F" ] || rm -f "$TMP_F"' EXIT
prepara_file() {  # $1 = password da scrivere, oppure vuoto = riscrivi solo la riga utente
  mkdir -p "$DIR"; chmod 700 "$DIR"
  TMP_F="$(mktemp "$FILE.XXXXXX")"
  chmod 600 "$TMP_F"
  if [ -n "$1" ]; then
    printf 'POSTGRES_AGENT_USER=%s\nPOSTGRES_AGENT_PASSWORD=%s\n' "$RUOLO" "$1" > "$TMP_F"
  else
    { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_AGENT_USER=' "$FILE" || [ $? -eq 1 ]
      printf 'POSTGRES_AGENT_USER=%s\n' "$RUOLO"
    } > "$TMP_F"
  fi
}
installa_file() {  # $1 = 1 se il ruolo e' gia' stato cambiato
  if ! mv -f "$TMP_F" "$FILE"; then
    if [ "$1" = 1 ]; then
      echo "[agenti-pw] ERRORE: il ruolo ha la password nuova ma $FILE non e' stato sostituito. Il file nuovo e' in $TMP_F (modo 600): spostalo su $FILE a mano" >&2
      TMP_F=""   # non si toglie: e' l'unica copia della credenziale nuova
    else
      echo "[agenti-pw] ERRORE: $FILE non e' stato sostituito; il ruolo non e' cambiato" >&2
    fi
    exit 1
  fi
  TMP_F=""
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
    prepara_file ""
    installa_file 0
    fatto="${fatto:+$fatto; }POSTGRES_AGENT_USER riscritto in $FILE, password intatta"
  fi
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password di $FILE (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

if [ "$RUOTA" = 0 ] && chiedi "SELECT (rolpassword IS NOT NULL)::int FROM pg_authid WHERE rolname='$RUOLO'"; then
  echo "[agenti-pw] ERRORE: $FILE non ha la password ma $RUOLO ne ha gia' una nel cluster: crearne una nuova sarebbe una rotazione. Se e' voluta: --ruota" >&2
  exit 1
fi

PW="$(openssl rand -hex 16)"
[ ${#PW} -eq 32 ] || { echo "[agenti-pw] ERRORE: password di lunghezza sbagliata" >&2; exit 1; }
prepara_file "$PW"
applica_al_ruolo "$PW"
unset PW
installa_file 1
if [ "$RUOTA" = 1 ]; then
  verifica_finale "password RUOTATA: $RUOLO ha LOGIN, credenziale nuova in $FILE (gli agenti la usano alla prossima connessione)"
else
  verifica_finale "$RUOLO ha LOGIN, credenziale in $FILE"
fi
