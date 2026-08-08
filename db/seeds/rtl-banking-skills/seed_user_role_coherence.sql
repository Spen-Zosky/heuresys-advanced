-- =============================================================================
-- Audit coerenza per-user — correzioni RULE-BASED (S1025, 2026-07-22)
--
-- Mandato Enzo S1025: per OGNI user verificare ruolo organizzativo assegnato +
-- coerenza/realismo dei dati collegati con quel ruolo (standard da ricerca web
-- per una banca retail regionale italiana / software house italiana).
--
-- Regole applicate (derivate dai dati live, non liste nominali):
--   A. TITOLO CONTRATTO = TITOLO POSIZIONE — 4 mismatch misurati (promossi
--      Blocco C con job_title stantio: "Bank manager" su Finance/Operations
--      Director, "Compliance officer" su IT Director).
--   B. FLOOR ETÀ/ANZIANITÀ PER INQUADRAMENTO (standard carriera bancaria ITA:
--      un QD3-QD4 richiede ~10+ anni di carriera; un Dirigente 15+):
--        QD3/QD4  → età ≥ 35, anzianità ≥ 8 anni
--        Dirigente → età ≥ 42, anzianità ≥ 10 anni
--      Fix: shift indietro coerente di birth_date (demographics) e di
--      hire/seniority/contract_start (employment+contracts) del solo deficit.
--      Misurati 8 outlier (Bank Manager 26enni con 2-3 anni di anzianità, un
--      Operations Director 33enne, CEO 37enne).
--   C. GERARCHIA RETRIBUTIVA APICALE: il CRO (211k) era ≈ CEO (212k); per una
--      banca regionale il CRO sta a ~80-85% del CEO → 178.000 €.
--   D. HEURESYS: chiara.spenuso (Head of Product, contratto esistente) era
--      SENZA posizione → assegnata a POS-00000003 (Head of Product, vacante).
--   E. HEURESYS: POS-00000001 "CEO & Founder" vacante → creato l'utente reale
--      enzo.spenuso@heuresys.com (fondatore; CREDENTIAL-LESS: nessuna identità
--      auth ⇒ non può fare login — persona senza credenziali, doctrine I14) e
--      assegnato. Manager OU: HS-CORP → enzo, HS-PROD → chiara, HS-MGMT → andrea.
--
-- IDEMPOTENT: UPDATE/INSERT guardati, UUID v5 deterministici; al 2° giro 0 righe.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_user_role_coherence.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\set heu '8bc5bc59-f2d2-4a8a-882a-ea26ac367858'

BEGIN;

-- ----------------------------------------------------------------------------
-- A. Titolo contratto = titolo posizione (tutti i tenant)
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_contracts uc
   SET user_contract_job_title = p.position_title, updated_at = now()
  FROM sys.sys_user_position_assignments a
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
 WHERE a.user_position_assignment_user_id = uc.user_contract_user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
   AND lower(trim(uc.user_contract_job_title)) <> lower(trim(p.position_title));

-- ----------------------------------------------------------------------------
-- B. Floor età/anzianità per inquadramento (shift indietro del solo deficit)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _age_fix ON COMMIT DROP AS
SELECT uc.user_contract_user_id AS user_id,
       GREATEST(0, ceil(
         CASE WHEN uc.user_contract_ccnl_level IN ('QD3','QD4') THEN 35
              WHEN uc.user_contract_ccnl_level = 'Dirigente' THEN 42
              ELSE 0 END
         - date_part('year', age(d.user_demographics_birth_date))))::int AS age_deficit,
       GREATEST(0, ceil(
         CASE WHEN uc.user_contract_ccnl_level IN ('QD3','QD4') THEN 8
              WHEN uc.user_contract_ccnl_level = 'Dirigente' THEN 10
              ELSE 0 END
         - date_part('year', age(uc.user_contract_start_date))))::int AS tenure_deficit
FROM sys.sys_user_contracts uc
JOIN sys.sys_user_demographics d ON d.user_demographics_user_id = uc.user_contract_user_id
WHERE uc.user_contract_ccnl_level IN ('QD3','QD4','Dirigente');

DELETE FROM _age_fix WHERE age_deficit = 0 AND tenure_deficit = 0;

UPDATE sys.sys_user_demographics d
   SET user_demographics_birth_date = d.user_demographics_birth_date - make_interval(years => f.age_deficit),
       updated_at = now()
  FROM _age_fix f
 WHERE d.user_demographics_user_id = f.user_id AND f.age_deficit > 0;

UPDATE sys.sys_user_employment e
   SET user_employment_hire_date = e.user_employment_hire_date - make_interval(years => f.tenure_deficit),
       user_employment_seniority_date = e.user_employment_seniority_date - make_interval(years => f.tenure_deficit),
       updated_at = now()
  FROM _age_fix f
 WHERE e.user_employment_user_id = f.user_id AND f.tenure_deficit > 0;

