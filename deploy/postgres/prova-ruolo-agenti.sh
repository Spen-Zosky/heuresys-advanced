#!/usr/bin/env bash
# deploy/postgres/prova-ruolo-agenti.sh — B2
# Prova in entrambi i versi: SELECT/INSERT/UPDATE/DELETE ammessi, DROP/TRUNCATE/
# ALTER/CREATE rifiutati. Gira SOLO su uno schema temporaneo creato qui e
# eliminato in uscita: nessuna tabella reale e' toccata. Esce !=0 se qualcosa non torna.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
DB="${POSTGRES_DB:-heuresys_advanced}"
S="prova_agenti_$(date +%s)_$$"
SU() { sudo -u postgres psql -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
AG() { bash "$DIR/psql-agenti.sh" -q -tA "$@"; }
trap 'SU -c "DROP SCHEMA IF EXISTS $S CASCADE" >/dev/null 2>&1' EXIT

SU -c "CREATE SCHEMA $S; CREATE TABLE $S.t(id int primary key, v text);
       INSERT INTO $S.t VALUES (1,'a');
       GRANT USAGE ON SCHEMA $S TO heuresys_agenti;
       GRANT SELECT,INSERT,UPDATE,DELETE ON $S.t TO heuresys_agenti;" || { echo "KO setup"; exit 2; }

ko=0
ok()  { AG -c "$1" >/dev/null 2>&1 && echo "ok   ammesso:   $1" || { echo "KO   doveva passare: $1"; ko=1; }; }
no()  { AG -c "$1" >/dev/null 2>&1 && { echo "KO   doveva essere rifiutato: $1"; ko=1; } || echo "ok   rifiutato: $1"; }

ok "SELECT * FROM $S.t"
ok "INSERT INTO $S.t VALUES (2,'b')"
ok "UPDATE $S.t SET v='c' WHERE id=2"
ok "DELETE FROM $S.t WHERE id=2"
no "TRUNCATE $S.t"
no "DROP TABLE $S.t"
no "ALTER TABLE $S.t ADD COLUMN x int"
no "CREATE TABLE $S.nuova(id int)"
no "CREATE TABLE sys.prova_agenti_nuova(id int)"
no "DROP SCHEMA $S CASCADE"

# la tabella e i dati sono ancora li'
n=$(SU -tA -c "SELECT count(*) FROM $S.t")
[ "$n" = "1" ] && echo "ok   post-condizione: tabella intatta ($n riga)" || { echo "KO post-condizione: $n righe"; ko=1; }
[ $ko -eq 0 ] && echo "PROVA OK" || echo "PROVA FALLITA"
exit $ko
