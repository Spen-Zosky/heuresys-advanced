-- W0-A2: misura della partecipazione ai processi per l'ADR "partecipazione legata alla posizione".
-- Sola lettura. Si esegue sul gemello:
--   ssh linux-pc 'sudo -n -u postgres psql -d heuresys_advanced -X -q -At -F"|"' < partecipanti_misura.sql
\echo '== 1. righe totali, per tenant, ruolo, attivita, origine della derivazione'
SELECT 'totale', count(*) FROM sys.sys_process_participants;
SELECT 'tenant', t.tenant_code, count(*) FROM sys.sys_process_participants pp
  JOIN sys.sys_tenancies t ON t.tenant_id = pp.process_participant_tenant_id GROUP BY 2 ORDER BY 2;
SELECT 'ruolo', process_participant_role, process_participant_is_active, count(*)
  FROM sys.sys_process_participants GROUP BY 2,3 ORDER BY 2,3;
SELECT 'derivazione', coalesce(process_participant_metadata->>'derived','(nessuna)'), count(*)
  FROM sys.sys_process_participants GROUP BY 2 ORDER BY 2;
SELECT 'processi-di-unita', count(DISTINCT process_participant_org_unit_process_id) FROM sys.sys_process_participants;
SELECT 'persone-distinte', count(DISTINCT process_participant_user_id) FROM sys.sys_process_participants;
SELECT 'ultima-modifica', max(updated_at)::date, min(created_at)::date FROM sys.sys_process_participants;

\echo '== 2. classificazione di ogni riga: quante assegnazioni ACTIVE ha la persona su posizioni attive della unita del processo'
WITH r AS (
  SELECT pp.process_participant_id, pp.process_participant_role AS ruolo, pp.process_participant_is_active AS attiva,
         oup.org_unit_process_org_unit_id AS ou, pp.process_participant_user_id AS u
    FROM sys.sys_process_participants pp
    JOIN sys.sys_organization_unit_processes oup
      ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
), c AS (
  SELECT r.*,
    (SELECT count(*) FROM sys.sys_user_position_assignments a
       JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
      WHERE a.user_position_assignment_user_id = r.u AND a.user_position_assignment_status = 'ACTIVE'
        AND p.position_is_active AND p.position_organization_unit_id = r.ou) AS nella_unita,
    (SELECT count(*) FROM sys.sys_user_position_assignments a
      WHERE a.user_position_assignment_user_id = r.u AND a.user_position_assignment_status = 'ACTIVE') AS ovunque
  FROM r
)
SELECT 'classe',
  CASE WHEN nella_unita = 1 THEN 'A-una-posizione-nella-unita'
       WHEN nella_unita > 1 THEN 'B-piu-posizioni-nella-unita'
       WHEN ovunque > 0 THEN 'C-assegnata-altrove'
       ELSE 'D-nessuna-assegnazione-attiva' END,
  ruolo, attiva, count(*)
FROM c GROUP BY 2,3,4 ORDER BY 2,3,4;

\echo '== 3. assegnazioni ACTIVE con data di fine passata (stato e calendario non concordano)'
SELECT 'attiva-ma-scaduta', count(*) FROM sys.sys_user_position_assignments
 WHERE user_position_assignment_status = 'ACTIVE' AND user_position_assignment_end_date < current_date;
SELECT 'stati-assegnazione', user_position_assignment_status, user_position_assignment_kind, count(*)
  FROM sys.sys_user_position_assignments GROUP BY 2,3 ORDER BY 2,3;

\echo '== 4. OWNER: la posizione di cui la persona e titolare nella unita coincide con quella di cui e proprietaria?'
WITH o AS (
  SELECT pp.process_participant_id, oup.org_unit_process_org_unit_id AS ou, pp.process_participant_user_id AS u
    FROM sys.sys_process_participants pp
    JOIN sys.sys_organization_unit_processes oup
      ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
   WHERE pp.process_participant_role = 'OWNER'
)
SELECT 'owner',
  CASE WHEN EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a JOIN sys.sys_positions p
                      ON p.position_id = a.user_position_assignment_position_id
                     WHERE a.user_position_assignment_user_id = o.u AND a.user_position_assignment_status='ACTIVE'
                       AND p.position_is_active AND p.position_organization_unit_id = o.ou
                       AND p.position_owner_user_id = o.u)
       THEN 'titolare-della-posizione-che-possiede'
       ELSE 'possiede-una-posizione-ma-titolare-di-altra' END,
  count(*)
FROM o GROUP BY 2 ORDER BY 2;

\echo '== 5. processi di unita senza alcun OWNER fra i partecipanti'
SELECT 'processi-senza-owner', count(*) FROM sys.sys_organization_unit_processes oup
 WHERE NOT EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                    WHERE pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
                      AND pp.process_participant_role = 'OWNER');
SELECT 'processi-di-unita-totali', count(*) FROM sys.sys_organization_unit_processes;
