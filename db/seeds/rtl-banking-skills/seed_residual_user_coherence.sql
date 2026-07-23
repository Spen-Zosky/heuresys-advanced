-- =============================================================================
-- #72 — Audit coerenza per-user, dimensioni residue (S1028, 2026-07-23)
--
-- Completa il mandato Enzo S1025 (report: docs/kb/db-forensics/
-- USER_ROLE_COHERENCE_2026-07-22.md §4) con lo stesso metodo dei seed S1025:
-- regola per archetipo → correzione deterministica → post-condition permanente.
--
--   A. TITOLI DI STUDIO ↔ RUOLO + ATENEO (dim 1)
--      Regola a doppio vincolo: (a) campo di studio ammesso per la famiglia di
--      ruolo (un Risk Analyst non esce da Lettere; un IT Director non esce da
--      Giurisprudenza); (b) campo offerto dall'ateneo (il Politecnico non
--      laurea in Diritto; la LUISS non ha Ingegneria; Bocconi/Statale/Cattolica
--      senza ingegneria dove reale). Misurato live: 4 "Lettere" su profili
--      bancari (inclusa la CRO), cluster seriale Scienze Politiche su
--      Risk/Financial Analyst, cluster CS/Elettronica su TUTTI i dealer,
--      IT con lauree giuridiche/bancarie, 9 combo ateneo→campo impossibili.
--      Fix minimal-touch: nuovo campo dal set di ruolo ∩ offerta ateneo (hash
--      deterministico); ateneo cambiato solo se l'intersezione è vuota.
--      + floor titolo: Head/Director/Chief con solo DIP → MSC.
--      + MBA: field-of-study normalizzato a Business Administration.
--      + coverage: 3 persone reali SENZA alcun titolo (chiara.spenuso,
--        giuseppe.ferri, maria.colombo) ricevono un percorso coerente col ruolo.
--   B. KPI PER-UTENTE = KPI STANDARD DEL RUOLO (dim 2)
--      Mappa ruolo→KPI tipico di banca retail (catalogo esistente, nessuna
--      definizione nuova): teller→TXN-ACCURACY, compliance→AML-ALERTS,
--      analyst→REPORT/RISK-ACCURACY, advisor→AUM-GROWTH, dealer→FX P&L,
--      manager→Cross-Selling, treasury→LCR, audit→Audit-plan-completion,
--      IT→Uptime, HR→Turnover/Time-to-hire, vertici→Cost-Income/NPL/NPS.
--      Rimossi i 3 target semanticamente errati (AML su IT Director e Head of
--      Internal Audit, AUM su Head of Marketing); inserito il KPI di ruolo
--      mancante per ogni utente RTL con assignment PRIMARY ACTIVE.
--   C. STRAORDINARI COERENTI COL RUOLO (dim 3)
--      CCNL Credito: Quadri Direttivi (QD*) e Dirigenti NON maturano
--      straordinario retribuito → 41 righe sys_overtime di esenti archiviate in
--      audit.overtime_exempt_archive e rimosse; 548 righe attendance di esenti
--      azzerate (hours_overtime→0). NIGHT plausibile solo per l'IT operativo
--      (Software Developer, System Administrator): gli altri NIGHT → WEEKDAY.
--   D. ANAGRAFICHE SATELLITE (dim 4)
--      Indirizzi: CAP allineato alla città (Milano 201xx, Venezia 301xx, …),
--      region normalizzata (via "Mil"/"Central Region"/vuoto → regione reale).
--      Familiari: riga residuo-test "father Test (6 anni)" → child con nome
--      reale; gap età coniuge ≤18 anni; gap genitore-figlio in [18..50];
--      is_dependent dei figli ricalcolato (a carico se <24 anni).
--      Documenti identità: NATIONAL_ID nel formato CIE reale (AA00000AA),
--      DRIVER_LICENSE nel formato patente reale (U1A0000000); passaporti già
--      conformi (AA0000000). Coverage: NATIONAL_ID + indirizzo per le persone
--      reali che ne erano prive.
--   E. DIR-RISKM: lead/manager (dim 5 — decisione presa: PROMOZIONE)
--      martina.gentile (Risk Analyst più senior della direzione: 51 anni, 20 di
--      anzianità, 3A3L) → Risk Manager (nuova POS-RISKM-HEAD, riporta al CRO),
--      QD3 58.500 € (floor CCNL 57.159, benchmark risk manager 34-61k),
--      manager OU + team lead + membership + employment sync allineati.
--
-- SCOPE: tenant RTL + HEURESYS (satellite); founder enzo.spenuso@heuresys.com
--        ESCLUSO dalla coverage satellite (dati che solo Enzo può fornire).
-- IDEMPOTENT: transazione unica, UUID v5, UPDATE/INSERT/DELETE guardati;
--             al 2° giro 0 righe toccate. Post-condition fail-loud in coda.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_residual_user_coherence.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\set rtl '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
\set heu '8bc5bc59-f2d2-4a8a-882a-ea26ac367858'

BEGIN;

-- hash deterministico (per pick riproducibili, MAI per chiavi: quelle sono v5)
CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- ============================================================================
-- A. TITOLI DI STUDIO ↔ RUOLO + ATENEO
-- ============================================================================

-- A0. campi ammessi per famiglia di ruolo
CREATE TEMP TABLE _role_allow ON COMMIT DROP AS
SELECT r.role_title,
       CASE r.fam
         WHEN 'ECON' THEN ARRAY['Economia','Economia e Finanza','Economia Aziendale',
                                'Scienze Bancarie','Business Administration','Ingegneria Gestionale']
         WHEN 'OPS'  THEN ARRAY['Economia','Economia e Finanza','Economia Aziendale',
                                'Scienze Bancarie','Business Administration','Ingegneria Gestionale',
                                'Giurisprudenza','Scienze Giuridiche','Diritto','Diritto Commerciale']
         WHEN 'LAW'  THEN ARRAY['Giurisprudenza','Scienze Giuridiche','Diritto',
                                'Diritto Commerciale','Economia']
         WHEN 'IT'   THEN ARRAY['Informatica','Ingegneria Informatica','Computer Science',
                                'Ingegneria Elettronica']
         WHEN 'MKT'  THEN ARRAY['Economia','Business Administration','Economia Aziendale',
                                'Scienze Politiche']
         WHEN 'HR'   THEN ARRAY['Economia','Business Administration','Giurisprudenza',
                                'Scienze Politiche']
         WHEN 'EXSW' THEN ARRAY['Business','Business Administration','Economia','Informatica',
                                'Ingegneria Gestionale','Computer Science']
       END AS fields
