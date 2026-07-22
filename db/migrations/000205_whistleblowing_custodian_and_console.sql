-- ============================================================================
-- 000205_whistleblowing_custodian_and_console.sql — #51 E/E1: il canale ha un
-- custode reale e una console raggiungibile.
--
-- Stato misurato (2026-07-22): il modulo API whistleblowing è completo e
-- testato (mig 000181: ruolo + permessi custodian-only, derogazione esplicita
-- ad ADR-0027), ma NESSUN utente deteneva WHISTLEBLOWING_CUSTODIAN — la
-- console era irraggiungibile per chiunque. D.Lgs 24/2023 richiede un
-- gestore designato: assegnato ad **andrea.martino@rtl-bank.org** (Head of
-- Legal & Compliance, promosso in #70 S1025) — scelta standard per la
-- funzione (gestore del canale = Legal/Compliance).
--
-- Inoltre registra la console nella sidebar DB-driven (sezione Governance),
-- gated su whistleblowing/read: la voce compare SOLO al custode (nessun
-- altro ruolo detiene il permesso — mig 000181).
--
-- IDEMPOTENTE: guardie NOT EXISTS / ON CONFLICT. Authored: 2026-07-22 (S1026).
-- ============================================================================

INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id)
SELECT u.user_id, r.auth_role_id
  FROM sys.sys_users u, sys.sys_auth_roles r
 WHERE u.user_email = 'andrea.martino@rtl-bank.org'
   AND r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_user_auth_roles x
      WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_role_id = r.auth_role_id
   );

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
SELECT 'whistleblowing-console', 'Segnalazioni whistleblowing', '/whistleblowing-console',
       'ShieldCheck', 'governance', 'GOVERNANCE', 'whistleblowing', 'read', false, 19, true
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'whistleblowing-console'
 );

DO $$
DECLARE ok bool;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    WHERE u.user_email = 'andrea.martino@rtl-bank.org' AND r.auth_role_code = 'WHISTLEBLOWING_CUSTODIAN'
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION '000205: custodian non assegnato';
  END IF;
  RAISE NOTICE '000205: custode designato (andrea.martino, Legal & Compliance) + console in sidebar.';
END $$;
