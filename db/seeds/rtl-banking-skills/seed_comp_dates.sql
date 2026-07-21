-- =====================================================================================
-- Blocco C — Correzione COMPLETA retribuzioni + date — tenant RTL_BANK
-- =====================================================================================
-- Scope: SOLO tenant RTL_BANK (86ba7a65-217f-48ba-8ce5-5c09b40a66b0). NON tocca HEURESYS.
-- Idempotente, transazionale. Rieseguibile: conteggi/valori stabili.
--
-- Fix applicati (tutti nel contesto CCNL Credito, banca retail regionale italiana):
--   1. posizione -> banda retributiva (da job_role della posizione)
--   2. salario = mid della banda +/- delta anzianita (hash-stabile su user_id), clampato [min,max]
--   3. livello CCNL (pay_scale_level / ccnl_level) coerente con la banda
--   4. contract_type: apprenticeship solo se eta<30 AND tenure<4 AND livello area prof. (3A%);
--      mai quadri/dirigenti; altrimenti permanent (o fixed_term se contract_end futuro)
--   5. seniority_date <= hire_date (rimosso il costante 2021-01-01)
--   6. date sintetiche (2-dicembre + coorte 2006) ridistribuite deterministicamente
--   7. pay-slip: ultime 3 mensilita per tutti gli utenti attivi (13 mensilita bancarie)
--   8. certificazioni IVASS (assicurativo-adjacent) + EFPA/MiFID II (advisor/dealer)
--   9. 2 utenti incompleti (Maria Colombo, Giuseppe Ferri): birth+gender+contratto
--
-- Mapping ruolo->banda (decisione di dominio, mid EUR):
--   CEO->EX-1(220k) | Directors->EX-2(150k) | Head Commercial/CRO->MG-1(105k)
--   Bank/Line/HR Manager->MG-2(80k) | Advisor/Compliance/Dealer->PR-1(67k)
--   Risk/Financial Analyst->PR-2(52k) | Back Office/Payment->PR-3(40k)
--   Bank Teller->SP-1(34k) | SysAdmin/SW Dev->IT-2(65k)
-- =====================================================================================

\set ON_ERROR_STOP on
\set rtl 86ba7a65-217f-48ba-8ce5-5c09b40a66b0
\set today 2026-07-21

BEGIN;

-- -------------------------------------------------------------------------------------
-- 0. Mappa ruolo -> banda -> (band_id, min/mid/max, livello CCNL). Temp, tx-scoped.
-- -------------------------------------------------------------------------------------
CREATE TEMP TABLE _rtl_band_map ON COMMIT DROP AS
WITH role_band(role_name, band_code) AS (VALUES
    ('CEO','EX-1'),
    ('Finance Director','EX-2'), ('IT Director','EX-2'), ('Operations Director','EX-2'),
    ('Retail Director','EX-2'), ('HR Director','EX-2'),
    ('Head of Commercial Banking','MG-1'), ('Chief Risk Officer','MG-1'),
    ('Bank Manager','MG-2'), ('Line Manager - Operations','MG-2'), ('HR Manager','MG-2'),
    ('Investment Advisor','PR-1'), ('Compliance Officer','PR-1'), ('Securities Dealer','PR-1'),
    ('Risk Analyst','PR-2'), ('Financial Analyst','PR-2'),
    ('Back Office Specialist','PR-3'), ('Payment Specialist','PR-3'),
    ('Bank Teller','SP-1'),
    ('System Administrator','IT-2'), ('Software Developer','IT-2')
),
band_ccnl(band_code, ccnl_level) AS (VALUES
    ('EX-1','Dirigente'), ('EX-2','Dirigente'),
    ('MG-1','QD4'), ('MG-2','QD3'),
    ('PR-1','3A4L'), ('IT-1','3A4L'), ('IT-2','3A4L'),
    ('PR-2','3A3L'),
    ('IT-3','3A2L'), ('PR-3','3A2L'),
    ('SP-1','3A1L'), ('SP-2','3A1L')
)
SELECT rb.role_name,
       rb.band_code,
       cb.compensation_band_id                              AS band_id,
       cb.compensation_band_min_eur                         AS bmin,
       cb.compensation_band_mid_eur                         AS bmid,
       cb.compensation_band_max_eur                         AS bmax,
       bc.ccnl_level