FROM (VALUES
  ('Bank Teller','ECON'),('Bank Manager','ECON'),('Investment Advisor','ECON'),
  ('Retail Director','ECON'),('Head of Commercial Banking','ECON'),('CEO','ECON'),
  ('Finance Director','ECON'),('Financial Analyst','ECON'),('Risk Analyst','ECON'),
  ('Risk Manager','ECON'),('Chief Risk Officer','ECON'),('Head of Treasury','ECON'),
  ('Securities Dealer','ECON'),('Operations Director','ECON'),
  ('Line Manager - Operations','ECON'),
  ('Payment Specialist','OPS'),('Back Office Specialist','OPS'),
  ('Compliance Officer','LAW'),('Head of Legal & Compliance','LAW'),
  ('Head of Internal Audit','LAW'),
  ('Software Developer','IT'),('System Administrator','IT'),('IT Director','IT'),
  ('Head of Marketing','MKT'),('HR Director','HR'),('HR Manager','HR'),
  ('COO','EXSW'),('Head of Product','EXSW'),('CEO & Founder','EXSW')
) r(role_title, fam);

-- A0b. campi NON offerti dall'ateneo (atenei non elencati = offerta completa)
CREATE TEMP TABLE _inst_deny ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('Politecnico di Milano', ARRAY['Economia','Economia e Finanza','Economia Aziendale',
     'Scienze Bancarie','Business Administration','Business','Giurisprudenza',
     'Scienze Giuridiche','Diritto','Diritto Commerciale','Scienze Politiche','Lettere']),
  ('Politecnico di Torino', ARRAY['Economia','Economia e Finanza','Economia Aziendale',
     'Scienze Bancarie','Business Administration','Business','Giurisprudenza',
     'Scienze Giuridiche','Diritto','Diritto Commerciale','Scienze Politiche','Lettere']),
  ('LUISS',                ARRAY['Ingegneria Gestionale','Ingegneria Informatica',
     'Ingegneria Elettronica','Informatica','Computer Science','Lettere','Scienze Bancarie']),
  ('Università Bocconi',   ARRAY['Ingegneria Gestionale','Ingegneria Informatica',
     'Ingegneria Elettronica','Informatica','Computer Science','Lettere','Scienze Bancarie',
     'Scienze Giuridiche']),
  ('Università Cattolica', ARRAY['Ingegneria Gestionale','Ingegneria Informatica',
     'Ingegneria Elettronica','Computer Science']),
  ('Università di Milano', ARRAY['Ingegneria Gestionale','Ingegneria Elettronica',
     'Ingegneria Informatica'])
) t(inst, denied);

-- A1. MBA: il field-of-study di un MBA è Business Administration (le business
--     school — SDA, MIP, LUISS BS — sono istituzione-esenti dal vincolo ateneo)
UPDATE sys.sys_user_education_records
   SET user_education_field_of_study = 'Business Administration', updated_at = now()
 WHERE user_education_degree = 'MBA'
   AND user_education_field_of_study NOT IN
       ('Business Administration','Business','Economia Aziendale','Economia');

-- A2. violazioni ruolo↔campo e ateneo↔campo → fix minimal-touch deterministico
CREATE TEMP TABLE _edu_fix ON COMMIT DROP AS
WITH cur AS (
  SELECT e.user_education_record_id AS rec_id, u.user_email,
         e.user_education_degree AS deg, e.user_education_field_of_study AS f,
         e.user_education_institution AS inst, p.position_title AS role
  FROM sys.sys_user_education_records e
  JOIN sys.sys_users u ON u.user_id = e.user_education_record_user_id
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = u.user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
), j AS (
  SELECT c.*, ra.fields AS allow, COALESCE(d.denied, '{}') AS denied,
         (c.f = ANY(ra.fields)) AS role_ok,
         (c.deg = 'MBA' OR NOT (c.f = ANY(COALESCE(d.denied, '{}')))) AS inst_ok
  FROM cur c
  JOIN _role_allow ra ON ra.role_title = c.role
  LEFT JOIN _inst_deny d ON d.inst = c.inst
), viol AS (
  SELECT j.*,
         ARRAY(SELECT x FROM unnest(j.allow) x WHERE NOT x = ANY(j.denied)) AS cand_keep
  FROM j WHERE NOT (j.role_ok AND j.inst_ok)
)
SELECT v.rec_id, v.user_email,
       CASE WHEN cardinality(v.cand_keep) > 0
            THEN v.cand_keep[(pg_temp.h(v.user_email || ':edu-f') % cardinality(v.cand_keep)) + 1]
            ELSE v.allow[(pg_temp.h(v.user_email || ':edu-f') % cardinality(v.allow)) + 1]
       END AS new_field,
       CASE WHEN cardinality(v.cand_keep) > 0 THEN v.inst
            ELSE (ARRAY['Università di Bologna','Università La Sapienza','Università Federico II',
                        'Università di Padova','Università di Pisa','Università di Firenze']
                 )[(pg_temp.h(v.user_email || ':edu-i') % 6) + 1]
       END AS new_inst
FROM viol v;

UPDATE sys.sys_user_education_records e
   SET user_education_field_of_study = f.new_field,
       user_education_institution   = f.new_inst,
       updated_at = now()
  FROM _edu_fix f
 WHERE e.user_education_record_id = f.rec_id
   AND (e.user_education_field_of_study <> f.new_field
     OR e.user_education_institution   <> f.new_inst);

