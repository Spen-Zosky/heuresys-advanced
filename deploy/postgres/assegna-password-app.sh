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
#     irraggiungibile non e' una password rifiutata. Attenzione: la fonte e' il `.env`
#     di REPO (stampato nel messaggio): lanciato con un altro REPO, vale quello;
#   - il `.env` non ce l'ha e il ruolo nemmeno -> se ne crea una (prima assegnazione);
#   - il `.env` non ce l'ha ma il ruolo si' -> esce 1 senza toccare niente: crearne una
#     nuova sarebbe una rotazione, e lo decide solo `--ruota`.
# Un controllo sul cluster che non riesce non vale mai come «no»: lo script esce 1.
# Un secondo lancio senza opzioni, quindi, non cambia niente. Con `--ruota` se ne crea
# una nuova comunque e si riallinea il `.env` (il comportamento di prima del 24/11);
# l'API in servizio usa la nuova solo dopo il riavvio.
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

# Domanda al cluster che risponde 1 o 0. Un errore di psql, o una risposta diversa,
# NON e' uno 0: lo script si ferma senza toccare niente.
chiedi() {  # $1 = SELECT che restituisce 0 o 1
  local r
  r="$(sudo -u postgres psql -X -tAqc "$1" 2>/dev/null)" \
    || { echo "[app-pw] ERRORE: non riesco a interrogare il cluster (sudo -u postgres psql): non tocco niente" >&2; exit 1; }
  case "$(printf '%s' "$r" | tr -d '[:space:]')" in
    1) return 0 ;;
    0) return 1 ;;
    *) echo "[app-pw] ERRORE: risposta inattesa dal cluster: non tocco niente" >&2; exit 1 ;;
  esac
}

# Il ruolo deve esistere gia': crearlo e' compito di ruoli.sql, che assegna anche
# i privilegi. Uno script che facesse entrambe le cose nasconderebbe il fatto che
# i privilegi sono la parte che conta.
if ! chiedi "SELECT count(*) FROM pg_roles WHERE rolname='$RUOLO'"; then
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
    sudo -u postgres psql -X -tAqc 'select 1' >/dev/null 2>&1
  fi
}

# La password arriva a psql via STDIN dentro un ALTER ROLE ... PASSWORD: non
# compare fra gli argomenti del processo, quindi non e' visibile con `ps`. Nella stessa
# transazione si spengono, solo per lei, il log delle istruzioni lente o in errore e
# pg_stat_statements, che altrimenti ne conserverebbero il testo (password compresa).
# ON_ERROR_STOP: se l'ALTER fallisce, psql esce non zero e il file non si scrive.
applica_al_ruolo() {  # $1 = password
  printf "BEGIN;\nSET LOCAL log_statement = 'none';\nSET LOCAL log_min_duration_statement = -1;\nSET LOCAL log_min_error_statement = 'panic';\nSET LOCAL pg_stat_statements.track_utility = off;\nALTER ROLE %s LOGIN PASSWORD %s;\nCOMMIT;\n" \
    "$RUOLO" "$(printf "%s" "$1" | sed "s/'/''/g; s/^/'/; s/$/'/")" \
    | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d heuresys_advanced -f - >/dev/null
}

