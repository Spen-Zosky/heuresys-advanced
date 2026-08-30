-- ============================================================================
-- 000326 — Le otto famiglie di cruscotto hanno una pagina, e per questo si accendono.
--          (#142 Cruscotti focalizzati per tipologia, F4)
--
-- COSA MANCAVA. La `000316` ha creato le otto famiglie con le loro 27 viste e le ha
-- lasciate tutte SPENTE (`dashboard_is_active = false`), protette da un CHECK:
--     sys_dashboards_attivo_ha_pagina  CHECK (is_active = false OR ui_interface_id IS NOT NULL)
-- Non era prudenza generica: un menu che offre pagine inesistenti e' la stessa bugia che
-- `#99 F7` aveva appena tolto. Le pagine ora esistono (F4), quindi il vincolo si puo'
-- soddisfare invece di aggirare.
--
-- SETTE VOCI NUOVE, NON OTTO. `self` dichiara `dashboard_route = '/me'`, che e' il
-- portale ESS e ha gia' la sua voce di menu (`me-home`): agganciarla a quella esistente
-- invece di crearne una seconda evita due voci per la stessa pagina — misurato prima di
-- scrivere, `SELECT ... WHERE ui_interface_route = '/me'` restituisce esattamente una riga.
--
-- L'AGGANCIO SI FA PER ROUTE, non per un elenco scritto a mano. `sys_dashboards` gia'
-- dichiara la propria `dashboard_route`; la riga di menu dichiara la propria
-- `ui_interface_route`. Legarle confrontando le due colonne significa che il giorno in cui
-- una delle due cambia il legame o si aggiorna da se' o si rompe RUMOROSAMENTE nella
-- post-condizione — mai in silenzio, che e' l'unico esito inaccettabile.
--
-- LE ICONE stanno nella mappa esplicita di `layout.tsx` (`ICON_MAP`): un nome fuori da
-- quella mappa non da' errore, da' una voce senza icona. Verificate una per una prima di
-- scriverle — Building2, GitBranch, Network, Layers, Users, ShieldCheck, Database ci sono
-- tutte.
--
-- IL GRUPPO e' `overview`, dove vive gia' `/dashboard`: e' la stessa domanda («come sta
-- andando»), vista da otto punti di osservazione. Gli ordini partono da 12 perche' 11 e'
-- occupato dalla `000322`; il gruppo ne contava 12 voci prima di questa migrazione.
--
-- IDEMPOTENTE. Nessuna operazione distruttiva.
-- PER TORNARE INDIETRO: `UPDATE sys.sys_dashboards SET dashboard_is_active = false,
-- dashboard_ui_interface_id = NULL;` piu' `DELETE FROM sys.sys_ui_interfaces WHERE
-- ui_interface_code LIKE 'dashboard-%'` **e** togliere questo file — la catena si
-- ri-applica per intero a ogni deploy (ADR-0035).
-- ============================================================================
BEGIN;

-- Cio' che NON deve cambiare, letto PRIMA: nessuna voce di menu preesistente si sposta.
CREATE TEMP TABLE _menu_prima ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord, ui_interface_route AS route
  FROM sys.sys_ui_interfaces;

-- ── 1. Le sette voci di menu, una per famiglia con pagina propria ──────────────
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('dashboard-azienda',       'Cruscotto Azienda',             '/dashboard/azienda',
   'Building2',   'overview', 'OVERVIEW', 'dashboard_company',  'view', true, 12, true),
  ('dashboard-processi',      'Cruscotto Processi',            '/dashboard/processi',
   'GitBranch',   'overview', 'OVERVIEW', 'dashboard_process',  'view', true, 13, true),
  ('dashboard-organizzazione','Cruscotto Organizzazione',      '/dashboard/organizzazione',
   'Network',     'overview', 'OVERVIEW', 'dashboard_org',      'view', true, 14, true),
  ('dashboard-filiale',       'Cruscotto Filiale',             '/dashboard/filiale',
   'Layers',      'overview', 'OVERVIEW', 'dashboard_branch',   'view', true, 15, true),
  ('dashboard-hr',            'Cruscotto HR Management',       '/dashboard/hr',
   'Users',       'overview', 'OVERVIEW', 'dashboard_hr',       'view', true, 16, true),
  ('dashboard-platform',      'Cruscotto Platform Management', '/dashboard/platform',
   'ShieldCheck', 'overview', 'OVERVIEW', 'dashboard_platform', 'view', true, 17, true),
  ('dashboard-tenant',        'Cruscotto Tenant Management',   '/dashboard/tenant',
   'Database',    'overview', 'OVERVIEW', 'dashboard_tenant',   'view', true, 18, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- ── 2. Canone i18n (ADR-0029): italiano in riga, inglese come sovrapposizione ──
-- Il campo e' `ui_interface_label` — NON `label`: la `000322` documenta il residuo di
-- una riga che usa l'altro nome, e il cancello di copertura EN conta con questo.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en', v.en, 'MANUAL'
  FROM sys.sys_ui_interfaces i
  JOIN (VALUES
    ('dashboard-azienda',        'Company dashboard'),
    ('dashboard-processi',       'Processes dashboard'),
    ('dashboard-organizzazione', 'Organization dashboard'),
    ('dashboard-filiale',        'Branch dashboard'),
    ('dashboard-hr',             'HR management dashboard'),
    ('dashboard-platform',       'Platform management dashboard'),
    ('dashboard-tenant',         'Tenant management dashboard')
  ) AS v(code, en) ON v.code = i.ui_interface_code
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- ── 3. L'aggancio, PER ROUTE — mai per un elenco scritto a mano ────────────────
UPDATE sys.sys_dashboards d
   SET dashboard_ui_interface_id = i.ui_interface_id,
       updated_at = now()
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_route = d.dashboard_route
   AND d.dashboard_ui_interface_id IS DISTINCT FROM i.ui_interface_id;

-- ── 4. L'accensione, che il CHECK autorizza solo ora ───────────────────────────
UPDATE sys.sys_dashboards
   SET dashboard_is_active = true, updated_at = now()
 WHERE dashboard_ui_interface_id IS NOT NULL
   AND dashboard_is_active = false;

-- ── 5. Le classi di dato delle voci nuove, DERIVATE dalle viste ────────────────
-- Non si riscrivono a mano: ogni famiglia le dichiara già, vista per vista, in
-- `sys_dashboard_block_data_classes` (mig. `000316`). La voce di menu eredita l'UNIONE —
-- che è la stessa regola con cui F3a compone la modalità della pagina («la peggiore fra le
-- classi»), quindi le due non possono divergere.
--
-- ⚠ SENZA QUESTO PASSO IL CANCELLO DI `#99 F7` DIVENTA ROSSO, e a ragione: le sette
-- resource nuove (`dashboard_company`, `dashboard_hr`, …) non starebbero in nessuno dei
-- tre elenchi di `data-classes.ts` e la prova «NESSUNA resource passa in silenzio» le
-- nominerebbe. Trovato prima di applicarla, non dopo.
INSERT INTO sys.sys_ui_interface_data_classes (ui_interface_id, data_class)
SELECT DISTINCT d.dashboard_ui_interface_id, c.data_class
  FROM sys.sys_dashboards d
  JOIN sys.sys_dashboard_blocks b ON b.dashboard_id = d.dashboard_id
  JOIN sys.sys_dashboard_block_data_classes c ON c.dashboard_block_id = b.dashboard_block_id
 WHERE d.dashboard_ui_interface_id IS NOT NULL
   AND d.dashboard_route LIKE '/dashboard/%'
