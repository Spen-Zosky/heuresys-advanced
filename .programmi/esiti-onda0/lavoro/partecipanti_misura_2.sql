-- W0-A2: approfondimento delle righe "assegnata altrove" (classe C della misura 1). Sola lettura, sul gemello:
--   ssh linux-pc 'sudo -n -u postgres psql -d heuresys_advanced -X -q -At -F"|"' < partecipanti_misura_2.sql
WITH RECURSIVE anc AS (
  SELECT organization_unit_id AS ou, organization_unit_id AS anc, 0 AS d FROM sys.sys_organization_units
  UNION ALL
  SELECT anc.ou, u.organization_unit_parent_id, anc.d + 1
    FROM anc JOIN sys.sys_organization_units u ON u.organization_unit_id = anc.anc
   WHERE u.organization_unit_parent_id IS NOT NULL
), r AS (
  SELECT pp.process_participant_id, pp.process_participant_role AS ruolo, pp.created_at,
         oup.org_unit_process_org_unit_id AS ou, pp.process_participant_user_id AS u
    FROM sys.sys_process_participants pp
    JOIN sys.sys_organization_unit_processes oup
      ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
), cur AS (
  SELECT a.user_position_assignment_user_id AS u, p.position_organization_unit_id AS ou_corrente
    FROM sys.sys_user_position_assignments a JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
   WHERE a.user_position_assignment_status = 'ACTIVE'
), c AS (
  SELECT r.* FROM r
   WHERE NOT EXISTS (SELECT 1 FROM cur WHERE cur.u = r.u AND cur.ou_corrente = r.ou)
)
SELECT 'C-relazione', ruolo,
  CASE
    WHEN EXISTS (SELECT 1 FROM cur JOIN anc ON anc.ou = c.ou AND anc.anc = cur.ou_corrente AND anc.d > 0 WHERE cur.u = c.u)
      THEN 'posizione-corrente-in-unita-superiore'
    WHEN EXISTS (SELECT 1 FROM cur JOIN anc ON anc.anc = c.ou AND anc.ou = cur.ou_corrente AND anc.d > 0 WHERE cur.u = c.u)
      THEN 'posizione-corrente-in-unita-sottostante'
    WHEN EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
                  WHERE a.user_position_assignment_user_id = c.u AND a.user_position_assignment_status = 'ENDED'
                    AND p.position_organization_unit_id = c.ou)
      THEN 'era-assegnata-nella-unita-ora-chiusa'
    ELSE 'nessun-legame-con-la-unita' END,
  count(*)
FROM c GROUP BY 2,3 ORDER BY 2,3;

\echo '== assegnazioni ACTIVE modificate dopo la creazione delle partecipazioni (2026-07-20)'
SELECT 'assegnazioni-active-toccate-dopo', count(*) FROM sys.sys_user_position_assignments
 WHERE user_position_assignment_status = 'ACTIVE' AND updated_at > timestamptz '2026-07-20';
SELECT 'assegnazioni-active-iniziate-dopo', count(*) FROM sys.sys_user_position_assignments
 WHERE user_position_assignment_status = 'ACTIVE' AND user_position_assignment_start_date > date '2026-07-20';
\echo '== posizioni con piu di un titolare ACTIVE'
SELECT 'posizioni-con-piu-titolari', count(*) FROM (
  SELECT user_position_assignment_position_id FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1) x;
\echo '== persone con piu di una assegnazione ACTIVE'
SELECT 'persone-con-piu-posizioni', count(*) FROM (
  SELECT user_position_assignment_user_id FROM sys.sys_user_position_assignments
   WHERE user_position_assignment_status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1) x;