-- A3. floor titolo: ruoli apicali con solo DIP → MSC
UPDATE sys.sys_user_education_records e
   SET user_education_degree = 'MSC', updated_at = now()
  FROM sys.sys_users u, sys.sys_user_position_assignments a, sys.sys_positions p
 WHERE u.user_id = e.user_education_record_user_id
   AND a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND p.position_id = a.user_position_assignment_position_id
   AND e.user_education_degree = 'DIP'
   AND (p.position_title LIKE 'Head of%' OR p.position_title LIKE '%Director'
        OR p.position_title LIKE 'Chief%' OR p.position_title IN ('CEO','COO'));

-- A4. coverage: percorso di studi per le 3 persone reali che ne erano prive
INSERT INTO sys.sys_user_education_records
  (user_education_record_id, user_education_record_user_id, user_education_record_tenant_id,
   user_education_degree, user_education_institution, user_education_field_of_study,
   user_education_start_date, user_education_end_date, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'edu-cov:' || m.email),
       u.user_id, u.user_tenant_id, 'MSC', m.inst, m.field,
       make_date(extract(year FROM d.user_demographics_birth_date)::int + 19, 10, 1),
       make_date(extract(year FROM d.user_demographics_birth_date)::int + 24, 7, 15),
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM (VALUES
  ('chiara.spenuso@heuresys.com', 'Informatica',             'Università di Bologna'),
  ('giuseppe.ferri@rtl-bank.org', 'Economia',                'Università di Milano'),
  ('maria.colombo@rtl-bank.org',  'Business Administration', 'Università Cattolica')
) m(email, field, inst)
JOIN sys.sys_users u ON u.user_email = m.email
JOIN sys.sys_user_demographics d ON d.user_demographics_user_id = u.user_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_education_records e
                   WHERE e.user_education_record_user_id = u.user_id)
ON CONFLICT (user_education_record_id) DO NOTHING;

-- ============================================================================
-- B. KPI PER-UTENTE = KPI STANDARD DEL RUOLO (banca retail, tenant RTL)
-- ============================================================================

-- B0. mappa ruolo → KPI standard (codici del catalogo esistente) + valori target
CREATE TEMP TABLE _role_kpi ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('Bank Teller',                'TXN-ACCURACY',   98.5, 95.0,  99.5, '%'),
  ('Bank Manager',               'KPI-008',         2.2,  1.8,   2.8, 'ratio'),
  ('Financial Analyst',          'REPORT-ACCURACY',97.0, 92.0,  99.0, '%'),
  ('Risk Analyst',               'RISK-ACCURACY',  92.0, 85.0,  97.0, '%'),
  ('Risk Manager',               'RISK-ACCURACY',  92.0, 85.0,  97.0, '%'),
  ('Chief Risk Officer',         'KPI-005',         3.5,  5.0,   2.5, '%'),
  ('Investment Advisor',         'AUM-GROWTH',      6.0,  3.0,  10.0, '%'),
  ('Compliance Officer',         'AML-ALERTS',     90.0, 80.0,  97.0, '%'),
  ('Securities Dealer',          'BP-010-KPI-03',150000, 300000, 50000, 'EUR'),
  ('Software Developer',         'BP-008-KPI-03',  96.0, 90.0,  99.0, '%'),
  ('System Administrator',       'BP-008-KPI-01',  99.5, 98.5, 99.95, '%'),
  ('IT Director',                'KPI-009',        99.5, 99.0,  99.9, '%'),
  ('HR Director',                'KPI-001',         6.0,  9.0,   4.0, '%'),
  ('HR Manager',                 'KPI-013',        35.0, 50.0,  25.0, 'days'),
  ('Finance Director',           'KPI-006',        55.0, 62.0,  48.0, '%'),
  ('Operations Director',        'KPI-015',        35.0, 25.0,  50.0, '%'),
  ('Line Manager - Operations',  'KPI-015',        35.0, 25.0,  50.0, '%'),
  ('Retail Director',            'KPI-007',        45.0, 30.0,  60.0, 'score'),
  ('CEO',                        'KPI-006',        55.0, 62.0,  48.0, '%'),
  ('Head of Treasury',           'BP-010-KPI-01', 140.0,120.0, 160.0, '%'),
  ('Head of Internal Audit',     'BP-011-KPI-02',  90.0, 80.0, 100.0, '%'),
  ('Head of Legal & Compliance', 'AML-ALERTS',     90.0, 80.0,  97.0, '%'),
  ('Head of Marketing',          'KPI-007',        45.0, 30.0,  60.0, 'score'),
  ('Head of Commercial Banking', 'BP-001-KPI-04', 180.0,140.0, 220.0, 'EUR milioni'),
  ('Payment Specialist',         'BP-002-KPI-02',   0.5,  1.0,   0.2, '%'),
  ('Back Office Specialist',     'BP-002-KPI-01',  24.0, 36.0,  12.0, 'ore')
) t(role_title, kpi_code, tgt, min_v, stretch, unit);

-- guard: ogni codice della mappa esiste 1 volta nel catalogo
DO $$
DECLARE n int; m int;
BEGIN
  SELECT count(DISTINCT rk.kpi_code) INTO n FROM _role_kpi rk;
  SELECT count(DISTINCT rk.kpi_code) INTO m
  FROM _role_kpi rk JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code = rk.kpi_code;
  IF n <> m THEN
    RAISE EXCEPTION '#72 seed B: % codici KPI della mappa non risolti nel catalogo', n - m;
  END IF;
END $$;

