#!/usr/bin/env bash
# db/scripts/pe4-passo3-prova.sh <database-di-prova>
#
# PE-4 passo 3, le REGOLE (D-P3-1 corretta, D-P3-3): PROVA A ANDATA E RITORNO su una COPIA
# con il passo 2 gia' applicato. Si lancia sul linux-pc (serve `sudo -u postgres`). Rifiuta
# ogni database il cui nome non contenga `_o209_`: non gira mai sull'originale.
#
#   bash db/scripts/pe4-passo3-prova.sh heuresys_advanced_o209_regole1
#
# Variabili: PE4_SQL_DIR (cartella del repo), PE4_LAVORO (istantanee).
#
# Exit 0 solo se TUTTO e' vero:
#   1. un owner per ogni processo che l'oracolo (scritto diverso dallo script) sa risolvere,
#      ed e' il posto del responsabile dell'unita' OWNER; nessun processo con due owner;
#   2. ogni posto attivo con un titolare partecipa ai processi della sua unita', oppure e'
#      negli esclusi con un motivo; nessuna riga CONTRIBUTOR-POSIZIONE fuori dalla sua unita';
#   3. le righe che la corsa non doveva toccare sono identiche (carattere per carattere);
#   4. una seconda passata non cambia niente;
#   5. l'inversa riporta le righe di prima identiche e lascia le nuove tutte disattivate;
#      le partecipazioni attive tornano esattamente quelle di prima; seconda inversa nulla;
#   6. una nuova passata dopo l'inversa riattiva (non duplica) e torna allo stato del punto 1.
set -uo pipefail

DB="${1:?uso: pe4-passo3-prova.sh <database-di-prova>}"
case "$DB" in *_o209_*) ;; *) echo "[regole] RIFIUTO: '$DB' non e' un database di prova (nome senza _o209_)" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="${PE4_SQL_DIR:-$HERE}"
W="${PE4_LAVORO:-$HOME/pe4-lavoro/$DB}"
mkdir -p "$W"
REGOLE="$SQL/db/scripts/pe4-passo3-regole.sql"
INV="$SQL/db/scripts/pe4-passo3-regole-inversa.sql"

