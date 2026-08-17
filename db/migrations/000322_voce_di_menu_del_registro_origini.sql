-- ============================================================================
-- 000322 — La voce di menu del REGISTRO DELL'ORIGINE.  (#198 Tenant Builder P3, T7)
--
-- PERCHE' UNA PAGINA AUTONOMA, e non annidata nel fascicolo come diceva il piano.
-- Il piano di T7 collocava il registro sotto
-- `/tenant-blueprints/[id]/origins`. Misurato su `sys_auth_role_permissions`
-- prima di scrivere una riga:
--     tenant_blueprint:read  ->  PLATFORM_ADMIN
--     provenance:read        ->  PLATFORM_ADMIN, TENANT_ADMIN
-- Annidato li', il registro sarebbe stato **irraggiungibile per `TENANT_ADMIN`** —
-- che e' proprio uno dei due ruoli a cui il permesso lo apre, e proprio il ruolo
-- con cui il piano stesso chiede di provarlo («deve vedere il registro della
-- propria azienda»). La collocazione contraddiceva la prova.
--
-- Percio' la pagina e' autonoma e la voce sta in `overview`, dove vive
-- `/provenance`: stesso permesso, e la stessa domanda — «da dove viene questo
-- dato». L'isolamento per azienda NON e' nella pagina: e' nel servizio
-- (`tenantFilter`: platform vede tutto, tenant-admin la propria), che e' I5 —
-- FK piu' filtro applicativo, mai RLS.
--
-- L'ORDINE E' 11, cioe' in CODA al gruppo, e non e' una scelta estetica: gli
-- ordini 8 e 9 — i piu' vicini a `/provenance` — sono occupati, e **l'8 lo e' due
-- volte** (`provenance` e `org-director-vrio`). Infilarsi accanto avrebbe creato
-- una terza voce sullo stesso numero. La vicinanza semantica la da' il gruppo, non
-- l'intero. Percio' la post-condizione qui NON puo' essere «una sola voce
-- all'ordine N», come nella `000302`: in questo gruppo sarebbe falsa da prima.
--
-- IDEMPOTENTE. Nessuna operazione distruttiva.
-- PER TORNARE INDIETRO: `DELETE FROM sys.sys_ui_interfaces WHERE
-- ui_interface_code = 'generated-origins'` **e** togliere questo file — la catena
-- si ri-applica per intero a ogni deploy (ADR-0035).
-- ============================================================================
BEGIN;

-- Il conteggio da proteggere, letto PRIMA: nessuna voce esistente deve muoversi.
CREATE TEMP TABLE _menu_prima ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord
  FROM sys.sys_ui_interfaces;

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  -- L'icona e' `Database` e non un nome piu' espressivo perche' la sidebar risolve
  -- `ui_interface_icon` con una MAPPA ESPLICITA (`layout.tsx:50`): un nome fuori da
  -- quella mappa non da' errore, da' una voce senza icona. Verificato prima di
  -- scriverlo — `FileSearch`, che sarebbe stato piu' calzante, non c'e'.
  ('generated-origins', 'Registro delle righe generate', '/generated-origins', 'Database',
   'overview', 'OVERVIEW', 'provenance', 'read', true, 11, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Canone i18n (ADR-0029): italiano canonico in riga, inglese come sovrapposizione.
-- Senza questa riga il cancello di copertura EN va rosso.
--
-- ⚠ IL NOME DEL CAMPO E' `ui_interface_label`, NON `label`. Copiandolo dalla `000302`
-- avevo scritto `label`, e la **seconda passata** della prova generale mi ha fermato:
-- la post-condizione della `000306` — numero MINORE, quindi gira prima e alla seconda
-- passata vede la voce nuova — conta le traduzioni con `field='ui_interface_label'` e
-- dichiarava «67 voci attive ma 66 etichette tradotte». Misurato subito dopo:
-- **66 righe** portano `ui_interface_label` e **una sola** porta `label`, quella della
-- `000302`. Il canonico e' quello con 66 esemplari; l'altro e' un residuo, emendato
-- nello stesso passaggio.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en',
       'Generated records registry', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'generated-origins'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

DO $$
DECLARE n int; v_spostate int;
BEGIN
  -- 1. Il permesso dichiarato deve ESISTERE: una coppia che non corrisponde a
  --    nulla non e' mai soddisfatta, e la voce sparirebbe per tutti.
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'provenance:read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000322: atteso 1 permesso provenance:read, trovati %', n;
  END IF;

  -- 2. La voce esiste, e' attiva e dichiara la coppia che la governa.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'generated-origins'
     AND ui_interface_is_active
     AND ui_interface_requires_admin
     AND ui_interface_required_resource = 'provenance'
     AND ui_interface_required_action = 'read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000322: la voce del registro non dichiara il permesso che la governa';
  END IF;

  -- 3. La condizione della 000271 ri-verificata su TUTTE le righe, non solo sulla
  --    nuova: nessuna voce riservata resta muta.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active AND ui_interface_requires_admin
     AND (ui_interface_required_resource IS NULL OR ui_interface_required_action IS NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION '000322: % voci riservate non dichiarano il permesso che le governa', n;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE: nessuna voce preesistente
  --    ha cambiato gruppo o ordine. E' la forma giusta qui, dove «una sola voce
  --    per ordine» non vale (l'8 e' doppio da prima di questa migrazione).
  SELECT count(*) INTO v_spostate
    FROM _menu_prima p
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = p.codice
   WHERE i.ui_interface_sidebar_group <> p.gruppo OR i.ui_interface_order <> p.ord;
  IF v_spostate <> 0 THEN
    RAISE EXCEPTION '000322: % voci di menu esistenti hanno cambiato posizione', v_spostate;
  END IF;

  -- 5. La copertura EN dell'etichetta nuova.
  SELECT count(*) INTO n
    FROM sys.sys_reference_translations t
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = t.entity_id
   WHERE t.entity_table = 'sys_ui_interfaces' AND t.locale = 'en'
     AND t.field = 'ui_interface_label'
     AND i.ui_interface_code = 'generated-origins';
  IF n <> 1 THEN
    RAISE EXCEPTION '000322: manca la traduzione EN dell''etichetta del registro';
  END IF;

  -- 6. E la copertura vale per TUTTE le voci attive, con il campo canonico: e' la
  --    condizione della 000306, ri-verificata qui perche' questa migrazione aggiunge
  --    una voce e sarebbe la prima a poterla rompere.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces i
   WHERE i.ui_interface_is_active
     AND NOT EXISTS (SELECT 1 FROM sys.sys_reference_translations x
                      WHERE x.entity_table = 'sys_ui_interfaces'
                        AND x.entity_id = i.ui_interface_id
                        AND x.field = 'ui_interface_label' AND x.locale = 'en');
  IF n <> 0 THEN
    RAISE EXCEPTION '000322: % voci di menu attive restano senza etichetta EN', n;
  END IF;

  -- 7. Il residuo che questa migrazione ha fatto emergere non deve tornare: nessuna
  --    riga con il campo fuori convenzione `label`, che nessun lettore consulta.
  SELECT count(*) INTO n FROM sys.sys_reference_translations
   WHERE entity_table = 'sys_ui_interfaces' AND field = 'label';
  IF n <> 0 THEN
    RAISE EXCEPTION '000322: % traduzioni di menu usano ancora il campo orfano «label»', n;
  END IF;

  RAISE NOTICE '000322: voce «Registro delle righe generate» in overview (ord 11), permesso provenance:read dichiarato, 0 voci mute, 0 voci spostate';
END $$;

COMMIT;
