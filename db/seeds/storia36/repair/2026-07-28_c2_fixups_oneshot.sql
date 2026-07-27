-- ============================================================================
-- storia36 C2 — fixups ONE-SHOT dalla review adversarial 3-lenti (2026-07-28).
-- FUORI dal glob custodia. Guardati e idempotenti (twice-run → 0).
--  F1 cross-tenant I5 (precedente C1): DELETE 2 review + 6 goal (con 13 update
--     + 7 comment figli) con subject HEURESYS dentro il tenant RTL
--  F2 1.000 check-in legacy datati DOPO la due del goal (ciclo degenere) →
--     ricollocati dentro [start, due] su workday in cui il soggetto non è assente
--  F3 155 review legacy con submitted/acknowledged a mezzanotte flat → orario
--     lavorativo deterministico (pattern C1-R2)
--  F4 goal legacy con completed_at in giorno non lavorativo (41 da P2) → snap
--  F5 4 review legacy COMPLETED senza competency ratings → 3 righe KSABA
--  F6 f360 legacy H2-2025 → agganciate alla review ANNUAL 2025 del target
--  F7 riallineamento finale: goal non terminali → progress = ultimo check-in
--     (da eseguire DOPO il reseed C2)
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns  constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  v_n   bigint := 0;
  v_tot bigint := 0;
  v_bad bigint;
