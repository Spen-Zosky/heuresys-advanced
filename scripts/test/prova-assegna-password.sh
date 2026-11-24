#!/usr/bin/env bash
#
# scripts/test/prova-assegna-password.sh — P5 (24/11/2026)
#
# Prova deploy/postgres/assegna-password-app.sh e assegna-password-agenti.sh su un
# cluster PostgreSQL PRIVATO, creato qui con initdb in una cartella temporanea e tolto
# all'uscita: niente porta TCP (solo un socket nella cartella), nessun contatto con il
# cluster vero. Un database usa e getta sul cluster vero NON basterebbe: i ruoli sono
# del cluster, e un ALTER ROLE heuresys_app cambierebbe la password di produzione.
#
# `sudo -u postgres psql ...` degli script arriva a un `sudo` finto che lo gira al
# cluster privato; HOME, REPO, il `.env` e ~/.config/claude-agenti/db-agenti.env sono
# finti, sotto la cartella della prova, e la prova si ferma se non lo sono. Nessuna
# password viene stampata: si confrontano impronte SHA-256 dello stato (file +
# verificatore del ruolo in pg_authid). Il cluster registra ogni istruzione
# (log_statement=all), e alla fine nel suo log non deve esserci nessuna password.
#
# Esce 0 se tutto e' verde, 1 altrimenti. Se mancano initdb/psql/openssl, o su Windows
# (gli script girano solo sulla VM), stampa SALTATA ed esce 0.
# PROVA_IMPRONTE=<file>: vi scrive le impronte dei due lanci di fila (per i rapporti).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
# Niente dall'ambiente puo' dirottare psql o le shell figlie verso il cluster vero:
# PGSERVICE/PGSERVICEFILE vincerebbero su PGHOST/PGPORT del sudo finto, BASH_ENV/ENV
# farebbero eseguire codice a ogni `bash` lanciato dalla prova.
for v in $(compgen -e | grep '^PG'); do unset "$v"; done
unset BASH_ENV ENV
APP="$ROOT/deploy/postgres/assegna-password-app.sh"
AGE="$ROOT/deploy/postgres/assegna-password-agenti.sh"
FAIL=0
ok()   { printf '  ok   %s\n' "$*"; }
fail() { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$*" >&2; }

case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*) echo "  SALTATA: Windows — i due script girano solo sulla VM (sudo -u postgres)"; exit 0 ;;
esac
BIN=""
for d in "$(pg_config --bindir 2>/dev/null)" /usr/lib/postgresql/*/bin; do
  [ -n "$d" ] && [ -x "$d/initdb" ] && [ -x "$d/pg_ctl" ] && { BIN="$d"; break; }
done
if [ -z "$BIN" ] || ! command -v psql >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  echo "  SALTATA: initdb, psql o openssl assenti (serve un PostgreSQL installato)"
  exit 0
fi

T="$(mktemp -d)" && [ -n "$T" ] || { echo "mktemp fallito" >&2; exit 1; }
SOCK="$T/sock"; PORTA=54329; SUPER=prova_super
chiudi() { "$BIN/pg_ctl" -D "$T/dati" -m immediate stop >/dev/null 2>&1; rm -rf "$T"; }
trap chiudi EXIT
mkdir -p "$SOCK" "$T/bin" "$T/casa/heuresys-advanced"

# pg_stat_statements, se la libreria c'e': gli script non devono lasciarci la password.
PSS_OPT=""
if [ -f "$("$BIN/pg_config" --pkglibdir 2>/dev/null || pg_config --pkglibdir 2>/dev/null)/pg_stat_statements.so" ]; then
  PSS_OPT="-c shared_preload_libraries=pg_stat_statements -c pg_stat_statements.track_utility=on"
fi
"$BIN/initdb" -D "$T/dati" -U "$SUPER" -A trust >/dev/null 2>&1 || { echo "initdb fallito" >&2; exit 1; }
printf 'local all %s trust\nlocal all all scram-sha-256\n' "$SUPER" > "$T/dati/pg_hba.conf"
"$BIN/pg_ctl" -D "$T/dati" -l "$T/log" -w \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -c port=$PORTA -c log_statement=all -c log_min_duration_statement=0 $PSS_OPT" start >/dev/null 2>&1 \
  || { echo "il cluster privato non parte:" >&2; cat "$T/log" >&2; exit 1; }

su() { psql -X -q -h "$SOCK" -p "$PORTA" -U "$SUPER" -d postgres -v ON_ERROR_STOP=1 -tA "$@"; }
su -c "CREATE DATABASE heuresys_advanced" >/dev/null
[ -z "$PSS_OPT" ] || su -c "CREATE EXTENSION pg_stat_statements" >/dev/null

# sudo finto: toglie -n / -u <utente> e manda psql al cluster privato, nel database
# `postgres` come fa psql lanciato dall'utente postgres.
cat > "$T/bin/sudo" <<EOF
#!/bin/sh
while [ \$# -gt 0 ]; do case "\$1" in -n) shift ;; -u) shift 2 ;; *) break ;; esac; done
if [ -n "\${FINTO_ERRORE_AUTHID:-}" ]; then case "\$*" in *pg_authid*) exit 2 ;; esac; fi
exec env PGHOST='$SOCK' PGPORT='$PORTA' PGUSER='$SUPER' PGDATABASE=postgres "\$@"
EOF
chmod +x "$T/bin/sudo"
export PATH="$T/bin:$PATH" HOME="$T/casa" REPO="$T/casa/heuresys-advanced"
# Tutto cio' che gli script scrivono deve stare sotto $T: altrimenti ci si ferma.
[ "$(command -v sudo)" = "$T/bin/sudo" ] || { echo "sudo finto non in testa al PATH: mi fermo" >&2; exit 1; }
case "$REPO" in "$T"/*) ;; *) echo "REPO fuori dalla prova: mi fermo" >&2; exit 1 ;; esac
case "$HOME" in "$T"/*) ;; *) echo "HOME fuori dalla prova: mi fermo" >&2; exit 1 ;; esac
# E per la stessa strada degli script (una shell figlia): sudo -u postgres psql deve
# arrivare al cluster privato, non a un altro.
[ "$(bash -c 'sudo -u postgres psql -X -tAqc "show data_directory"' 2>/dev/null)" = "$T/dati" ] \
  || { echo "sudo -u postgres psql non arriva al cluster della prova: mi fermo" >&2; exit 1; }
# Per assegna-password-agenti.sh (host/porta dall'ambiente, come psql-agenti.sh)
export POSTGRES_HOST="$SOCK" POSTGRES_PORT="$PORTA"

ENVF="$REPO/.env"
printf 'POSTGRES_HOST=%s\nPOSTGRES_PORT=%s\nPOSTGRES_DB=heuresys_advanced\nALTRA=1\n' "$SOCK" "$PORTA" > "$ENVF"
AGF="$T/casa/.config/claude-agenti/db-agenti.env"
USCITE="$T/uscite.txt"; : > "$USCITE"
VISTE="$T/password-viste.txt"; : > "$VISTE"

impronta() {  # $1 = ruolo, $2.. = file
  local r="$1"; shift
  { su -c "SELECT rolcanlogin, coalesce(rolpassword,'') FROM pg_authid WHERE rolname='$r'"
    for f in "$@"; do if [ -f "$f" ]; then cat "$f"; else echo "assente $f"; fi; done
  } | sha256sum | cut -c1-64
}
pw_di() { sed -n "s/^$2=//p" "$1" 2>/dev/null | tail -n 1 | tr -d '\r'; }  # $1 file, $2 chiave
entra() {  # $1 = ruolo, $2 = file, $3 = chiave
  local pw; pw="$(pw_di "$2" "$3")"
  [ "$(PGPASSWORD="$pw" psql -X -w -h "$SOCK" -p "$PORTA" -U "$1" -d heuresys_advanced -tAc 'select 1' 2>/dev/null)" = 1 ]
}
annota() { [ -n "${PROVA_IMPRONTE:-}" ] && printf '%s\n' "$*" >> "$PROVA_IMPRONTE"; return 0; }
# lancia: come in produzione (app: `bash -s` da stdin; agenti: `bash file`); tiene ogni
# uscita e ogni password comparsa nel file, per controllare alla fine che non escano.
lancia() {  # $1 = nome, $2 = script, $3 = file, $4 = chiave, $5.. = argomenti
  local nome="$1" sc="$2" f="$3" k="$4"; shift 4
  if [ "$nome" = app ]; then o="$(bash -s -- "$@" < "$sc" 2>&1)"; rc=$?
  else o="$(bash "$sc" "$@" 2>&1)"; rc=$?; fi
  printf '%s\n' "$o" >> "$USCITE"
  local p; p="$(pw_di "$f" "$k")"; [ -z "$p" ] || printf '%s\n' "$p" >> "$VISTE"
}

prova() {  # $1 = nome, $2 = script, $3 = ruolo, $4 = file, $5 = chiave, $6.. = file nell'impronta
  local nome="$1" sc="$2" ru="$3" f="$4" k="$5"; shift 5
  local i1 i2 i3 sf
  lancia "$nome" "$sc" "$f" "$k"
  { [ $rc = 1 ] && grep -q 'ruol.* non esiste\|non esiste, esegui' <<<"$o"; } && ok "$nome: ruolo assente -> esce 1" || fail "$nome ruolo assente ($rc: $o)"
  su -c "CREATE ROLE $ru NOLOGIN" >/dev/null
  lancia "$nome" "$sc" "$f" "$k" --boh
  [ $rc = 2 ] && ok "$nome: argomento sconosciuto -> esce 2" || fail "$nome argomento sconosciuto ($rc)"

  lancia "$nome" "$sc" "$f" "$k"; i1="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && entra "$ru" "$f" "$k"; } && ok "$nome: prima assegnazione, il ruolo entra" || fail "$nome prima assegnazione ($rc: $o)"
  lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  annota "$nome lancio1 $i1"; annota "$nome lancio2 $i2"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: secondo lancio senza opzioni -> stato identico (SHA-256), «invariato»" \
    || fail "$nome secondo lancio ($rc, $i1 / $i2: $o)"

  lancia "$nome" "$sc" "$f" "$k" --ruota; i3="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i3" != "$i2" ] && entra "$ru" "$f" "$k" && grep -q 'RUOTATA' <<<"$o"; } \
    && ok "$nome: --ruota -> password nuova, il ruolo entra" || fail "$nome --ruota ($rc: $o)"

  sf="$(sha256sum < "$f")"
  su -c "ALTER ROLE $ru PASSWORD 'un-altra-password'" >/dev/null
  lancia "$nome" "$sc" "$f" "$k"
  { [ $rc = 0 ] && [ "$(sha256sum < "$f")" = "$sf" ] && entra "$ru" "$f" "$k" && grep -q 'riapplicata' <<<"$o"; } \
    && ok "$nome: ruolo con un'altra password -> riapplica quella del file, file invariato" \
    || fail "$nome password diversa nel cluster ($rc: $o)"
  su -c "ALTER ROLE $ru NOLOGIN" >/dev/null
  lancia "$nome" "$sc" "$f" "$k"
  { [ $rc = 0 ] && [ "$(sha256sum < "$f")" = "$sf" ] && entra "$ru" "$f" "$k"; } \
    && ok "$nome: LOGIN spento -> riacceso con la password del file" || fail "$nome LOGIN spento ($rc: $o)"
  i1="$(impronta "$ru" "$@")"; lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: dopo il riallineamento il lancio seguente non cambia niente" || fail "$nome dopo riallineamento ($rc)"

  # fine riga CRLF: la password si legge lo stesso, niente cambia
  sed -i 's/$/\r/' "$f"; i1="$(impronta "$ru" "$@")"
  lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: file con fine riga CRLF -> letto, niente cambia" || fail "$nome CRLF ($rc: $o)"
  sed -i 's/\r$//' "$f"

  # righe doppie: vince l'ultima (come quando la shell carica il file); `export` ammesso
  local buona; buona="$(grep "^$k=" "$f")"
  sed -i "1i $k=00000000000000000000000000000000" "$f"
  i1="$(impronta "$ru" "$@")"; lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: chiave ripetuta nel file -> vale l'ultima riga, niente cambia" || fail "$nome righe doppie ($rc: $o)"
  sed -i "1d" "$f"
  sed -i "s/^$k=/export $k=/" "$f"
  i1="$(impronta "$ru" "$@")"; lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: riga con export -> letta, niente cambia" || fail "$nome export ($rc: $o)"
  sed -i "s/^export $k=/$k=/" "$f"
  [ "$(grep "^$k=" "$f")" = "$buona" ] || fail "$nome: la prova ha alterato la riga della password"

  # riga dell'utente sbagliata: si corregge solo quella, la password resta identica
  local ku="${k%PASSWORD}USER" pr
  pr="$(grep "^$k=" "$f")"
  sed -i "s/^$ku=.*/$ku=qualcun_altro/" "$f"
  lancia "$nome" "$sc" "$f" "$k"
  { [ $rc = 0 ] && [ "$(grep "^$k=" "$f")" = "$pr" ] && grep -qx "$ku=$ru" "$f" && entra "$ru" "$f" "$k"; } \
    && ok "$nome: utente sbagliato nel file -> corretta solo quella riga" || fail "$nome riga utente ($rc: $o)"

  # server irraggiungibile e password non accettata: non si tocca il ruolo
  su -c "ALTER ROLE $ru PASSWORD 'irraggiungibile'" >/dev/null
  i1="$(impronta "$ru" "$@")"
  if [ "$nome" = app ]; then sed -i "s/^POSTGRES_PORT=.*/POSTGRES_PORT=1/" "$f"; lancia "$nome" "$sc" "$f" "$k"
    sed -i "s/^POSTGRES_PORT=.*/POSTGRES_PORT=$PORTA/" "$f"
  else POSTGRES_PORT=1 lancia "$nome" "$sc" "$f" "$k"; fi
  i2="$(impronta "$ru" "$@")"
  { [ $rc = 1 ] && grep -q 'non risponde' <<<"$o"; } && [ "$i1" = "$i2" ] \
    && ok "$nome: server irraggiungibile -> esce 1 e non tocca il ruolo" || fail "$nome server irraggiungibile ($rc: $o)"
  lancia "$nome" "$sc" "$f" "$k"   # riallinea per i casi dopo
  entra "$ru" "$f" "$k" || fail "$nome: riallineamento dopo il server irraggiungibile"

  # il file perde la password ma il ruolo ne ha una: niente rotazione implicita
  pr="$(grep "^$k=" "$f")"; sed -i "/^$k=/d" "$f"
  i1="$(impronta "$ru" "$@")"; lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 1 ] && [ "$i1" = "$i2" ] && grep -q -- '--ruota' <<<"$o"; } \
    && ok "$nome: file senza password ma ruolo con password -> esce 1, niente rotazione" || fail "$nome rotazione implicita ($rc: $o)"
  # ... e se la domanda al cluster fallisce, non vale come «no»
  sed -i "/^$k=/d" "$f"
  i1="$(impronta "$ru" "$@")"; FINTO_ERRORE_AUTHID=1 lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 1 ] && [ "$i1" = "$i2" ] && grep -q 'non riesco a interrogare' <<<"$o"; } \
    && ok "$nome: domanda al cluster fallita -> esce 1, niente rotazione" || fail "$nome errore del cluster ($rc: $o)"
  printf '%s\n' "$pr" >> "$f"

  # formato estraneo nel file + ruolo che non lo accetta -> esce 1, niente cambia
  sed -i "s/^$k=.*/$k=non-e-del-formato-x'y/" "$f"
  su -c "ALTER ROLE $ru PASSWORD 'ancora-un-altra'" >/dev/null
  i1="$(impronta "$ru" "$@")"; lancia "$nome" "$sc" "$f" "$k"; i2="$(impronta "$ru" "$@")"
  { [ $rc = 1 ] && [ "$i1" = "$i2" ] && grep -q 'formato' <<<"$o"; } \
    && ok "$nome: password del file in formato estraneo -> esce 1 e non tocca niente" || fail "$nome formato estraneo ($rc: $o)"
}

