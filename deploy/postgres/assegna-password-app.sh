#!/usr/bin/env bash
#
# deploy/postgres/assegna-password-app.sh — #223 F3
#
# Da' una password a `heuresys_app`, gli accende il LOGIN, e la deposita nel
# `.env` dell'host su cui gira. Va eseguito SULLA MACCHINA, mai da remoto con la
# password come argomento.
#
# PERCHE' ESISTE COME SCRIPT invece che come sequenza di comandi a mano: il
# segreto non deve MAI comparire in un contesto, in una cronologia di shell, in
# un log o in un file versionato. Qui nasce sul posto, passa a psql via stdin e
# si scrive nel `.env`: non viene mai stampato, e nessuno dei passaggi lo
# espone. Questo file puo' stare nel repo proprio perche' non lo contiene —
# contiene il MODO di produrlo.
#
# USO
#     ssh oracle-vm-default 'bash -s' < deploy/postgres/assegna-password-app.sh
#     ssh oracle-vm-default 'bash -s -- --ruota' < deploy/postgres/assegna-password-app.sh
#
# IDEMPOTENTE (P5, 24/11/2026). Senza opzioni NON ruota mai:
#   - il `.env` ha gia' una password e `heuresys_app` entra con quella -> non cambia niente;
#   - il `.env` ce l'ha ma il ruolo non la accetta (LOGIN spento, password diversa nel
#     cluster) -> si riapplica AL RUOLO quella del `.env`, che non si tocca: e' la
#     credenziale che l'API sta gia' usando. Solo se il server risponde: un server
#     irraggiungibile non e' una password rifiutata;
#   - il `.env` non ce l'ha e il ruolo nemmeno -> se ne crea una (prima assegnazione);
#   - il `.env` non ce l'ha ma il ruolo si' -> esce 1 senza toccare niente: crearne una
#     nuova sarebbe una rotazione, e lo decide solo `--ruota`.
# Un secondo lancio senza opzioni, quindi, non cambia niente. Con `--ruota` se ne crea
# una nuova comunque e si riallinea il `.env` (il comportamento di prima del 24/11).
# Prima di P5 ogni lancio ruotava: rilanciarlo «per sicurezza» cambiava la credenziale
# sotto un'API in servizio, che se ne sarebbe accorta solo al riavvio.
set -euo pipefail

uso() { echo "[app-pw] uso: assegna-password-app.sh [--ruota]" >&2; exit 2; }
RUOTA=0
[ $# -le 1 ] || uso
case "${1:-}" in
  '')      ;;
  --ruota) RUOTA=1 ;;
  *)       uso ;;
esac

REPO="${REPO:-$HOME/heuresys-advanced}"
ENVF="$REPO/.env"
RUOLO="heuresys_app"

[ -f "$ENVF" ] || { echo "[app-pw] ERRORE: $ENVF non esiste" >&2; exit 1; }

# Il ruolo deve esistere gia': crearlo e' compito di ruoli.sql, che assegna anche
# i privilegi. Uno script che facesse entrambe le cose nasconderebbe il fatto che
# i privilegi sono la parte che conta.
if ! sudo -u postgres psql -tAqc "SELECT 1 FROM pg_roles WHERE rolname='$RUOLO'" | grep -q 1; then
  echo "[app-pw] ERRORE: il ruolo $RUOLO non esiste — esegui prima deploy/postgres/ruoli.sql" >&2
  exit 1
fi

# Valore di una chiave del `.env` senza stamparlo: vince l'ultima riga, come quando la
# shell lo carica; ammessi spazi iniziali ed `export`; via il CR e una coppia di virgolette.
valore_env() {
  sed -n "s/^[[:space:]]*\(export[[:space:]]\{1,\}\)\{0,1\}$1=//p" "$ENVF" | tail -n 1 | tr -d '\r' \
    | sed "s/^'\(.*\)'\$/\1/; s/^\"\(.*\)\"\$/\1/"
}
DB_HOST="$(valore_env POSTGRES_HOST)"; DB_PORT="$(valore_env POSTGRES_PORT)"; DB_NOME="$(valore_env POSTGRES_DB)"

# Il ruolo entra DAVVERO con questa password, dove l'API si collega? La password passa a
# psql nell'ambiente (PGPASSWORD, come prova-identita-app.sh), mai fra gli argomenti.
accetta() {  # $1 = password
  [ -n "$1" ] || return 1
  local r
  r="$(PGPASSWORD="$1" PGCONNECT_TIMEOUT=5 psql -X -w -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
         -U "$RUOLO" -d "${DB_NOME:-heuresys_advanced}" -tAqc 'select 1' 2>/dev/null)" || return 1
  [ "$(printf '%s' "$r" | tr -d '[:space:]')" = "1" ]
}
# Il server dove l'API si collega risponde? Distingue «password rifiutata» da «non arrivo».
risponde() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q -t 5 -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}"
  else
    sudo -u postgres psql -tAqc 'select 1' >/dev/null 2>&1
  fi
}
# Il ruolo ha gia' una password nel cluster? (un ruolo appena creato da ruoli.sql no)
ha_password() {
  sudo -u postgres psql -tAqc "SELECT 1 FROM pg_authid WHERE rolname='$RUOLO' AND rolpassword IS NOT NULL" | grep -q 1
}

