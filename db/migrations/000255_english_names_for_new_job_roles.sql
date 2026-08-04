-- ═══════════════════════════════════════════════════════════════════════════════
-- 000255_english_names_for_new_job_roles.sql
--
-- IL NOME INGLESE DEI 39 RUOLI PROFESSIONALI NATI CON LA RICOSTRUZIONE.
--
-- Perche' esiste
--   La migrazione 000252 ha creato 39 ruoli professionali per dare una mansione
--   alle 133 posizioni della ricostruzione dell'organigramma. Li ha creati con il
--   nome italiano e basta: il cruscotto di salute e' passato da «coverage EN: 0
--   campi con gap» a **2 campi con gap, 39 righe ciascuno** — `job_role_name` e
--   `job_role_description`. Un rosso introdotto applicando, chiuso qui.
--
--   Non e' un dettaglio cosmetico: l'interfaccia ha il selettore di lingua
--   nell'header e un utente che lavora in inglese vedrebbe trentanove mansioni in
--   italiano in mezzo alle altre.
--
-- Come sono tradotte
--   Con la terminologia bancaria inglese corrente, non parola per parola: un
--   «Gestore Piccole Imprese» in inglese e' uno *Small Business Relationship
--   Manager*, non un «Small Enterprise Handler». Dove esiste gia' un ruolo
--   omonimo nel catalogo `RTL-ROLE-*` (che e' in inglese) si usa la stessa forma,
--   perche' due nomi diversi per lo stesso mestiere sono un difetto di catalogo.
--   `source: 'LLM'`, come le 137 traduzioni gia' presenti.
--
-- Reversibile: rollback in coda. Rieseguibile: ON CONFLICT DO NOTHING sulla
-- chiave naturale (entita, campo, lingua).
-- Prerequisiti: 000252 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE en (codice text, nome_en text, descrizione_en text) ON COMMIT DROP;
INSERT INTO en VALUES
  ('RTL-ROLE-CASSIERE',                  'Bank Teller',                          'Branch counter operations: cash handling, payments and everyday customer service.'),
  ('RTL-ROLE-CONSULENTE-CLIENTELA',      'Personal Banking Advisor',             'Advises retail customers on accounts, lending and savings products.'),
  ('RTL-ROLE-GESTORE-PICCOLE-IMPRESE',   'Small Business Relationship Manager',  'Manages the bank relationship with small businesses and sole traders.'),
  ('RTL-ROLE-VICE-DIRETTORE-FILIALE',    'Deputy Branch Manager',                'Supports the branch manager and stands in for them on daily operations.'),
  ('RTL-ROLE-DIRETTORE-FILIALE',         'Branch Manager',                       'Runs a branch: commercial results, staff and operational compliance.'),
  ('RTL-ROLE-RESPONSABILE-AREA',         'Area Manager',                         'Leads the branches of a geographic area.'),
  ('RTL-ROLE-SPECIALISTA-SUPPORTO-RETE', 'Branch Network Support Specialist',    'Quality and operational support to the branch network.'),
  ('RTL-ROLE-RESP-GOVERNO-RETE',         'Head of Branch Network Governance',    'Heads network governance and support.'),
  ('RTL-ROLE-SPECIALISTA-SVILUPPO-COMM', 'Business Development Specialist',      'Develops commercial initiatives and customer acquisition.'),
  ('RTL-ROLE-RESP-COORD-COMMERCIALE',    'Head of Commercial Coordination',      'Heads commercial coordination across the network.'),
  ('RTL-ROLE-ANALISTA-CREDITI',          'Credit Analyst',                       'Assesses creditworthiness and prepares lending decisions.'),
  ('RTL-ROLE-ANALISTA-MONITORAGGIO',     'Credit Monitoring Analyst',            'Monitors exposures and early warning signals on the loan book.'),
  ('RTL-ROLE-GESTORE-RECUPERO-CREDITI',  'Debt Recovery Officer',                'Manages the recovery of non-performing exposures.'),
  ('RTL-ROLE-DIRETTORE-CREDITI',         'Head of Credit',                       'Leads the credit division.'),
  ('RTL-ROLE-RESP-ISTRUTTORIA',          'Head of Loan Origination',             'Heads loan assessment and disbursement.'),
  ('RTL-ROLE-RESP-MONITORAGGIO',         'Head of Credit Monitoring and NPL',    'Heads monitoring and non-performing loans.'),
  ('RTL-ROLE-RESP-CREDITI-RETAIL',       'Head of Retail Lending',               'Heads the retail lending office.'),
  ('RTL-ROLE-RESP-CREDITI-PMI',          'Head of SME Lending',                  'Heads the SME lending office.'),
  ('RTL-ROLE-ANALISTA-BILANCIO',         'Financial Reporting Analyst',          'Prepares statutory accounts and supervisory reporting.'),
  ('RTL-ROLE-ANALISTA-FINANZIARIO',      'Financial Analyst',                    'Financial analysis and planning.'),
  ('RTL-ROLE-RESP-BILANCIO',             'Head of Financial and Regulatory Reporting', 'Heads accounts and supervisory reporting.'),
  ('RTL-ROLE-OPERATORE-CAMBI',           'FX Dealer',                            'Executes foreign exchange operations.'),
  ('RTL-ROLE-SPECIALISTA-BACK-OFFICE',   'Back Office Specialist',               'Processes and settles banking transactions.'),
  ('RTL-ROLE-SPECIALISTA-PAGAMENTI',     'Payment Specialist',                   'Handles payment systems and transaction processing.'),
  ('RTL-ROLE-RESP-BACK-OFFICE',          'Head of Back Office',                  'Heads back office operations.'),
  ('RTL-ROLE-RESP-PAGAMENTI',            'Head of Payments',                     'Heads the payments department.'),
  ('RTL-ROLE-SISTEMISTA',                'Systems Administrator',                'Runs and maintains IT infrastructure.'),
  ('RTL-ROLE-ANALISTA-RISCHIO',          'Risk Analyst',                         'Measures and reports on the bank risk exposures.'),
  ('RTL-ROLE-RISK-MANAGER',              'Risk Manager',                         'Manages the risk management function.'),
  ('RTL-ROLE-RESP-RISK-MANAGEMENT',      'Head of Risk Management',              'Heads the risk management department.'),
  ('RTL-ROLE-LEGALE',                    'Legal Counsel',                        'Provides legal advice and handles disputes.'),
  ('RTL-ROLE-SPECIALISTA-COMPLIANCE',    'Compliance Specialist',                'Ensures adherence to regulation and internal policy.'),
  ('RTL-ROLE-RESP-AFFARI-LEGALI',        'Head of Legal and Corporate Affairs',  'Heads legal and corporate affairs.'),
  ('RTL-ROLE-RESP-ANTIRICICLAGGIO',      'Head of Anti-Money Laundering',        'Heads the anti-money laundering department.'),
  ('RTL-ROLE-SPECIALISTA-MARKETING',     'Marketing and Communications Specialist', 'Marketing campaigns and corporate communications.'),
  ('RTL-ROLE-ADDETTO-AMM-PERSONALE',     'Payroll and HR Administration Officer', 'Payroll and employment administration.'),
  ('RTL-ROLE-SPECIALISTA-FORMAZIONE',    'Learning and Development Specialist',  'Designs and delivers training and development.'),
  ('RTL-ROLE-RESP-AMM-PERSONALE',        'Head of HR Administration',            'Heads HR and payroll administration.'),
  ('RTL-ROLE-RESP-SVILUPPO-ORG',         'Head of Organisational Development',   'Heads development, training and organisational design.');

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_job_roles', jr.job_role_id, 'name', 'en', e.nome_en, 'LLM'
  FROM en e JOIN sys.sys_job_roles jr ON jr.job_role_code = e.codice
ON CONFLICT DO NOTHING;

INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_job_roles', jr.job_role_id, 'description', 'en', e.descrizione_en, 'LLM'
  FROM en e JOIN sys.sys_job_roles jr ON jr.job_role_code = e.codice
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_mappa int; n_agganciati int; n_gap int; n_orfani int;
BEGIN
  SELECT count(*) INTO n_mappa FROM en;
  IF n_mappa <> 39 THEN RAISE EXCEPTION 'Mappa EN: attese 39 righe, trovate %', n_mappa; END IF;

  -- ogni codice della mappa corrisponde a un ruolo che esiste: un refuso nel codice
  -- passerebbe in silenzio, lasciando la traduzione non scritta e il gap aperto
  SELECT count(*) INTO n_agganciati FROM en e
    JOIN sys.sys_job_roles jr ON jr.job_role_code = e.codice;
  IF n_agganciati <> 39 THEN
    RAISE EXCEPTION 'Codici della mappa che non corrispondono ad alcun ruolo: %', 39 - n_agganciati;
  END IF;

  -- LA PROVA: la vista di copertura torna a zero campi con gap
  SELECT coalesce(sum(missing), 0) INTO n_gap FROM sys.v_reference_translation_coverage;
  IF n_gap <> 0 THEN
    RAISE EXCEPTION 'Copertura EN: restano % traduzioni mancanti', n_gap;
  END IF;

  -- e non si sono create traduzioni che puntano a righe inesistenti: e' il danno
  -- che la sentinella degli orfani ha scoperto in S1042, subito dopo una bonifica
  SELECT count(*) INTO n_orfani FROM sys.v_reference_translation_orphans;
  IF n_orfani <> 0 THEN
    RAISE EXCEPTION 'Traduzioni orfane create da questa migrazione: %', n_orfani;
  END IF;

  RAISE NOTICE 'TRADUZIONI OK — 39 ruoli con nome e descrizione in inglese, copertura EN senza lacune, nessuna traduzione orfana.';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   DELETE FROM sys.sys_reference_translations t
--    USING sys.sys_job_roles jr
--    WHERE t.entity_id = jr.job_role_id AND t.entity_table = 'sys_job_roles' AND t.locale = 'en'
--      AND jr.job_role_description LIKE 'Ruolo professionale introdotto con la ricostruzione%';
-- COMMIT;