echo "== assegna-password-app.sh (cluster privato, lanciato con bash -s) =="
prova app "$APP" heuresys_app "$ENVF" POSTGRES_APP_PASSWORD "$ENVF" "$ENVF.bak"
grep -q '^ALTRA=1$' "$ENVF" && ok "app: le altre righe del .env restano" || fail "app: righe del .env perse"
echo "== assegna-password-agenti.sh (cluster privato) =="
prova agenti "$AGE" heuresys_agenti "$AGF" POSTGRES_AGENT_PASSWORD "$AGF"
[ "$(stat -c %a "$AGF" 2>/dev/null)" = 600 ] && ok "agenti: file in modo 600" || fail "agenti: modo del file"

echo "== nessuna password fuori dai file =="
n="$(grep -c . "$VISTE")"
if [ "$n" -ge 4 ] && ! grep -qFf "$VISTE" "$USCITE"; then ok "nessuna delle $n password comparse nei file e' nelle uscite"; else fail "una password e' nelle uscite (o non ne ho viste: $n)"; fi
if grep -q 'ALTER ROLE' "$T/log" && ! grep -qFf "$VISTE" "$T/log"; then
  ok "nel log del server (log_statement=all) nessuna password degli script"
else
  fail "il log del server contiene una password degli script (o non registra: $(grep -c 'ALTER ROLE' "$T/log"))"
fi
resti="$(ls -A "$REPO" "$(dirname "$AGF")" | grep -E '^\.env\.bak\.|^db-agenti\.env\.' || true)"
[ -z "$resti" ] && ok "nessun temporaneo rimasto accanto ai file" || fail "temporanei rimasti: $resti"
if [ -n "$PSS_OPT" ]; then
  if [ "$(su -c "SELECT count(*) FROM pg_stat_statements WHERE query ILIKE '%ALTER ROLE%'")" -ge 1 ] \
     && ! su -c "SELECT query FROM pg_stat_statements" | grep -qFf "$VISTE"; then
    ok "pg_stat_statements: nessuna password degli script"
  else
    fail "pg_stat_statements contiene una password degli script (o non registra)"
  fi
else
  printf '  skip pg_stat_statements assente: controllo non fatto\n'
fi

[ "$FAIL" = 0 ] && echo "prova-assegna-password: tutto verde" || echo "prova-assegna-password: $FAIL rossi"
[ "$FAIL" = 0 ]
