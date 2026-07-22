-- ============================================================================
-- 000202_leave_request_self_permission.sql — #34 B/B3: il dipendente richiede
-- le proprie ferie/permessi (primo flusso approvativo business reale).
--
-- Il dominio leave aveva SOLO permessi di lettura (000173: leave:read org-gated
-- + leave:read:self ESS). La nuova POST /v1/me/time-off/requests introduce la
-- scrittura self-scope: la richiesta del dipendente diventa una approval
-- request (resource_type TIME_OFF_REQUEST) col manager diretto come approver;
-- l'effect handler all'apply crea la riga sys_time_off_requests APPROVED,
-- decrementa il balance e scrive la transazione USAGE — la richiesta "pending"
-- vive nel runtime approvals, non come riga time-off orfana.
--
-- Pattern grant: come surveys:respond:self (000135) — self-scope floor (I17),
-- concesso a TUTTI i ruoli: ogni dipendente può chiedere le proprie ferie.
--
-- IDEMPOTENTE: ON CONFLICT DO NOTHING. Authored: 2026-07-22 (S1026).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('leave:request:self', 'Submit own time-off requests (ESS)', 'leave', 'request:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'leave:request:self'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'leave:request:self';
  IF n = 0 THEN
    RAISE EXCEPTION '000202: leave:request:self senza grant';
  END IF;
  RAISE NOTICE '000202: leave:request:self concesso a % ruoli (self floor I17).', n;
END $$;
