#!/usr/bin/env bash
# db/scripts/pe4-prova.sh <database-di-prova>
#
# PE-4 (ADR-0044) passi 1 e 2: PROVA A ANDATA E RITORNO su una COPIA del gemello.
# Si lancia sul linux-pc (serve `sudo -u postgres`). Rifiuta ogni database il cui nome
# non contenga `_pe4_`: non gira mai sull'originale.
#
#   ssh linux-pc 'cd ~/pe4-prova && bash db/scripts/pe4-prova.sh heuresys_advanced_pe4_prova1'
#
# Variabili (per le mutazioni e per la copia fuori dal repo):
#   PE4_SQL_DIR    cartella con le migrazioni e gli script (predefinita: il repo di questo file)
#   PE4_SABOTAGGIO=1   dopo l'istantanea di partenza riempie A MANO una riga, fuori dal giornale
#   PE4_LAVORO     dove scrivere le istantanee (predefinita: ~/pe4-lavoro/<database>)
#
# Che cosa dimostra, con exit 0 solo se TUTTO e' vero:
#   1. passo 1 applicato due volte: colonna, FK, indici; le partecipazioni identiche a prima;
#   2. passo 2 fase A: riempie esattamente la classe certa calcolata da un oracolo indipendente;
#      una seconda passata non cambia niente (confronto carattere per carattere);
#   3. passo 2 fase D3: H riempite, N disattivate, 845 = riempite + disattivate;
#      il registro dei dubbi ha H + N, ognuna con motivo; una seconda passata non cambia niente;
#   4. l'inversa del passo 2 riporta la tabella allo stato di prima, carattere per carattere;
#   5. l'inversa del passo 1 riporta la tabella allo stato originale, carattere per carattere.
set -uo pipefail

DB="${1:?uso: pe4-prova.sh <database-di-prova>}"
case "$DB" in *_pe4_*) ;; *) echo "[pe4] RIFIUTO: '$DB' non e' un database di prova PE-4 (nome senza _pe4_)" >&2; exit 2 ;; esac
HERE="$(cd "$(dirname "$0")/../.." && pwd)"
SQL="${PE4_SQL_DIR:-$HERE}"
W="${PE4_LAVORO:-$HOME/pe4-lavoro/$DB}"
mkdir -p "$W"
M457="$SQL/db/migrations/000457_pe4_passo1_posizione_nelle_partecipazioni.sql"
RIEMPI="$SQL/db/scripts/pe4-passo2-riempi.sql"
INV2="$SQL/db/scripts/pe4-passo2-inversa.sql"
INV1="$SQL/db/scripts/pe4-passo1-inversa.sql"

ROSSI=0
pg()  { sudo -n -u postgres psql -X -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }
val() { pg -At -c "$1"; }
ok()  { printf '  OK     %s\n' "$*"; }
ko()  { printf '  ROSSO  %s\n' "$*"; ROSSI=$((ROSSI+1)); }
check() { # check <descrizione> <atteso> <ottenuto>
  if [ "$2" = "$3" ]; then ok "$1 = $3"; else ko "$1: atteso '$2', ottenuto '$3'"; fi; }
esegui() { # esegui <descrizione> <file> [opzioni psql]  -- il file passa da stdin
  local d="$1" f="$2"; shift 2
  if [ ! -f "$f" ]; then ko "$d: file assente ($f)"; return 1; fi
  if pg "$@" -f - < "$f" > "$W/ultimo.out" 2>&1; then ok "$d"; return 0; else ko "$d: $(tail -3 "$W/ultimo.out" | tr '\n' ' ')"; return 1; fi
}
dump()  { pg -At -c "select to_jsonb(t)::text from sys.sys_process_participants t order by process_participant_id" > "$1"; }
dump0() { pg -At -c "select (to_jsonb(t) - 'process_participant_position_id')::text from sys.sys_process_participants t order by process_participant_id" > "$1"; }
uguali() { # uguali <descrizione> <fileA> <fileB>  -- carattere per carattere
  if cmp -s "$2" "$3"; then ok "$1 (identici, $(wc -c < "$2") byte)"; else ko "$1: i file differiscono"; fi; }

echo "[pe4] database: $DB   sql: $SQL   lavoro: $W"
N0=$(val "select count(*) from sys.sys_process_participants")
dump0 "$W/00_originale.json"
echo "== partenza: $N0 partecipazioni"

