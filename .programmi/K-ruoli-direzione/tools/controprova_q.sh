#!/usr/bin/env bash
# controprova_q.sh — la prova che q.py SA RIFIUTARE (F0.5). Scrive evidenze/F0.5_controprova.txt.
# Ogni caso stampa comando, exit code e prime righe. Il conteggio di sys_auth_roles si misura
# prima e dopo con psql (non con q.py: la prova non deve misurarsi da sola).
set -u
K="$(cd "$(dirname "$0")/.." && pwd)"
Q="python $K/tools/q.py"
OUT="$K/evidenze/F0.5_controprova.txt"
PS="psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -At -c"
{
  echo "CONTROPROVA q.py — $(date -Iseconds)"
  echo
  echo "[0] conteggio PRIMA (psql, non q.py): select count(*) from sys.sys_auth_roles"
  $PS "select count(*) from sys.sys_auth_roles"
  echo
  echo '[1] q.py "delete from sys.sys_auth_roles"   (atteso: exit 3, SOLO SELECT)'
  $Q "delete from sys.sys_auth_roles"; echo "exit=$?"
  echo
  echo '[2] q.py "select 1; drop view sys.v_prova"   (atteso: exit 3)'
  $Q "select 1; drop view sys.v_prova"; echo "exit=$?"
  echo
  echo '[3] q.py "with x as (select 1) select * from x"   (atteso: exit 0, una riga)'
  $Q "with x as (select 1) select * from x"; echo "exit=$?"
  echo
  echo '[4] q.py "/* c */ -- c'"'"'\n  SELECT count(*) from sys.sys_auth_roles"   (commenti tolti: atteso exit 0)'
  $Q "/* commento */ -- riga
  SELECT count(*) as n from sys.sys_auth_roles"; echo "exit=$?"
  echo
  echo '[5] q.py "with x as (insert into sys.sys_auth_roles(auth_role_code,auth_role_name) values ('"'"'PROVA_K'"'"','"'"'x'"'"') returning 1) select * from x"'
  echo '    (passa la sintassi: comincia con with. Atteso: exit 1, "cannot execute INSERT in a read-only transaction" — e\x27 il server che rifiuta)'
  $Q "with x as (insert into sys.sys_auth_roles(auth_role_code,auth_role_name) values ('PROVA_K','x') returning 1) select * from x"; echo "exit=$?"
  echo
  echo '[6] q.py "select pg_sleep(35)"   (atteso: exit 1, statement timeout a 30s)'
  $Q "select pg_sleep(35)"; echo "exit=$?"
  echo
  echo "[7] conteggio DOPO (psql): select count(*) from sys.sys_auth_roles"
  $PS "select count(*) from sys.sys_auth_roles"
  echo "[7b] nessuna riga PROVA_K: select count(*) from sys.sys_auth_roles where auth_role_code='PROVA_K'"
  $PS "select count(*) from sys.sys_auth_roles where auth_role_code='PROVA_K'"
} > "$OUT" 2>&1
cat "$OUT"
