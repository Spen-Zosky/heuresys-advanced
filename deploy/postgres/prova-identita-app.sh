#!/usr/bin/env bash
#
# deploy/postgres/prova-identita-app.sh — #223 F3
#
# Prova che `heuresys_app` possa fare cio' che all'API serve, e NON possa fare il
# resto. Va eseguito SULLA MACCHINA: legge le credenziali dal `.env` e non le
# stampa mai.
#
# PERCHE' PRIMA DEL DEPLOY. Se questa identita' non avesse un permesso che
# serve, l'API si fermerebbe alla prima richiesta e la scoperta arriverebbe dagli
# utenti. Se invece potesse fare DDL, la separazione sarebbe NOMINALE — e un
# «l'API si e' avviata» non lo distinguerebbe dal caso riuscito.
#
# USO
#     ssh oracle-vm-default 'bash -s' < deploy/postgres/prova-identita-app.sh
set -uo pipefail

REPO="${REPO:-$HOME/heuresys-advanced}"
set -a; . "$REPO/.env"; set +a

: "${POSTGRES_APP_USER:?POSTGRES_APP_USER non impostata nel .env}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD non impostata nel .env}"

export PGPASSWORD="$POSTGRES_APP_PASSWORD"
Q() { psql -w -h "${POSTGRES_HOST:-localhost}" -p "${POSTGRES_PORT:-5432}" \
        -U "$POSTGRES_APP_USER" -d "${POSTGRES_DB:-heuresys_advanced}" -tAqc "$1" 2>&1; }

esiti=0
ok()   { echo "  [OK] $1"; }
ko()   { echo "  [!!] $1"; esiti=1; }

echo "=== cio' che l'API DEVE poter fare ==="

Q "SELECT count(*) FROM sys.sys_users" | grep -qE '^[0-9]+$' \
  && ok "legge sys.sys_users" || ko "NON legge sys.sys_users"

# scrittura vera, annullata: se l'API non potesse scrivere, non servirebbe a nulla
Q "BEGIN; UPDATE sys.sys_skills SET skill_description = skill_description WHERE skill_id = (SELECT skill_id FROM sys.sys_skills LIMIT 1); ROLLBACK;" >/dev/null \
  && ok "scrive in sys.sys_skills" || ko "NON scrive in sys.sys_skills"

# il trigger di audit (000339) gira coi privilegi di CHI esegue: senza questo,
# ogni modifica a un catalogo fallirebbe
Q "BEGIN; INSERT INTO audit.catalog_changes (table_name, operation) VALUES ('prova', 'INSERT'); ROLLBACK;" >/dev/null \
  && ok "scrive in audit.catalog_changes (serve ai trigger di 000339)" \
  || ko "NON scrive in audit.catalog_changes — i trigger di audit bloccherebbero le modifiche ai cataloghi"

Q "SELECT count(*) FROM staging.mig344_skill_group_uri_undo" | grep -qE '^[0-9]+$' \
  && ok "legge i giornali di annullamento in staging" || ko "NON legge staging"

echo "=== cio' che l'API NON deve poter fare ==="

r="$(Q "CREATE TABLE sys.prova_separazione_ruoli (x int)")"
if echo "$r" | grep -qi "permission denied\|permesso negato"; then
  ok "CREATE TABLE respinto — la separazione e' reale"
else
  ko "CREATE TABLE NON respinto: la separazione e' NOMINALE (risposta: $r)"
  # se e' passata davvero, si rimuove subito
  Q "DROP TABLE IF EXISTS sys.prova_separazione_ruoli" >/dev/null
fi

r="$(Q "DROP TABLE IF EXISTS sys.sys_users")"
if echo "$r" | grep -qi "must be owner\|permission denied\|deve essere il proprietario\|permesso negato"; then
  ok "DROP TABLE respinto"
else
  ko "DROP TABLE non respinto come atteso (risposta: $r)"
fi

r="$(Q "SELECT count(*) FROM sys.sys_auth_credentials")"
echo "$r" | grep -qE '^[0-9]+$' \
  && ok "legge le credenziali — l'API autentica le persone, quindi le SERVE" \
  || ko "NON legge sys_auth_credentials: il login non funzionerebbe ($r)"

unset PGPASSWORD
[ "$esiti" -eq 0 ] && echo "ESITO: VERDE — l'identita' dell'applicazione e' quella giusta" \
                   || echo "ESITO: ROSSO — non deployare"
exit "$esiti"