-- B1. rimozione dei 3 target semanticamente errati (misurati S1028):
--     AML su IT Director e Head of Internal Audit, AUM su Head of Marketing.
--     (Nessuna FK punta a sys_kpi_targets; il KPI di ruolo corretto arriva da B2.)
DELETE FROM sys.sys_kpi_targets t
 USING sys.sys_users u, sys.sys_user_position_assignments a, sys.sys_positions p,
       sys.sys_kpi_definitions k
 WHERE t.kpi_target_user_id = u.user_id
   AND a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND p.position_id = a.user_position_assignment_position_id
   AND k.kpi_definition_id = t.kpi_target_kpi_id
   AND ( (k.kpi_definition_code = 'AML-ALERTS'
          AND p.position_title NOT IN ('Compliance Officer','Head of Legal & Compliance'))
      OR (k.kpi_definition_code = 'AUM-GROWTH'
          AND p.position_title <> 'Investment Advisor') );

-- B2. coverage: ogni utente RTL attivo con assignment PRIMARY ACTIVE ha il
--     target del KPI standard del suo ruolo (periodo 2026, valori dalla mappa)
INSERT INTO sys.sys_kpi_targets
  (kpi_target_id, kpi_target_tenant_id, kpi_target_kpi_id, kpi_target_user_id,
   kpi_target_period_start, kpi_target_period_end,
   kpi_target_target_value, kpi_target_minimum_value, kpi_target_stretch_value,
   kpi_target_unit, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'kpi-target-2026:' || rk.kpi_code || ':' || u.user_email),
       :'rtl'::uuid, k.kpi_definition_id, u.user_id,
       DATE '2026-01-01', DATE '2026-12-31',
       rk.tgt, rk.min_v, rk.stretch, rk.unit,
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM sys.sys_users u
JOIN sys.sys_user_position_assignments a
     ON a.user_position_assignment_user_id = u.user_id
    AND a.user_position_assignment_kind = 'PRIMARY'
    AND a.user_position_assignment_status = 'ACTIVE'
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
JOIN _role_kpi rk ON rk.role_title = p.position_title
JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code = rk.kpi_code
WHERE u.user_tenant_id = :'rtl'::uuid
  AND u.user_status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_kpi_targets t
                   WHERE t.kpi_target_user_id = u.user_id
                     AND t.kpi_target_kpi_id = k.kpi_definition_id)
ON CONFLICT (kpi_target_id) DO NOTHING;

-- ============================================================================
-- D. ANAGRAFICHE SATELLITE
-- ============================================================================

-- D0. geografia canonica città → (regex CAP valido, CAP canonico, regione)
CREATE TEMP TABLE _city_geo ON COMMIT DROP AS
SELECT * FROM (VALUES
  ('Milano',  '^20[01][0-9]{2}$', '20121', 'Lombardia'),
  ('Monza',   '^209[0-9]{2}$',    '20900', 'Lombardia'),
  ('Bergamo', '^241[0-9]{2}$',    '24122', 'Lombardia'),
  ('Brescia', '^251[0-9]{2}$',    '25121', 'Lombardia'),
  ('Como',    '^221[0-9]{2}$',    '22100', 'Lombardia'),
  ('Varese',  '^211[0-9]{2}$',    '21100', 'Lombardia'),
  ('Torino',  '^101[0-9]{2}$',    '10121', 'Piemonte'),
  ('Roma',    '^00[0-9]{3}$',     '00184', 'Lazio'),
  ('Palermo', '^901[0-9]{2}$',    '90133', 'Sicilia'),
  ('Bari',    '^701[0-9]{2}$',    '70121', 'Puglia'),
  ('Venezia', '^301[0-9]{2}$',    '30121', 'Veneto'),
  ('Bologna', '^401[0-9]{2}$',    '40121', 'Emilia-Romagna'),
  ('Napoli',  '^801[0-9]{2}$',    '80121', 'Campania'),
  ('Genova',  '^161[0-9]{2}$',    '16121', 'Liguria')
) t(city, cap_re, cap_canon, region);

-- D1. CAP allineato alla città + regione normalizzata
UPDATE sys.sys_user_addresses ad
   SET user_address_postal_code = CASE WHEN ad.user_address_postal_code ~ g.cap_re
                                       THEN ad.user_address_postal_code ELSE g.cap_canon END,
       user_address_region = g.region,
       updated_at = now()
  FROM _city_geo g
 WHERE ad.user_address_city = g.city
   AND (ad.user_address_postal_code !~ g.cap_re
        OR ad.user_address_region IS DISTINCT FROM g.region);

-- D2. familiari — (a) residuo-test "father Test (6 anni)" → child con nome reale
UPDATE sys.sys_user_family_members f
   SET user_family_member_relationship = 'child',
       user_family_member_first_name = 'Giulia',
       updated_at = now()
 WHERE f.user_family_member_relationship NOT IN ('spouse','child')
    OR f.user_family_member_first_name = 'Test';

-- D2b. coniugi: gap d'età col titolare ≤ 18 anni (offset deterministico ±6)
UPDATE sys.sys_user_family_members f
   SET user_family_member_birth_date =
         d.user_demographics_birth_date
         + make_interval(years => (pg_temp.h(u.user_email || ':spouse') % 13) - 6),
       updated_at = now()
  FROM sys.sys_users u, sys.sys_user_demographics d
 WHERE u.user_id = f.user_family_member_user_id
   AND d.user_demographics_user_id = u.user_id
   AND f.user_family_member_relationship = 'spouse'
   AND abs(date_part('year', age(d.user_demographics_birth_date))
         - date_part('year', age(f.user_family_member_birth_date))) > 18;

