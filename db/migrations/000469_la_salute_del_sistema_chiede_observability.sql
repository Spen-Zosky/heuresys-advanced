-- ============================================================================
-- 000469 — La voce «Salute del sistema» chiede il permesso che la sua pagina usa.
--
-- CHE COSA E' SUCCESSO (analisi interfacce del 2026-10-31, D-14 e INC-04; piano
-- interfacce del 2026-11-03, voce S-3)
--   La pagina /system-health legge tre rotte, tutte con `observability:read`
--   (apps/api/src/modules/observability/routes.ts). La voce di menu dichiarava invece
--   `tenant:read` con requires_admin=true (000050). Conseguenze misurate dall'analisi:
--   TENANT_ADMIN vedeva la voce e veniva rimandato via dalla pagina; PLATFORM_OPERATOR,
--   che ha `observability:read` proprio per questo lavoro (000178, mandato K R-9), non
--   la vedeva, perche' non ha un dominio che apra una superficie amministrativa.
--
-- LA CORREZIONE
--   La voce dichiara `observability:read` e requires_admin=false. La coppia permesso si
--   valuta sempre (me/service.ts), quindi la voce compare solo a chi detiene il
--   permesso: oggi PLATFORM_ADMIN e PLATFORM_OPERATOR. Togliere requires_admin non la
--   apre a nessun altro: il pavimento amministrativo serviva a filtrare una coppia che
--   qui non filtrava niente.
--
-- PERCHE' UN FILE NUOVO E NON L'EMENDAMENTO DI 000050
--   000050 semina con ON CONFLICT DO NOTHING: emendarla cambierebbe solo un database
--   nuovo. Si corregge un attributo con un UPDATE sui valori finali (stessa forma di
--   000467).
--
-- ROLLBACK DICHIARATO: un UPDATE che rimette 'tenant'/'read' e requires_admin=true
-- sulla riga `system-health`, e il ritiro di questo file dalla catena.
--
-- IDEMPOTENTE + twice-run safe (UPDATE su valori finali, guardia che verifica).
-- ============================================================================

BEGIN;

-- Cio' che NON deve cambiare, letto PRIMA della scrittura.
CREATE TEMP TABLE _menu_prima_469 ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_required_resource AS risorsa,
       ui_interface_required_action AS azione, ui_interface_requires_admin AS riservata,
       ui_interface_is_active AS attiva, ui_interface_route AS route
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'system-health';

UPDATE sys.sys_ui_interfaces
   SET ui_interface_required_resource = 'observability',
       ui_interface_required_action   = 'read',
       ui_interface_requires_admin    = false,
       updated_at                     = now()
 WHERE ui_interface_code = 'system-health'
   AND (ui_interface_required_resource IS DISTINCT FROM 'observability'
     OR ui_interface_required_action   IS DISTINCT FROM 'read'
     OR ui_interface_requires_admin    IS DISTINCT FROM false);

DO $$
DECLARE
  n_perm int; n_voce int; n_cambiate int;
BEGIN
  -- 1. Il permesso dichiarato deve ESISTERE: una coppia che non corrisponde a nulla
  --    farebbe sparire la voce per tutti.
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'observability:read';
  IF n_perm <> 1 THEN
    RAISE EXCEPTION '000469: atteso 1 permesso observability:read, trovati %', n_perm;
  END IF;

  SELECT count(*) INTO n_voce FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'system-health'
     AND ui_interface_required_resource = 'observability'
     AND ui_interface_required_action = 'read'
     AND ui_interface_requires_admin = false;
  IF n_voce <> 1 THEN
    RAISE EXCEPTION '000469: la voce «system-health» non dichiara observability:read';
  END IF;

  -- 2. Nessun'altra voce e' cambiata.
  SELECT count(*) INTO n_cambiate
    FROM _menu_prima_469 pr
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = pr.codice
   WHERE i.ui_interface_required_resource IS DISTINCT FROM pr.risorsa
      OR i.ui_interface_required_action IS DISTINCT FROM pr.azione
      OR i.ui_interface_requires_admin IS DISTINCT FROM pr.riservata
      OR i.ui_interface_is_active IS DISTINCT FROM pr.attiva
      OR i.ui_interface_route IS DISTINCT FROM pr.route;
  IF n_cambiate <> 0 THEN
    RAISE EXCEPTION '000469: % altre voci di menu sono cambiate: annullo', n_cambiate;
  END IF;

  RAISE NOTICE '000469: la voce «Salute del sistema» chiede observability:read, come la sua pagina; 0 altre voci toccate';
END $$;

COMMIT;
