-- ============================================================================
-- 000203_me_time_off_interface.sql — #34 B/B3: /me/time-off nella sidebar ESS.
--
-- Registra la nuova pagina "Ferie e permessi" nel registry DB-driven della
-- navigazione (sys_ui_interfaces → GET /v1/me/interfaces → sidebar S1009,
-- sezione Area personale). Gating esplicito su leave/read:self (I17 floor —
-- ogni ruolo lo possiede, come me-surveys fa con surveys/respond:self).
-- Ordine 52: subito dopo me-approvals (51), dove il dipendente segue le
-- richieste in attesa.
--
-- IDEMPOTENTE: WHERE NOT EXISTS. Authored: 2026-07-22 (S1026).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
SELECT 'me-time-off', 'Ferie e permessi', '/me/time-off', 'Clock',
       'personal', 'PERSONAL', 'leave', 'read:self', false, 52, true
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'me-time-off'
 );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.sys_ui_interfaces
                  WHERE ui_interface_code = 'me-time-off' AND ui_interface_is_active) THEN
    RAISE EXCEPTION '000203: me-time-off non registrata';
  END IF;
  RAISE NOTICE '000203: /me/time-off registrata nella sidebar (Area personale, ordine 52).';
END $$;
