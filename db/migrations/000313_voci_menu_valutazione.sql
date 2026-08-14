-- ─────────────────────────────────────────────────────────────────────────────
-- 000313 — Le due voci di menu del ciclo di valutazione (#92 F6)
--
-- F3/F4/F5 hanno costruito dieci rotte (`review-cycles`, `performance-reviews`,
-- `calibration-sessions`, `GET /v1/me/performance`) e F6 costruisce le due pagine che le
-- consumano. Ma **una pagina senza voce di menu e' irraggiungibile**: la sidebar non e' un
-- file del frontend, e' questa tabella. E' la lezione gia' pagata da `#125`, dove pagine
-- vive risultavano invisibili perche' nessuna riga le nominava.
--
-- Due voci, una per ciascuno dei due lati:
--   /performance     gruppo `workforce`, permesso `performance-review:read` — la platea e'
--                    quella corretta dalla 000309 (HRMS_MANAGER, TENANT_ADMIN,
--                    PLATFORM_ADMIN, MANAGER), NON quella di catalogo.
--   /me/performance  area personale, permesso `performance-review:read:self` (000312), che
--                    il ruolo base USER detiene: I17, il pavimento vale per tutti.
--
-- L'ordine continua le sequenze esistenti (workforce arriva a 27 con `okrs`; l'area
-- personale a 55 con `ME_DOCUMENTS`), misurate e non ricordate.
--
-- ⚠ NON e' una scrittura di massa: due INSERT idempotenti, nessuna riga esistente toccata.
-- Per questo non c'e' un giornale di ritorno — il ritiro di una voce e' `is_active=false`
-- sul suo codice, ed e' gia' il modo con cui il progetto ne ha spente nove in `000163`.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective, ui_interface_required_resource,
   ui_interface_required_action, ui_interface_requires_admin, ui_interface_order,
   ui_interface_is_active)
SELECT 'performance', 'Valutazioni', '/performance', 'TrendingUp',
       'workforce', 'WORKFORCE', 'performance-review', 'read', true, 28, true
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'performance'
);

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective, ui_interface_required_resource,
   ui_interface_required_action, ui_interface_requires_admin, ui_interface_order,
   ui_interface_is_active)
SELECT 'me-performance', 'Le mie valutazioni', '/me/performance', 'TrendingUp',
       'personal', 'PERSONAL', 'performance-review', 'read:self', false, 56, true
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'me-performance'
);

-- Traduzioni EN: senza, il cancello i18n torna rosso (ADR-0029).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'Performance reviews', 'MANUAL'
  FROM sys.sys_ui_interfaces i WHERE i.ui_interface_code = 'performance'
ON CONFLICT DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', 'My performance reviews', 'MANUAL'
  FROM sys.sys_ui_interfaces i WHERE i.ui_interface_code = 'me-performance'
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  n_voci int; n_trad int; n_gruppo int; n_perm_ok int; n_altre_prima int; n_altre int;
BEGIN
  SELECT count(*) INTO n_voci FROM sys.sys_ui_interfaces
   WHERE ui_interface_code IN ('performance', 'me-performance') AND ui_interface_is_active;
  IF n_voci <> 2 THEN
    RAISE EXCEPTION '000313: le voci attive sono % invece di 2', n_voci;
  END IF;

  SELECT count(*) INTO n_trad FROM sys.sys_reference_translations t
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = t.entity_id
   WHERE t.entity_table = 'sys_ui_interfaces' AND t.locale = 'en'
     AND t.field = 'ui_interface_label'
     AND i.ui_interface_code IN ('performance', 'me-performance');
  IF n_trad <> 2 THEN
    RAISE EXCEPTION '000313: le traduzioni EN sono % invece di 2', n_trad;
  END IF;

  -- Il gruppo `personal` deve essere quello REALE delle altre voci /me/*: se lo avessi
  -- scritto a memoria e fosse un altro, la voce esisterebbe e non comparirebbe da nessuna
  -- parte — il difetto peggiore, perche' tace.
  SELECT count(*) INTO n_gruppo FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'me-performance'
     AND ui_interface_sidebar_group = (
       SELECT ui_interface_sidebar_group FROM sys.sys_ui_interfaces
        WHERE ui_interface_code = 'me-time-off');
  IF n_gruppo <> 1 THEN
    RAISE EXCEPTION '000313: me-performance non sta nel gruppo delle altre voci personali';
  END IF;

  -- Il permesso che la voce pretende deve ESISTERE davvero, o la voce e' irraggiungibile
  -- per tutti: una voce che nomina un permesso inesistente non e' nascosta, e' morta.
  SELECT count(*) INTO n_perm_ok FROM sys.sys_ui_interfaces i
   WHERE i.ui_interface_code IN ('performance', 'me-performance')
     AND EXISTS (
       SELECT 1 FROM sys.sys_auth_permissions p
        WHERE p.auth_permission_code = i.ui_interface_required_resource || ':' || i.ui_interface_required_action);
  IF n_perm_ok <> 2 THEN
    RAISE EXCEPTION '000313: una delle due voci nomina un permesso che non esiste';
  END IF;

  -- NON doveva cambiare: nessuna voce preesistente e' stata toccata o spenta.
  SELECT count(*) INTO n_altre FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active AND ui_interface_code NOT IN ('performance', 'me-performance');
  IF n_altre < 60 THEN
    RAISE EXCEPTION '000313: le altre voci attive sono scese a % — qualcosa e stato spento', n_altre;
  END IF;

  RAISE NOTICE '000313 ok — 2 voci di menu, 2 traduzioni EN, % altre voci attive intatte', n_altre;
END $$;
