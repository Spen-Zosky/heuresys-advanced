-- ============================================================================
-- 000526 — IL BACKSTAGE ha una voce di menu.  (ADR-0063 D2, voce G1 del piano
--          docs/piani/PIANO_heuresys-ai-driven_20261126.md)
--
-- La pagina `/organization/backstage` mostra l'organizzazione ghost del tenant (000523): albero,
-- elenco, storia dei periodi e deriva rispetto all'albero vivo, con la guida in una modale. Nel
-- frontend si chiama «Backstage» in italiano e in inglese (Enzo, 2026-11-28). La voce sta nel
-- gruppo `organization`, subito dopo l'organigramma (ordine 205), nel ramo «Struttura».
--
-- IL PERMESSO È `organization_unit:list`, lo stesso di GET /v1/ghost-units, /storia e /deriva:
-- chi vede la voce può aprire la pagina, chi non la vede riceverebbe 403. `requires_admin` è
-- FALSO. Nessuna classe di dato in `sys_ui_interface_data_classes`: la pagina mostra delle
-- persone solo il nome, come l'organigramma.
--
-- Icona `Layers`, che la mappa di `apps/web/src/app/(authenticated)/layout.tsx` conosce.
--
-- GUARDIA / POST-CONDIZIONE / ROLLBACK
--   Guardia: il permesso esiste, una sola voce per la rotta.
--   Post-condizione: nessuna voce preesistente cambia gruppo, ordine o stato.
--   Rollback: emendare questo file (ADR-0035) e togliere la riga del codice `backstage`
--   e la sua traduzione; la catena si ri-applica a ogni deploy.
-- IDEMPOTENTE. Nessuna operazione distruttiva. Il runner avvolge il file in una transazione.
-- ============================================================================

DROP TABLE IF EXISTS pg_temp._menu_prima_526;
CREATE TEMP TABLE _menu_prima_526 AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord, ui_interface_is_active AS attiva
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'backstage';

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('backstage', 'Backstage', '/organization/backstage', 'Layers',
   'organization', 'GOVERNANCE', 'organization_unit', 'list', false, 205, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'Backstage', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'backstage'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

DO $$
DECLARE n int; v_cambiate int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_auth_permissions WHERE auth_permission_code = 'organization_unit:list';
  IF n <> 1 THEN
    RAISE EXCEPTION '000526: atteso 1 permesso organization_unit:list, trovati %', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'backstage' AND ui_interface_route = '/organization/backstage'
     AND ui_interface_is_active AND NOT ui_interface_requires_admin
     AND ui_interface_required_resource = 'organization_unit' AND ui_interface_required_action = 'list';
  IF n <> 1 THEN
    RAISE EXCEPTION '000526: la voce del Backstage non dichiara il permesso che la governa';
  END IF;

  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_route = '/organization/backstage';
  IF n <> 1 THEN
    RAISE EXCEPTION '000526: % voci puntano a /organization/backstage', n;
  END IF;

  SELECT count(*) INTO v_cambiate
    FROM _menu_prima_526 p
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = p.codice
   WHERE i.ui_interface_sidebar_group IS DISTINCT FROM p.gruppo OR i.ui_interface_order <> p.ord
      OR i.ui_interface_is_active <> p.attiva;
  IF v_cambiate <> 0 THEN
    RAISE EXCEPTION '000526: % voci di menu esistenti sono cambiate', v_cambiate;
  END IF;

  RAISE NOTICE '000526: voce «Backstage» nel gruppo organization (ord 205), permesso organization_unit:list, 0 voci cambiate';
END $$;

DROP TABLE IF EXISTS pg_temp._menu_prima_526;