-- D2c. figli: gap genitore-figlio in [18..50] (fix deterministico 22..37,
--      limitato dall'età del titolare così il figlio non nasce nel futuro)
UPDATE sys.sys_user_family_members f
   SET user_family_member_birth_date =
         d.user_demographics_birth_date
         + make_interval(years => 22 + (pg_temp.h(u.user_email || ':' || f.user_family_member_first_name)
              % GREATEST(1, LEAST(16, date_part('year', age(d.user_demographics_birth_date))::int - 23)))),
       updated_at = now()
  FROM sys.sys_users u, sys.sys_user_demographics d
 WHERE u.user_id = f.user_family_member_user_id
   AND d.user_demographics_user_id = u.user_id
   AND f.user_family_member_relationship = 'child'
   AND (date_part('year', age(d.user_demographics_birth_date))
      - date_part('year', age(f.user_family_member_birth_date))) NOT BETWEEN 18 AND 50;

-- D2d. is_dependent dei figli: a carico se < 24 anni
UPDATE sys.sys_user_family_members f
   SET user_family_member_is_dependent =
         (date_part('year', age(f.user_family_member_birth_date)) < 24),
       updated_at = now()
 WHERE f.user_family_member_relationship = 'child'
   AND f.user_family_member_is_dependent IS DISTINCT FROM
       (date_part('year', age(f.user_family_member_birth_date)) < 24);

-- D3. documenti identità: formati italiani reali
-- CIE: 2 lettere + 5 cifre + 2 lettere (es. CA12345AB) — conserva prefisso reale
UPDATE sys.sys_user_identity_documents doc
   SET user_identity_document_number =
         substr(doc.user_identity_document_number, 1, 2)
         || lpad((pg_temp.h(doc.user_identity_document_id::text || ':cie') % 100000)::text, 5, '0')
         || chr(65 + pg_temp.h(doc.user_identity_document_id::text || ':cie-a') % 26)
         || chr(65 + pg_temp.h(doc.user_identity_document_id::text || ':cie-b') % 26),
       updated_at = now()
 WHERE doc.user_identity_document_kind = 'NATIONAL_ID'
   AND doc.user_identity_document_number !~ '^[A-Z]{2}[0-9]{5}[A-Z]{2}$';

-- patente: U1 + lettera + 7 cifre (formato MC nazionale)
UPDATE sys.sys_user_identity_documents doc
   SET user_identity_document_number =
         'U1' || chr(65 + pg_temp.h(doc.user_identity_document_id::text || ':dl-a') % 26)
         || lpad((pg_temp.h(doc.user_identity_document_id::text || ':dl-n') % 10000000)::text, 7, '0'),
       updated_at = now()
 WHERE doc.user_identity_document_kind = 'DRIVER_LICENSE'
   AND doc.user_identity_document_number !~ '^U1[A-Z][0-9]{7}$';

-- passaporto: 2 lettere + 7 cifre (già conforme; guardia per re-run futuri)
UPDATE sys.sys_user_identity_documents doc
   SET user_identity_document_number =
         'YA' || lpad((pg_temp.h(doc.user_identity_document_id::text || ':pp') % 10000000)::text, 7, '0'),
       updated_at = now()
 WHERE doc.user_identity_document_kind = 'PASSPORT'
   AND doc.user_identity_document_number !~ '^[A-Z]{2}[0-9]{7}$';

-- D4. coverage satellite delle persone reali che ne erano prive
--     (founder enzo.spenuso ESCLUSO: dati che solo Enzo può fornire)
INSERT INTO sys.sys_user_addresses
  (user_address_id, user_address_user_id, user_address_tenant_id, user_address_kind,
   user_address_street, user_address_city, user_address_postal_code,
   user_address_country, user_address_region, user_address_is_primary, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'addr-cov:' || m.email),
       u.user_id, u.user_tenant_id, 'PERMANENT',
       m.street, m.city, m.cap, 'IT', m.region, true,
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM (VALUES
  ('giuseppe.ferri@rtl-bank.org', 'Via Manzoni, 24', 'Milano', '20124', 'Lombardia'),
  ('maria.colombo@rtl-bank.org',  'Via Cavour, 12',  'Monza',  '20900', 'Lombardia')
) m(email, street, city, cap, region)
JOIN sys.sys_users u ON u.user_email = m.email
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_addresses x
                   WHERE x.user_address_user_id = u.user_id)
ON CONFLICT (user_address_id) DO NOTHING;

INSERT INTO sys.sys_user_identity_documents
  (user_identity_document_id, user_identity_document_user_id, user_identity_document_tenant_id,
   user_identity_document_kind, user_identity_document_number,
   user_identity_document_expiry_date, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'iddoc-cov:' || m.email),
       u.user_id, u.user_tenant_id, 'NATIONAL_ID',
       'CA' || lpad((pg_temp.h(m.email || ':cie') % 100000)::text, 5, '0')
            || chr(65 + pg_temp.h(m.email || ':cie-a') % 26)
            || chr(65 + pg_temp.h(m.email || ':cie-b') % 26),
       DATE '2032-01-01' + (pg_temp.h(m.email || ':exp') % 1000),
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM (VALUES
  ('giuseppe.ferri@rtl-bank.org'),
  ('maria.colombo@rtl-bank.org'),
  ('andrea.spenuso@heuresys.com'),
  ('chiara.spenuso@heuresys.com')
) m(email)
JOIN sys.sys_users u ON u.user_email = m.email
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_identity_documents x
                   WHERE x.user_identity_document_user_id = u.user_id
                     AND x.user_identity_document_kind = 'NATIONAL_ID')
ON CONFLICT (user_identity_document_id) DO NOTHING;

-- ============================================================================
-- E. DIR-RISKM: martina.gentile → Risk Manager (lead/manager della direzione)
-- ============================================================================

-- E0. posizione head della direzione (nuova, riporta al CRO POS-00000396)
INSERT INTO sys.sys_positions
  (position_id, position_tenant_id, position_code, position_title,
   position_organization_unit_id, position_job_role_id, position_reports_to_position_id,
   position_owner_user_id, position_criticality, position_is_active,
   position_effective_from, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-RISKM-HEAD'),
       :'rtl'::uuid, 'POS-RISKM-HEAD', 'Risk Manager',
       ou.organization_unit_id,
       (SELECT position_job_role_id FROM sys.sys_positions
         WHERE position_code = 'POS-00000430' AND position_tenant_id = :'rtl'::uuid),
       (SELECT position_id FROM sys.sys_positions
         WHERE position_code = 'POS-00000396' AND position_tenant_id = :'rtl'::uuid),
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'federica.marchetti@rtl-bank.org'),
       'HIGH', true, DATE '2026-07-23',
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM sys.sys_organization_units ou
WHERE ou.organization_unit_code = 'DIR-RISKM'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_positions p
                   WHERE p.position_code = 'POS-RISKM-HEAD'
                     AND p.position_tenant_id = :'rtl'::uuid)
