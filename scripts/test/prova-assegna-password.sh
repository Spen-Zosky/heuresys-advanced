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
# cluster privato; il `.env` e ~/.config/claude-agenti/db-agenti.env sono finti, in una
# casa finta. Nessuna password viene stampata: si confrontano impronte SHA-256 dello
# stato (file + verificatore del ruolo in pg_authid).
#
# Cosa si pretende, per ciascuno dei due script:
#   prima assegnazione -> il ruolo entra con la password del file;
#   secondo lancio senza opzioni -> stato IDENTICO (impronta uguale) e «invariato";
#   --ruota -> password nuova, il ruolo entra con quella;
#   ruolo con un'altra password o senza LOGIN -> riapplica quella del file, il file non cambia;
#   password nel file in un formato estraneo -> esce 1 e non tocca niente;
#   ruolo assente -> esce 1; argomento sconosciuto -> esce 2.
#
# Esce 0 se tutto e' verde, 1 altrimenti; se initdb non c'e' lo dice ed esce 0.
# PROVA_IMPRONTE=<file>: vi scrive le impronte dei due lanci di fila (per i rapporti).
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
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

"$BIN/initdb" -D "$T/dati" -U "$SUPER" -A trust >/dev/null 2>&1 || { echo "initdb fallito" >&2; exit 1; }
printf 'local all %s trust\nlocal all all scram-sha-256\n' "$SUPER" > "$T/dati/pg_hba.conf"
"$BIN/pg_ctl" -D "$T/dati" -l "$T/log" -w \
  -o "-c listen_addresses='' -c unix_socket_directories='$SOCK' -c port=$PORTA" start >/dev/null 2>&1 \
  || { echo "il cluster privato non parte:" >&2; cat "$T/log" >&2; exit 1; }

su() { psql -X -q -h "$SOCK" -p "$PORTA" -U "$SUPER" -d postgres -v ON_ERROR_STOP=1 -tA "$@"; }
su -c "CREATE DATABASE heuresys_advanced" >/dev/null

