-- ============================================================================
-- 000158_g01_non_esco_skill_names_it.sql
-- Fix G-01 (audit S1006), slice 3/N: the 41 real NON-ESCO skill names (English
-- soft-skills + banking-domain skills). Translated IT-canonical (Enzo's decision).
-- The 14k ESCO skills are handled separately (their IT preferred labels come from
-- the official ESCO API, slice 4). The 7771 'OLDDB::<table>::<uuid>' rows and the
-- 'Qx YYYY Skills Analysis' / 'Standard 5-Point Scale' rows are NOT skills (legacy
-- import junk) — left untouched; flagged for a separate data-quality cleanup.
-- Match by skill_name, scoped to non-ESCO rows; idempotent (update only-if-differs).
-- Domain anglicisms accepted in Italian banking are intentionally kept.
-- ============================================================================

WITH tr(en, it) AS (VALUES
  ('Adaptability', 'Adattabilità'),
  ('Anti-Money Laundering Operations', 'Operazioni antiriciclaggio'),
  ('Anti-money laundering', 'Antiriciclaggio'),
  ('Bancassurance', 'Bancassicurazione'),
  ('Basel III/IV Regulatory Framework', 'Framework regolamentare Basilea III/IV'),
  ('Brand strategy', 'Strategia di brand'),
  ('Collaboration', 'Collaborazione'),
  ('Communication', 'Comunicazione'),
  ('Core Banking Systems', 'Sistemi di core banking'),
  ('Corporate Cash Management', 'Gestione della liquidità aziendale'),
  ('Credit Scoring Models', 'Modelli di credit scoring'),
  ('Critical thinking', 'Pensiero critico'),
  ('Customer Focus', 'Orientamento al cliente'),
  ('Data analysis', 'Analisi dei dati'),
  ('Digital Payments & Fintech', 'Pagamenti digitali e fintech'),
  ('Financial Cybersecurity', 'Cybersecurity finanziaria'),
  ('Foreign Exchange Trading', 'Trading in valute estere'),
  ('Fraud Detection & Prevention', 'Rilevamento e prevenzione delle frodi'),
  ('IFRS 9 Financial Instruments', 'IFRS 9 – Strumenti finanziari'),
  ('Innovation', 'Innovazione'),
  ('Internal Audit Banking', 'Internal audit bancario'),
  ('KYC Due Diligence', 'Due diligence KYC'),
  ('Leadership', 'Leadership'),
  ('Loan Origination', 'Erogazione prestiti'),
  ('Market Risk Management', 'Gestione del rischio di mercato'),
  ('MiFID II Compliance', 'Conformità MiFID II'),
  ('NPL Management', 'Gestione degli NPL'),
  ('Operational Risk Management', 'Gestione del rischio operativo'),
  ('PSD2 & Open Banking', 'PSD2 e open banking'),
  ('Private Banking', 'Private banking'),
  ('Problem Solving', 'Problem solving'),
  ('Quality control', 'Controllo qualità'),
  ('Relationship Banking', 'Relationship banking'),
  ('Results Orientation', 'Orientamento ai risultati'),
  ('Risk management', 'Gestione del rischio'),
  ('Stress Testing & Scenario Analysis', 'Stress testing e analisi di scenario'),
  ('Sustainable Finance & ESG', 'Finanza sostenibile ed ESG'),
  ('Time management', 'Gestione del tempo'),
  ('Trade Finance', 'Trade finance'),
  ('UX/UI design', 'Design UX/UI'),
  ('Wealth Management Advisory', 'Consulenza per la gestione patrimoniale')
)
UPDATE sys.sys_skills s
   SET skill_name = tr.it
  FROM tr
 WHERE s.skill_name = tr.en
   AND (s.skill_esco_uri NOT LIKE 'http://data.europa.eu/esco/skill/%' OR s.skill_esco_uri IS NULL)
   AND s.skill_name <> tr.it;

DO $$
BEGIN
  RAISE NOTICE '000158: non-ESCO skill names translated to IT (G-01 slice 3).';
END $$;
