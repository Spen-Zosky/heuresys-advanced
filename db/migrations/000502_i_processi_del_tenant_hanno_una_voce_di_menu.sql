-- ============================================================================
-- 000502 — I PROCESSI DEL TENANT hanno una voce di menu.  (V5 del piano
--          docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md)
--
-- La pagina `/tenant-processes` elenca i processi dell'azienda (sys_tenant_processes di primo
-- livello) e apre la scheda di ciascuno: sottoprocessi, attività, chi le esegue, unità e ruoli,
-- flusso a corsie, grafo. È un oggetto diverso dal catalogo dei processi del modello
-- (`/processes`, «Catalogo dei processi»): la voce si chiama «Processi» e sta nello stesso gruppo
-- funzionale `processes`, prima del catalogo (ordine 295).
--
-- IL PERMESSO È `organization_unit_processes:read` (000122), lo stesso delle rotte
-- `/v1/processes`: chi legge la partecipazione delle unità ai processi legge il processo.
-- `requires_admin` è FALSO. Nessuna classe di dato in `sys_ui_interface_data_classes`: la resource
-- è dichiarata senza dati di persona in `apps/api/src/lib/scope/data-classes.ts`, e la scheda
-- mostra delle persone solo il nome, come l'organigramma.
--
-- Icona `GitBranch`, che la mappa di `apps/web/src/app/(authenticated)/layout.tsx` conosce.
--
-- GUARDIA / POST-CONDIZIONE / ROLLBACK
--   Guardia: il permesso esiste, una sola voce per la rotta.
--   Post-condizione: nessuna voce preesistente cambia gruppo, ordine o stato.
--   Rollback: emendare questo file (ADR-0035) e togliere la riga del codice `tenant-processes`
--   e la sua traduzione; la catena si ri-applica a ogni deploy.
-- IDEMPOTENTE. Nessuna operazione distruttiva. Il runner avvolge il file in una transazione.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._menu_prima_502;
CREATE TEMP TABLE _menu_prima_502 AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord, ui_interface_is_active AS attiva
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'tenant-processes';

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('tenant-processes', 'Processi', '/tenant-processes', 'GitBranch',
   'processes', 'GOVERNANCE', 'organization_unit_processes', 'read', false, 295, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'Processes', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'tenant-processes'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

DO $$
DECLARE n int; v_cambiate int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions WHERE auth_permission_code = 'organization_unit_processes:read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000502: atteso 1 permesso organization_unit_processes:read, trovati %', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'tenant-processes' AND ui_interface_route = '/tenant-processes'
     AND ui_interface_is_active AND NOT ui_interface_requires_admin
     AND ui_interface_required_resource = 'organization_unit_processes' AND ui_interface_required_action = 'read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000502: la voce dei processi non dichiara il permesso che la governa';
  END IF;

  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_route = '/tenant-processes';
  IF n <> 1 THEN
    RAISE EXCEPTION '000502: % voci puntano a /tenant-processes', n;
  END IF;

  SELECT count(*) INTO v_cambiate
    FROM _menu_prima_502 p
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = p.codice
   WHERE i.ui_interface_sidebar_group IS DISTINCT FROM p.gruppo OR i.ui_interface_order <> p.ord
      OR i.ui_interface_is_active <> p.attiva;
  IF v_cambiate <> 0 THEN
    RAISE EXCEPTION '000502: % voci di menu esistenti sono cambiate', v_cambiate;
  END IF;

  RAISE NOTICE '000502: voce «Processi» nel gruppo processes (ord 295), permesso organization_unit_processes:read, 0 voci cambiate';
END $$;

DROP TABLE IF EXISTS pg_temp._menu_prima_502;