FROM role_band rb
JOIN band_ccnl bc ON bc.band_code = rb.band_code
JOIN sys.sys_compensation_bands cb
     ON cb.compensation_band_code = rb.band_code
    AND cb.compensation_band_tenant_id = :'rtl'::uuid;

-- Guard: ogni ruolo mappato deve risolvere una banda RTL (altrimenti STOP)
DO $$
DECLARE missing int;
BEGIN
    SELECT count(*) INTO missing FROM _rtl_band_map WHERE band_id IS NULL;
    IF missing > 0 THEN
        RAISE EXCEPTION 'Bande RTL non risolte per % ruoli mappati', missing;
    END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 1. Snapshot computato per-utente (attivi con posizione PRIMARY + ruolo mappato).
--    Le date finali sono calcolate PRIMA del salario (il salario usa la tenure finale).
-- -------------------------------------------------------------------------------------
CREATE TEMP TABLE _rtl_comp ON COMMIT DROP AS
WITH base AS (
    SELECT u.user_id,
           u.user_first_name,
           d.user_demographics_birth_date AS birth,
           e.user_employment_hire_date    AS hire,
           p.position_title,
           jr.job_role_name               AS role_name,
           m.band_id, m.band_code, m.bmin, m.bmid, m.bmax, m.ccnl_level
    FROM sys.sys_users u
    JOIN sys.sys_user_position_assignments upa
         ON upa.user_position_assignment_user_id = u.user_id
        AND upa.user_position_assignment_status  = 'ACTIVE'
        AND upa.user_position_assignment_kind    = 'PRIMARY'
    JOIN sys.sys_positions p  ON p.position_id  = upa.user_position_assignment_position_id
    JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
    JOIN _rtl_band_map m      ON m.role_name    = jr.job_role_name
    LEFT JOIN sys.sys_user_demographics d ON d.user_demographics_user_id = u.user_id
    LEFT JOIN sys.sys_user_employment   e ON e.user_employment_user_id   = u.user_id
    WHERE u.user_tenant_id = :'rtl'::uuid
      AND u.user_status    = 'ACTIVE'
),
hashed AS (  -- hash deterministici non-negativi (28 bit) per campo
    SELECT *,
        ('x'||substr(md5(user_id::text||'hy'),1,7))::bit(28)::int  AS hy,
        ('x'||substr(md5(user_id::text||'hm'),1,7))::bit(28)::int  AS hm,
        ('x'||substr(md5(user_id::text||'hd'),1,7))::bit(28)::int  AS hd,
        ('x'||substr(md5(user_id::text||'ah'),1,7))::bit(28)::int  AS ah,
        ('x'||substr(md5(user_id::text||'bm'),1,7))::bit(28)::int  AS bm,
        ('x'||substr(md5(user_id::text||'bd'),1,7))::bit(28)::int  AS bd,
        ('x'||substr(md5(user_id::text||'jit'),1,7))::bit(28)::int AS jit,
        (   (birth IS NOT NULL AND extract(month from birth)=12 AND extract(day from birth)=2)
         OR (hire  IS NOT NULL AND extract(month from hire)=12  AND extract(day from hire)=2)
         OR (hire  IS NOT NULL AND extract(year  from hire)=2006)
        ) AS is_anom
    FROM base
),
dated AS (
    SELECT *,
        (23 + (ah % 8))                     AS age_at_hire,   -- hire = birth + 23..30 anni
        (is_anom OR birth IS NULL)          AS need_birth,
        -- hire finale: ridistribuito su 2003-2024 ESCLUSO 2006 (coorte sintetica da sciogliere)
        -- se anomalo; day>=3 -> mai 2-dicembre; skip-2006 -> re-run perfettamente stabile.
        CASE WHEN is_anom
             THEN make_date(
                    2003 + (hy % 21) + CASE WHEN 2003 + (hy % 21) >= 2006 THEN 1 ELSE 0 END,
                    1 + (hm % 12), 3 + (hd % 26))
             ELSE hire END                  AS final_hire
    FROM hashed
),
birthed AS (
    SELECT *,
        -- birth finale coerente con hire finale; day>=3 -> mai 2-dicembre
        CASE WHEN need_birth
             THEN make_date(extract(year from final_hire)::int - age_at_hire,
                            1 + (bm % 12), 3 + (bd % 26))
             ELSE birth END                 AS final_birth
    FROM dated
)
SELECT
    user_id, user_first_name, position_title, role_name, band_code, band_id,
    bmin, bmid, bmax, ccnl_level, is_anom, need_birth,
    final_hire,
    final_hire                              AS final_seniority,
    final_birth,
    date_part('year', age(DATE :'today', final_birth))::int AS final_age,
    round(((DATE :'today' - final_hire) / 365.25)::numeric, 2) AS tenure_years,
    -- salario: mid * (1 + delta_anzianita[-15%,+15%] + jitter[-2%,+2%]), clampato [min,max], intero
    LEAST(GREATEST(
        round( bmid * (
            1
            + 0.15 * (2 * (LEAST(GREATEST((DATE :'today' - final_hire)/365.25, 0), 35) / 35.0) - 1)
            + 0.02 * (2 * ((jit % 1000) / 1000.0) - 1)
        ))
    , bmin), bmax)::int                     AS salary
