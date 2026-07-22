-- =============================================================================
-- #71b — Catalogo formativo bancario + mapping skill→modulo (S1025, 2026-07-22)
--
-- Le skill bancarie richieste dalle posizioni RTL (Blocco B) non avevano ALCUN
-- modulo formativo collegato (0 righe in skill_learning_mappings per le skill
-- richieste → la pagina /positions/:id/learning era vuota per ogni posizione).
-- Il catalogo nativo (16 temi generici/tech) non copre il dominio bancario.
--
-- FONTE realismo (ricerca web 2026-07-22): l'offerta formativa standard del
-- settore bancario italiano (percorsi professionalizzanti ABIFormazione e
-- academy bancarie: antiriciclaggio, MiFID II, credito/NPL, risk management,
-- Basilea, IFRS 9, PSD2/open banking, tesoreria, private banking, ESG, trade
-- finance, internal audit). 15 moduli GLOBAL realistici, codice BANK-LM-*.
--
-- Mapping: ogni skill bancaria richiesta → il modulo del proprio tema (target
-- proficiency = PROFICIENT); le 8 skill trasversali → i moduli nativi esistenti
-- (Leadership Fondamentale, Comunicazione Efficace, ecc.).
--
-- IDEMPOTENT: UUID v5 deterministici + ON CONFLICT/NOT EXISTS. SCOPE: catalogo
-- GLOBAL (is_global=true) + mapping; nessuna scrittura tenant-specifica.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_banking_learning_catalog.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Moduli bancari (GLOBAL, realistici, BANK-LM-*)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _bank_modules ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('BANK-LM-AML',    'Antiriciclaggio e contrasto al finanziamento del terrorismo', 'Normativa AML/CFT, adeguata verifica della clientela (KYC), segnalazioni di operazioni sospette (SOS), ruolo della UIF.', 480),
  ('BANK-LM-MIFID',  'MiFID II e tutela degli investitori', 'Product governance, valutazione di adeguatezza/appropriatezza, inducement, consulenza in materia di investimenti.', 360),
  ('BANK-LM-CREDIT', 'Il processo del credito: istruttoria, erogazione e monitoraggio', 'Analisi del merito creditizio, credit scoring, pratiche di fido, monitoraggio andamentale del portafoglio.', 600),
  ('BANK-LM-NPL',    'Gestione dei crediti deteriorati (NPL)', 'Classificazione EBA, strategie di recupero, calendar provisioning, cessioni e cartolarizzazioni.', 360),
  ('BANK-LM-RISK',   'Risk management bancario', 'Rischio di credito, mercato, operativo e di liquidità; framework RAF/ICAAP/ILAAP; stress testing e analisi di scenario.', 600),
  ('BANK-LM-BASEL',  'Basilea III/IV e requisiti patrimoniali', 'Fondi propri, RWA, leverage ratio, LCR/NSFR, impatti del pacchetto CRR3/CRD6.', 360),
  ('BANK-LM-IFRS9',  'IFRS 9 – Strumenti finanziari', 'Classificazione e misurazione, impairment expected credit loss (ECL) a 3 stadi, hedge accounting.', 300),
  ('BANK-LM-PSD2',   'PSD2, open banking e pagamenti digitali', 'Servizi di pagamento, TPP (AISP/PISP), SCA, istant payments e scenari fintech.', 300),
  ('BANK-LM-TREAS',  'Tesoreria e mercati finanziari', 'Gestione della liquidità, money market e FX, ALM di base, operatività della sala mercati.', 480),
  ('BANK-LM-PRIVB',  'Private banking e gestione patrimoniale', 'Wealth management, asset allocation, pianificazione successoria e fiscale del cliente private.', 420),
  ('BANK-LM-ESG',    'Finanza sostenibile ed ESG', 'Tassonomia UE, SFDR, integrazione dei fattori ESG nel credito e negli investimenti, rischio climatico.', 300),
  ('BANK-LM-TRADEF', 'Trade finance e operazioni con l''estero', 'Crediti documentari, garanzie internazionali, incassi documentari, norme ICC (UCP 600).', 360),
  ('BANK-LM-AUDIT',  'Internal audit bancario', 'Metodologia dell''audit interno, audit dei processi creditizi e finanza, follow-up e reporting agli organi.', 420),
  ('BANK-LM-COREB',  'Sistemi di core banking e operativitá di sportello', 'Architettura dei sistemi bancari, anagrafe/conti/pagamenti, operatività e controlli di filiale.', 300),
  ('BANK-LM-CYBFIN', 'Sicurezza informatica nei servizi finanziari', 'DORA, gestione degli incidenti ICT, frodi sui pagamenti, resilienza operativa digitale.', 300)
) t(code, title, descr, mins);

INSERT INTO sys.sys_learning_modules
  (learning_module_id, learning_module_tenant_id, learning_module_code, learning_module_title,
   learning_module_description, learning_module_kind, learning_module_delivery,
   learning_module_duration_minutes, learning_module_is_global, learning_module_metadata)