# sudo finto: toglie -n / -u <utente> e manda psql al cluster privato, nel database
# `postgres` come fa psql lanciato dall'utente postgres.
cat > "$T/bin/sudo" <<EOF
#!/bin/sh
while [ \$# -gt 0 ]; do case "\$1" in -n) shift ;; -u) shift 2 ;; *) break ;; esac; done
exec env PGHOST='$SOCK' PGPORT='$PORTA' PGUSER='$SUPER' PGDATABASE=postgres "\$@"
EOF
chmod +x "$T/bin/sudo"
export PATH="$T/bin:$PATH" HOME="$T/casa"
[ "$(command -v sudo)" = "$T/bin/sudo" ] || { echo "sudo finto non in testa al PATH: mi fermo" >&2; exit 1; }
# Per assegna-password-agenti.sh (host/porta dall'ambiente, come psql-agenti.sh)
export POSTGRES_HOST="$SOCK" POSTGRES_PORT="$PORTA"

ENVF="$T/casa/heuresys-advanced/.env"
printf 'POSTGRES_HOST=%s\nPOSTGRES_PORT=%s\nPOSTGRES_DB=heuresys_advanced\nALTRA=1\n' "$SOCK" "$PORTA" > "$ENVF"
AGF="$T/casa/.config/claude-agenti/db-agenti.env"

impronta() {  # $1 = ruolo, $2.. = file
  local r="$1"; shift
  { su -c "SELECT rolcanlogin, coalesce(rolpassword,'') FROM pg_authid WHERE rolname='$r'"
    for f in "$@"; do if [ -f "$f" ]; then cat "$f"; else echo "assente $f"; fi; done
  } | sha256sum | cut -c1-64
}
entra() {  # $1 = ruolo, $2 = file, $3 = chiave
  local pw; pw="$(sed -n "s/^$3=//p" "$2" | tail -n 1)"
  [ "$(PGPASSWORD="$pw" psql -X -w -h "$SOCK" -p "$PORTA" -U "$1" -d heuresys_advanced -tAc 'select 1' 2>/dev/null)" = 1 ]
}
annota() { [ -n "${PROVA_IMPRONTE:-}" ] && printf '%s\n' "$*" >> "$PROVA_IMPRONTE"; return 0; }

prova() {  # $1 = nome, $2 = script, $3 = ruolo, $4 = file, $5 = chiave, $6.. = file nell'impronta
  local nome="$1" sc="$2" ru="$3" f="$4" k="$5"; shift 5
  local o rc i1 i2 i3
  o="$(bash "$sc" 2>&1)"; rc=$?
  { [ $rc = 1 ] && grep -q 'non esiste' <<<"$o"; } && ok "$nome: ruolo assente -> esce 1" || fail "$nome ruolo assente ($rc: $o)"
  su -c "CREATE ROLE $ru NOLOGIN" >/dev/null
  o="$(bash "$sc" --boh 2>&1)"; rc=$?
  [ $rc = 2 ] && ok "$nome: argomento sconosciuto -> esce 2" || fail "$nome argomento sconosciuto ($rc)"

  o="$(bash "$sc" 2>&1)"; rc=$?; i1="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && entra "$ru" "$f" "$k"; } && ok "$nome: prima assegnazione, il ruolo entra" || fail "$nome prima assegnazione ($rc: $o)"
  o="$(bash "$sc" 2>&1)"; rc=$?; i2="$(impronta "$ru" "$@")"
  annota "$nome lancio1 $i1"; annota "$nome lancio2 $i2"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: secondo lancio senza opzioni -> stato identico (SHA-256), «invariato»" \
    || fail "$nome secondo lancio ($rc, $i1 / $i2: $o)"

  o="$(bash "$sc" --ruota 2>&1)"; rc=$?; i3="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i3" != "$i2" ] && entra "$ru" "$f" "$k" && grep -q 'RUOTATA' <<<"$o"; } \
    && ok "$nome: --ruota -> password nuova, il ruolo entra" || fail "$nome --ruota ($rc: $o)"

  local sf; sf="$(sha256sum < "$f")"
  su -c "ALTER ROLE $ru PASSWORD 'un-altra-password'" >/dev/null
  o="$(bash "$sc" 2>&1)"; rc=$?
  { [ $rc = 0 ] && [ "$(sha256sum < "$f")" = "$sf" ] && entra "$ru" "$f" "$k" && grep -q 'riapplicata' <<<"$o"; } \
    && ok "$nome: ruolo con un'altra password -> riapplica quella del file, file invariato" \
    || fail "$nome password diversa nel cluster ($rc: $o)"
  su -c "ALTER ROLE $ru NOLOGIN" >/dev/null
  o="$(bash "$sc" 2>&1)"; rc=$?
  { [ $rc = 0 ] && [ "$(sha256sum < "$f")" = "$sf" ] && entra "$ru" "$f" "$k"; } \
    && ok "$nome: LOGIN spento -> riacceso con la password del file" || fail "$nome LOGIN spento ($rc: $o)"
  i1="$(impronta "$ru" "$@")"; o="$(bash "$sc" 2>&1)"; rc=$?; i2="$(impronta "$ru" "$@")"
  { [ $rc = 0 ] && [ "$i1" = "$i2" ] && grep -q 'invariato' <<<"$o"; } \
    && ok "$nome: dopo il riallineamento il lancio seguente non cambia niente" || fail "$nome dopo riallineamento ($rc)"

  # formato estraneo nel file + ruolo che non lo accetta -> esce 1, niente cambia
  sed -i "s/^$k=.*/$k=non-e-del-formato-x'y/" "$f"
  su -c "ALTER ROLE $ru PASSWORD 'ancora-un-altra'" >/dev/null
  i1="$(impronta "$ru" "$@")"; o="$(bash "$sc" 2>&1)"; rc=$?; i2="$(impronta "$ru" "$@")"
  { [ $rc = 1 ] && [ "$i1" = "$i2" ] && grep -q 'formato' <<<"$o"; } \
    && ok "$nome: password del file in formato estraneo -> esce 1 e non tocca niente" || fail "$nome formato estraneo ($rc: $o)"
  if grep -qiE '[0-9a-f]{32}|un-altra|ancora-un' <<<"$o"; then fail "$nome: l'uscita contiene una password"; else ok "$nome: nessuna password nell'uscita"; fi
}

echo "== assegna-password-app.sh (cluster privato) =="
prova app "$APP" heuresys_app "$ENVF" POSTGRES_APP_PASSWORD "$ENVF" "$ENVF.bak"
grep -q '^ALTRA=1$' "$ENVF" && ok "app: le altre righe del .env restano" || fail "app: righe del .env perse"
echo "== assegna-password-agenti.sh (cluster privato) =="
prova agenti "$AGE" heuresys_agenti "$AGF" POSTGRES_AGENT_PASSWORD "$AGF"
[ "$(stat -c %a "$AGF" 2>/dev/null)" = 600 ] && ok "agenti: file in modo 600" || fail "agenti: modo del file"

[ "$FAIL" = 0 ] && echo "prova-assegna-password: tutto verde" || echo "prova-assegna-password: $FAIL rossi"
[ "$FAIL" = 0 ]
