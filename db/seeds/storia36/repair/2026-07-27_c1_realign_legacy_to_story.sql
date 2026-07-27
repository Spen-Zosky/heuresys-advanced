-- ============================================================================
-- storia36 C1 — one-shot: riallinea le righe attendance LEGACY ai giorni di
-- richieste time-off APPROVED (triage esito c: due record dello stesso sistema
-- si contraddicono — riga PRESENT su un giorno di ferie/malattia approvate;
-- vince la richiesta, che ha un approver).
-- Tocca SOLO righe non-STORIA36 (le righe del seed nascono già coerenti).
-- FUORI dal glob custodia (repair/ = one-shot manuali). Idempotente.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint := 0;
BEGIN
  UPDATE sys.sys_attendance a
     SET attendance_status = m.want,
         attendance_hours_regular = 0, attendance_hours_overtime = 0,
         attendance_clock_in = NULL, attendance_clock_out = NULL,
         attendance_break_start = NULL, attendance_break_end = NULL,
         updated_at = now()
  FROM (
    SELECT r.request_subject_user_id AS uid, gd.d::date AS d,
           CASE r.request_leave_type
             WHEN 'VACATION' THEN 'VACATION'
             WHEN 'SICK' THEN 'SICK'
             WHEN 'UNPAID' THEN 'UNPAID_LEAVE'
             ELSE 'PAID_LEAVE' END AS want
    FROM sys.sys_time_off_requests r
    CROSS JOIN LATERAL generate_series(r.request_start_date, r.request_end_date, interval '1 day') AS gd(d)
    WHERE r.request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND r.request_status = 'APPROVED'
  ) m
  WHERE a.attendance_subject_user_id = m.uid
    AND a.attendance_date = m.d
    AND a.attendance_natural_key NOT LIKE 'STORIA36::C1::%'
    AND a.attendance_status IS DISTINCT FROM m.want;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C1', 'repair/2026-07-27_c1_realign_legacy_to_story.sql', v_n, v_n);

  RAISE NOTICE 'storia36 C1 realign legacy→storia OK: % righe riallineate in questa corsa', v_n;
END $$;

COMMIT;
