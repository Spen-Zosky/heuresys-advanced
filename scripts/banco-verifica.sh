#!/usr/bin/env bash
#
# scripts/banco-verifica.sh — il banco di verifica delle interfacce, su una COPIA del database.
# Piano: docs/piani/PIANO_interfaccia-sistematica_20261111.md, §2.
#
# PERCHE' ESISTE (Enzo, 2026-11-11). Per guardare ogni pagina con ogni ruolo serviva entrare come
# ciascuna persona, e la produzione chiede a ognuna la parola d'ordine e il secondo fattore: le
# verifiche si fermavano li'. Il banco gira su una copia ripristinata in un cluster PostgreSQL
# privato, con chiavi di firma sue: un accesso firmato con quella chiave vale solo per il banco.
# La produzione, le sue chiavi, heuresys_advanced e heuresys_ci non si toccano, e il codice di
# autenticazione del prodotto non cambia.
#
# Uso (sulla VM):
#   bash scripts/banco-verifica.sh su <nome> [--rif <ramo-o-commit>] [--dump <file.dump>]
#   bash scripts/banco-verifica.sh persone <nome>            # persone.json, una persona per ruolo
#   bash scripts/banco-verifica.sh gettone <nome> <email>    # il cookie di accesso di una persona
#   bash scripts/banco-verifica.sh giro <nome> [opzioni del giro]
#   bash scripts/banco-verifica.sh aggiorna <nome>           # git pull + build + riavvio, stesso DB
#   bash scripts/banco-verifica.sh stato <nome>
#   bash scripts/banco-verifica.sh giu <nome>
#
# Sede: la copia del repository e' quella di scripts/copia-prova.sh (~/prove-heuresys-advanced/<nome>);
# il cluster, i registri e le porte stanno accanto, in ~/prove-heuresys-advanced/.banchi/<nome>/.
# `giu` ferma tutto, sposta il cluster nel cestino ~/_da_eliminare/ (niente rm) e chiude la copia.

set -euo pipefail
TAB=$(printf '\t')

SEDE="${HEURESYS_PROVE_DIR:-$HOME/prove-heuresys-advanced}"
REPO="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PROD_ENV="${PROD_ENV:-$HOME/heuresys-advanced/.env}"
DUMPS="${DUMPS:-$HOME/backup-hr/copie-fase}"

uso() { sed -n '14,22p' "$0" | sed 's/^# \{0,3\}//' >&2; exit 2; }
porta_libera() { local p; for p in $(seq "$1" "$2"); do ss -ltn "( sport = :$p )" | grep -q ":$p" || { echo "$p"; return; }; done; return 1; }

nome="${2:-}"; [ -n "${1:-}" ] || uso
B="$SEDE/.banchi/$nome"; C="$SEDE/$nome"

carica() { [ -f "$B/banco.env" ] || { echo "banco '$nome' non trovato" >&2; exit 3; }; set -a; . "$B/banco.env"; set +a; }
psqlb() { "$PGBIN/psql" -h "$B/sock" -p "$PGPORT" -U "$(id -un)" -d heuresys_banco -v ON_ERROR_STOP=1 "$@"; }

guardia_db() { # il banco non parla mai con un database che non sia il suo
  case "$POSTGRES_HOST" in "$B/sock"|127.0.0.1) ;; *) echo "GUARDIA: POSTGRES_HOST=$POSTGRES_HOST non e' il banco" >&2; exit 9 ;; esac
  [ "$POSTGRES_DB" = heuresys_banco ] || { echo "GUARDIA: POSTGRES_DB=$POSTGRES_DB" >&2; exit 9; }
  [ "$POSTGRES_PORT" = "$PGPORT" ] || { echo "GUARDIA: porta $POSTGRES_PORT diversa dal cluster del banco" >&2; exit 9; }
}