echo "== 1. passo 1: la colonna"
esegui "migrazione 000457, prima passata" "$M457"
esegui "migrazione 000457, seconda passata" "$M457"
check "colonna presente" "1" "$(val "select count(*) from information_schema.columns where table_schema='sys' and table_name='sys_process_participants' and column_name='process_participant_position_id'")"
check "FK sulla posizione, ON DELETE RESTRICT" "r" "$(val "select confdeltype from pg_constraint where conname='sys_process_participants_position_fk'")"
check "indici (normale + unico parziale)" "2" "$(val "select count(*) from pg_indexes where schemaname='sys' and tablename='sys_process_participants' and indexname in ('sys_process_participants_position_idx','sys_process_participants_process_position_uq')")"
check "righe dopo il passo 1" "$N0" "$(val "select count(*) from sys.sys_process_participants")"
dump0 "$W/01_dopo_passo1_senza_colonna.json"
uguali "passo 1: partecipazioni identiche all'originale" "$W/00_originale.json" "$W/01_dopo_passo1_senza_colonna.json"
check "colonna vuota dopo il passo 1" "0" "$(val "select count(*) from sys.sys_process_participants where process_participant_position_id is not null")"
dump "$W/02_stato_prima_passo2.json"
IMMQ="select md5(string_agg(concat_ws('|',process_participant_id,process_participant_tenant_id,process_participant_org_unit_process_id,process_participant_user_id,process_participant_role,process_participant_metadata::text,created_at,created_by,updated_by),' ' order by process_participant_id)) from sys.sys_process_participants"
IMM0=$(val "$IMMQ")

if [ "${PE4_SABOTAGGIO:-0}" = "1" ]; then
  echo "== SABOTAGGIO: una riga riempita a mano, fuori dal giornale"
  pg -c "update sys.sys_process_participants pp set process_participant_position_id = (select position_id from sys.sys_positions limit 1) where process_participant_id = (select process_participant_id from sys.sys_process_participants order by process_participant_id limit 1)" >/dev/null
fi

# ORACOLO indipendente (scritto con join + group by, non con gli array dello script).
ORA_A="select pp.process_participant_id id, min(p.position_id::text)::uuid pos
  from sys.sys_process_participants pp
  join sys.sys_organization_unit_processes oup on oup.organization_unit_process_id=pp.process_participant_org_unit_process_id
  join sys.sys_user_position_assignments a on a.user_position_assignment_user_id=pp.process_participant_user_id and a.user_position_assignment_status='ACTIVE'
  join sys.sys_positions p on p.position_id=a.user_position_assignment_position_id and p.position_is_active and p.position_organization_unit_id=oup.org_unit_process_org_unit_id
 group by pp.process_participant_id having count(distinct p.position_id)=1"
ORA_H="select pp.process_participant_id id, min(p.position_id::text)::uuid pos
  from sys.sys_process_participants pp
  join sys.sys_organization_unit_processes oup on oup.organization_unit_process_id=pp.process_participant_org_unit_process_id
  join sys.sys_user_position_assignments a on a.user_position_assignment_user_id=pp.process_participant_user_id
  join sys.sys_positions p on p.position_id=a.user_position_assignment_position_id and p.position_organization_unit_id=oup.org_unit_process_org_unit_id
 where a.user_position_assignment_start_date <= pp.created_at::date
   and (a.user_position_assignment_end_date is null or a.user_position_assignment_end_date >= pp.created_at::date)
   and pp.process_participant_id not in (select id from ($ORA_A) oa)
 group by pp.process_participant_id having count(distinct p.position_id)=1"
NA=$(val "select count(*) from ($ORA_A) x"); NH=$(val "select count(*) from ($ORA_H) x")
NN=$((N0 - NA - NH))
echo "== oracolo: A=$NA  H=$NH  N=$NN  (somma $N0)"

