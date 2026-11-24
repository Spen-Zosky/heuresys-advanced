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
#     credenziale che l'API sta gia' usando;
#   - il `.env` non ce l'ha -> se ne crea una (prima assegnazione).
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
# shell lo carica; via il CR e una coppia di virgolette attorno.
valore_env() {
  sed -n "s/^$1=//p" "$ENVF" | tail -n 1 | tr -d '\r' | sed "s/^'\(.*\)'\$/\1/; s/^\"\(.*\)\"\$/\1/"
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

# La password arriva a psql via STDIN dentro un ALTER ROLE ... PASSWORD: non
# compare fra gli argomenti del processo, quindi non e' visibile con `ps`.
applica_al_ruolo() {  # $1 = password
  printf "ALTER ROLE %s LOGIN PASSWORD %s;\n" "$RUOLO" "$(printf "%s" "$1" | sed "s/'/''/g; s/^/'/; s/$/'/")" \
    | sudo -u postgres psql -q -d heuresys_advanced -f -
}

# Deposito nel .env. `POSTGRES_APP_USER`/`POSTGRES_APP_PASSWORD` sono nuove:
# non si tocca `POSTGRES_USER`, che resta il migrator.
scrivi_env() {  # $1 = password
  # Copia di sicurezza del .env prima di toccarlo: e' gitignored e REALE, quindi
  # non c'e' una versione da cui ripescarlo se si rompe.
  cp -p "$ENVF" "$ENVF.bak"
  local tmp
  tmp="$(mktemp)"
  grep -v -E '^POSTGRES_APP_(USER|PASSWORD)=' "$ENVF" > "$tmp" || true
  printf 'POSTGRES_APP_USER=%s\n' "$RUOLO" >> "$tmp"
  printf 'POSTGRES_APP_PASSWORD=%s\n' "$1" >> "$tmp"
  install -m 600 "$tmp" "$ENVF"
  rm -f "$tmp"
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
  if [ "$(valore_env POSTGRES_APP_USER)" != "$RUOLO" ]; then
    scrivi_env "$ATTUALE"
    fatto="${fatto:+$fatto; }POSTGRES_APP_USER riscritto nel .env, stessa password (backup: .env.bak)"
  fi
  unset ATTUALE
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password del .env (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

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
