-- ============================================================================
-- 000467 — La voce «Ruoli» chiede il permesso che la sua pagina usa davvero.
--
-- CHE COSA E' SUCCESSO (analisi interfacce del 2026-10-31, D-17 e INC-10)
--   La pagina /admin/roles legge una sola rotta, GET /v1/auth/role-permissions, che
--   chiede `role_matrix:read`. La voce di menu dichiarava invece `role:read` (000050).
--   Misurato sui permessi di produzione: SECURITY_ADMIN ha `role_matrix:read` e non
--   `role:read`, quindi apriva la pagina senza vederne la voce; CEO ha `role:read` e non
--   `role_matrix:read`, quindi vedeva una voce che lo portava a un 403. TENANT_ADMIN li
--   ha entrambi e non cambia niente.
--
-- PERCHE' UN FILE NUOVO E NON L'EMENDAMENTO DI 000050
--   000050 semina con ON CONFLICT DO NOTHING: emendarla cambierebbe solo un database
--   nuovo, mai la riga che esiste gia'. Qui non si ritira niente (ADR-0035 riguarda i
--   ritiri): si corregge un attributo, con un UPDATE sui valori finali.
--
-- Effetto atteso: la voce «Ruoli» compare a chi puo' aprire la pagina (TENANT_ADMIN,
-- SECURITY_ADMIN, PLATFORM_ADMIN se ha il permesso) e sparisce per chi riceverebbe 403.
-- Per SECURITY_ADMIN la voce arriva insieme alla regola dei mandati funzionali in
-- apps/api/src/modules/me/service.ts (MANDATI_FUNZIONALI_CON_SUPERFICIE).
--
-- ROLLBACK DICHIARATO: un UPDATE che rimette 'role'/'read' sulla riga `roles` (e il
-- ritiro di questo file dalla catena, altrimenti al giro dopo torna).
--
-- IDEMPOTENTE + twice-run safe (UPDATE su valori finali, guardia che verifica).
-- ============================================================================

BEGIN;

-- Cio' che NON deve cambiare, letto PRIMA della scrittura.
CREATE TEMP TABLE _menu_prima_467 ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_required_resource AS risorsa,
       ui_interface_required_action AS azione, ui_interface_requires_admin AS riservata,
       ui_interface_is_active AS attiva, ui_interface_route AS route
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'roles';

UPDATE sys.sys_ui_interfaces
   SET ui_interface_required_resource = 'role_matrix',
       ui_interface_required_action   = 'read',
       updated_at                     = now()
 WHERE ui_interface_code = 'roles'
   AND (ui_interface_required_resource IS DISTINCT FROM 'role_matrix'
     OR ui_interface_required_action   IS DISTINCT FROM 'read');

DO $$
DECLARE
  n_perm int; n_voce int; n_cambiate int;
BEGIN
  -- 1. Il permesso dichiarato deve ESISTERE: una coppia che non corrisponde a nulla
  --    farebbe sparire la voce per tutti.
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'role_matrix:read';
  IF n_perm <> 1 THEN
    RAISE EXCEPTION '000467: atteso 1 permesso role_matrix:read, trovati %', n_perm;
  END IF;

  SELECT count(*) INTO n_voce FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'roles'
     AND ui_interface_required_resource = 'role_matrix'
     AND ui_interface_required_action = 'read';
  IF n_voce <> 1 THEN
    RAISE EXCEPTION '000467: la voce «roles» non dichiara role_matrix:read';
  END IF;

  -- 2. Nessun'altra voce e' cambiata.
  SELECT count(*) INTO n_cambiate
    FROM _menu_prima_467 pr
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = pr.codice
   WHERE i.ui_interface_required_resource IS DISTINCT FROM pr.risorsa
      OR i.ui_interface_required_action IS DISTINCT FROM pr.azione
      OR i.ui_interface_requires_admin IS DISTINCT FROM pr.riservata
      OR i.ui_interface_is_active IS DISTINCT FROM pr.attiva
      OR i.ui_interface_route IS DISTINCT FROM pr.route;
  IF n_cambiate <> 0 THEN
    RAISE EXCEPTION '000467: % altre voci di menu sono cambiate: annullo', n_cambiate;
  END IF;

  RAISE NOTICE '000467: la voce «Ruoli» chiede role_matrix:read, come la sua pagina; 0 altre voci toccate';
END $$;

COMMIT;
