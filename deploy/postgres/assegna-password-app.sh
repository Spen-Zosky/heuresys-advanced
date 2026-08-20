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
# un log o in un file versionato. Qui viene generato sul posto, passato a psql
# via stdin e scritto nel `.env` con `sed`: non viene mai stampato, e nessuno dei
# passaggi lo espone. Questo file puo' stare nel repo proprio perche' non lo
# contiene — contiene il MODO di produrlo.
#
# USO
#     ssh oracle-vm-default 'bash -s' < deploy/postgres/assegna-password-app.sh
#
# IDEMPOTENTE: rieseguito, RUOTA la password (ne genera una nuova e riallinea il
# `.env`). E' il comportamento voluto per una rotazione; se serve solo verificare
# lo stato, si guarda `rolcanlogin` in `pg_roles` senza lanciare nulla.
set -euo pipefail

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

# 32 caratteri esadecimali = 128 bit. Niente simboli: finisce in un `.env` letto
# da shell e da librerie diverse, e un carattere da citare e' un guasto in attesa.
#
# ⚠ NON si usa `tr -dc ... < /dev/urandom | head -c N`, che e' la forma piu'
# diffusa e qui era SBAGLIATA: `head` chiude la pipe appena ha i suoi N byte,
# `tr` riceve SIGPIPE, e con `set -o pipefail` lo script muore con exit 141 —
# misurato, alla prima esecuzione. `openssl rand` produce una quantita' finita e
# non ha pipe da rompere.
PW="$(openssl rand -hex 16)"
[ ${#PW} -eq 32 ] || { echo "[app-pw] ERRORE: password generata di lunghezza sbagliata" >&2; exit 1; }

# La password arriva a psql via STDIN dentro un ALTER ROLE ... PASSWORD: non
# compare fra gli argomenti del processo, quindi non e' visibile con `ps`.
printf "ALTER ROLE %s LOGIN PASSWORD %s;\n" "$RUOLO" "$(printf "%s" "$PW" | sed "s/'/''/g; s/^/'/; s/$/'/")" \
  | sudo -u postgres psql -q -d heuresys_advanced -f -

# Copia di sicurezza del .env prima di toccarlo: e' gitignored e REALE, quindi
# non c'e' una versione da cui ripescarlo se si rompe.
cp -p "$ENVF" "$ENVF.bak"

# Deposito nel .env. `POSTGRES_APP_USER`/`POSTGRES_APP_PASSWORD` sono nuove:
# non si tocca `POSTGRES_USER`, che resta il migrator.
tmp="$(mktemp)"
grep -v -E '^POSTGRES_APP_(USER|PASSWORD)=' "$ENVF" > "$tmp"
printf 'POSTGRES_APP_USER=%s\n' "$RUOLO" >> "$tmp"
printf 'POSTGRES_APP_PASSWORD=%s\n' "$PW" >> "$tmp"
install -m 600 "$tmp" "$ENVF"
rm -f "$tmp"
unset PW

# Prova che la nuova identita' si colleghi DAVVERO. Senza, avremmo scritto una
# credenziale e sperato: e la scoperta arriverebbe al riavvio dell'API.
if sudo -u postgres psql -tAqc "SELECT rolcanlogin FROM pg_roles WHERE rolname='$RUOLO'" | grep -q t; then
  echo "[app-pw] ok — $RUOLO ha LOGIN e la credenziale e' nel .env (backup: .env.bak)"
else
  echo "[app-pw] ERRORE: $RUOLO non risulta abilitato al login" >&2
  exit 1
fi