ON CONFLICT (position_id) DO NOTHING;

-- E1. assignment: chiudi il PRIMARY ACTIVE da Risk Analyst, apri quello da head
UPDATE sys.sys_user_position_assignments a
   SET user_position_assignment_status = 'ENDED',
       user_position_assignment_end_date = DATE '2026-07-23',
       updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_email = 'martina.gentile@rtl-bank.org'
   AND a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND a.user_position_assignment_position_id <>
       (SELECT position_id FROM sys.sys_positions
         WHERE position_code = 'POS-RISKM-HEAD' AND position_tenant_id = :'rtl'::uuid);

INSERT INTO sys.sys_user_position_assignments
  (user_position_assignment_id, user_position_assignment_tenant_id,
   user_position_assignment_user_id, user_position_assignment_position_id,
   user_position_assignment_kind, user_position_assignment_fte,
   user_position_assignment_start_date, user_position_assignment_status,
   user_position_assignment_notes, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-assign:POS-RISKM-HEAD:martina.gentile@rtl-bank.org'),
       :'rtl'::uuid, u.user_id, p.position_id, 'PRIMARY', 1.00,
       DATE '2026-07-23', 'ACTIVE',
       '#72 (S1028): promozione interna a Risk Manager — più senior della direzione (20 anni)',
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM sys.sys_users u, sys.sys_positions p
WHERE u.user_email = 'martina.gentile@rtl-bank.org'
  AND p.position_code = 'POS-RISKM-HEAD' AND p.position_tenant_id = :'rtl'::uuid
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                   WHERE a.user_position_assignment_user_id = u.user_id
                     AND a.user_position_assignment_position_id = p.position_id
                     AND a.user_position_assignment_kind = 'PRIMARY')
ON CONFLICT (user_position_assignment_id) DO NOTHING;

-- E2. contratto QD3 (floor CCNL 57.159) + employment sync
UPDATE sys.sys_user_contracts uc
   SET user_contract_ccnl_level = 'QD3',
       user_contract_gross_annual_salary = 58500,
       user_contract_job_title = 'Risk Manager',
       updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_email = 'martina.gentile@rtl-bank.org'
   AND uc.user_contract_user_id = u.user_id
   AND (uc.user_contract_ccnl_level <> 'QD3'
     OR uc.user_contract_job_title <> 'Risk Manager');

UPDATE sys.sys_user_employment e
   SET user_employment_salary = 58500,
       user_employment_pay_scale_level = 'QD3',
       updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_email = 'martina.gentile@rtl-bank.org'
   AND e.user_employment_user_id = u.user_id
   AND (e.user_employment_salary IS DISTINCT FROM 58500
     OR e.user_employment_pay_scale_level IS DISTINCT FROM 'QD3');

-- E3. manager OU + lead team + membership (il vecchio lead errato era l'IT Director)
UPDATE sys.sys_organization_units ou
   SET organization_unit_manager_user_id =
         (SELECT user_id FROM sys.sys_users WHERE user_email = 'martina.gentile@rtl-bank.org'),
       updated_at = now()
 WHERE ou.organization_unit_code = 'DIR-RISKM'
   AND ou.organization_unit_manager_user_id IS DISTINCT FROM
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'martina.gentile@rtl-bank.org');

UPDATE sys.sys_teams t
   SET team_lead_user_id =
         (SELECT user_id FROM sys.sys_users WHERE user_email = 'martina.gentile@rtl-bank.org'),
       updated_at = now()
 WHERE t.team_code = 'DIR-RISKM' AND t.team_tenant_id = :'rtl'::uuid
   AND t.team_lead_user_id IS DISTINCT FROM
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'martina.gentile@rtl-bank.org');

UPDATE sys.sys_team_members m
   SET team_member_role = 'LEAD', updated_at = now()
  FROM sys.sys_teams t, sys.sys_users u
 WHERE t.team_code = 'DIR-RISKM' AND t.team_tenant_id = :'rtl'::uuid
   AND u.user_email = 'martina.gentile@rtl-bank.org'
   AND m.team_member_team_id = t.team_id
   AND m.team_member_user_id = u.user_id
   AND m.team_member_role <> 'LEAD';

INSERT INTO sys.sys_team_members
  (team_member_id, team_member_team_id, team_member_user_id, team_member_role,
   team_member_is_active, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-tm:DIR-RISKM:martina.gentile@rtl-bank.org'),
       t.team_id, u.user_id, 'LEAD', true,
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'admin@heuresys.com')
FROM sys.sys_teams t, sys.sys_users u
WHERE t.team_code = 'DIR-RISKM' AND t.team_tenant_id = :'rtl'::uuid
  AND u.user_email = 'martina.gentile@rtl-bank.org'
  AND NOT EXISTS (SELECT 1 FROM sys.sys_team_members m
                   WHERE m.team_member_team_id = t.team_id
                     AND m.team_member_user_id = u.user_id)
ON CONFLICT (team_member_id) DO NOTHING;

-- il vecchio lead sbagliato (IT Director) non resta membro del team risk
DELETE FROM sys.sys_team_members m
 USING sys.sys_teams t
 WHERE m.team_member_team_id = t.team_id
   AND t.team_code = 'DIR-RISKM' AND t.team_tenant_id = :'rtl'::uuid
   AND m.team_member_user_id =
       (SELECT user_id FROM sys.sys_users WHERE user_email = 'marco.desantis@rtl-bank.org');

-- ============================================================================
-- C. STRAORDINARI COERENTI COL RUOLO
-- ============================================================================

-- C0. archivio (pattern mig 000197: purge con archivio, mai perdita)
CREATE SCHEMA IF NOT EXISTS audit;
CREATE TABLE IF NOT EXISTS audit.overtime_exempt_archive
  AS SELECT * FROM sys.sys_overtime WHERE false;
