-- =============================================================================
-- Blocco B — Banking skills end-to-end seed for tenant RTL_BANK
-- Tenant: 86ba7a65-217f-48ba-8ce5-5c09b40a66b0  (RTL Bank, customer-example)
-- Replaces the demo/noise skill framework with a realistic banking one:
--   1. wipe RTL demo requirements + holdings + gaps (removes ESCO noise skills
--      "materiali avanzati" / "regolamentazione della sosta" from RTL usage)
--   2. position skill requirements per job role  (role -> skill -> proficiency)
--   3. user skill holdings  (~80% coverage, ~35% one-level gap, deterministic)
--   4. gap analysis results (one SKILL row per active-assigned user)
--
-- IDEMPOTENT: single transaction, DELETE + deterministic-UUID INSERT. Re-running
-- produces identical rows/counts (all randomness is a stable hash of the ids).
-- SCOPE: touches ONLY the RTL tenant. Never HEURESYS, never global skills.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_banking_skills.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Config (tenant + created_by actor) and proficiency ranking
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'::uuid AS tenant_id,
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1) AS admin_id;

DO $$
BEGIN
  IF (SELECT admin_id FROM _cfg) IS NULL THEN
    RAISE EXCEPTION 'nessun PLATFORM_ADMIN attivo da usare come autore: senza un attore non si puo'' attribuire cio'' che si scrive';
  END IF;
END $$;

CREATE TEMP TABLE _rank ON COMMIT DROP AS
SELECT lvl, n FROM (VALUES
  ('NOVICE',1),('BASIC',2),('COMPETENT',3),('PROFICIENT',4),('EXPERT',5),('MASTER',6)
) t(lvl, n);

-- ----------------------------------------------------------------------------
-- 1. Domain mapping  role_name -> (skill, required_proficiency)
--    is_soft=true  -> resolve by skill_name + RTL tenant (COMP:: soft skills)
--    is_soft=false -> resolve by CUSTOM:: skill_code + RTL tenant (banking core)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _map ON COMMIT DROP AS
SELECT v.role_name,
       v.required,
       v.is_soft,
       COALESCE(sc.skill_id, ss.skill_id) AS skill_id
