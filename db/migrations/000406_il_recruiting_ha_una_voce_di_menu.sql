-- ─────────────────────────────────────────────────────────────────────────────
-- 000406 — `#54` F4: il recruiting ha una voce di menu
--
-- F3 ha dato al recruiting sette API (`000364`, `000374`); senza una porta nella navigazione
-- restano raggiungibili solo da chi conosce l'URL — che e' un altro modo di non
-- essere nel prodotto. Il cancello `check_pagine_raggiungibili.py` pretende che
-- ogni pagina autenticata abbia la sua porta, ed e' lui che lo verifichera'.
--
-- DOVE VA. Gruppo `workforce`: assumere e' lavoro sulle persone che entrano, non governo
-- ne' intelligence. Ordine 31, subito dopo l'ultima voce del gruppo (max
-- misurato oggi: 30) — cosi' nessuna voce esistente si sposta.
--
-- CHI LA VEDE. `job-requisition` / `read`, cioe' lo stesso permesso delle sette rotte. La voce
-- compare a chi puo' chiamare l'API, e non a chi non puo': una voce di menu che
-- porta a un 403 e' peggio di una voce assente. ⚠ `requires_admin = false`: la
-- pagina non e' amministrativa — la vede chi ha il permesso di lettura del ciclo,
-- cioe' PLATFORM_ADMIN, TENANT_ADMIN e HRMS_MANAGER (mig 000374, I22).
--
-- RITIRO (ADR-0035): si emenda QUESTO file, non se ne scrive uno che cancella.
--
-- IDEMPOTENTE + twice-run safe.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

-- Cio' che NON deve cambiare, letto PRIMA della scrittura.
CREATE TEMP TABLE _menu_prima_406 ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord, ui_interface_route AS route
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'recruiting';

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('recruiting', 'Recruiting', '/recruiting', 'UserPlus',
   'workforce', 'WORKFORCE', 'job-requisition', 'read', false, 31, true)
ON CONFLICT (ui_interface_code) DO UPDATE
  SET ui_interface_label = EXCLUDED.ui_interface_label,
      ui_interface_route = EXCLUDED.ui_interface_route,
      ui_interface_icon = EXCLUDED.ui_interface_icon,
      ui_interface_sidebar_group = EXCLUDED.ui_interface_sidebar_group,
      ui_interface_required_resource = EXCLUDED.ui_interface_required_resource,
      ui_interface_required_action = EXCLUDED.ui_interface_required_action,
      ui_interface_requires_admin = EXCLUDED.ui_interface_requires_admin,
      ui_interface_order = EXCLUDED.ui_interface_order,
      ui_interface_is_active = EXCLUDED.ui_interface_is_active,
      updated_at = now();

-- Overlay EN dell'etichetta (ADR-0029)
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
-- ⚠ `ui_interface_label`, NON `label`: e' il nome del campo che la post-condizione
-- della `000306` interroga («ogni voce attiva deve avere la sua traduzione»). Con
-- `label` la traduzione veniva scritta ma non trovata, e la catena si fermava alla
-- SECONDA passata con «75 voci attive ma 74 etichette tradotte» — la prima non poteva
-- vederlo, perche' la 000306 gira PRIMA della 000406 e alla prima passata la voce
-- ancora non esisteva.
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'Recruiting', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'recruiting'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- ── post-condizioni: cio' che doveva cambiare E cio' che NON doveva ──────────
DO $$
DECLARE v_spostate int; v_mia int;
BEGIN
  SELECT count(*) INTO v_spostate
    FROM _menu_prima_406 pr
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = pr.codice
   WHERE i.ui_interface_sidebar_group IS DISTINCT FROM pr.gruppo
      OR i.ui_interface_order IS DISTINCT FROM pr.ord
      OR i.ui_interface_route IS DISTINCT FROM pr.route;
  IF v_spostate > 0 THEN
    RAISE EXCEPTION '000406: % voci di menu preesistenti si sono spostate: annullo', v_spostate;
  END IF;

  SELECT count(*) INTO v_mia FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'recruiting' AND ui_interface_is_active
     AND ui_interface_route = '/recruiting';
  IF v_mia <> 1 THEN
    RAISE EXCEPTION '000406: la voce «recruiting» non risulta attiva su /recruiting';
  END IF;
  RAISE NOTICE '000406 OK: voce «recruiting» attiva, 0 voci preesistenti spostate';
END $$;

COMMIT;
