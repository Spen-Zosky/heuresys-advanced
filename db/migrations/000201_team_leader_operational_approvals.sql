-- ============================================================================
-- 000201_team_leader_operational_approvals.sql — #24 ADR-0027 F4 (parte B):
-- il TEAM_LEADER vede la coda delle approvazioni operative del suo perimetro.
--
-- Stato misurato (2026-07-22, matrice live): TEAM_LEADER aveva `approval:decide`
-- ma NON `approval:read` — poteva decidere uno step assegnatogli ma non
-- elencare/monitorare le richieste del proprio team. Incoerente con ADR-0027
-- §2.3 attività 4 ("operational approvals" gestite dal leader) ora che F4-B
-- (commit fd066a9d) gate-a le letture con resolveActivityScope: un TEAM_LEADER
-- con `approval:read` vede SOLO il proprio perimetro funzionale (team/processi
-- che guida) + le richieste in cui è approver — mai il tenant intero.
--
-- A differenza di 000199 questo È un ampliamento di audience deliberato: è il
-- deliverable della fase (attività 4 di F4), non igiene. La sicurezza sta nello
-- scoping funzionale già enforced a runtime, provato da
-- apps/api/test/two-axis-f4-crosstree.integration.test.ts.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING. Authored: 2026-07-22 (S1026).
-- ============================================================================

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  JOIN sys.sys_auth_permissions p ON p.auth_permission_code = 'approval:read'
 WHERE r.auth_role_code = 'TEAM_LEADER'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE ok bool;
BEGIN
  SELECT EXISTS (
    SELECT 1
      FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
     WHERE r.auth_role_code = 'TEAM_LEADER' AND p.auth_permission_code = 'approval:read'
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION '000201: TEAM_LEADER non ha approval:read — grant fallito';
  END IF;
  RAISE NOTICE '000201: TEAM_LEADER ha approval:read (coda operativa funzionale visibile).';
END $$;