FROM birthed;

-- =====================================================================================
-- FIX 1 — posizione -> banda (upsert su TUTTE le posizioni RTL con ruolo mappato)
-- =====================================================================================
INSERT INTO sys.sys_position_compensation_profiles
    (position_id, position_compensation_profile_tenant_id, compensation_band_id, economic_weight)
SELECT p.position_id, :'rtl'::uuid, m.band_id, COALESCE(p.position_economic_weight, 0.5000)
FROM sys.sys_positions p
JOIN sys.sys_job_roles jr ON jr.job_role_id = p.position_job_role_id
JOIN _rtl_band_map m      ON m.role_name    = jr.job_role_name
WHERE p.position_tenant_id = :'rtl'::uuid
ON CONFLICT (position_id) DO UPDATE
    SET compensation_band_id = EXCLUDED.compensation_band_id,
        updated_at = now();

-- =====================================================================================
-- FIX 2 + 3 + 6 (hire) — employment: salario, hire finale, livello CCNL, valuta, mensilita
-- =====================================================================================
UPDATE sys.sys_user_employment e
SET user_employment_salary               = c.salary,
    user_employment_hire_date            = c.final_hire,
    user_employment_pay_scale_level      = c.ccnl_level,
    user_employment_currency             = 'EUR',
    user_employment_pay_periods_per_year = 13,
    updated_at                           = now()
FROM _rtl_comp c
WHERE e.user_employment_user_id   = c.user_id
  AND e.user_employment_tenant_id = :'rtl'::uuid;

-- =====================================================================================
-- FIX 5 — seniority = hire per TUTTE le righe RTL (norma bancaria: anzianita = assunzione).
--         Copre: seniority>hire, il costante 2021-01-01, i NULL e i seniority<hire
--         incoerenti generati dalla ridistribuzione delle date. Distinct-guard -> re-run 0.
-- =====================================================================================
UPDATE sys.sys_user_employment
SET user_employment_seniority_date = user_employment_hire_date,
    updated_at                     = now()
WHERE user_employment_tenant_id = :'rtl'::uuid
  AND user_employment_seniority_date IS DISTINCT FROM user_employment_hire_date;

-- =====================================================================================
-- FIX 6 (birth) — demographics: ridistribuisce le date di nascita anomale / NULL
-- =====================================================================================
UPDATE sys.sys_user_demographics dm
SET user_demographics_birth_date = c.final_birth,
    updated_at                   = now()
FROM _rtl_comp c
WHERE dm.user_demographics_user_id   = c.user_id
  AND dm.user_demographics_tenant_id = :'rtl'::uuid
  AND c.need_birth;

-- =====================================================================================
-- FIX 9 (gender) — assegna gender coerente col nome SOLO dove NULL (Maria/Giuseppe...)
-- =====================================================================================
UPDATE sys.sys_user_demographics dm
SET user_demographics_gender = CASE WHEN lower(u.user_first_name) LIKE '%a' THEN 'FEMALE' ELSE 'MALE' END,
    updated_at               = now()
FROM sys.sys_users u
WHERE dm.user_demographics_user_id   = u.user_id
  AND u.user_tenant_id               = :'rtl'::uuid
  AND dm.user_demographics_gender IS NULL;