UPDATE sys.sys_user_contracts uc
   SET user_contract_start_date = uc.user_contract_start_date - make_interval(years => f.tenure_deficit),
       updated_at = now()
  FROM _age_fix f
 WHERE uc.user_contract_user_id = f.user_id AND f.tenure_deficit > 0;

-- ----------------------------------------------------------------------------
-- C. Gerarchia retributiva apicale: CRO a ~84% del CEO
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_contracts uc
   SET user_contract_gross_annual_salary = 178000, updated_at = now()
  FROM sys.sys_users u
 WHERE u.user_id = uc.user_contract_user_id
   AND u.user_email = 'alice.esposito@rtl-bank.org'
   AND uc.user_contract_gross_annual_salary > 200000;

-- ----------------------------------------------------------------------------
-- D. chiara.spenuso → Head of Product (posizione già esistente, vacante)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_user_position_assignments
  (user_position_assignment_id, user_position_assignment_tenant_id,
   user_position_assignment_user_id, user_position_assignment_position_id,
   user_position_assignment_kind, user_position_assignment_fte,
   user_position_assignment_start_date, user_position_assignment_status,
   user_position_assignment_notes, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'heu-assign:POS-00000003:chiara.spenuso@heuresys.com'),
       :'heu'::uuid, u.user_id, p.position_id, 'PRIMARY', 1.00,
       DATE '2026-07-22', 'ACTIVE',
       'audit coerenza S1025: Head of Product era senza posizione',
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1)
FROM sys.sys_users u, sys.sys_positions p
WHERE u.user_email = 'chiara.spenuso@heuresys.com'
  AND p.position_code = 'POS-00000003' AND p.position_tenant_id = :'heu'::uuid
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                   WHERE a.user_position_assignment_user_id = u.user_id
                     AND a.user_position_assignment_kind = 'PRIMARY'
                     AND a.user_position_assignment_status = 'ACTIVE')
ON CONFLICT (user_position_assignment_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- E. Fondatore reale su CEO & Founder (credential-less) + manager OU HEURESYS
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_users
  (user_id, user_tenant_id, user_external_code, user_email, user_display_name,
   user_first_name, user_last_name, user_status, user_type, user_locale)
SELECT uuid_generate_v5(uuid_ns_url(), 'heu-user:enzo.spenuso@heuresys.com'),
       '8bc5bc59-f2d2-4a8a-882a-ea26ac367858'::uuid, 'FOUNDER::enzo-spenuso',
       'enzo.spenuso@heuresys.com', 'Enzo Spenuso', 'Enzo', 'Spenuso',
       'ACTIVE', 'STANDARD', 'it-IT'
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users WHERE user_email = 'enzo.spenuso@heuresys.com')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO sys.sys_user_position_assignments
  (user_position_assignment_id, user_position_assignment_tenant_id,
   user_position_assignment_user_id, user_position_assignment_position_id,
   user_position_assignment_kind, user_position_assignment_fte,
   user_position_assignment_start_date, user_position_assignment_status,
   user_position_assignment_notes, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'heu-assign:POS-00000001:enzo.spenuso@heuresys.com'),
       :'heu'::uuid, u.user_id, p.position_id, 'PRIMARY', 1.00,
       DATE '2026-07-22', 'ACTIVE',
       'audit coerenza S1025: fondatore reale sulla posizione CEO & Founder',
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1)
FROM sys.sys_users u, sys.sys_positions p
WHERE u.user_email = 'enzo.spenuso@heuresys.com'
  AND p.position_code = 'POS-00000001' AND p.position_tenant_id = :'heu'::uuid
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                   WHERE a.user_position_assignment_user_id = u.user_id
                     AND a.user_position_assignment_kind = 'PRIMARY'
                     AND a.user_position_assignment_status = 'ACTIVE')
ON CONFLICT (user_position_assignment_id) DO NOTHING;

UPDATE sys.sys_organization_units ou
   SET organization_unit_manager_user_id = u.user_id, updated_at = now()
  FROM (VALUES ('HS-CORP','enzo.spenuso@heuresys.com'),
               ('HS-PROD','chiara.spenuso@heuresys.com'),
               ('HS-MGMT','andrea.spenuso@heuresys.com')) map(ou_code, email)
  JOIN sys.sys_users u ON u.user_email = map.email
 WHERE ou.organization_unit_code = map.ou_code
   AND ou.organization_unit_tenant_id = :'heu'::uuid
   AND ou.organization_unit_manager_user_id IS DISTINCT FROM u.user_id;