ALTER TABLE audit.overtime_exempt_archive
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();

-- C1. QD*/Dirigente/Quadro non maturano straordinario retribuito (CCNL Credito
--     art. quadri direttivi; CCNL Commercio dirigenti) → archivia e rimuovi
INSERT INTO audit.overtime_exempt_archive
SELECT o.*, now()
FROM sys.sys_overtime o
JOIN sys.sys_user_contracts c ON c.user_contract_user_id = o.overtime_subject_user_id
WHERE (c.user_contract_ccnl_level LIKE 'QD%'
       OR c.user_contract_ccnl_level IN ('Dirigente','Quadro'))
  AND NOT EXISTS (SELECT 1 FROM audit.overtime_exempt_archive x
                   WHERE x.overtime_id = o.overtime_id);

DELETE FROM sys.sys_overtime o
 USING sys.sys_user_contracts c
 WHERE c.user_contract_user_id = o.overtime_subject_user_id
   AND (c.user_contract_ccnl_level LIKE 'QD%'
        OR c.user_contract_ccnl_level IN ('Dirigente','Quadro'));

-- C2. attendance degli esenti: ore di straordinario azzerate
--     (attendance_hours_total è GENERATED: si ricalcola da solo)
UPDATE sys.sys_attendance att
   SET attendance_hours_overtime = 0,
       updated_at = now()
  FROM sys.sys_user_contracts c
 WHERE c.user_contract_user_id = att.attendance_subject_user_id
   AND (c.user_contract_ccnl_level LIKE 'QD%'
        OR c.user_contract_ccnl_level IN ('Dirigente','Quadro'))
   AND att.attendance_hours_overtime > 0;

-- C3. NIGHT plausibile solo per l'IT operativo → gli altri diventano WEEKDAY
UPDATE sys.sys_overtime o
   SET overtime_type = 'WEEKDAY',
       overtime_metadata = COALESCE(o.overtime_metadata, '{}'::jsonb)
         || '{"coherence_fix": "S1028 #72: NIGHT non plausibile per il ruolo, riclassificato WEEKDAY"}'::jsonb,
       updated_at = now()
  FROM sys.sys_user_position_assignments a, sys.sys_positions p
 WHERE a.user_position_assignment_user_id = o.overtime_subject_user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND p.position_id = a.user_position_assignment_position_id
   AND o.overtime_type = 'NIGHT'
   AND p.position_title NOT IN ('Software Developer','System Administrator');


