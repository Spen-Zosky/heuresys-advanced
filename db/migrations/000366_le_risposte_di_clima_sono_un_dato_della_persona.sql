-- ============================================================================
-- 000366 — Le risposte ai sondaggi di clima sono un dato della persona (#235)
--
-- LA VOCE `engagement` USA UNA RESOURCE ORA CLASSIFICATA, E NON LO DICHIARAVA.
-- Da #235 (S1085) `surveys` è `PERSONAL` in `RESOURCE_DATA_CLASS`: il cancello di
-- `#99` F7 — «esige la classe su ogni voce la cui resource è person-level» — diventa
-- rosso finché la voce non dichiara almeno quella classe. Questa migrazione è la
-- dichiarazione, e nasce dal test, non da un'intenzione.
--
-- PERCHÉ `PERSONAL`, e non `EVALUATION`: una risposta a un sondaggio di clima è
-- l'OPINIONE della persona, non un giudizio SU di lei.
--
-- PERCHÉ **NON** APERTA AL TENANT (`data_class_open_to_tenant = false`, il default):
-- l'esenzione della `000317` esiste per la RUBRICA AZIENDALE — nome e collocazione,
-- che chiunque lavori in azienda deve poter vedere. Chi ha detto cosa sul clima è
-- l'opposto: il dato che l'asse organizzativo esiste per proteggere (I18).
--
-- MISURATO PRIMA DI SCRIVERE (2026-08-30, database di produzione):
--   sys_engagement_survey_responses   862 righe · 862 con `response_subject_user_id`
--   sys_survey_responses            8.288 righe · 8.288 con `survey_response_subject_user_id`
--   sys_pulse_checks                2.834 righe · 2.834 con `pulse_check_subject_user_id`
--   sondaggi con `survey_is_anonymous = true`: 0 su 6 — nessuna promessa tradita
--   voci con `ui_interface_required_resource = 'surveys'`: `engagement` (INTELLIGENCE)
--     e `me-surveys` (PERSONAL, esclusa dal cancello perché è la vista di sé)
--
-- CHI PERDE LA VOCE DI MENU: **nessuno dei 18 titolari di `surveys:read`** (MANAGER 9,
-- TENANT_ADMIN 3, HRMS_MANAGER 2, PLATFORM_ADMIN 2, BLUEPRINT_MANAGER 1, PROCESS_OWNER 1).
-- In M1 `PERSONAL` è `none` in **un solo** dominio — `delegation` — e la voce sparirebbe
-- soltanto a chi non aprisse nessun altro dominio. La verifica live è la prova che chiude
-- la voce; questa è la ragione per cui ci si aspetta che non cambi nulla di visibile.
-- ============================================================================

INSERT INTO sys.sys_ui_interface_data_classes (ui_interface_id, data_class)
SELECT i.ui_interface_id, 'PERSONAL'
  FROM sys.sys_ui_interfaces i
 WHERE i.ui_interface_code = 'engagement'   -- elencata per codice, mai per LIKE
ON CONFLICT ON CONSTRAINT sys_ui_interface_data_classes_uq DO NOTHING;

DO $$
DECLARE
  n_engagement int;
  n_aperta     int;
  n_me         int;
  n_orfane     int;
BEGIN
  -- 1. la dichiarazione esiste
  SELECT count(*) INTO n_engagement
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code = 'engagement' AND dc.data_class = 'PERSONAL';
  IF n_engagement <> 1 THEN
    RAISE EXCEPTION '000366: attesa 1 dichiarazione PERSONAL su engagement, trovate %', n_engagement;
  END IF;

  -- 2. …e NON è aperta al tenant. Una riga aperta qui rimetterebbe le risposte di clima
  --    nella rubrica aziendale, cioè disferebbe la voce mentre sembra applicarla.
  SELECT count(*) INTO n_aperta
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code = 'engagement' AND dc.data_class_open_to_tenant;
  IF n_aperta <> 0 THEN
    RAISE EXCEPTION '000366: engagement dichiara % classi aperte al tenant, attese 0', n_aperta;
  END IF;

  -- 3. POST-CONDIZIONE SU CIÒ CHE NON DOVEVA CAMBIARE: `me-surveys` è la vista di sé
  --    (I17) e questa migrazione non la tocca. Se domani qualcuno le aggiungesse una
  --    classe da qui, la sua pagina personale comincerebbe a dipendere da M1.
  SELECT count(*) INTO n_me
    FROM sys.sys_ui_interface_data_classes dc
    JOIN sys.sys_ui_interfaces i ON i.ui_interface_id = dc.ui_interface_id
   WHERE i.ui_interface_code = 'me-surveys';
  IF n_me <> 0 THEN
    RAISE EXCEPTION '000366: me-surveys ha % dichiarazioni, ne erano attese 0 (non la tocchiamo)', n_me;
  END IF;

  -- 4. nessuna riga senza la sua voce (l'INSERT è una SELECT: un codice sbagliato
  --    non avrebbe inserito NIENTE, e la 1 sopra lo direbbe — questa guarda l'altro verso)
  SELECT count(*) INTO n_orfane
    FROM sys.sys_ui_interface_data_classes dc
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_ui_interfaces i WHERE i.ui_interface_id = dc.ui_interface_id);
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION '000366: % dichiarazioni orfane in sys_ui_interface_data_classes', n_orfane;
  END IF;

  -- 5. IL TOTALE ESATTO delle dichiarazioni di classe, che eredito dalla `000326` — la quale
  --    lo aveva ereditato dalla `000317`, con l'istruzione «chi aggiungera' righe dopo di me
  --    deve spostare QUESTO conteggio nel proprio file». Lo raccolgo: 41 + 1 = 42.
  --    ⚠ La `000326` NON e' rimasta senza guardia: al suo posto ora verifica le PROPRIE 15
  --    righe (le sette famiglie di cruscotto), che e' cio' che quel file deve garantire e
  --    che non invecchia. Il totale resta qui, e chi aggiungera' la prossima se lo prendera'.
  SELECT count(*) INTO n_engagement FROM sys.sys_ui_interface_data_classes;
  IF n_engagement <> 42 THEN
    RAISE EXCEPTION '000366: le dichiarazioni di classe totali sono % invece di 42 — se e'' un''aggiunta legittima, il conteggio esatto va spostato nella migrazione che la introduce', n_engagement;
  END IF;

  RAISE NOTICE '000366 OK — engagement dichiara PERSONAL, non aperta al tenant; me-surveys intatta';
END $$;
