-- Soglie dell'agente in PERSONE DISTINTE (ADR-0040): le tre misure da cui si ri-derivano.
-- Le soglie NON sono costanti: sono valori iniziali del tenant piu' grande, e questo file le ri-deriva.
-- Uso: psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f docs/kb/xtras/soglie-agente-persone-distinte.sql

\echo '--- (1) posizioni per unita'' (la misura della dottrina del 2026-09-08: include le vacanti)'
select t.tenant_code, count(*) unita, max(n) unita_max, round(percentile_cont(0.9) within group (order by n)::numeric,1) p90
from (select position_tenant_id tid, position_organization_unit_id ou, count(*) n from sys.sys_positions group by 1,2) x
join sys.sys_tenancies t on t.tenant_id = x.tid group by 1 order by 1;

\echo '--- (2) persone con incarico ATTIVO per unita'' (persone attive, non di servizio)'
with p as (
  select t.tenant_code, pos.position_organization_unit_id as ou, u.user_id
  from sys.sys_user_position_assignments a
  join sys.sys_positions pos on pos.position_id = a.user_position_assignment_position_id
  join sys.sys_users u on u.user_id = a.user_position_assignment_user_id
  join sys.sys_tenancies t on t.tenant_id = u.user_tenant_id
  where a.user_position_assignment_status = 'ACTIVE' and u.user_status='ACTIVE' and u.user_type <> 'SERVICE'
), x as (select tenant_code, ou, count(distinct user_id) n from p group by 1,2)
select tenant_code, count(*) unita, sum(n) incarichi, max(n) unita_max,
       percentile_cont(0.9) within group (order by n) p90
from x group by 1;

\echo '--- (3) persone distinte per CATENA (sottoalbero di unita''): quanto tocca «la mia catena»; conta le catene sopra le soglie iniziali 25 e 40'
-- persone distinte per CATENA (sottoalbero di unità), RTL_BANK: quanto tocca «la mia catena»
with recursive ou as (
  select organization_unit_id id, organization_unit_parent_id parent from sys.sys_organization_units
), sub as (
  select id as radice, id as nodo from ou
  union all
  select s.radice, o.id from sub s join ou o on o.parent = s.nodo
), p as (
  select pos.position_organization_unit_id ou, a.user_position_assignment_user_id uid
  from sys.sys_user_position_assignments a
  join sys.sys_positions pos on pos.position_id = a.user_position_assignment_position_id
  join sys.sys_users u on u.user_id = a.user_position_assignment_user_id
  where a.user_position_assignment_status='ACTIVE' and u.user_status='ACTIVE' and u.user_type<>'SERVICE'
), c as (
  select s.radice, count(distinct p.uid) n from sub s join p on p.ou = s.nodo group by 1
)
select count(*) catene, max(n) catena_max,
       percentile_cont(0.9) within group (order by n) p90,
       (select count(*) from c where n > 25) catene_oltre_25,
       (select count(*) from c where n > 40) catene_oltre_40
from c;