FROM (VALUES
  -- CEO
  ('CEO','Leadership',true ,'EXPERT'),
  ('CEO','CUSTOM::BASEL-REG',false,'COMPETENT'),
  ('CEO','CUSTOM::SUSTAIN-FIN',false,'COMPETENT'),
  ('CEO','Orientamento ai risultati',true ,'EXPERT'),
  ('CEO','CUSTOM::REL-BANKING',false,'PROFICIENT'),
  -- Retail Director
  ('Retail Director','CUSTOM::REL-BANKING',false,'EXPERT'),
  ('Retail Director','CUSTOM::PRIV-BANKING',false,'PROFICIENT'),
  ('Retail Director','Leadership',true ,'EXPERT'),
  ('Retail Director','Orientamento al cliente',true ,'EXPERT'),
  ('Retail Director','CUSTOM::LOAN-ORIG',false,'COMPETENT'),
  -- Head of Commercial Banking
  ('Head of Commercial Banking','CUSTOM::REL-BANKING',false,'EXPERT'),
  ('Head of Commercial Banking','CUSTOM::LOAN-ORIG',false,'PROFICIENT'),
  ('Head of Commercial Banking','CUSTOM::TRADE-FIN',false,'PROFICIENT'),
  ('Head of Commercial Banking','Leadership',true ,'PROFICIENT'),
  ('Head of Commercial Banking','Orientamento ai risultati',true ,'PROFICIENT'),
  -- Bank Manager
  ('Bank Manager','CUSTOM::REL-BANKING',false,'PROFICIENT'),
  ('Bank Manager','CUSTOM::LOAN-ORIG',false,'COMPETENT'),
  ('Bank Manager','Leadership',true ,'PROFICIENT'),
  ('Bank Manager','Orientamento al cliente',true ,'PROFICIENT'),
  ('Bank Manager','Comunicazione',true ,'PROFICIENT'),
  -- Bank Teller
  ('Bank Teller','CUSTOM::CORE-BANKING',false,'COMPETENT'),
  ('Bank Teller','CUSTOM::DIGITAL-PAY',false,'COMPETENT'),
  ('Bank Teller','CUSTOM::AML-OPS',false,'BASIC'),
  ('Bank Teller','Orientamento al cliente',true ,'PROFICIENT'),
  ('Bank Teller','Comunicazione',true ,'COMPETENT'),
  -- Investment Advisor
  ('Investment Advisor','CUSTOM::WEALTH-MGMT',false,'PROFICIENT'),
  ('Investment Advisor','CUSTOM::MIFID-COMP',false,'PROFICIENT'),
  ('Investment Advisor','CUSTOM::PRIV-BANKING',false,'COMPETENT'),
  ('Investment Advisor','CUSTOM::REL-BANKING',false,'PROFICIENT'),
  ('Investment Advisor','Orientamento al cliente',true ,'PROFICIENT'),
  -- Securities Dealer
  ('Securities Dealer','CUSTOM::FX-TRADING',false,'PROFICIENT'),
  ('Securities Dealer','CUSTOM::MARKET-RISK',false,'PROFICIENT'),
  ('Securities Dealer','CUSTOM::MIFID-COMP',false,'COMPETENT'),
  ('Securities Dealer','CUSTOM::TRADE-FIN',false,'COMPETENT'),
  -- Payment Specialist
  ('Payment Specialist','CUSTOM::PSD2-OPEN',false,'PROFICIENT'),
  ('Payment Specialist','CUSTOM::DIGITAL-PAY',false,'PROFICIENT'),
  ('Payment Specialist','CUSTOM::CORE-BANKING',false,'COMPETENT'),
  -- Compliance Officer
  ('Compliance Officer','CUSTOM::AML-OPS',false,'EXPERT'),
  ('Compliance Officer','CUSTOM::KYC-DUE',false,'PROFICIENT'),
  ('Compliance Officer','CUSTOM::MIFID-COMP',false,'PROFICIENT'),
  ('Compliance Officer','CUSTOM::INT-AUDIT',false,'COMPETENT'),
  ('Compliance Officer','Orientamento ai risultati',true ,'COMPETENT'),
  -- Risk Analyst
  ('Risk Analyst','CUSTOM::MARKET-RISK',false,'PROFICIENT'),
  ('Risk Analyst','CUSTOM::OP-RISK',false,'PROFICIENT'),
  ('Risk Analyst','CUSTOM::CREDIT-SCORE',false,'COMPETENT'),
  ('Risk Analyst','CUSTOM::STRESS-TEST',false,'COMPETENT'),
  ('Risk Analyst','Problem solving',true ,'PROFICIENT'),
  -- Chief Risk Officer
  ('Chief Risk Officer','CUSTOM::BASEL-REG',false,'EXPERT'),
  ('Chief Risk Officer','CUSTOM::STRESS-TEST',false,'EXPERT'),
  ('Chief Risk Officer','CUSTOM::MARKET-RISK',false,'EXPERT'),
  ('Chief Risk Officer','CUSTOM::OP-RISK',false,'PROFICIENT'),
  ('Chief Risk Officer','CUSTOM::NPL-MGMT',false,'PROFICIENT'),
  ('Chief Risk Officer','Leadership',true ,'PROFICIENT'),
  -- Finance Director
  ('Finance Director','CUSTOM::IFRS9',false,'EXPERT'),
  ('Finance Director','CUSTOM::CASH-MGMT',false,'PROFICIENT'),
  ('Finance Director','CUSTOM::BASEL-REG',false,'PROFICIENT'),
  ('Finance Director','Leadership',true ,'PROFICIENT'),
  -- Financial Analyst
  ('Financial Analyst','CUSTOM::IFRS9',false,'COMPETENT'),
  ('Financial Analyst','CUSTOM::CREDIT-SCORE',false,'COMPETENT'),
  ('Financial Analyst','CUSTOM::CASH-MGMT',false,'COMPETENT'),
  ('Financial Analyst','Problem solving',true ,'PROFICIENT'),
  -- Back Office Specialist
  ('Back Office Specialist','CUSTOM::CORE-BANKING',false,'PROFICIENT'),
  ('Back Office Specialist','CUSTOM::AML-OPS',false,'COMPETENT'),
  ('Back Office Specialist','Orientamento ai risultati',true ,'COMPETENT'),
  -- Operations Director
  ('Operations Director','CUSTOM::CORE-BANKING',false,'PROFICIENT'),
  ('Operations Director','CUSTOM::OP-RISK',false,'PROFICIENT'),
  ('Operations Director','Leadership',true ,'PROFICIENT'),
  -- Line Manager - Operations
  ('Line Manager - Operations','CUSTOM::CORE-BANKING',false,'COMPETENT'),
  ('Line Manager - Operations','CUSTOM::OP-RISK',false,'COMPETENT'),
  ('Line Manager - Operations','Orientamento ai risultati',true ,'COMPETENT'),
  -- IT Director
  ('IT Director','CUSTOM::CORE-BANKING',false,'PROFICIENT'),
  ('IT Director','CUSTOM::CYBER-FIN',false,'PROFICIENT'),
  ('IT Director','Leadership',true ,'PROFICIENT'),
  -- System Administrator
  ('System Administrator','CUSTOM::CORE-BANKING',false,'COMPETENT'),
  ('System Administrator','CUSTOM::CYBER-FIN',false,'COMPETENT'),
  -- Software Developer
  ('Software Developer','CUSTOM::CORE-BANKING',false,'COMPETENT'),
  ('Software Developer','CUSTOM::DIGITAL-PAY',false,'COMPETENT'),
  ('Software Developer','Problem solving',true ,'PROFICIENT'),
  -- HR Director
  ('HR Director','Leadership',true ,'EXPERT'),
  ('HR Director','Comunicazione',true ,'PROFICIENT'),
  ('HR Director','Collaborazione',true ,'PROFICIENT'),
  -- HR Manager
  ('HR Manager','Comunicazione',true ,'PROFICIENT'),
  ('HR Manager','Collaborazione',true ,'PROFICIENT'),
  ('HR Manager','Adattabilità',true ,'PROFICIENT'),
  -- Ruoli delle OU aggiunte nel Blocco D (Tesoreria, Audit, Marketing, Legal)
  ('internal auditor','CUSTOM::INT-AUDIT',false,'PROFICIENT'),
  ('internal auditor','CUSTOM::AML-OPS',false,'COMPETENT'),
  ('internal auditor','CUSTOM::BASEL-REG',false,'COMPETENT'),
  ('internal auditor','Problem solving',true ,'PROFICIENT'),
  ('tesoriere bancario/tesoriera bancaria','CUSTOM::CASH-MGMT',false,'EXPERT'),
  ('tesoriere bancario/tesoriera bancaria','CUSTOM::FX-TRADING',false,'PROFICIENT'),
  ('tesoriere bancario/tesoriera bancaria','CUSTOM::MARKET-RISK',false,'PROFICIENT'),
  ('tesoriere bancario/tesoriera bancaria','CUSTOM::TRADE-FIN',false,'COMPETENT'),
  ('tesoriere bancario/tesoriera bancaria','Leadership',true ,'PROFICIENT'),
  ('trader FX e mercati monetari','CUSTOM::FX-TRADING',false,'PROFICIENT'),
  ('trader FX e mercati monetari','CUSTOM::MARKET-RISK',false,'PROFICIENT'),
  ('trader FX e mercati monetari','CUSTOM::TRADE-FIN',false,'COMPETENT'),
  ('trader FX e mercati monetari','CUSTOM::MIFID-COMP',false,'COMPETENT'),
  ('specialista marketing bancario','CUSTOM::DIGITAL-PAY',false,'COMPETENT'),
  ('specialista marketing bancario','Orientamento al cliente',true ,'PROFICIENT'),
  ('specialista marketing bancario','Comunicazione',true ,'PROFICIENT'),
  ('specialista marketing bancario','Innovazione',true ,'COMPETENT'),
  ('Legal Counsel','CUSTOM::MIFID-COMP',false,'PROFICIENT'),
  ('Legal Counsel','CUSTOM::KYC-DUE',false,'COMPETENT'),
  ('Legal Counsel','CUSTOM::INT-AUDIT',false,'COMPETENT'),
  ('Legal Counsel','Problem solving',true ,'PROFICIENT')
) AS v(role_name, skill_key, is_soft, required)
LEFT JOIN sys.sys_skills sc
  ON v.is_soft = false AND sc.skill_code = v.skill_key
     AND sc.skill_tenant_id = (SELECT tenant_id FROM _cfg)
