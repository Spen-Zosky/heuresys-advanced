-- ============================================================================
-- 000157_g01_process_names_it.sql
-- Fix G-01 (audit S1006), slice 2/N: blueprint process registry names.
-- /processes + /process-owner showed the 23 BPM process names in English while
-- the UI is Italian. Translated IT-canonical (Enzo's decision). Standard banking
-- process taxonomy; acronyms (KYC/AML/ALM/IT) kept. Resilient (join by code) +
-- idempotent (update only-if-differs).
-- ============================================================================

WITH tr(code, it) AS (VALUES
  ('00', 'Strategia e governance aziendale'),
  ('01', 'Acquisizione e onboarding clienti'),
  ('02', 'KYC / AML'),
  ('03', 'Apertura e gestione conti'),
  ('04', 'Pagamenti e bonifici'),
  ('05', 'Erogazione del credito'),
  ('06', 'Monitoraggio e recupero crediti'),
  ('07', 'Consulenza patrimoniale'),
  ('08', 'Investimenti retail'),
  ('09', 'Tesoreria e ALM'),
  ('10', 'Gestione del rischio'),
  ('11', 'Compliance e reportistica regolamentare'),
  ('12', 'Audit interno'),
  ('13', 'Operatività di filiale'),
  ('14', 'Servizio clienti'),
  ('15', 'Marketing e comunicazione'),
  ('16', 'IT e cybersecurity'),
  ('17', 'Gestione del capitale umano'),
  ('18', 'Finanza e contabilità'),
  ('19', 'Approvvigionamenti e gestione fornitori'),
  ('20', 'Facility e immobili'),
  ('21', 'Legale'),
  ('22', 'Dati e analytics')
)
UPDATE sys.sys_blueprint_process_registry p
   SET blueprint_process_name = tr.it
  FROM tr
 WHERE p.blueprint_process_code = tr.code
   AND p.blueprint_process_name <> tr.it;

DO $$
BEGIN
  RAISE NOTICE '000157: blueprint process names translated to IT (G-01 slice 2).';
END $$;