# La password arriva a psql via STDIN dentro un ALTER ROLE ... PASSWORD: non
# compare fra gli argomenti del processo, quindi non e' visibile con `ps`. Nella stessa
# transazione si spengono, solo per lei, il log delle istruzioni lente o in errore e
# pg_stat_statements, che altrimenti ne conserverebbero il testo (password compresa).
# ON_ERROR_STOP: se l'ALTER fallisce, psql esce non zero e il file non si scrive.
applica_al_ruolo() {  # $1 = password
  printf "BEGIN;\nSET LOCAL log_statement = 'none';\nSET LOCAL log_min_duration_statement = -1;\nSET LOCAL log_min_error_statement = 'panic';\nSET LOCAL pg_stat_statements.track_utility = off;\nALTER ROLE %s LOGIN PASSWORD %s;\nCOMMIT;\n" \
    "$RUOLO" "$(printf "%s" "$1" | sed "s/'/''/g; s/^/'/; s/$/'/")" \
    | sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d heuresys_advanced -f - >/dev/null
}

# Sostituzione del .env: copia di sicurezza prima (e' gitignored e REALE, non c'e' una
# versione da cui ripescarlo), temporaneo nella stessa cartella, mv atomico.
TMP_ENV=""
trap '[ -z "$TMP_ENV" ] || rm -f "$TMP_ENV"' EXIT
sostituisci_env() {  # stdin = contenuto nuovo
  cp -p "$ENVF" "$ENVF.bak"
  TMP_ENV="$(mktemp "$ENVF.XXXXXX")"
  cat > "$TMP_ENV"
  chmod 600 "$TMP_ENV"
  mv -f "$TMP_ENV" "$ENVF"
  TMP_ENV=""
}
# `POSTGRES_APP_USER`/`POSTGRES_APP_PASSWORD`: non si tocca `POSTGRES_USER`, che resta il migrator.
scrivi_env() {  # $1 = password
  { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_APP_(USER|PASSWORD)=' "$ENVF" || true
    printf 'POSTGRES_APP_USER=%s\n' "$RUOLO"
    printf 'POSTGRES_APP_PASSWORD=%s\n' "$1"
  } | sostituisci_env
}
scrivi_utente() {  # solo la riga dell'utente; quella della password resta com'e'
  { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_APP_USER=' "$ENVF" || true
    printf 'POSTGRES_APP_USER=%s\n' "$RUOLO"
  } | sostituisci_env
}

# Prova che l'identita' si colleghi DAVVERO con la password del .env. Senza, avremmo
# scritto una credenziale e sperato: e la scoperta arriverebbe al riavvio dell'API.
verifica_finale() {  # $1 = messaggio di riuscita
  if accetta "$(valore_env POSTGRES_APP_PASSWORD)"; then
    echo "[app-pw] ok — $1"
  else
    echo "[app-pw] ERRORE: $RUOLO non entra con la password del .env (host ${DB_HOST:-localhost}, porta ${DB_PORT:-5432})" >&2
    exit 1
  fi
}

ATTUALE="$(valore_env POSTGRES_APP_PASSWORD)"
if [ "$RUOTA" = 0 ] && [ -n "$ATTUALE" ]; then
  fatto=""
  if ! accetta "$ATTUALE"; then
    if ! risponde; then
      unset ATTUALE
      echo "[app-pw] ERRORE: il server su ${DB_HOST:-localhost}:${DB_PORT:-5432} non risponde: non tocco il ruolo" >&2
      exit 1
    fi
    # Si riapplica solo una password nel formato che questo script produce: un valore
    # scritto a mano, con caratteri da citare, non si manda al server alla cieca.
    if ! printf '%s' "$ATTUALE" | grep -qxE '[0-9a-f]{32}'; then
      unset ATTUALE
      echo "[app-pw] ERRORE: $RUOLO non accetta la password del .env, che non e' nel formato di questo script: non la riapplico. Per crearne una nuova: --ruota" >&2
      exit 1
    fi
    applica_al_ruolo "$ATTUALE"
    fatto="riapplicata al ruolo la password gia' nel .env (il .env non cambia)"
  fi
  unset ATTUALE
  if [ "$(valore_env POSTGRES_APP_USER)" != "$RUOLO" ]; then
    scrivi_utente
    fatto="${fatto:+$fatto; }POSTGRES_APP_USER riscritto nel .env, password intatta (backup: .env.bak)"
  fi
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password del .env (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

if [ "$RUOTA" = 0 ] && ha_password; then
  echo "[app-pw] ERRORE: il .env non ha POSTGRES_APP_PASSWORD ma $RUOLO ha gia' una password nel cluster: crearne una nuova sarebbe una rotazione. Se e' voluta: --ruota" >&2
  exit 1
fi

# 32 caratteri esadecimali = 128 bit. Niente simboli: finisce in un `.env` letto
# da shell e da librerie diverse, e un carattere da citare e' un guasto in attesa.
#
# ⚠ NON si usa `tr -dc ... < /dev/urandom | head -c N`, che e' la forma piu'
# diffusa e qui era SBAGLIATA: `head` chiude la pipe appena ha i suoi N byte,
# `tr` riceve SIGPIPE, e con `set -o pipefail` lo script muore con exit 141 —
# misurato, alla prima esecuzione. `openssl rand` produce una quantita' finita e
# non ha pipe da rompere.
PW="$(openssl rand -hex 16)"
[ ${#PW} -eq 32 ] || { echo "[app-pw] ERRORE: password di lunghezza sbagliata" >&2; exit 1; }

applica_al_ruolo "$PW"
scrivi_env "$PW"
unset PW

if [ "$RUOTA" = 1 ]; then
  verifica_finale "password RUOTATA: $RUOLO ha LOGIN e la credenziale nuova e' nel .env (backup: .env.bak)"
else
  verifica_finale "$RUOLO ha LOGIN e la credenziale e' nel .env (backup: .env.bak)"
fi