LEFT JOIN sys.sys_skills ss
  ON v.is_soft = true  AND ss.skill_name = v.skill_key
     AND ss.skill_tenant_id = (SELECT tenant_id FROM _cfg);

-- Fail loud if any mapping skill did not resolve (orphan guard)
DO $$
DECLARE missing int;
BEGIN
  SELECT count(*) INTO missing FROM _map WHERE skill_id IS NULL;
  IF missing > 0 THEN
    RAISE EXCEPTION 'Unresolved skills in banking mapping: % row(s)', missing;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Wipe RTL demo data (children first for FK integrity), RTL scope only
-- ----------------------------------------------------------------------------
DELETE FROM sys.sys_position_skill_requirement_history
 WHERE position_skill_requirement_history_psr_id IN (
   SELECT position_skill_requirement_id FROM sys.sys_position_skill_requirements
   WHERE position_skill_requirement_tenant_id = (SELECT tenant_id FROM _cfg));

DELETE FROM sys.sys_position_skill_requirements
 WHERE position_skill_requirement_tenant_id = (SELECT tenant_id FROM _cfg);

DELETE FROM sys.sys_user_skills
 WHERE user_skill_tenant_id = (SELECT tenant_id FROM _cfg);

DELETE FROM sys.sys_gap_analysis_results
 WHERE gap_analysis_result_tenant_id = (SELECT tenant_id FROM _cfg);

