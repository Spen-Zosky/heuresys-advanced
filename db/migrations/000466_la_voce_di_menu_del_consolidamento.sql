-- ============================================================================
-- 000466 — La voce di menu del CONSOLIDAMENTO DEL TENANT.  (AC-10, `.programmi/consolidamento/agente/`)
--
-- La pagina `/consolidation` è dove il Direttore HR avvia i giri dell'agente, ne legge le
-- proposte e decide (specifica §6, «tutto dentro advanced»). Senza una voce di menu la
-- pagina esisterebbe e nessuno la troverebbe: è il difetto che la 000306 ha chiuso per
-- ventidue pagine, e che qui non si riapre.
--
-- IL PERMESSO È `consolidation:read` (000465), e `requires_admin` è FALSO: chi apre la
-- voce è chi ha quel permesso, cioè il Direttore HR (`HRMS_MANAGER`) del tenant, senza la
-- seconda condizione dei ruoli d'amministrazione. Il delegato senza ruolo non vede la voce
-- (non ha il permesso, ha una delega): raggiunge la pagina dal collegamento che il Direttore
-- gli dà, e le rotte lo ammettono per la delega. Portare la delega nel menu è un passo a sé.
--
-- LA RESOURCE NON PORTA DATI DI PERSONA, ed è scritto in `apps/api/src/lib/scope/data-classes.ts`
-- (`RESOURCE_SENZA_DATI_DI_PERSONA`): il registro tiene voci di struttura (unità, posizioni,
-- competenze, processi, indicatori) e nessun identificativo di persona (specifica §7). Per
-- questo la voce non dichiara classi in `sys_ui_interface_data_classes`.
--
-- La sezione è GOVERNANCE, accanto a modelli e tenant: il consolidamento confronta la
-- struttura del tenant con il prototipo, non è un cruscotto. L'ordine 19 sta in coda alla
-- sezione; un ordine condiviso non è un errore (la 000322 lo ha misurato), conta il gruppo.
--
-- Icona `Layers`: la sidebar risolve `ui_interface_icon` con una mappa esplicita
-- (`apps/web/src/app/(authenticated)/layout.tsx`), e `Layers` c'è.
--
-- IDEMPOTENTE. Nessuna operazione distruttiva.
-- PER TORNARE INDIETRO: emendare questo file (ADR-0035) e togliere la riga del codice
-- `tenant-consolidation` e la sua traduzione — la catena si ri-applica a ogni deploy.
-- ============================================================================
BEGIN;

-- Il conteggio da proteggere, letto PRIMA: nessuna voce esistente deve muoversi.
CREATE TEMP TABLE _menu_prima_466 ON COMMIT DROP AS
SELECT ui_interface_code AS codice, ui_interface_sidebar_group AS gruppo,
       ui_interface_order AS ord, ui_interface_is_active AS attiva
  FROM sys.sys_ui_interfaces
 WHERE ui_interface_code <> 'tenant-consolidation';

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action,
   ui_interface_requires_admin, ui_interface_order, ui_interface_is_active)
VALUES
  ('tenant-consolidation', 'Consolidamento con il prototipo', '/consolidation', 'Layers',
   'governance', 'GOVERNANCE', 'consolidation', 'read', false, 19, true)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Canone i18n (ADR-0029): italiano in riga, inglese come sovrapposizione, campo canonico.
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_ui_interfaces', i.ui_interface_id, 'ui_interface_label', 'en',
       'Consolidation with the prototype', 'MANUAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'tenant-consolidation'
ON CONFLICT (entity_table, entity_id, field, locale)
  DO UPDATE SET text = EXCLUDED.text, source = 'MANUAL', updated_at = now();

DO $$
DECLARE n int; v_cambiate int;
BEGIN
  -- 1. Il permesso dichiarato esiste: una coppia che non corrisponde a nulla nasconde la voce a tutti.
  SELECT count(*) INTO n FROM sys.sys_auth_permissions WHERE auth_permission_code = 'consolidation:read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000466: atteso 1 permesso consolidation:read, trovati %', n;
  END IF;

  -- 2. La voce c'è, una sola, attiva, con la coppia che la governa.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code = 'tenant-consolidation' AND ui_interface_route = '/consolidation'
     AND ui_interface_is_active AND NOT ui_interface_requires_admin
     AND ui_interface_required_resource = 'consolidation' AND ui_interface_required_action = 'read';
  IF n <> 1 THEN
    RAISE EXCEPTION '000466: la voce del consolidamento non dichiara il permesso che la governa';
  END IF;

  -- 3. Una rotta, una voce: nessun doppione che il menu mostrerebbe due volte.
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_route = '/consolidation';
  IF n <> 1 THEN
    RAISE EXCEPTION '000466: % voci puntano a /consolidation', n;
  END IF;

  -- 4. POST-CONDIZIONE SU CIÒ CHE NON DOVEVA CAMBIARE: nessuna voce preesistente si è mossa.
  SELECT count(*) INTO v_cambiate
    FROM _menu_prima_466 p
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_code = p.codice
   WHERE i.ui_interface_sidebar_group <> p.gruppo OR i.ui_interface_order <> p.ord
      OR i.ui_interface_is_active <> p.attiva;
  IF v_cambiate <> 0 THEN
    RAISE EXCEPTION '000466: % voci di menu esistenti sono cambiate', v_cambiate;
  END IF;

  -- 5. La traduzione EN della voce nuova.
  SELECT count(*) INTO n
    FROM sys.sys_reference_translations t
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = t.entity_id
   WHERE t.entity_table = 'sys_ui_interfaces' AND t.locale = 'en' AND t.field = 'ui_interface_label'
     AND i.ui_interface_code = 'tenant-consolidation';
  IF n <> 1 THEN
    RAISE EXCEPTION '000466: manca la traduzione EN della voce del consolidamento';
  END IF;

  RAISE NOTICE '000466: voce «Consolidamento con il prototipo» in governance (ord 19), permesso consolidation:read, 0 voci cambiate';
END $$;

COMMIT;