BEGIN
  -- F1: cross-tenant (subject HEURESYS in tenant RTL) — DELETE, come il C1
  CREATE TEMP TABLE _xg ON COMMIT DROP AS
  SELECT g.goal_id FROM sys.sys_goals g
  JOIN sys.sys_users u ON u.user_id = g.goal_subject_user_id
  WHERE g.goal_tenant_id = c_rtl AND u.user_tenant_id <> c_rtl;

  DELETE FROM sys.sys_goal_updates WHERE update_goal_id IN (SELECT goal_id FROM _xg);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  DELETE FROM sys.sys_goal_comments WHERE comment_goal_id IN (SELECT goal_id FROM _xg);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  DELETE FROM sys.sys_goals WHERE goal_id IN (SELECT goal_id FROM _xg);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  DELETE FROM sys.sys_performance_reviews r
   USING sys.sys_users u
   WHERE u.user_id = r.review_subject_user_id
     AND r.review_tenant_id = c_rtl AND u.user_tenant_id <> c_rtl;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F1 cross-tenant eliminati (goal+figli+review): % righe cumulative', v_tot;

  -- F2: check-in legacy fuori dal periodo del goal → dentro [start, due],
  --     workday, soggetto non assente
  UPDATE sys.sys_goal_check_ins c
     SET check_in_date = f.d
  FROM (
    SELECT c2.check_in_id,
           (SELECT max(cal.cal_date) FROM staging.storia36_calendar cal
             WHERE cal.is_workday
               AND cal.cal_date <= g.goal_start_date
                     + ((COALESCE(g.goal_due_date, g.goal_start_date + 90) - g.goal_start_date)
                        * (10 + pg_temp.h(c2.check_in_id::text||'RD') % 80) / 100)
               AND cal.cal_date >= g.goal_start_date
               AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a
                               WHERE a.attendance_subject_user_id = c2.check_in_subject_user_id
                                 AND a.attendance_date = cal.cal_date
                                 AND a.attendance_status IN ('VACATION','SICK','PAID_LEAVE','UNPAID_LEAVE','ABSENT'))
           ) AS d
    FROM sys.sys_goal_check_ins c2
    JOIN sys.sys_goals g ON g.goal_id = c2.check_in_goal_id
    WHERE c2.check_in_natural_key NOT LIKE 'STORIA36%'
      AND g.goal_due_date IS NOT NULL
      AND c2.check_in_date > g.goal_due_date
  ) f
  WHERE f.check_in_id = c.check_in_id AND f.d IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F2 check-in legacy ricollocati nel periodo del goal: %', v_n;

  -- F3: review legacy a mezzanotte flat → orario lavorativo
  UPDATE sys.sys_performance_reviews r
     SET review_submitted_at = r.review_submitted_at
           + ((9 + pg_temp.h(r.review_id::text||'SH') % 5) || ' hours')::interval
           + ((pg_temp.h(r.review_id::text||'SM') % 60) || ' minutes')::interval,
         review_acknowledged_at = CASE
           WHEN r.review_acknowledged_at IS NULL THEN NULL
           WHEN r.review_acknowledged_at::date = r.review_submitted_at::date
             THEN r.review_acknowledged_at
                  + ((11 + pg_temp.h(r.review_id::text||'AH') % 5) || ' hours')::interval
                  + ((pg_temp.h(r.review_id::text||'AM') % 60) || ' minutes')::interval
           ELSE r.review_acknowledged_at
                + ((9 + pg_temp.h(r.review_id::text||'AH') % 8) || ' hours')::interval
                + ((pg_temp.h(r.review_id::text||'AM') % 60) || ' minutes')::interval
         END,
         updated_at = now()
   WHERE r.review_natural_key NOT LIKE 'STORIA36%'
     AND r.review_submitted_at IS NOT NULL
     AND r.review_submitted_at::time = TIME '00:00:00';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F3 review legacy: timestamp a orario lavorativo: %', v_n;

  -- F4: completed_at legacy in giorno non lavorativo → snap al workday precedente
  UPDATE sys.sys_goals g
     SET goal_completed_at = f.ts, updated_at = now()
  FROM (
    SELECT g2.goal_id,
           (SELECT max(cal_date) FROM staging.storia36_calendar
             WHERE is_workday AND cal_date <= g2.goal_completed_at::date
               AND cal_date >= g2.goal_start_date)::timestamp
             + (g2.goal_completed_at::time)::interval AS ts
    FROM sys.sys_goals g2
    JOIN staging.storia36_calendar c ON c.cal_date = g2.goal_completed_at::date
    WHERE g2.goal_natural_key NOT LIKE 'STORIA36%'
      AND g2.goal_completed_at IS NOT NULL
      AND NOT c.is_workday
  ) f
  WHERE f.goal_id = g.goal_id AND f.ts IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F4 completed_at legacy snappati a workday: %', v_n;

  -- F5: review legacy COMPLETED senza competency ratings → 3 righe KSABA
  INSERT INTO sys.sys_performance_review_competency_ratings (
    rating_id, rating_tenant_id, rating_review_id, rating_subject_user_id,
    rating_natural_key, rating_ksaba_dimension, rating_competency_name,
    rating_self_rating, rating_manager_rating, rating_weight)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C2::COMPFIX::' || pr.review_id || '::' || d.dim),
    pr.review_tenant_id, pr.review_id, pr.review_subject_user_id,
    'STORIA36::C2::COMPFIX::' || pr.review_id || '::' || d.dim,
    d.dim, d.cname,
    round(LEAST(5.00, GREATEST(1.00,
      COALESCE(pr.review_competency_rating, pr.review_overall_rating, 3.4)
      + (pg_temp.h(pr.review_id::text||d.dim||'SR') % 9 - 3) / 10.0))::numeric, 2),
    round(LEAST(5.00, GREATEST(1.00,
      COALESCE(pr.review_competency_rating, pr.review_overall_rating, 3.4)
      + (pg_temp.h(pr.review_id::text||d.dim||'MR') % 7 - 3) / 10.0))::numeric, 2),
    d.w
  FROM sys.sys_performance_reviews pr
  JOIN (VALUES
    ('KNOWLEDGE', 'Domain Knowledge',     1.20),
    ('SKILL',     'Technical Execution',  1.00),
    ('BEHAVIOR',  'Professional Conduct', 0.80)
  ) AS d(dim, cname, w) ON true
  WHERE pr.review_status = 'COMPLETED'
    AND pr.review_subject_user_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sys.sys_performance_review_competency_ratings cr
                    WHERE cr.rating_review_id = pr.review_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F5 competency ratings per review legacy scoperte: %', v_n;

  -- F6: f360 legacy H2-2025 → aggancio alla review ANNUAL 2025 del target
  UPDATE sys.sys_feedback_360_responses f
     SET response_review_id = pr.review_id
  FROM sys.sys_performance_reviews pr
  WHERE f.response_natural_key NOT LIKE 'STORIA36%'
    AND f.response_review_id IS NULL
    AND pr.review_subject_user_id = f.response_target_user_id
    AND pr.review_type = 'ANNUAL'
    AND extract(year FROM pr.review_period_end)::int = 2025;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F6 f360 legacy agganciate alla ANNUAL 2025: %', v_n;

  -- F7: riallineamento finale progress = ultimo check-in (goal non terminali)
  UPDATE sys.sys_goals g
     SET goal_progress_percent = f.want, updated_at = now()
  FROM (
    SELECT DISTINCT ON (c.check_in_goal_id)
           c.check_in_goal_id AS goal_id, c.check_in_new_progress AS want
    FROM sys.sys_goal_check_ins c
    ORDER BY c.check_in_goal_id, c.check_in_date DESC, c.created_at DESC
  ) f
  WHERE f.goal_id = g.goal_id
    AND g.goal_status NOT IN ('COMPLETED','CANCELLED')
    AND g.goal_progress_percent IS DISTINCT FROM f.want;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F7 progress riallineato all''ultimo check-in: %', v_n;

  -- F8: f360 legacy completate in giorni non lavorativi (125/390, vizio
  --     d'import) → snap al workday precedente + orario lavorativo se midnight
  UPDATE sys.sys_feedback_360_responses f
     SET response_completed_at =
           (SELECT max(cal_date) FROM staging.storia36_calendar
             WHERE is_workday AND cal_date <= f.response_completed_at::date)::timestamp
           + CASE WHEN f.response_completed_at::time = TIME '00:00:00'
                  THEN ((9 + pg_temp.h(f.response_id::text||'FH') % 8) || ' hours')::interval
                       + ((pg_temp.h(f.response_id::text||'FM') % 60) || ' minutes')::interval
                  ELSE (f.response_completed_at::time)::interval END
   WHERE f.response_natural_key NOT LIKE 'STORIA36%'
     AND f.response_completed_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM staging.storia36_calendar c
                 WHERE c.cal_date = f.response_completed_at::date AND NOT c.is_workday);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F8 f360 legacy snappate a workday: %', v_n;

  -- F8b: anche le f360 legacy in workday ma a mezzanotte flat → orario lavorativo
  UPDATE sys.sys_feedback_360_responses f
     SET response_completed_at = f.response_completed_at
           + ((9 + pg_temp.h(f.response_id::text||'FH') % 8) || ' hours')::interval
           + ((pg_temp.h(f.response_id::text||'FM') % 60) || ' minutes')::interval
   WHERE f.response_natural_key NOT LIKE 'STORIA36%'
     AND f.response_completed_at IS NOT NULL
     AND f.response_completed_at::time = TIME '00:00:00';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'F8b f360 legacy midnight → orario lavorativo: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C2', 'repair/2026-07-28_c2_fixups_oneshot.sql', v_tot, v_tot);

  -- Post-condizioni
  SELECT count(*) INTO v_bad FROM sys.sys_performance_reviews r
  JOIN sys.sys_users u ON u.user_id = r.review_subject_user_id
  WHERE r.review_tenant_id = c_rtl AND u.user_tenant_id <> c_rtl;
  IF v_bad > 0 THEN RAISE EXCEPTION 'F1 incompleto: % review cross-tenant', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_goal_check_ins c
  JOIN sys.sys_goals g ON g.goal_id = c.check_in_goal_id
  WHERE g.goal_due_date IS NOT NULL AND c.check_in_date > g.goal_due_date
    AND c.check_in_natural_key NOT LIKE 'STORIA36%';
  IF v_bad > 0 THEN RAISE EXCEPTION 'F2 incompleto: % check-in legacy oltre la due', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_performance_reviews
  WHERE review_submitted_at IS NOT NULL AND review_submitted_at::time = TIME '00:00:00';
  IF v_bad > 0 THEN RAISE EXCEPTION 'F3 incompleto: % review a mezzanotte', v_bad; END IF;

  RAISE NOTICE 'storia36 C2 fixups OK: % righe toccate in questa corsa', v_tot;
END $$;

COMMIT;