-- ----------------------------------------------------------------------------
-- 3. Position skill requirements — one row per RTL position matching the role
--    weight: core=1.0, soft=0.6 | criticality from required proficiency
--    id: deterministic v5 (position_id : skill_id)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_position_skill_requirements
  (position_skill_requirement_id, position_id, position_skill_requirement_tenant_id,
   skill_id, required_proficiency, weight, criticality, position_skill_requirement_metadata, created_by)
SELECT
  uuid_generate_v5(uuid_ns_url(), p.position_id::text || ':' || m.skill_id::text),
  p.position_id,
  (SELECT tenant_id FROM _cfg),
  m.skill_id,
  m.required,
  CASE WHEN m.is_soft THEN 0.6 ELSE 1.0 END,
  CASE m.required
       WHEN 'MASTER'     THEN 'CRITICAL'
       WHEN 'EXPERT'     THEN 'CRITICAL'
       WHEN 'PROFICIENT' THEN 'HIGH'
       WHEN 'COMPETENT'  THEN 'MEDIUM'
       ELSE 'LOW'
  END,
  -- provenance esplicita (come il marker 'peer-group-prevalence-v1' di mig
  -- 000096): ogni riga PSR deve dichiarare il proprio motore di derivazione.
  jsonb_build_object('derived_by', 'banking-seed-v1'),
  (SELECT admin_id FROM _cfg)