SELECT uuid_generate_v5(uuid_ns_url(), 'bank-lm:' || m.code),
       NULL, m.code, m.title, m.descr, 'COURSE', 'SELF_PACED', m.mins, true,
       jsonb_build_object('seeded_by', 'banking-learning-catalog-v1')
FROM _bank_modules m
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules lm WHERE lm.learning_module_code = m.code);

-- ----------------------------------------------------------------------------
-- 2. Mapping skill richieste → modulo del tema
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _skill_module_map ON COMMIT DROP AS
SELECT * FROM (VALUES
  -- skill bancarie (CUSTOM::, per nome) → moduli BANK-LM-*
  ('Operazioni antiriciclaggio',              'BANK-LM-AML'),
  ('Due diligence KYC',                       'BANK-LM-AML'),
  ('Conformità MiFID II',                     'BANK-LM-MIFID'),
  ('Erogazione prestiti',                     'BANK-LM-CREDIT'),
  ('Modelli di credit scoring',               'BANK-LM-CREDIT'),
  ('Gestione degli NPL',                      'BANK-LM-NPL'),
  ('Gestione del rischio di mercato',         'BANK-LM-RISK'),
  ('Gestione del rischio operativo',          'BANK-LM-RISK'),
  ('Stress testing e analisi di scenario',    'BANK-LM-RISK'),
  ('Framework regolamentare Basilea III/IV',  'BANK-LM-BASEL'),
  ('IFRS 9 – Strumenti finanziari',           'BANK-LM-IFRS9'),
  ('PSD2 e open banking',                     'BANK-LM-PSD2'),
  ('Pagamenti digitali e fintech',            'BANK-LM-PSD2'),
  ('Gestione della liquidità aziendale',      'BANK-LM-TREAS'),
  ('Trading in valute estere',                'BANK-LM-TREAS'),
  ('Private banking',                         'BANK-LM-PRIVB'),
  ('Consulenza per la gestione patrimoniale', 'BANK-LM-PRIVB'),
  ('Finanza sostenibile ed ESG',              'BANK-LM-ESG'),
  ('Trade finance',                           'BANK-LM-TRADEF'),
  ('Internal audit bancario',                 'BANK-LM-AUDIT'),
  ('Sistemi di core banking',                 'BANK-LM-COREB'),
  ('Cybersecurity finanziaria',               'BANK-LM-CYBFIN'),
  ('Relationship banking',                    'BANK-LM-PRIVB'),
  -- skill trasversali → moduli nativi esistenti (per titolo)
  ('Leadership',                 '@Leadership Fondamentale'),
  ('Comunicazione',              '@Comunicazione Efficace'),
  ('Collaborazione',             '@Diversity & Inclusion'),
  ('Orientamento ai risultati',  '@Time Management'),
  ('Orientamento al cliente',    '@Comunicazione Efficace'),
  ('Problem solving',            '@Design Thinking'),
  ('Innovazione',                '@Design Thinking'),
  ('Adattabilità',               '@Time Management')
) t(skill_name, module_ref);

INSERT INTO sys.sys_skill_learning_mappings
  (skill_learning_mapping_id, skill_learning_mapping_skill_id,
   skill_learning_mapping_module_id, skill_learning_mapping_target_proficiency,
   skill_learning_mapping_metadata)
SELECT uuid_generate_v5(uuid_ns_url(), 'bank-slm:' || s.skill_id::text || ':' || lm.learning_module_id::text),
       s.skill_id, lm.learning_module_id, 'PROFICIENT',
       jsonb_build_object('seeded_by', 'banking-learning-catalog-v1')
FROM _skill_module_map m
JOIN sys.sys_skills s
  ON lower(trim(s.skill_name)) = lower(trim(m.skill_name))
 AND s.skill_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid
JOIN LATERAL (
  SELECT learning_module_id FROM sys.sys_learning_modules
   WHERE (m.module_ref NOT LIKE '@%' AND learning_module_code = m.module_ref)
      OR (m.module_ref LIKE '@%' AND learning_module_title = substr(m.module_ref, 2))
   ORDER BY learning_module_code LIMIT 1
) lm ON true
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings x
                   WHERE x.skill_learning_mapping_skill_id = s.skill_id
                     AND x.skill_learning_mapping_module_id = lm.learning_module_id)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Post-conditions (fail loud)
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'BANK-LM-%';
  IF n <> 15 THEN RAISE EXCEPTION '#71b seed: attesi 15 moduli BANK-LM, trovati %', n; END IF;

  -- ogni skill richiesta da una posizione RTL ha almeno un modulo mappato
  SELECT count(*) INTO n
  FROM (SELECT DISTINCT r.skill_id
          FROM sys.sys_position_skill_requirements r
          JOIN sys.sys_positions p ON p.position_id = r.position_id
         WHERE p.position_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid) req
  WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skill_learning_mappings m
                     WHERE m.skill_learning_mapping_skill_id = req.skill_id);
  IF n > 0 THEN
    RAISE EXCEPTION '#71b seed: % skill richieste ancora senza modulo formativo', n;
  END IF;

  RAISE NOTICE '#71b seed: 15 moduli bancari + mapping completo skill richieste→formazione.';
END $$;

COMMIT;