ON CONFLICT DO NOTHING;

DO $$
DECLARE n int; v_mancanti text;
BEGIN
  -- 1. I sette permessi dichiarati devono ESISTERE: una coppia che non corrisponde a
  --    nulla non e' mai soddisfatta, e la voce sparirebbe per tutti senza dirlo.
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('dashboard_company:view','dashboard_process:view',
     'dashboard_org:view','dashboard_branch:view','dashboard_hr:view',
     'dashboard_platform:view','dashboard_tenant:view');
  IF n <> 7 THEN
    RAISE EXCEPTION '000326: attesi 7 permessi di famiglia, trovati %', n;
  END IF;

  -- 2. OGNI famiglia ha la sua pagina. Se l'aggancio per route fallisse — perche' una
  --    delle due colonne e' cambiata — qui si sente, e si sente NOMINANDO la famiglia.
  SELECT string_agg(dashboard_code || ' -> ' || dashboard_route, ', ')
    INTO v_mancanti
    FROM sys.sys_dashboards WHERE dashboard_ui_interface_id IS NULL;
  IF v_mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000326: famiglie senza pagina agganciata: %', v_mancanti;
  END IF;

  -- 3. Tutte e otto accese.
  SELECT count(*) INTO n FROM sys.sys_dashboards WHERE dashboard_is_active;
  IF n <> 8 THEN
    RAISE EXCEPTION '000326: attese 8 famiglie attive, trovate %', n;
  END IF;

  -- 4. LA POST-CONDIZIONE CHE PROTEGGE CIO' CHE NON DOVEVA CAMBIARE: nessuna voce di
  --    menu preesistente si e' spostata di gruppo, ordine o route. Senza questa, un
  --    conflitto di ordine passerebbe inosservato finche' qualcuno non guarda il menu.
  SELECT count(*) INTO n
    FROM _menu_prima p
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = p.codice
   WHERE i.ui_interface_sidebar_group IS DISTINCT FROM p.gruppo
      OR i.ui_interface_order IS DISTINCT FROM p.ord
      OR i.ui_interface_route IS DISTINCT FROM p.route;
  IF n <> 0 THEN
    RAISE EXCEPTION '000326: % voci di menu preesistenti sono state alterate', n;
  END IF;

  -- 5. Nessuna voce riservata resta muta (la condizione della 000271, ri-verificata su
  --    TUTTE le righe e non solo sulle nuove).
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active AND ui_interface_requires_admin
     AND (ui_interface_required_resource IS NULL OR ui_interface_required_action IS NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION '000326: % voci riservate non dichiarano il permesso che le governa', n;
  END IF;

  -- 6. Ogni voce nuova con classi dichiarate dalle proprie viste le ha ereditate. Sono
  --    SEI e non sette: `org` e `tenant` espongono la sola `PERSONAL`, `process` la sola
  --    `ACTIVITY` — ciò che conta è che nessuna famiglia con classi le abbia perse.
  SELECT count(*) INTO n
    FROM sys.sys_dashboards d
   WHERE d.dashboard_route LIKE '/dashboard/%'
     AND EXISTS (SELECT 1 FROM sys.sys_dashboard_blocks b
                   JOIN sys.sys_dashboard_block_data_classes c
                     ON c.dashboard_block_id = b.dashboard_block_id
                  WHERE b.dashboard_id = d.dashboard_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_ui_interface_data_classes x
                      WHERE x.ui_interface_id = d.dashboard_ui_interface_id);
  IF n <> 0 THEN
    RAISE EXCEPTION '000326: % famiglie hanno viste con classi ma la voce di menu non le eredita', n;
  END IF;

  -- 7. LE MIE 15 RIGHE, non il totale del mondo (emendato dalla `000366`, 2026-08-30).
  --    Questo controllo contava `count(*)` sull'INTERA tabella e pretendeva 41 — cioe'
  --    cristallizzava una misura che cresce a ogni voce nuova. Il file lo sapeva e lasciava
  --    l'istruzione «chi aggiungera' righe deve spostare QUESTO conteggio nel proprio file»:
  --    e' un protocollo che funziona, ma costringe ogni migrazione futura a passare di qui
  --    e a rendere rossa la prova generale prima di accorgersene (successo davvero, oggi).
  --    Quindi il totale se lo porta via la `000366`, come il protocollo prescrive, e qui
  --    resta cio' che questo file DEVE davvero garantire: le sue proprie dichiarazioni.
  --    Un controllo che guarda solo cio' che ha scritto non invecchia.
  SELECT count(*) INTO n
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code IN ('dashboard-azienda','dashboard-processi','dashboard-organizzazione',
                                 'dashboard-filiale','dashboard-hr','dashboard-platform',
                                 'dashboard-tenant');
  IF n <> 15 THEN
    RAISE EXCEPTION '000326: le sette famiglie dichiarano % classi invece di 15', n;
  END IF;

  -- 8. Le sette etichette hanno la loro traduzione inglese.
  SELECT count(*) INTO n
    FROM sys.sys_ui_interfaces i
    JOIN sys.sys_reference_translations t
      ON t.entity_table = 'sys_ui_interfaces' AND t.entity_id = i.ui_interface_id
     AND t.field = 'ui_interface_label' AND t.locale = 'en'
   WHERE i.ui_interface_code LIKE 'dashboard-%';
  IF n <> 7 THEN
    RAISE EXCEPTION '000326: attese 7 etichette tradotte, trovate %', n;
  END IF;
END $$;

COMMIT;