FROM sys.sys_positions p
JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
JOIN _map m               ON m.role_name    = jr.job_role_name
WHERE p.position_tenant_id = (SELECT tenant_id FROM _cfg)
ON CONFLICT (position_id, skill_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Required skills per ACTIVE-assigned user (1:1 assignment) + their position
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _uap ON COMMIT DROP AS
SELECT a.user_position_assignment_user_id     AS uid,
       a.user_position_assignment_position_id AS pos_id
FROM sys.sys_user_position_assignments a
JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
WHERE a.user_position_assignment_status = 'ACTIVE'
  AND p.position_tenant_id = (SELECT tenant_id FROM _cfg);

CREATE TEMP TABLE _user_reqs ON COMMIT DROP AS
SELECT u.uid, m.skill_id, m.is_soft, m.required, r.n AS req_rank
FROM _uap u
JOIN sys.sys_positions p  ON p.position_id = u.pos_id
JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
JOIN _map m               ON m.role_name = jr.job_role_name
JOIN _rank r              ON r.lvl = m.required;

-- ----------------------------------------------------------------------------
-- 4. User skill holdings — deterministic ~80% coverage, ~35% one-level gap
--    all "random" attributes are a stable md5 hash of (uid, skill_id, salt)
-- ----------------------------------------------------------------------------
WITH included AS (
  SELECT ur.uid, ur.skill_id, ur.is_soft, ur.req_rank,
         -- held rank: drop one level for ~35% (never below NOVICE=1)
         CASE WHEN abs(mod(('x'||substr(md5(ur.uid::text||ur.skill_id::text||'dg'),1,8))::bit(32)::int,100)) < 35
              THEN GREATEST(1, ur.req_rank - 1) ELSE ur.req_rank END AS held_rank,
         1 + abs(mod(('x'||substr(md5(ur.uid::text||ur.skill_id::text||'ye'),1,8))::bit(32)::int,15)) AS yoe,
         (abs(mod(('x'||substr(md5(ur.uid::text||ur.skill_id::text||'ver'),1,8))::bit(32)::int,100)) < 60) AS is_verified,
         0.70 + abs(mod(('x'||substr(md5(ur.uid::text||ur.skill_id::text||'cf'),1,8))::bit(32)::int,26))/100.0 AS conf
  FROM _user_reqs ur
  -- include ~80% of a user's required skills
  WHERE abs(mod(('x'||substr(md5(ur.uid::text||ur.skill_id::text||'incl'),1,8))::bit(32)::int,100)) < 80
),
primaries AS (  -- mark the top 1-2 held CORE banking skills as primary per user
  SELECT uid, skill_id,
         row_number() OVER (PARTITION BY uid
           ORDER BY abs(mod(('x'||substr(md5(uid::text||skill_id::text||'pri'),1,8))::bit(32)::int,1000000))) AS rn
  FROM included WHERE is_soft = false
)
INSERT INTO sys.sys_user_skills
  (user_skill_id, user_skill_tenant_id, user_skill_user_id, user_skill_skill_id,
   user_skill_proficiency, user_skill_years_experience, user_skill_is_primary,
   user_skill_is_verified, user_skill_verified_by_user_id, user_skill_verified_at,
   user_skill_source, user_skill_confidence, created_by)
SELECT
  uuid_generate_v5(uuid_ns_url(), i.uid::text || ':' || i.skill_id::text),
  (SELECT tenant_id FROM _cfg),
  i.uid,
  i.skill_id,
  rl.lvl,
  i.yoe,
  COALESCE(pr.rn <= 2, false),
  i.is_verified,
  CASE WHEN i.is_verified THEN (SELECT admin_id FROM _cfg) ELSE NULL END,
  CASE WHEN i.is_verified THEN now() ELSE NULL END,
  'MANAGER_OVERRIDE',
  i.conf,
  (SELECT admin_id FROM _cfg)
FROM included i
JOIN _rank rl ON rl.n = i.held_rank
LEFT JOIN primaries pr ON pr.uid = i.uid AND pr.skill_id = i.skill_id
ON CONFLICT (user_skill_user_id, user_skill_skill_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Gap analysis — one SKILL result per active-assigned user
--    payload: array of {skill_id, skill_name, required, held, gap_levels}
--    overall_score: % of required skills the user meets (held_rank >= req_rank)
--    id: deterministic v5 (uid : position_id : gap)
-- ----------------------------------------------------------------------------
WITH gap_src AS (
  SELECT ur.uid,
         ur.skill_id,
         sk.skill_name,
         ur.required,
         ur.req_rank,
         us.user_skill_proficiency          AS held,
         COALESCE(rh.n, 0)                   AS held_rank
  FROM _user_reqs ur
  JOIN sys.sys_skills sk ON sk.skill_id = ur.skill_id
  LEFT JOIN sys.sys_user_skills us
         ON us.user_skill_user_id = ur.uid
        AND us.user_skill_skill_id = ur.skill_id
        AND us.user_skill_tenant_id = (SELECT tenant_id FROM _cfg)
  LEFT JOIN _rank rh ON rh.lvl = us.user_skill_proficiency
)
INSERT INTO sys.sys_gap_analysis_results
  (gap_analysis_result_id, gap_analysis_result_tenant_id, gap_analysis_result_user_id,
   gap_analysis_result_position_id, gap_analysis_result_kind, gap_analysis_result_payload,
   gap_analysis_result_overall_score, gap_analysis_result_computed_at)
SELECT
  uuid_generate_v5(uuid_ns_url(), g.uid::text || ':' || ua.pos_id::text || ':gap'),
  (SELECT tenant_id FROM _cfg),
  g.uid,
  ua.pos_id,
  'SKILL',
  -- shape canonica: OGGETTO con chiave 'skill_gaps' (lo schema Zod condiviso
  -- dichiara payload z.record(...) — un array nudo rompe la serializzazione
  -- della risposta /v1/learning-gaps/analysis-results con un 500; regressione
  -- S1024→S1025).
  jsonb_build_object('skill_gaps', jsonb_agg(
    jsonb_build_object(
      'skill_id',   g.skill_id,
      'skill_name', g.skill_name,
      'required',   g.required,
      'held',       COALESCE(g.held, 'NONE'),
      'gap_levels', GREATEST(0, g.req_rank - g.held_rank)
    ) ORDER BY g.skill_name
  )),
  round(100.0 * count(*) FILTER (WHERE g.held_rank >= g.req_rank) / count(*), 1),
  now()
FROM gap_src g
JOIN _uap ua ON ua.uid = g.uid
GROUP BY g.uid, ua.pos_id;

COMMIT;
