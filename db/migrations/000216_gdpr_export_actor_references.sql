-- 000216_gdpr_export_actor_references.sql
-- Z-259 — l'export DSR non deve consegnare al richiedente dati di TERZI.
--
-- Il problema (preesistente al 2026-07-21, non introdotto da questa sessione):
-- `sys_gdpr_data_map` pilota anche `exportSubjectData`, che per ogni riga del
-- registro fa `SELECT * FROM <tabella> WHERE <colonna> = <richiedente>`. Due
-- righe del registro selezionano pero' su una colonna in cui la persona non e'
-- il SOGGETTO del record ma il suo AUTORE:
--
--   * sys_feedback_360_responses.response_reviewer_user_id
--   * sys_continuous_feedback.feedback_from_user_id
--
-- Misurato live su `tommaso.fiore@rtl-bank.org` (ruolo USER, il piu' basso):
-- 8 risposte 360 su 8 colleghi diversi + 4 feedback verso 4 colleghi diversi,
-- restituiti INTERI. Art. 15(4): il diritto di copia non lede i diritti altrui.
--
-- Perche' una colonna e non una regex nel codice: la stessa scelta e' costata
-- Z-257. Qui le due righe sono elencate ESPLICITAMENTE, non derivate da un
-- pattern sul nome ne' da una query viva sul catalogo — cosi' un riferimento
-- nuovo NON viene auto-classificato e resta visibile al gate di copertura.
--
-- Nota di disegno (vale anche per il seguito di Z-257): la marcatura governa la
-- SELEZIONE. Resta separata la PROIEZIONE — nelle righe legittimamente
-- esportate, le altre colonne che puntano a sys_users vengono omesse dal
-- bundle: e' cio' che impedisce che il valutato scopra CHI lo ha valutato
-- (verificato: sul lato target, la riga porta con se' response_reviewer_user_id).
-- La proiezione e' derivata dal grafo FK a runtime, non da questa tabella.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE con predicato di disuguaglianza.

ALTER TABLE sys.sys_gdpr_data_map
  ADD COLUMN IF NOT EXISTS gdpr_map_reference_kind varchar(16) NOT NULL DEFAULT 'SUBJECT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_gdpr_data_map'::regclass
       AND conname  = 'sys_gdpr_data_map_reference_kind_check'
  ) THEN
    ALTER TABLE sys.sys_gdpr_data_map
      ADD CONSTRAINT sys_gdpr_data_map_reference_kind_check
      CHECK (gdpr_map_reference_kind IN ('SUBJECT', 'ACTOR'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_gdpr_data_map.gdpr_map_reference_kind IS
  'SUBJECT = la riga contiene dati DELLA persona: entra nell''export Art. 15. ACTOR = la persona e'' autore/valutatore di un fatto ALTRUI: la riga NON entra nell''export, perche'' descrive un terzo (Art. 15(4)). Elenco esplicito, mai derivato da pattern sul nome.';

-- Le due righe ACTOR del registro corrente. Elenco chiuso e verificato a mano:
-- ogni riga sta su una tabella che collega due persone, e questa colonna e'
-- quella dell'AUTORE (l'altra, che designa il soggetto, resta SUBJECT).
UPDATE sys.sys_gdpr_data_map
   SET gdpr_map_reference_kind = 'ACTOR', updated_at = now()
 WHERE gdpr_map_table_schema = 'sys'
   AND (gdpr_map_table_name, gdpr_map_subject_fk) IN (
         ('sys_feedback_360_responses', 'response_reviewer_user_id'),
         ('sys_continuous_feedback',    'feedback_from_user_id')
       )
   AND gdpr_map_reference_kind <> 'ACTOR';
