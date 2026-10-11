-- W0-A2: per le righe senza assegnazione ACTIVE nella unita, la posizione che la persona occupava
-- nella unita alla data di creazione della riga (2026-07-20) e' univoca? Sola lettura, sul gemello.
WITH r AS (
  SELECT pp.process_participant_id, pp.process_participant_role AS ruolo, pp.created_at::date AS d,
         oup.org_unit_process_org_unit_id AS ou, pp.process_participant_user_id AS u
    FROM sys.sys_process_participants pp
    JOIN sys.sys_organization_unit_processes oup
      ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions p
                       ON p.position_id = a.user_position_assignment_position_id
                      WHERE a.user_position_assignment_user_id = pp.process_participant_user_id
                        AND a.user_position_assignment_status = 'ACTIVE'
                        AND p.position_organization_unit_id = oup.org_unit_process_org_unit_id)
), s AS (
  SELECT r.*, (SELECT count(DISTINCT a.user_position_assignment_position_id)
                 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions p
                   ON p.position_id = a.user_position_assignment_position_id
                WHERE a.user_position_assignment_user_id = r.u AND p.position_organization_unit_id = r.ou
                  AND a.user_position_assignment_start_date <= r.d
                  AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= r.d)) AS alla_data
  FROM r
)
SELECT 'posizione-alla-data-di-creazione', ruolo,
       CASE WHEN alla_data = 1 THEN 'una' WHEN alla_data > 1 THEN 'piu' ELSE 'nessuna' END, count(*)
  FROM s GROUP BY 2,3 ORDER BY 2,3;
SELECT 'assegnazioni-create-dopo-le-partecipazioni', count(*) FROM sys.sys_user_position_assignments WHERE created_at > timestamptz '2026-07-20';
