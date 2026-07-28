-- ============================================================================
-- storia36 C4 — formazione: iniziative annuali calendarizzate SUI giorni
-- TRAINING del C1, evidence che li quadra, self-paced negli anni scoperti,
-- rinnovi delle certificazioni obbligatorie scadute.
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C4)
-- Misura: .storia36/analysis/c4-misura.md · Codice: c4-codice.md
--
-- Fatti che governano il design:
--  · i 1.180 giorni TRAINING dell'attendance C1 sono FISSI (UNIQUE tenant,
--    user, date): le iniziative d'aula si CALENDARIZZANO su di essi e ogni
--    giorno TRAINING riceve un'evidence dello stesso giorno (quadratura C4e —
--    oggi solo 7/1.180)
--  · catalogo: i 15 moduli BANK-LM-* (global, titoli bancari IT) sono la base
--    delle iniziative; 1 iniziativa = 1 modulo (FK NOT NULL RESTRICT)
--  · monte-ore: IVASS 30 ore/anno per i distributori assicurativi (Reg. IVASS
--    40/2018; l'AML conta nel monte-ore — Reg. 44/2019), MiFID II aggiornamento
--    annuale (CONSOB 20307/2018): fonti nel diario C4. Aula 7,5h/giorno ×
--    ~2,6 gg + self-paced ≈ 25-45 h/anno
--  · certificazioni: rinnovo = NUOVA riga (NK tenant,user,name,issuer,issued);
--    27 IVASS + 24 EFPA + 1 altra SCADUTE mai rinnovate → catene di rinnovo
--    annuale fino a coprire il presente
--  · assignments senza UNIQUE → idempotenza via anti-join (user, initiative)
--
-- Idempotente: id uuid_generate_v5 su STORIA36::C4::*; twice-run → 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns   constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_to   constant date := DATE '2026-07-26';
  v_hr   uuid;
  v_n    bigint := 0;
  v_tot  bigint := 0;
BEGIN
  -- facilitator delle iniziative: HRMS/tenant admin reale
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users WHERE user_email = 'federica.marchetti@rtl-bank.org';

  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email, e.user_employment_hire_date AS hire
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  -- i 15 moduli del catalogo bancario, numerati
  CREATE TEMP TABLE _cat ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY learning_module_code) AS k,
         learning_module_id, learning_module_code, learning_module_name,
         COALESCE(learning_module_duration_minutes, 450) AS dur_min
  FROM sys.sys_learning_modules
  WHERE learning_module_code LIKE 'BANK-LM%';

  -- giorni TRAINING del C1 (fissi), per anno
  CREATE TEMP TABLE _tday ON COMMIT DROP AS
  SELECT a.attendance_subject_user_id AS user_id, a.attendance_date AS d,
         extract(year FROM a.attendance_date)::int AS y
  FROM sys.sys_attendance a
  WHERE a.attendance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND a.attendance_status = 'TRAINING';

  -- --------------------------------------------------------------------------
  -- 1. Iniziative: K per anno (2023: 3 · 2024/2025: 5 · 2026: 4 + 1 in corso),
  --    modulo dal catalogo BANK-LM a rotazione, periodo = i giorni TRAINING
  --    dell'anno, facilitator reale, cohort per anno
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_training_initiatives (
    training_initiative_id, training_initiative_tenant_id,
    training_initiative_module_id, training_initiative_code,
    training_initiative_cohort_name, training_initiative_start_date,
    training_initiative_end_date, training_initiative_facilitator_user_id,
    training_initiative_status, training_initiative_capacity,
    training_initiative_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C4::TI::' || y.y || '::' || k.k),
    c_rtl,
    (SELECT learning_module_id FROM _cat
      WHERE _cat.k = 1 + (pg_temp.h(y.y::text||k.k||'TIM') + k.k * 4) % 15),
    'STORIA36-TI-' || y.y || '-' || k.k,
    'Piano formativo ' || y.y,
    (SELECT min(d) FROM _tday WHERE _tday.y = y.y),
    CASE WHEN y.y = 2026 AND k.k = 4 THEN NULL
         ELSE (SELECT max(d) FROM _tday WHERE _tday.y = y.y) END,
    v_hr,
    CASE WHEN y.y = 2026 AND k.k = 4 THEN 'IN_PROGRESS' ELSE 'COMPLETED' END,
    60,
    jsonb_build_object('storia36', 'C4',
      'giustificazione', 'copertura requisiti/gap: modulo mappato in sys_skill_learning_mappings')
  FROM (VALUES (2023), (2024), (2025), (2026)) AS y(y)
  CROSS JOIN LATERAL generate_series(1, CASE y.y WHEN 2023 THEN 3 WHEN 2026 THEN 4 ELSE 5 END) AS k(k)
  WHERE EXISTS (SELECT 1 FROM _tday WHERE _tday.y = y.y)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: iniziative inserite %', v_n;

  -- mappa (giorno TRAINING) → iniziativa dell'anno
  CREATE TEMP TABLE _daymap ON COMMIT DROP AS
  SELECT t.user_id, t.d, t.y,
         'STORIA36-TI-' || t.y || '-' ||
           (1 + pg_temp.h(t.user_id::text||t.d||'TIA')
                % (CASE t.y WHEN 2023 THEN 3 WHEN 2026 THEN 4 ELSE 5 END)) AS ti_code
  FROM _tday t;

  -- --------------------------------------------------------------------------
  -- 2. Evidence d'AULA: una per ogni giorno TRAINING scoperto (quadratura),
  --    modulo = quello dell'iniziativa del giorno, punteggio 70-100
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_learning_evidence (
    user_learning_evidence_id, user_learning_evidence_user_id,
    user_learning_evidence_tenant_id, user_learning_evidence_module_id,
    user_learning_evidence_completed_at, user_learning_evidence_score,
    user_learning_evidence_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C4::EV::' || m.user_id || '::' || m.d),
    m.user_id, c_rtl,
    ti.training_initiative_module_id,
    m.d::timestamp + interval '17 hours'
      + ((pg_temp.h(m.user_id::text||m.d||'EM') % 45) || ' minutes')::interval,
    70 + pg_temp.h(m.user_id::text||m.d||'ES') % 31,
    jsonb_build_object('storia36', 'C4', 'initiative', m.ti_code, 'kind', 'AULA')
  FROM _daymap m
  JOIN sys.sys_training_initiatives ti ON ti.training_initiative_code = m.ti_code
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_learning_evidence e
    WHERE e.user_learning_evidence_user_id = m.user_id
      AND e.user_learning_evidence_completed_at::date = m.d)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: evidence aula inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 3. Assignments (utente × iniziativa frequentata), COMPLETED come l'import
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_learning_assignments (
    user_learning_assignment_id, user_learning_assignment_tenant_id,
    user_learning_assignment_user_id, user_learning_assignment_initiative_id,
    user_learning_assignment_module_id, user_learning_assignment_is_mandatory,
    user_learning_assignment_status, user_learning_assignment_assigned_by,
    user_learning_assignment_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C4::ULA::' || x.user_id || '::' || x.ti_code),
    c_rtl, x.user_id, ti.training_initiative_id, ti.training_initiative_module_id,
    true,
    CASE WHEN ti.training_initiative_status = 'IN_PROGRESS' THEN 'IN_PROGRESS' ELSE 'COMPLETED' END,
    v_hr,
    jsonb_build_object('storia36', 'C4')
  FROM (SELECT DISTINCT user_id, ti_code FROM _daymap) x
  JOIN sys.sys_training_initiatives ti ON ti.training_initiative_code = x.ti_code
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_learning_assignments a
    WHERE a.user_learning_assignment_user_id = x.user_id
      AND a.user_learning_assignment_initiative_id = ti.training_initiative_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: assignments inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 4. Self-paced negli anni scoperti (2023-08..2025-08 quasi vuoti): 2-3
  --    moduli/anno dal catalogo global mappato, in giorni lavorati non-assenti
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_learning_evidence (
    user_learning_evidence_id, user_learning_evidence_user_id,
    user_learning_evidence_tenant_id, user_learning_evidence_module_id,
    user_learning_evidence_completed_at, user_learning_evidence_score,
    user_learning_evidence_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C4::SP::' || s.user_id || '::' || y.y || '::' || n.n),
    s.user_id, c_rtl, cat.learning_module_id,
    dd.d::timestamp + interval '15 hours'
      + ((pg_temp.h(s.user_id::text||y.y||n.n||'SPM') % 120) || ' minutes')::interval,
    70 + pg_temp.h(s.user_id::text||y.y||n.n||'SPS') % 31,
    jsonb_build_object('storia36', 'C4', 'kind', 'SELF_PACED')
  FROM _scope s
  CROSS JOIN (VALUES (2023), (2024), (2025)) AS y(y)
  CROSS JOIN LATERAL generate_series(1, 2 + pg_temp.h(s.user_id::text||y.y||'SPN') % 2) AS n(n)
  JOIN _cat cat ON cat.k = 1 + (pg_temp.h(s.user_id::text||y.y||n.n||'SPC') + n.n * 7) % 15
  CROSS JOIN LATERAL (
    SELECT max(c.cal_date) AS d
    FROM staging.storia36_calendar c
    WHERE c.is_workday
      AND c.cal_date >= GREATEST(s.hire + 30, make_date(y.y, 1, 1))
      AND c.cal_date <= LEAST(make_date(y.y, 12, 20), c_to)
      AND c.cal_date <= make_date(y.y, 1 + pg_temp.h(s.user_id::text||y.y||n.n||'SPD') % 12, 1) + 27
      AND EXISTS (SELECT 1 FROM sys.sys_attendance a
                  WHERE a.attendance_subject_user_id = s.user_id
                    AND a.attendance_date = c.cal_date
                    AND a.attendance_status IN ('PRESENT','REMOTE'))
  ) dd
  WHERE dd.d IS NOT NULL
    AND (y.y > 2023 OR dd.d >= DATE '2023-08-01')
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_learning_evidence e
      WHERE e.user_learning_evidence_user_id = s.user_id
        AND e.user_learning_evidence_module_id = cat.learning_module_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: evidence self-paced inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 5. Rinnovi delle certificazioni obbligatorie scadute (IVASS/EFPA/altre):
  --    catena di rinnovi ANNUALI (nuove righe) fino a coprire il presente
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_certifications (
    user_certification_id, user_certification_user_id, user_certification_tenant_id,
    user_certification_name, user_certification_issuer,
    user_certification_issued_date, user_certification_expires_date,
    user_certification_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C4::CERT::' || c0.user_certification_id || '::' || g.n),
    c0.user_certification_user_id, c0.user_certification_tenant_id,
    c0.user_certification_name, c0.user_certification_issuer,
    iss.d,
    (iss.d + interval '1 year')::date + (pg_temp.h(c0.user_certification_id::text||g.n||'CE') % 25),
    jsonb_build_object('storia36', 'C4', 'renewal_of', c0.user_certification_id, 'renewal_n', g.n)
  FROM sys.sys_user_certifications c0
  JOIN _scope s ON s.user_id = c0.user_certification_user_id
  CROSS JOIN generate_series(1, 3) AS g(n)
  CROSS JOIN LATERAL (
    SELECT ((c0.user_certification_expires_date + ((g.n - 1) || ' years')::interval)::date
            - (pg_temp.h(c0.user_certification_id::text||g.n||'CI') % 20)) AS d
  ) iss
  WHERE c0.user_certification_tenant_id = c_rtl
    AND c0.user_certification_expires_date < c_to             -- scaduta oggi
    AND c0.user_certification_metadata->>'storia36' IS NULL   -- solo capostipiti legacy
    AND iss.d <= c_to                                         -- rinnovo già avvenuto
    AND iss.d >= s.hire
    -- catena: il rinnovo n serve solo se il precedente scade prima del presente
    AND (c0.user_certification_expires_date + ((g.n - 1) || ' years')::interval)::date <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C4: rinnovi certificazioni inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 6. Registro + post-condizioni (batteria C4)
  -- --------------------------------------------------------------------------
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C4', '04_learning.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c4a();
  PERFORM staging.storia36_check_c4b();
  PERFORM staging.storia36_check_c4c();
  PERFORM staging.storia36_check_c4d();
  PERFORM staging.storia36_check_c4e();

  RAISE NOTICE 'storia36 C4 OK: % righe scritte in questa corsa (delta atteso 0 alla seconda)', v_tot;
END $$;

COMMIT;