-- =====================================================================================
-- FIX 2 + 3 + 4 — contratti esistenti: salario, CCNL, start=hire, tipo apprendistato
-- =====================================================================================
UPDATE sys.sys_user_contracts ct
SET user_contract_gross_annual_salary = c.salary,
    user_contract_ccnl_type           = 'CCNL Credito 2024',
    user_contract_ccnl_level          = c.ccnl_level,
    user_contract_currency            = 'EUR',
    user_contract_salary_type         = 'annual',
    user_contract_payment_frequency   = 'monthly',
    user_contract_start_date          = c.final_hire,
    user_contract_type = CASE
        WHEN ct.user_contract_type = 'apprenticeship'
             AND NOT (c.final_age < 30 AND c.tenure_years < 4 AND c.ccnl_level LIKE '3A%')
        THEN CASE WHEN ct.user_contract_end_date IS NOT NULL
                       AND ct.user_contract_end_date > DATE :'today'
                  THEN 'fixed_term' ELSE 'permanent' END
        ELSE ct.user_contract_type
    END,
    updated_at = now()
FROM _rtl_comp c
WHERE ct.user_contract_user_id   = c.user_id
  AND ct.user_contract_tenant_id = :'rtl'::uuid;

-- FIX 4 (blanket) — riassegna OGNI apprendistato RTL fuori regola (eta<30 AND tenure<4),
--                   inclusi utenti non in _rtl_comp (es. DEACTIVATED senza posizione attiva).
UPDATE sys.sys_user_contracts ct
SET user_contract_type = CASE
        WHEN ct.user_contract_end_date IS NOT NULL AND ct.user_contract_end_date > DATE :'today'
        THEN 'fixed_term' ELSE 'permanent' END,
    updated_at = now()
FROM sys.sys_user_employment e,
     sys.sys_user_demographics d
WHERE ct.user_contract_tenant_id  = :'rtl'::uuid
  AND e.user_employment_user_id   = ct.user_contract_user_id
  AND d.user_demographics_user_id = ct.user_contract_user_id
  AND ct.user_contract_type = 'apprenticeship'
  AND d.user_demographics_birth_date IS NOT NULL
  AND e.user_employment_hire_date    IS NOT NULL
  AND NOT ( date_part('year', age(DATE :'today', d.user_demographics_birth_date)) < 30
            AND (DATE :'today' - e.user_employment_hire_date)/365.25 < 4
            AND ct.user_contract_ccnl_level LIKE '3A%' );

-- =====================================================================================
-- FIX 9 (contratto) — crea la riga contratto per gli utenti attivi che non ne hanno
--                     (Maria Colombo, Giuseppe Ferri). Idempotente via NOT EXISTS.
-- =====================================================================================
INSERT INTO sys.sys_user_contracts
    (user_contract_user_id, user_contract_tenant_id, user_contract_type, user_contract_code,
     user_contract_start_date, user_contract_ccnl_type, user_contract_ccnl_level,
     user_contract_gross_annual_salary, user_contract_currency, user_contract_salary_type,
     user_contract_payment_frequency, user_contract_work_hours_weekly, user_contract_job_title,
     user_contract_status)
SELECT c.user_id, :'rtl'::uuid,
       CASE WHEN c.final_age < 30 AND c.tenure_years < 4 AND c.ccnl_level LIKE '3A%'
            THEN 'apprenticeship' ELSE 'permanent' END,
       'CTR-'||to_char(c.final_hire,'YYYY')||'-'||upper(substr(replace(c.user_id::text,'-',''),1,6)),
       c.final_hire, 'CCNL Credito 2024', c.ccnl_level,
       c.salary, 'EUR', 'annual', 'monthly', 40.00, c.position_title, 'ACTIVE'
FROM _rtl_comp c
WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_contracts ct WHERE ct.user_contract_user_id = c.user_id
);

-- =====================================================================================
-- FIX 7 — pay-slip: rigenera le ultime 3 mensilita per TUTTI gli utenti attivi.
--         Gross mensile = salario/13 (13a bancaria). Net ~= gross*0.72. Idempotente (del+ins).
-- =====================================================================================
DELETE FROM sys.sys_user_pay_slips WHERE user_pay_slip_tenant_id = :'rtl'::uuid;