-- ============================================================================
-- F. POST-CONDITIONS (fail loud — invarianti permanenti del #72)
-- ============================================================================
DO $$
DECLARE n int;
BEGIN
  -- F1. 0 violazioni ruolo↔campo di studio / ateneo↔campo
  WITH cur AS (
    SELECT u.user_email, e.user_education_degree deg, e.user_education_field_of_study f,
           e.user_education_institution inst, p.position_title role
    FROM sys.sys_user_education_records e
    JOIN sys.sys_users u ON u.user_id = e.user_education_record_user_id
    JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  )
  SELECT count(*) INTO n
  FROM cur c
  JOIN _role_allow ra ON ra.role_title = c.role
  LEFT JOIN _inst_deny d ON d.inst = c.inst
  WHERE NOT (c.f = ANY(ra.fields))
     OR NOT (c.deg = 'MBA' OR NOT (c.f = ANY(COALESCE(d.denied, '{}'))));
  IF n > 0 THEN RAISE EXCEPTION '#72 F1: % titoli di studio incoerenti col ruolo/ateneo', n; END IF;

  -- F2. 0 ruoli apicali con solo DIP
  SELECT count(*) INTO n
  FROM sys.sys_user_education_records e
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = e.user_education_record_user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE e.user_education_degree = 'DIP'
    AND (p.position_title LIKE 'Head of%' OR p.position_title LIKE '%Director'
         OR p.position_title LIKE 'Chief%' OR p.position_title IN ('CEO','COO'));
  IF n > 0 THEN RAISE EXCEPTION '#72 F2: % ruoli apicali con solo diploma', n; END IF;

  -- F3. coverage satellite: ogni persona reale con posizione ha titolo, indirizzo
  --     e documento nazionale (founder e account tecnici esclusi)
  SELECT count(*) INTO n
  FROM sys.sys_users u
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = u.user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  WHERE u.user_status = 'ACTIVE'
    AND u.user_email NOT IN ('admin@heuresys.com','platform.admin@heuresys.com',
                             'enzo.spenuso@heuresys.com')
    AND ( NOT EXISTS (SELECT 1 FROM sys.sys_user_education_records x
                       WHERE x.user_education_record_user_id = u.user_id)
       OR NOT EXISTS (SELECT 1 FROM sys.sys_user_addresses x
                       WHERE x.user_address_user_id = u.user_id)
       OR NOT EXISTS (SELECT 1 FROM sys.sys_user_identity_documents x
                       WHERE x.user_identity_document_user_id = u.user_id
                         AND x.user_identity_document_kind = 'NATIONAL_ID') );
  IF n > 0 THEN RAISE EXCEPTION '#72 F3: % persone reali senza satellite completo', n; END IF;

  -- F4. KPI: ogni utente RTL attivo con ruolo mappato ha il KPI standard del ruolo
  SELECT count(*) INTO n
  FROM sys.sys_users u
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = u.user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  JOIN _role_kpi rk ON rk.role_title = p.position_title
  JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code = rk.kpi_code
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid
    AND u.user_status = 'ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM sys.sys_kpi_targets t
                     WHERE t.kpi_target_user_id = u.user_id
                       AND t.kpi_target_kpi_id = k.kpi_definition_id);
  IF n > 0 THEN RAISE EXCEPTION '#72 F4: % utenti senza il KPI standard del ruolo', n; END IF;

  -- F5. 0 KPI role-specific assegnati a ruoli incoerenti
  SELECT count(*) INTO n
  FROM sys.sys_kpi_targets t
  JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.kpi_target_kpi_id
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = t.kpi_target_user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE t.kpi_target_user_id IS NOT NULL
    AND ( (k.kpi_definition_code = 'AML-ALERTS'
           AND p.position_title NOT IN ('Compliance Officer','Head of Legal & Compliance'))
       OR (k.kpi_definition_code = 'AUM-GROWTH' AND p.position_title <> 'Investment Advisor') );
  IF n > 0 THEN RAISE EXCEPTION '#72 F5: % KPI role-specific su ruoli incoerenti', n; END IF;

  -- F6. straordinari: 0 righe per esenti (QD*/Dirigente/Quadro), 0 ore residue
  --     in attendance, NIGHT solo per l'IT operativo
  SELECT count(*) INTO n
  FROM sys.sys_overtime o
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = o.overtime_subject_user_id
  WHERE c.user_contract_ccnl_level LIKE 'QD%'
     OR c.user_contract_ccnl_level IN ('Dirigente','Quadro');
  IF n > 0 THEN RAISE EXCEPTION '#72 F6a: % righe overtime per livelli esenti', n; END IF;

  SELECT count(*) INTO n
  FROM sys.sys_attendance att
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = att.attendance_subject_user_id
  WHERE (c.user_contract_ccnl_level LIKE 'QD%'
         OR c.user_contract_ccnl_level IN ('Dirigente','Quadro'))
    AND att.attendance_hours_overtime > 0;
  IF n > 0 THEN RAISE EXCEPTION '#72 F6b: % attendance con straordinario per esenti', n; END IF;

  SELECT count(*) INTO n
  FROM sys.sys_overtime o
  JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = o.overtime_subject_user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE o.overtime_type = 'NIGHT'
    AND p.position_title NOT IN ('Software Developer','System Administrator');
  IF n > 0 THEN RAISE EXCEPTION '#72 F6c: % overtime NIGHT su ruoli non-IT', n; END IF;

  -- F7. indirizzi: CAP conforme alla città e regione canonica
  SELECT count(*) INTO n
  FROM sys.sys_user_addresses ad
  JOIN _city_geo g ON g.city = ad.user_address_city
  WHERE ad.user_address_postal_code !~ g.cap_re
     OR ad.user_address_region IS DISTINCT FROM g.region;
  IF n > 0 THEN RAISE EXCEPTION '#72 F7: % indirizzi con CAP/regione incoerenti', n; END IF;

  -- F8. familiari: relazioni chiuse, gap età plausibili, dipendenza coerente
  SELECT count(*) INTO n
  FROM sys.sys_user_family_members f
  JOIN sys.sys_user_demographics d
       ON d.user_demographics_user_id = f.user_family_member_user_id
  WHERE f.user_family_member_relationship NOT IN ('spouse','child')
     OR (f.user_family_member_relationship = 'spouse'
         AND abs(date_part('year', age(d.user_demographics_birth_date))
               - date_part('year', age(f.user_family_member_birth_date))) > 18)
     OR (f.user_family_member_relationship = 'child'
         AND (date_part('year', age(d.user_demographics_birth_date))
            - date_part('year', age(f.user_family_member_birth_date))) NOT BETWEEN 18 AND 50)
     OR (f.user_family_member_relationship = 'child'
         AND f.user_family_member_is_dependent
         AND date_part('year', age(f.user_family_member_birth_date)) >= 24);
  IF n > 0 THEN RAISE EXCEPTION '#72 F8: % familiari incoerenti', n; END IF;

  -- F9. documenti identità nei formati italiani reali
  SELECT count(*) INTO n
  FROM sys.sys_user_identity_documents doc
  WHERE (doc.user_identity_document_kind = 'NATIONAL_ID'
         AND doc.user_identity_document_number !~ '^[A-Z]{2}[0-9]{5}[A-Z]{2}$')
     OR (doc.user_identity_document_kind = 'DRIVER_LICENSE'
         AND doc.user_identity_document_number !~ '^U1[A-Z][0-9]{7}$')
     OR (doc.user_identity_document_kind = 'PASSPORT'
         AND doc.user_identity_document_number !~ '^[A-Z]{2}[0-9]{7}$');
  IF n > 0 THEN RAISE EXCEPTION '#72 F9: % documenti identità con formato non valido', n; END IF;

  -- F10. DIR-RISKM guidata dal Risk Manager (martina.gentile), contratto coerente
  SELECT count(*) INTO n
  FROM sys.sys_organization_units ou
  JOIN sys.sys_teams t ON t.team_code = ou.organization_unit_code
  JOIN sys.sys_users u ON u.user_email = 'martina.gentile@rtl-bank.org'
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  WHERE ou.organization_unit_code = 'DIR-RISKM'
    AND ou.organization_unit_manager_user_id = u.user_id
    AND t.team_lead_user_id = u.user_id
    AND c.user_contract_ccnl_level = 'QD3'
    AND c.user_contract_gross_annual_salary >= 57159
    AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                 JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
                WHERE a.user_position_assignment_user_id = u.user_id
                  AND a.user_position_assignment_kind = 'PRIMARY'
                  AND a.user_position_assignment_status = 'ACTIVE'
                  AND p.position_code = 'POS-RISKM-HEAD');
  IF n <> 1 THEN RAISE EXCEPTION '#72 F10: DIR-RISKM non guidata correttamente dal Risk Manager'; END IF;
END $$;

COMMIT;

-- riepilogo post-run (informativo)
SELECT 'edu_fixed' AS metric, count(*) FROM sys.sys_user_education_records WHERE updated_at > now() - interval '5 minutes'
UNION ALL SELECT 'kpi_targets_tot', count(*) FROM sys.sys_kpi_targets WHERE kpi_target_user_id IS NOT NULL
UNION ALL SELECT 'overtime_rows', count(*) FROM sys.sys_overtime
UNION ALL SELECT 'overtime_archived', count(*) FROM audit.overtime_exempt_archive;