avvia_servizi() {
  carica; guardia_db
  ( cd "$C/apps/api" && set -a && . "$C/.env" && set +a && JWT_PRIVATE_KEY="$(awk 'NF{printf "%s\\n",$0}' "$C/.secrets/jwt_private.pem")" JWT_PUBLIC_KEY="$(awk 'NF{printf "%s\\n",$0}' "$C/.secrets/jwt_public.pem")" nohup node dist/server.js >"$B/api.log" 2>&1 & echo $! >"$B/api.pid" )
  for _ in $(seq 60); do curl -fs "http://127.0.0.1:$PORT/readyz" >/dev/null && break; sleep 1; done
  ( cd "$C/apps/web" && nohup npx next start -H 127.0.0.1 -p "$WEBPORT" >"$B/web.log" 2>&1 & echo $! >"$B/web.pid" )
  for _ in $(seq 60); do curl -fs -o /dev/null "http://127.0.0.1:$WEBPORT/login" && break; sleep 1; done
  echo "banco '$nome': web http://127.0.0.1:$WEBPORT  api http://127.0.0.1:$PORT  db porta $PGPORT"
}
ferma_servizi() {
  for s in web api; do [ -f "$B/$s.pid" ] && kill "$(cat "$B/$s.pid")" 2>/dev/null || true; rm -f "$B/$s.pid"; done
  # il pid salvato e' quello del lanciatore (npx), non del server figlio: si ferma chi ascolta le porte del banco (e solo quelle)
  for p in "$WEBPORT" "$PORT"; do
    for pid in $(ss -ltnpH "sport = :$p" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do kill "$pid" 2>/dev/null || true; done
  done
  for _ in $(seq 10); do ss -ltnH "( sport = :$WEBPORT or sport = :$PORT )" | grep -q . || break; sleep 1; done
}
costruisci() {
  carica; guardia_db
  ( cd "$C" && pnpm install --frozen-lockfile >"$B/install.log" 2>&1 )
  ( cd "$C" && bash db/scripts/migrate.sh >"$B/migrate.log" 2>&1 ) || { echo "migrazioni fallite: $B/migrate.log" >&2; exit 5; }
  ( cd "$C" && pnpm --filter @heuresys/shared build && pnpm --filter ./apps/api build ) >"$B/build-api.log" 2>&1
  ( cd "$C/apps/web" && NEXT_PUBLIC_API_PROXY_BASE_URL="http://127.0.0.1:$PORT" pnpm build ) >"$B/build-web.log" 2>&1
}

elenco_persone() { # una persona vera (STANDARD, attiva) per ruolo: di RTL Bank, e la piattaforma
  psqlb -At -F "$TAB" <<'SQL'
SELECT DISTINCT ON (r.auth_role_code) r.auth_role_code, u.user_email
  FROM sys.sys_user_auth_roles ur
  JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
  JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
  LEFT JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id
 WHERE ur.user_auth_role_revoked_at IS NULL AND u.user_type = 'STANDARD' AND u.user_status = 'ACTIVE'
   AND (r.auth_role_code = 'PLATFORM_ADMIN' OR t.tenant_code = 'RTL_BANK')
 ORDER BY r.auth_role_code,
   (SELECT count(*) FROM sys.sys_user_auth_roles x WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_revoked_at IS NULL),
   u.user_email;
SQL
}

case "$1" in
su)
  shift 2; rif="origin/main"; dump=""
  while [ $# -gt 0 ]; do case "$1" in --rif) rif="$2"; shift 2 ;; --dump) dump="$2"; shift 2 ;; *) uso ;; esac; done
  [ -d "$B" ] && { echo "il banco '$nome' esiste gia': usa aggiorna o giu" >&2; exit 3; }
  [ -n "$dump" ] || dump="$(ls -1t "$DUMPS"/*/database.dump | head -1)"
  [ -f "$dump" ] || { echo "dump non trovato" >&2; exit 4; }
  # la copia puo' esistere gia' (aperta a mano sul ramo): allora si riusa
  [ -d "$C/.git" ] || [ -f "$C/.git" ] || bash "$REPO/scripts/copia-prova.sh" apri "$nome" "banco di verifica delle interfacce" --rif "$rif"
  mkdir -p "$B/sock" "$C/.secrets"
  PGPORT="$(porta_libera 55400 55499)"; PORT="$(porta_libera 4100 4199)"; WEBPORT="$(porta_libera 4200 4299)"
  "$PGBIN/initdb" -D "$B/pg" -U "$(id -un)" --auth=trust -E UTF8 --locale=C.UTF-8 >"$B/initdb.log"
  "$PGBIN/pg_ctl" -D "$B/pg" -l "$B/pg.log" -o "-p $PGPORT -k $B/sock -c listen_addresses=127.0.0.1" start >/dev/null
  # i ruoli che il .env di produzione nomina esistono anche qui (accesso trust, nessuna parola d'ordine)
  for r in $(grep -E '^POSTGRES_(APP_)?USER=' "$PROD_ENV" | cut -d= -f2 | tr -d '"' | sort -u); do
    "$PGBIN/psql" -h "$B/sock" -p "$PGPORT" -d postgres -qc "CREATE ROLE \"$r\" LOGIN SUPERUSER" 2>/dev/null || true
  done
  "$PGBIN/createdb" -h "$B/sock" -p "$PGPORT" heuresys_banco
  "$PGBIN/pg_restore" -h "$B/sock" -p "$PGPORT" -d heuresys_banco --no-owner --no-acl -j 4 "$dump" >"$B/restore.log" 2>&1 || true
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$C/.secrets/jwt_private.pem" 2>/dev/null
  openssl pkey -in "$C/.secrets/jwt_private.pem" -pubout -out "$C/.secrets/jwt_public.pem"
  # .env del banco: quello di produzione, con database, porte e chiavi del banco
  grep -vE '^(POSTGRES_HOST|POSTGRES_PORT|POSTGRES_DB|PORT|HOST|JWT_PRIVATE_KEY|JWT_PUBLIC_KEY|ADMIN_ORIGIN|COOKIE_SECURE|NODE_ENV|MFA_ENFORCEMENT_ENABLED)=' "$PROD_ENV" >"$C/.env"
  cat >>"$C/.env" <<EOF
POSTGRES_HOST=$B/sock
POSTGRES_PORT=$PGPORT
POSTGRES_DB=heuresys_banco
PORT=$PORT
HOST=127.0.0.1
ADMIN_ORIGIN=http://127.0.0.1:$WEBPORT
COOKIE_SECURE=false
NODE_ENV=production
EOF
  cat >"$B/banco.env" <<EOF
PGPORT=$PGPORT
PORT=$PORT
WEBPORT=$WEBPORT
POSTGRES_HOST=$B/sock
POSTGRES_PORT=$PGPORT
POSTGRES_DB=heuresys_banco
DUMP=$dump
EOF
  costruisci
  avvia_servizi
  ;;
avvia)
  carica; ferma_servizi; avvia_servizi ;;