# Il .env nuovo si PREPARA prima di toccare il ruolo: copia di sicurezza (e' gitignored e
# REALE, non c'e' una versione da cui ripescarlo) e temporaneo completo nella stessa
# cartella, con un nome che .gitignore copre (`.env.bak*`). Dopo l'ALTER resta solo il mv.
TMP_ENV=""
trap '[ -z "$TMP_ENV" ] || rm -f "$TMP_ENV"' EXIT
prepara_env() {  # $1 = password da scrivere, oppure vuoto = riscrivi solo la riga utente
  cp -p "$ENVF" "$ENVF.bak"
  TMP_ENV="$(mktemp "$ENVF.bak.XXXXXX")"
  chmod 600 "$TMP_ENV"
  if [ -n "$1" ]; then
    # `POSTGRES_USER` non si tocca: resta il migrator. grep esce 1 se non resta niente
    # (va bene), 2 se non riesce a leggere (e allora ci si ferma).
    { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_APP_(USER|PASSWORD)=' "$ENVF" || [ $? -eq 1 ]
      printf 'POSTGRES_APP_USER=%s\n' "$RUOLO"
      printf 'POSTGRES_APP_PASSWORD=%s\n' "$1"
    } > "$TMP_ENV"
  else
    { grep -v -E '^[[:space:]]*(export[[:space:]]+)?POSTGRES_APP_USER=' "$ENVF" || [ $? -eq 1 ]
      printf 'POSTGRES_APP_USER=%s\n' "$RUOLO"
    } > "$TMP_ENV"
  fi
}
installa_env() {  # $1 = 1 se il ruolo e' gia' stato cambiato
  if ! mv -f "$TMP_ENV" "$ENVF"; then
    if [ "$1" = 1 ]; then
      echo "[app-pw] ERRORE: il ruolo ha la password nuova ma $ENVF non e' stato sostituito. Il .env completo e nuovo e' in $TMP_ENV (modo 600): spostalo su $ENVF a mano" >&2
      TMP_ENV=""   # non si toglie: e' l'unica copia della credenziale nuova
    else
      echo "[app-pw] ERRORE: $ENVF non e' stato sostituito; il ruolo non e' cambiato" >&2
    fi
    exit 1
  fi
  TMP_ENV=""
}

# Prova che l'identita' si colleghi DAVVERO con la password del .env. Senza, avremmo
# scritto una credenziale e sperato: e la scoperta arriverebbe al riavvio dell'API.
verifica_finale() {  # $1 = messaggio di riuscita
  if accetta "$(valore_env POSTGRES_APP_PASSWORD)"; then
    echo "[app-pw] ok — $1"
  else
    echo "[app-pw] ERRORE: $RUOLO non entra con la password di $ENVF (host ${DB_HOST:-localhost}, porta ${DB_PORT:-5432})" >&2
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
      echo "[app-pw] ERRORE: $RUOLO non accetta la password di $ENVF, che non e' nel formato di questo script: non la riapplico. Per crearne una nuova: --ruota" >&2
      exit 1
    fi
    applica_al_ruolo "$ATTUALE"
    fatto="riapplicata al ruolo la password gia' in $ENVF (il file non cambia)"
  fi
  unset ATTUALE
  if [ "$(valore_env POSTGRES_APP_USER)" != "$RUOLO" ]; then
    prepara_env ""
    installa_env 0
    fatto="${fatto:+$fatto; }POSTGRES_APP_USER riscritto in $ENVF, password intatta (backup: .env.bak)"
  fi
  [ -n "$fatto" ] || fatto="invariato: $RUOLO entra gia' con la password di $ENVF (per cambiarla: --ruota)"
  verifica_finale "$fatto"
  exit 0
fi
unset ATTUALE

if [ "$RUOTA" = 0 ] && chiedi "SELECT (rolpassword IS NOT NULL)::int FROM pg_authid WHERE rolname='$RUOLO'"; then
  echo "[app-pw] ERRORE: $ENVF non ha POSTGRES_APP_PASSWORD ma $RUOLO ha gia' una password nel cluster: crearne una nuova sarebbe una rotazione. Se e' voluta: --ruota" >&2
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

prepara_env "$PW"
applica_al_ruolo "$PW"
unset PW
installa_env 1

if [ "$RUOTA" = 1 ]; then
  verifica_finale "password RUOTATA: $RUOLO ha LOGIN e la credenziale nuova e' in $ENVF (backup: .env.bak). L'API in servizio la usa solo dopo il riavvio"
else
  verifica_finale "$RUOLO ha LOGIN e la credenziale e' in $ENVF (backup: .env.bak)"
fi