INSERT INTO sys.sys_user_pay_slips
    (user_pay_slip_user_id, user_pay_slip_tenant_id, user_pay_slip_period,
     user_pay_slip_period_start, user_pay_slip_period_end, user_pay_slip_gross_pay,
     user_pay_slip_net_pay, user_pay_slip_deductions, user_pay_slip_payment_date, user_pay_slip_status)
SELECT c.user_id, :'rtl'::uuid, m.period, m.pstart, m.pend,
       round(c.salary/13.0, 2)                                  AS gross,
       round(c.salary/13.0 * 0.72, 2)                           AS net,
       jsonb_build_object(
           'gross',            round(c.salary/13.0, 2),
           'net',              round(c.salary/13.0 * 0.72, 2),
           'inps',             round(c.salary/13.0 * 0.0919, 2),
           'irpef',            round(c.salary/13.0 * 0.1881, 2),
           'total_deductions', round(c.salary/13.0 * 0.28, 2)
       )                                                         AS deductions,
       m.paydate, 'paid'
FROM _rtl_comp c
CROSS JOIN (VALUES
    ('2026-04', DATE '2026-04-01', DATE '2026-04-30', DATE '2026-04-27'),
    ('2026-05', DATE '2026-05-01', DATE '2026-05-31', DATE '2026-05-27'),
    ('2026-06', DATE '2026-06-01', DATE '2026-06-30', DATE '2026-06-27')
) m(period, pstart, pend, paydate);

-- =====================================================================================
-- FIX 8 — certificazioni. IVASS (RUI Sez.E) per ruoli assicurativo-adjacent;
--         EFPA/MiFID II per Investment Advisor + Securities Dealer. Idempotente (NOT EXISTS).
--         issued_date deterministico (hire finale + offset hash), expires +5 anni.
-- =====================================================================================
-- IVASS: Investment Advisor + Bank Manager (intermediazione assicurativa retail)
INSERT INTO sys.sys_user_certifications
    (user_certification_user_id, user_certification_tenant_id, user_certification_name,
     user_certification_issuer, user_certification_issued_date, user_certification_expires_date,
     user_certification_credential_id)
SELECT c.user_id, :'rtl'::uuid,
       'Iscrizione RUI - Sez. E (Intermediari Assicurativi)', 'IVASS',
       iss.issued, (iss.issued + 365*5),
       'RUI-E-'||upper(substr(replace(c.user_id::text,'-',''),1,8))
FROM _rtl_comp c
CROSS JOIN LATERAL (
    SELECT GREATEST(c.final_hire, DATE '2016-01-01')
           + (('x'||substr(md5(c.user_id::text||'ivass'),1,7))::bit(28)::int % 300) AS issued
) iss
WHERE c.role_name IN ('Investment Advisor','Bank Manager')
  AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications x
      WHERE x.user_certification_user_id = c.user_id
        AND x.user_certification_name    = 'Iscrizione RUI - Sez. E (Intermediari Assicurativi)'
        AND x.user_certification_issuer  = 'IVASS'
  );

-- EFPA / MiFID II: Investment Advisor + Securities Dealer
INSERT INTO sys.sys_user_certifications
    (user_certification_user_id, user_certification_tenant_id, user_certification_name,
     user_certification_issuer, user_certification_issued_date, user_certification_expires_date,
     user_certification_credential_id)
SELECT c.user_id, :'rtl'::uuid,
       'Certificazione EFPA European Financial Advisor (MiFID II)', 'EFPA Italia',
       iss.issued, (iss.issued + 365*5),
       'EFPA-EFA-'||upper(substr(replace(c.user_id::text,'-',''),1,8))
FROM _rtl_comp c
CROSS JOIN LATERAL (
    SELECT GREATEST(c.final_hire, DATE '2016-01-01')
           + (('x'||substr(md5(c.user_id::text||'mifid'),1,7))::bit(28)::int % 300) AS issued
) iss
WHERE c.role_name IN ('Investment Advisor','Securities Dealer')
  AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_certifications x
      WHERE x.user_certification_user_id = c.user_id
        AND x.user_certification_name    = 'Certificazione EFPA European Financial Advisor (MiFID II)'
        AND x.user_certification_issuer  = 'EFPA Italia'
  );

COMMIT;