aggiorna)
  carica; ferma_servizi
  git -C "$C" pull --ff-only -q
  costruisci; avvia_servizi ;;
gettone)
  carica; email="${3:?manca l indirizzo email}"
  riga="$(psqlb -At -F "$TAB" -v email="$email" <<'SQL'
SELECT u.user_id, coalesce(u.user_tenant_id::text, ''), coalesce(string_agg(DISTINCT r.auth_role_code, ','), '')
  FROM sys.sys_users u
  LEFT JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
  LEFT JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
 WHERE lower(u.user_email) = lower(:'email')
 GROUP BY 1, 2;
SQL
)"
  [ -n "$riga" ] || { echo "persona non trovata: $email" >&2; exit 6; }
  IFS="$TAB" read -r uid tid ruoli <<<"$riga"
  node "$REPO/scripts/banco-firma.mjs" "$C/.secrets/jwt_private.pem" "$uid" "$tid" "$ruoli" ;;
persone)
  carica
  elenco_persone \
  | while IFS="$TAB" read -r ruolo email; do
      cookie="$(bash "$0" gettone "$nome" "$email")"
      printf '{"chiave":"%s","email":"%s","ruoli":"%s","cookie":"%s"}\n' "$(echo "$ruolo" | tr 'A-Z_' 'a-z-')" "$email" "$ruolo" "$cookie"
    done | node -e 'const l=require("fs").readFileSync(0,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse);console.log(JSON.stringify(l,null,1))' >"$B/persone.json"
  echo "$B/persone.json: $(grep -c '"chiave"' "$B/persone.json") persone" ;;
giro)
  carica; shift 2
  [ -f "$B/persone.json" ] || bash "$0" persone "$nome"
  out="$B/giro-$(date +%Y%m%d-%H%M)"
  ( cd "$C/apps/web" && GIRO_BASE="http://127.0.0.1:$WEBPORT" GIRO_PERSONE="$B/persone.json" GIRO_OUT="$out" node tests/giro/giro.mjs "$@" )
  echo "esito: $out" ;;
stato)
  carica; echo "copia $C ($(git -C "$C" log --oneline -1))"; cat "$B/banco.env"
  for s in api web; do [ -f "$B/$s.pid" ] && kill -0 "$(cat "$B/$s.pid")" 2>/dev/null && echo "$s attivo" || echo "$s fermo"; done ;;
giu)
  carica; ferma_servizi
  "$PGBIN/pg_ctl" -D "$B/pg" stop -m fast >/dev/null || true
  rm -f "$C/.env"; mv "$C/.secrets" "$B/secrets-della-copia"
  cestino="$HOME/_da_eliminare/banchi-verifica_$(date +%Y%m%d)"; mkdir -p "$cestino"
  mv "$B" "$cestino/${nome}_$(date +%H%M%S)"
  bash "$REPO/scripts/copia-prova.sh" chiudi "$nome"
  echo "banco '$nome' chiuso; cluster e registri in $cestino" ;;
*) uso ;;
esac