ROSSI=0
pg()  { sudo -n -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
val() { pg -At -c "$1"; }
ok()  { printf '  OK     %s\n' "$*"; }
ko()  { printf '  ROSSO  %s\n' "$*"; ROSSI=$((ROSSI+1)); }
check() { if [ "$2" = "$3" ]; then ok "$1 = $3"; else ko "$1: atteso '$2', ottenuto '$3'"; fi; }
esegui() {
  local d="$1" f="$2"; shift 2
  if pg "$@" -f - < "$f" > "$W/ultimo.out" 2>&1; then ok "$d"; grep -o 'pe4-passo3[^"]*' "$W/ultimo.out" | sed 's/^/         /'; return 0
  else ko "$d: $(tail -3 "$W/ultimo.out" | tr '\n' ' ')"; return 1; fi
}
dump()   { pg -At -c "select to_jsonb(t)::text from sys.sys_process_participants t order by process_participant_id" > "$1"; }
attive() { pg -At -c "select concat_ws('|',process_participant_id,process_participant_role,process_participant_position_id) from sys.sys_process_participants where process_participant_is_active order by 1" > "$1"; }
forma()  { pg -At -c "select concat_ws('|',process_participant_org_unit_process_id,process_participant_position_id,process_participant_role,process_participant_is_active) from sys.sys_process_participants order by 1" > "$1"; }
uguali() { if cmp -s "$2" "$3"; then ok "$1 (identici, $(wc -c < "$2") byte)"; else ko "$1: i file differiscono"; fi; }

# ORACOLO del process owner, scritto con join + group by (lo script usa tabelle temporanee e CASE).
ORA_OWNER="select oup.organization_unit_process_id oup_id, min(p.position_id::text)::uuid pos
  from sys.sys_organization_unit_processes oup
  join sys.sys_organization_units ou on ou.organization_unit_id=oup.org_unit_process_org_unit_id and ou.organization_unit_is_active
  join sys.sys_user_position_assignments a on a.user_position_assignment_user_id=ou.organization_unit_manager_user_id
   and a.user_position_assignment_status='ACTIVE' and a.user_position_assignment_start_date<=current_date
   and (a.user_position_assignment_end_date is null or a.user_position_assignment_end_date>=current_date)
  join sys.sys_positions p on p.position_id=a.user_position_assignment_position_id and p.position_is_active
   and p.position_organization_unit_id=ou.organization_unit_id
 where oup.org_unit_process_role='OWNER'
   and (select count(*) from sys.sys_organization_unit_processes o2
         where o2.org_unit_process_tenant_id=oup.org_unit_process_tenant_id
           and o2.org_unit_process_blueprint_process_id=oup.org_unit_process_blueprint_process_id
           and o2.org_unit_process_role='OWNER')=1
 group by 1 having count(distinct p.position_id)=1"

echo "[regole] database: $DB   sql: $SQL   lavoro: $W"
N0=$(val "select count(*) from sys.sys_process_participants")
check "precondizione: attive senza posizione (passo 2 applicato)" "0" "$(val "select count(*) from sys.sys_process_participants where process_participant_is_active and process_participant_position_id is null")"
dump "$W/00_prima.json"; attive "$W/00_attive.txt"
NOWN=$(val "select count(*) from ($ORA_OWNER) x")
NPROC=$(val "select count(distinct (org_unit_process_tenant_id, org_unit_process_blueprint_process_id)) from sys.sys_organization_unit_processes")
echo "== partenza: $N0 partecipazioni; processi $NPROC; owner risolvibili per l'oracolo $NOWN"

echo "== 1. le regole"
esegui "regole, prima passata" "$REGOLE"
RUN1=$(val "select run_id from staging.process_participants_regole_undo order by undo_id desc limit 1")
check "owner attivi = owner dell'oracolo" "$NOWN" "$(val "select count(*) from sys.sys_process_participants where process_participant_is_active and process_participant_role='OWNER' and process_participant_metadata->>'derived'='RULE-OWNER-UNITA-GOVERNO'")"
check "owner che differiscono dall'oracolo" "0" "$(val "select count(*) from (select process_participant_org_unit_process_id, process_participant_position_id from sys.sys_process_participants where process_participant_is_active and process_participant_role='OWNER' and process_participant_metadata->>'derived'='RULE-OWNER-UNITA-GOVERNO' except ($ORA_OWNER)) x")"
check "processi senza owner = esclusi owner di questa corsa" "$((NPROC-NOWN))" "$(val "select count(*) from staging.process_participants_regole_esclusi where run_id='$RUN1' and regola='RULE-OWNER-UNITA-GOVERNO'")"
check "processi con piu' di un owner attivo su un posto attivo" "0" "$(val "select count(*) from (select oup.org_unit_process_blueprint_process_id from sys.sys_process_participants pp join sys.sys_organization_unit_processes oup on oup.organization_unit_process_id=pp.process_participant_org_unit_process_id join sys.sys_positions p on p.position_id=pp.process_participant_position_id and p.position_is_active where pp.process_participant_is_active and pp.process_participant_role='OWNER' group by 1 having count(*)>1) x")"
check "posti attivi con un titolare, senza riga attiva e non esclusi" "0" "$(val "select count(*) from sys.sys_organization_unit_processes oup join sys.sys_organization_units ou on ou.organization_unit_id=oup.org_unit_process_org_unit_id and ou.organization_unit_is_active join sys.sys_positions p on p.position_organization_unit_id=ou.organization_unit_id and p.position_is_active where (select count(*) from sys.sys_user_position_assignments a where a.user_position_assignment_position_id=p.position_id and a.user_position_assignment_status='ACTIVE' and a.user_position_assignment_start_date<=current_date and (a.user_position_assignment_end_date is null or a.user_position_assignment_end_date>=current_date))=1 and not exists (select 1 from sys.sys_process_participants pp where pp.process_participant_org_unit_process_id=oup.organization_unit_process_id and pp.process_participant_position_id=p.position_id and pp.process_participant_is_active) and not exists (select 1 from staging.process_participants_regole_esclusi e where e.run_id='$RUN1' and e.organization_unit_process_id=oup.organization_unit_process_id and e.position_id=p.position_id)")"
check "righe CONTRIBUTOR-POSIZIONE fuori dalla loro unita'" "0" "$(val "select count(*) from sys.sys_process_participants pp join sys.sys_organization_unit_processes oup on oup.organization_unit_process_id=pp.process_participant_org_unit_process_id join sys.sys_positions p on p.position_id=pp.process_participant_position_id where pp.process_participant_metadata->>'derived'='RULE-CONTRIBUTOR-POSIZIONE' and p.position_organization_unit_id<>oup.org_unit_process_org_unit_id")"
check "partecipazioni con metadata.storia36" "0" "$(val "select count(*) from sys.sys_process_participants where process_participant_metadata ? 'storia36'")"
NJ=$(val "select count(*) from staging.process_participants_regole_undo")
NINS=$(val "select count(*) from staging.process_participants_regole_undo where azione='INSERISCI'")
check "righe dopo = prima + inserite" "$((N0+NINS))" "$(val "select count(*) from sys.sys_process_participants")"
pg -At -c "select to_jsonb(t)::text from sys.sys_process_participants t where process_participant_id not in (select process_participant_id from staging.process_participants_regole_undo) order by process_participant_id" > "$W/01_fuori.json"
grep -v -F -f <(pg -At -c "select process_participant_id from staging.process_participants_regole_undo") "$W/00_prima.json" > "$W/00_fuori.json"
uguali "le righe fuori dal giornale sono identiche a prima" "$W/00_fuori.json" "$W/01_fuori.json"
dump "$W/02_dopo.json"; forma "$W/02_forma.txt"

echo "== 2. seconda passata"
esegui "regole, seconda passata" "$REGOLE"
dump "$W/03_dopo_bis.json"
uguali "la seconda passata non cambia niente" "$W/02_dopo.json" "$W/03_dopo_bis.json"
check "giornale invariato" "$NJ" "$(val "select count(*) from staging.process_participants_regole_undo")"

echo "== 3. ritorno"
esegui "inversa" "$INV"
attive "$W/04_attive.txt"
uguali "le partecipazioni attive tornano quelle di prima" "$W/00_attive.txt" "$W/04_attive.txt"
pg -At -c "select to_jsonb(t)::text from sys.sys_process_participants t where process_participant_id not in (select process_participant_id from staging.process_participants_regole_undo where azione='INSERISCI') order by process_participant_id" > "$W/04_vecchie.json"
uguali "le righe di prima sono identiche a prima" "$W/00_prima.json" "$W/04_vecchie.json"
check "righe inserite ancora attive" "0" "$(val "select count(*) from sys.sys_process_participants pp join staging.process_participants_regole_undo u on u.process_participant_id=pp.process_participant_id and u.azione='INSERISCI' where pp.process_participant_is_active")"
check "voci del giornale aperte" "0" "$(val "select count(*) from staging.process_participants_regole_undo where annullato_il is null")"
dump "$W/05_dopo_inversa.json"
esegui "inversa, seconda passata" "$INV"
dump "$W/06_dopo_inversa_bis.json"
uguali "la seconda inversa non cambia niente" "$W/05_dopo_inversa.json" "$W/06_dopo_inversa_bis.json"

echo "== 4. di nuovo avanti, dopo il ritorno"
esegui "regole dopo l'inversa" "$REGOLE"
check "righe: nessuna duplicata (riattivate, non reinserite)" "$((N0+NINS))" "$(val "select count(*) from sys.sys_process_participants")"
forma "$W/07_forma.txt"
uguali "stesso stato della prima passata (processo, posto, ruolo, attiva)" "$W/02_forma.txt" "$W/07_forma.txt"

echo
if [ "$ROSSI" -eq 0 ]; then echo "[regole] VERDE su $DB"; exit 0; else echo "[regole] ROSSO su $DB: $ROSSI controlli falliti"; exit 1; fi