echo "== 2. passo 2, fase A (la sola classe certa)"
esegui "fase A" "$RIEMPI" -v fase=A
check "riempite dopo la fase A" "$NA" "$(val "select count(*) from sys.sys_process_participants where process_participant_position_id is not null")"
check "fase A: righe che differiscono dall'oracolo A" "0" "$(val "select count(*) from (select process_participant_id id, process_participant_position_id pos from sys.sys_process_participants where process_participant_position_id is not null except ($ORA_A)) x")"
check "fase A: disattivate" "0" "$(val "select count(*) from sys.sys_process_participants where not process_participant_is_active")"
check "fase A: registro dei dubbi (H+N, in attesa)" "$((NH+NN))" "$(val "select count(*) from staging.process_participants_dubbi where esito='IN_ATTESA'")"
dump "$W/03_dopo_faseA.json"
esegui "fase A, seconda passata" "$RIEMPI" -v fase=A
dump "$W/04_dopo_faseA_bis.json"
uguali "fase A: la seconda passata non cambia niente" "$W/03_dopo_faseA.json" "$W/04_dopo_faseA_bis.json"
check "fase A bis: voci del giornale" "$NA" "$(val "select count(*) from staging.process_participants_position_undo")"

echo "== 2b. passo 2, fase D3 (H riempite, N disattivate)"
esegui "fase D3" "$RIEMPI" -v fase=D3
FIL=$(val "select count(*) from sys.sys_process_participants where process_participant_position_id is not null")
DIS=$(val "select count(*) from sys.sys_process_participants where not process_participant_is_active")
check "riempite (A+H)" "$((NA+NH))" "$FIL"
check "disattivate (N)" "$NN" "$DIS"
check "conservazione: riempite + disattivate = partecipazioni di partenza" "$N0" "$((FIL+DIS))"
check "righe che differiscono dall'oracolo A+H" "0" "$(val "select count(*) from (select process_participant_id id, process_participant_position_id pos from sys.sys_process_participants where process_participant_position_id is not null except (($ORA_A) union ($ORA_H))) x")"
check "disattivate = esattamente quelle senza posizione" "$NN" "$(val "select count(*) from sys.sys_process_participants where not process_participant_is_active and process_participant_position_id is null")"
check "registro dei dubbi: H riempite" "$NH" "$(val "select count(*) from staging.process_participants_dubbi where esito='RIEMPITA_DA_STORIA' and classe='H'")"
check "registro dei dubbi: N disattivate" "$NN" "$(val "select count(*) from staging.process_participants_dubbi where esito='DISATTIVATA' and classe='N'")"
check "registro dei dubbi: tutti con motivo" "0" "$(val "select count(*) from staging.process_participants_dubbi where coalesce(length(motivo),0)=0")"
check "partecipazioni con metadata.storia36" "0" "$(val "select count(*) from sys.sys_process_participants where process_participant_metadata ? 'storia36'")"
check "persona, ruolo, metadati e chiavi invariati (impronta)" "$IMM0" "$(val "$IMMQ")"
dump "$W/05_dopo_faseD3.json"
esegui "fase tutto, seconda passata" "$RIEMPI" -v fase=tutto
dump "$W/06_dopo_tutto_bis.json"
uguali "passo 2: la seconda passata non cambia niente" "$W/05_dopo_faseD3.json" "$W/06_dopo_tutto_bis.json"

echo "== 3. ritorno: inversa del passo 2"
esegui "inversa del passo 2" "$INV2"
dump "$W/07_dopo_inversa2.json"
uguali "inversa 2: la tabella torna allo stato di prima del passo 2" "$W/02_stato_prima_passo2.json" "$W/07_dopo_inversa2.json"
check "giornale: voci ancora aperte" "0" "$(val "select count(*) from staging.process_participants_position_undo where annullato_il is null")"
check "giornale conservato (voci totali)" "$((NA+NH+NN))" "$(val "select count(*) from staging.process_participants_position_undo")"
esegui "inversa del passo 2, seconda passata" "$INV2"
dump "$W/08_dopo_inversa2_bis.json"
uguali "inversa 2 bis: non cambia niente" "$W/07_dopo_inversa2.json" "$W/08_dopo_inversa2_bis.json"

echo "== 3b. ritorno: inversa del passo 1"
esegui "inversa del passo 1" "$INV1"
check "colonna rimossa" "0" "$(val "select count(*) from information_schema.columns where table_schema='sys' and table_name='sys_process_participants' and column_name='process_participant_position_id'")"
dump0 "$W/09_dopo_inversa1.json"
uguali "inversa 1: la tabella torna all'originale" "$W/00_originale.json" "$W/09_dopo_inversa1.json"

echo
if [ "$ROSSI" -eq 0 ]; then echo "[pe4] VERDE su $DB"; exit 0; else echo "[pe4] ROSSO su $DB: $ROSSI controlli falliti"; exit 1; fi