-- ----------------------------------------------------------------------------
-- E2. Sync employment ← contratto (ULTIMO step di scrittura): pay_scale_level
--     e salary della vista employment (esposta da /v1/me/profile/full) devono
--     rispecchiare l'inquadramento contrattuale finale (i seed #70/#71a e le
--     sezioni A-C aggiornano solo il lato contratto).
-- ----------------------------------------------------------------------------
UPDATE sys.sys_user_employment e
   SET user_employment_pay_scale_level = uc.user_contract_ccnl_level,
       user_employment_salary = uc.user_contract_gross_annual_salary,
       updated_at = now()
  FROM sys.sys_user_contracts uc
 WHERE uc.user_contract_user_id = e.user_employment_user_id
   AND (e.user_employment_pay_scale_level IS DISTINCT FROM uc.user_contract_ccnl_level
     OR e.user_employment_salary IS DISTINCT FROM uc.user_contract_gross_annual_salary);

-- ----------------------------------------------------------------------------
-- F. Post-conditions (fail loud)
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_user_contracts uc
  JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id = uc.user_contract_user_id
   AND a.user_position_assignment_kind='PRIMARY' AND a.user_position_assignment_status='ACTIVE'
  JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
  WHERE lower(trim(uc.user_contract_job_title)) <> lower(trim(p.position_title));
  IF n > 0 THEN RAISE EXCEPTION 'audit seed: % job_title ancora disallineati', n; END IF;

  SELECT count(*) INTO n
  FROM sys.sys_user_contracts uc
  JOIN sys.sys_user_demographics d ON d.user_demographics_user_id = uc.user_contract_user_id
  WHERE (uc.user_contract_ccnl_level IN ('QD3','QD4')
         AND (date_part('year', age(d.user_demographics_birth_date)) < 35
              OR date_part('year', age(uc.user_contract_start_date)) < 8))
     OR (uc.user_contract_ccnl_level = 'Dirigente'
         AND (date_part('year', age(d.user_demographics_birth_date)) < 42
              OR date_part('year', age(uc.user_contract_start_date)) < 10));
  IF n > 0 THEN RAISE EXCEPTION 'audit seed: % outlier età/anzianità residui', n; END IF;

  -- assunzione non prima dei 20 anni (guardrail post-shift)
  SELECT count(*) INTO n FROM sys.sys_user_contracts uc
  JOIN sys.sys_user_demographics d ON d.user_demographics_user_id=uc.user_contract_user_id
  WHERE uc.user_contract_start_date < d.user_demographics_birth_date + interval '20 years';
  IF n > 0 THEN RAISE EXCEPTION 'audit seed: % assunzioni pre-20-anni dopo lo shift', n; END IF;

  -- CRO sotto il CEO
  IF (SELECT uc.user_contract_gross_annual_salary FROM sys.sys_user_contracts uc
      JOIN sys.sys_users u ON u.user_id=uc.user_contract_user_id
      WHERE u.user_email='alice.esposito@rtl-bank.org')
     >= (SELECT uc.user_contract_gross_annual_salary FROM sys.sys_user_contracts uc
         JOIN sys.sys_users u ON u.user_id=uc.user_contract_user_id
         WHERE u.user_email='federica.marchetti@rtl-bank.org') THEN
    RAISE EXCEPTION 'audit seed: CRO ancora >= CEO';
  END IF;

  -- CEO & Founder e Head of Product coperti
  SELECT count(*) INTO n
  FROM (VALUES ('POS-00000001'),('POS-00000003')) k(code)
  JOIN sys.sys_positions p ON p.position_code = k.code
   AND p.position_tenant_id = '8bc5bc59-f2d2-4a8a-882a-ea26ac367858'::uuid
  WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                     WHERE a.user_position_assignment_position_id = p.position_id
                       AND a.user_position_assignment_kind='PRIMARY'
                       AND a.user_position_assignment_status='ACTIVE');
  IF n > 0 THEN RAISE EXCEPTION 'audit seed: % posizioni HEURESYS chiave ancora vacanti', n; END IF;

  -- employment rispecchia il contratto (livello + salario)
  SELECT count(*) INTO n FROM sys.sys_user_employment e
  JOIN sys.sys_user_contracts uc ON uc.user_contract_user_id = e.user_employment_user_id
  WHERE e.user_employment_pay_scale_level IS DISTINCT FROM uc.user_contract_ccnl_level
     OR e.user_employment_salary IS DISTINCT FROM uc.user_contract_gross_annual_salary;
  IF n > 0 THEN RAISE EXCEPTION 'audit seed: % employment disallineati dal contratto', n; END IF;

  RAISE NOTICE 'audit seed: titoli allineati, età/anzianità coerenti, apicali coerenti, employment sincronizzato, HEURESYS org completa.';
END $$;

COMMIT;
