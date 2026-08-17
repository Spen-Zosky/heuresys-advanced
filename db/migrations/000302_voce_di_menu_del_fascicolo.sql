-- ============================================================================
-- 000302 — La voce di menu del fascicolo di configurazione.
--          (#131 Tenant Builder P1, T6)
--
-- La voce sta in `governance` accanto a `blueprints`: il fascicolo E' la
-- configurazione di un'azienda, e chi lo compone sta gia' guardando i modelli.
-- I valori di `sidebar_group`, `perspective`, `icon` e `order` NON sono
-- plausibili a memoria: sono copiati dalle voci vicine lette sul database
-- (governance/GOVERNANCE, ordini 10..20 e 40; il fascicolo prende il 21, subito
-- dopo `skill-taxonomy`, per non spostare nulla di esistente).
--
-- LA COPPIA RISORSA+AZIONE E' OBBLIGATORIA, non una precauzione. La `000271`
-- chiude con una guardia che pretende che **nessuna voce riservata resti muta**:
-- una riga con `requires_admin = true` e la coppia vuota ricadrebbe sul solo
-- controllo di classe e renderebbe rossa quella guardia. Qui la coppia e'
-- `tenant_blueprint` + `read`, cioe' esattamente il permesso che governa le 15
-- rotte del modulo.
--
-- IDEMPOTENTE + sicura due volte. Nessuna operazione distruttiva.
-- PER TORNARE INDIETRO: `DELETE FROM sys.sys_ui_interfaces WHERE
-- ui_interface_code = 'tenant-blueprints'` — e togliere questo file, perche' la
-- catena si ri-applica per intero a ogni deploy (ADR-0035).
-- ============================================================================
BEGIN;

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('tenant-blueprints', 'Fascicoli di configurazione', '/tenant-blueprints', 'ClipboardList',
   'governance', 'GOVERNANCE', 'tenant_blueprint', 'read', true, 21, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Canone i18n (ADR-0029): italiano canonico in riga, inglese come
-- sovrapposizione. Senza questa riga il cancello di copertura EN va rosso.
--
-- ⚠ EMENDATA S1068 (2026-08-17): il campo era `'label'`, e nessuno lo legge. Il
-- canonico e' `ui_interface_label` — misurato: **66 righe** lo usano, e questa era
-- l'unica con l'altro nome. Conseguenze reali di quel refuso, entrambe invisibili
-- finche' la `000322` non ha fatto scattare la post-condizione della `000306` alla
-- SECONDA passata della prova generale:
--   (a) questa riga era un ORFANO ricreato a ogni deploy (ADR-0035: la catena si
--       ri-applica, quindi si emenda il file che lo crea — non si cancella a valle);
--   (b) l'etichetta EN che l'utente vedeva veniva dalla `000306`, ed era
--       «Configuration blueprints» — cioe' il nome di un'ALTRA voce di menu
--       (`/blueprints`, i modelli). Un fascicolo di configurazione non e' un modello,
--       e chiamarli con la stessa parola in inglese cancella la distinzione su cui
--       poggia tutto il Tenant Builder. Corretto anche la' nello stesso passaggio.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en',
       'Configuration dossiers', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'tenant-blueprints'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

-- In AGGIUNTA all'emendamento (ADR-0035 forma 3): rimuove l'esemplare orfano che le
-- corse precedenti hanno lasciato. Da sola questa riga non ritirerebbe nulla — al
-- deploy dopo l'INSERT qui sopra lo ricreerebbe; e' l'emendamento a chiudere il rubinetto.
DELETE FROM sys.sys_reference_translations
 WHERE entity_table = 'sys_ui_interfaces' AND field = 'label';

DO $$
DECLARE n int;
BEGIN
  -- 1. Il permesso dichiarato deve ESISTERE, altrimenti la voce sparirebbe per
  --    tutti: una coppia che non corrisponde a nulla non e' mai soddisfatta.
  SELECT count(*) INTO n FROM sys.sys_auth_permissions
   WHERE auth_permission_code = 'tenant_blueprint:read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000302: atteso 1 permesso tenant_blueprint:read, trovati %', n;
  END IF;

  -- 2. La voce esiste, e' attiva e dichiara la coppia.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'tenant-blueprints'
     AND ui_interface_is_active
     AND ui_interface_requires_admin
     AND ui_interface_required_resource = 'tenant_blueprint'
     AND ui_interface_required_action = 'read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000302: la voce del fascicolo non dichiara il permesso che la governa';
  END IF;

  -- 3. La condizione della 000271, ri-verificata sulla RIGA intera: nessuna
  --    voce riservata muta. Vale per tutte, non solo per quella appena inserita.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_is_active AND ui_interface_requires_admin
     AND (ui_interface_required_resource IS NULL OR ui_interface_required_action IS NULL);
  IF n <> 0 THEN
    RAISE EXCEPTION
      '000302: % voci riservate non dichiarano il permesso che le governa', n;
  END IF;

  -- 4. Post-condizione che protegge cio' che NON doveva cambiare: nessuna voce
  --    esistente ha cambiato posizione. L'ordine 21 era libero (misurato: in
  --    governance esistono 10..20 e 40), e se qualcuno lo occupasse in futuro
  --    questa verifica lo direbbe invece di lasciare due voci sovrapposte.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_sidebar_group = 'governance' AND ui_interface_order = 21;
  IF n <> 1 THEN
    RAISE EXCEPTION '000302: in governance ci sono % voci all''ordine 21, ne serve una sola', n;
  END IF;

  -- 5. La copertura EN della voce nuova, col campo canonico (emendato S1068).
  SELECT count(*) INTO n
    FROM sys.sys_reference_translations t
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = t.entity_id
   WHERE t.entity_table = 'sys_ui_interfaces' AND t.locale = 'en'
     AND t.field = 'ui_interface_label'
     AND i.ui_interface_code = 'tenant-blueprints';
  IF n <> 1 THEN
    RAISE EXCEPTION '000302: manca la traduzione EN dell''etichetta del fascicolo';
  END IF;

  RAISE NOTICE '000302: voce «Fascicoli di configurazione» in governance, permesso dichiarato, 0 voci mute';
END $$;

COMMIT;
