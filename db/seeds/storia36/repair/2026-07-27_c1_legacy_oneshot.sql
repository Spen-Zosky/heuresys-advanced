-- ============================================================================
-- storia36 C1 — riparazioni ONE-SHOT sul dato LEGACY (triage esito c della
-- review adversarial 3-lenti del 2026-07-27, vedi .storia36/PROGRESS.md).
--
-- ⚠ Questa directory repair/ è FUORI dal glob di `storia36.sh` (run_seeds
-- esegue solo db/seeds/storia36/*.sql): i one-shot si lanciano A MANO al
-- cluster che li decide, MAI in custodia --repair-missing (principio: mai
-- riparazione automatica di righe organiche/modificate).
--
-- Contenuto (tutte le riparazioni sono guardate e idempotenti, twice-run → 0):
--  R1 envelope legacy 9h → 7,5h CCNL (37,5h/sett) sulle righe lavorate;
--     ABSENT legacy con 9h → 0h/clock NULL
--  R2 26 richieste legacy con approved_at < created_at → created_at storico
--  R3 balances legacy: 2026 VACATION flat-28 → scala CCNL (23/25/28 aree,
--     29 QD art.58 26+3, 30 Dirigente conv.); 2025 legacy (5 utenti):
--     VACATION 22→scala, SICK 8→180 (comporto conv.), PERSONAL 3→4
--  R4 18 righe attendance cross-tenant (andrea.spenuso HEURESYS su tenant RTL,
--     violazione I5) → DELETE
--  R5 sys_overtime: retype WEEKDAY/WEEKEND/HOLIDAY dal calendario reale
--     (NIGHT invariato)
--  R6 accrual rules: 4 copie identiche attive per tipo → resta la più vecchia,
--     soft-delete delle altre; ccnl_type → 'CCNL Credito 2024'
--  R7 43 richieste legacy con days_requested ≠ workday coperti → allineate
--     alla semantica workday (quella adottata da C1)
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_n   bigint := 0;
  v_tot bigint := 0;
  v_bad bigint;
BEGIN
  -- R1a: righe lavorate legacy a 9h → envelope CCNL 7,5h (clock_out esteso dell'ot)
  UPDATE sys.sys_attendance
     SET attendance_hours_regular = 7.5,
         attendance_clock_in = TIME '09:00',
         attendance_clock_out = TIME '17:30' + (attendance_hours_overtime || ' hours')::interval,
         attendance_break_start = TIME '13:00',
         attendance_break_end = TIME '14:00',
         updated_at = now()
   WHERE attendance_natural_key NOT LIKE 'STORIA36%'
     AND attendance_hours_regular = 9.00
     AND attendance_status IN ('PRESENT','REMOTE','TRAINING');
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R1a envelope legacy lavorate 9h→7,5h: %', v_n;

  -- R1b: ABSENT legacy con ore valorizzate → 0h, clock NULL
  UPDATE sys.sys_attendance
     SET attendance_hours_regular = 0, attendance_hours_overtime = 0,
         attendance_clock_in = NULL, attendance_clock_out = NULL,
         attendance_break_start = NULL, attendance_break_end = NULL,
         updated_at = now()
   WHERE attendance_natural_key NOT LIKE 'STORIA36%'
     AND attendance_status IN ('ABSENT','VACATION','SICK','PAID_LEAVE','UNPAID_LEAVE','HOLIDAY')
     AND (attendance_hours_regular > 0 OR attendance_clock_in IS NOT NULL);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R1b assenze legacy con ore → 0h: %', v_n;

  -- R2: richieste legacy approvate PRIMA di essere create → created_at storico
  UPDATE sys.sys_time_off_requests r
     SET created_at = r.request_approved_at
                      - ((2 + pg_temp.h(r.request_id::text||'RC') % 3) || ' days')::interval
                      + ((9 + pg_temp.h(r.request_id::text||'RH') % 8) || ' hours')::interval
                      + ((pg_temp.h(r.request_id::text||'RM') % 60) || ' minutes')::interval,
         updated_at = r.request_approved_at
   WHERE r.request_natural_key NOT LIKE 'STORIA36%'
     AND r.request_approved_at IS NOT NULL
     AND r.request_approved_at <= r.created_at;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R2 created_at storico su richieste legacy: %', v_n;

  -- R3a: balances VACATION legacy (2025-2026) → scala CCNL per inquadramento/anzianità
  UPDATE sys.sys_time_off_balances b
     SET balance_total_days = f.tot, balance_accrued_days = f.tot, updated_at = now()
  FROM (
    SELECT b2.balance_id,
           CASE WHEN c.user_contract_ccnl_level LIKE 'QD%' THEN 29
                WHEN c.user_contract_ccnl_level = 'Dirigente' THEN 30
                WHEN b2.balance_year - extract(year FROM e.user_employment_hire_date) >= 10 THEN 28
                WHEN b2.balance_year - extract(year FROM e.user_employment_hire_date) >= 5  THEN 25
                ELSE 23 END AS tot
    FROM sys.sys_time_off_balances b2
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = b2.balance_subject_user_id
    LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = b2.balance_subject_user_id
    WHERE b2.balance_natural_key NOT LIKE 'STORIA36%'
      AND b2.balance_leave_type = 'VACATION'
      AND b2.balance_year IN (2025, 2026)
  ) f
  WHERE f.balance_id = b.balance_id
    AND b.balance_total_days IS DISTINCT FROM f.tot;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R3a balances VACATION legacy → scala CCNL: %', v_n;

  -- R3b: balances SICK/PERSONAL legacy fuori convenzione (SICK 180 comporto, PERSONAL 4)
  UPDATE sys.sys_time_off_balances
     SET balance_total_days = CASE balance_leave_type WHEN 'SICK' THEN 180 ELSE 4 END,
         balance_accrued_days = CASE balance_leave_type WHEN 'SICK' THEN 180 ELSE 4 END,
         updated_at = now()
   WHERE balance_natural_key NOT LIKE 'STORIA36%'
     AND balance_leave_type IN ('SICK','PERSONAL')
     AND balance_total_days IS DISTINCT FROM
         CASE balance_leave_type WHEN 'SICK' THEN 180 ELSE 4 END;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R3b balances SICK/PERSONAL legacy → convenzione: %', v_n;

  -- R4: righe attendance con tenant ≠ tenant dell'utente (violazione I5) → DELETE
  DELETE FROM sys.sys_attendance a
   USING sys.sys_users u
   WHERE u.user_id = a.attendance_subject_user_id
     AND a.attendance_tenant_id IS DISTINCT FROM u.user_tenant_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R4 righe attendance cross-tenant eliminate: %', v_n;

  -- R5: sys_overtime retype dal calendario reale (NIGHT invariato)
  UPDATE sys.sys_overtime o
     SET overtime_type = t.want, updated_at = now()
  FROM (
    SELECT o2.overtime_id,
           CASE WHEN c.holiday_name IS NOT NULL THEN 'HOLIDAY'
                WHEN extract(isodow FROM o2.overtime_date) IN (6,7) THEN 'WEEKEND'
                ELSE 'WEEKDAY' END AS want
    FROM sys.sys_overtime o2
    LEFT JOIN staging.storia36_calendar c ON c.cal_date = o2.overtime_date
    WHERE o2.overtime_type <> 'NIGHT'
  ) t
  WHERE t.overtime_id = o.overtime_id
    AND o.overtime_type IS DISTINCT FROM t.want;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R5 sys_overtime retype dal calendario: %', v_n;

  -- R6a: accrual rules — resta la copia più vecchia per (tenant, tipo), soft-delete le altre
  UPDATE sys.sys_leave_accrual_rules r
     SET accrual_rule_deleted_at = now(), accrual_rule_is_active = false, updated_at = now()
   WHERE r.accrual_rule_deleted_at IS NULL
     AND r.accrual_rule_id NOT IN (
       SELECT DISTINCT ON (accrual_rule_tenant_id, accrual_rule_leave_type) accrual_rule_id
       FROM sys.sys_leave_accrual_rules
       WHERE accrual_rule_deleted_at IS NULL
       ORDER BY accrual_rule_tenant_id, accrual_rule_leave_type, created_at, accrual_rule_id);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R6a accrual rules duplicate soft-deleted: %', v_n;

  -- R6b: etichetta CCNL corretta sulle regole attive (la banca è CCNL Credito)
  UPDATE sys.sys_leave_accrual_rules
     SET accrual_rule_ccnl_type = 'CCNL Credito 2024', updated_at = now()
   WHERE accrual_rule_deleted_at IS NULL
     AND accrual_rule_ccnl_type IS DISTINCT FROM 'CCNL Credito 2024';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R6b accrual rules → CCNL Credito 2024: %', v_n;

  -- R7: days_requested legacy ≠ workday coperti → semantica workday (adottata da C1)
  UPDATE sys.sys_time_off_requests r
     SET request_days_requested = w.wd, updated_at = now()
  FROM (
    SELECT r2.request_id,
           (SELECT count(*)::numeric FROM staging.storia36_calendar c
             WHERE c.cal_date BETWEEN r2.request_start_date AND r2.request_end_date
               AND c.is_workday) AS wd
    FROM sys.sys_time_off_requests r2
    WHERE r2.request_natural_key NOT LIKE 'STORIA36%'
  ) w
  WHERE w.request_id = r.request_id
    AND w.wd > 0
    AND r.request_days_requested IS DISTINCT FROM w.wd;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R7 days_requested legacy → workday: %', v_n;

  -- R8: richieste legacy APPROVED su giorni NON lavorativi (permessi di sabato/
  --     festivi — nonsenso operativo) → spostate al workday precedente
  UPDATE sys.sys_time_off_requests r
     SET request_start_date = w.d, request_end_date = w.d, updated_at = now()
  FROM (
    SELECT r2.request_id,
           (SELECT max(cal_date) FROM staging.storia36_calendar c
             WHERE c.is_workday AND c.cal_date < r2.request_start_date) AS d
    FROM sys.sys_time_off_requests r2
    WHERE r2.request_natural_key NOT LIKE 'STORIA36%'
      AND r2.request_status = 'APPROVED'
      AND r2.request_start_date = r2.request_end_date
      AND NOT EXISTS (SELECT 1 FROM staging.storia36_calendar c
                      WHERE c.cal_date = r2.request_start_date AND c.is_workday)
  ) w
  WHERE w.request_id = r.request_id AND w.d IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'R8 richieste legacy su giorni non lavorativi → workday precedente: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C1', 'repair/2026-07-27_c1_legacy_oneshot.sql', v_tot, v_tot);

  -- Post-condizioni fail-loud
  SELECT count(*) INTO v_bad FROM sys.sys_attendance
   WHERE attendance_natural_key NOT LIKE 'STORIA36%' AND attendance_hours_regular = 9.00
     AND attendance_status IN ('PRESENT','REMOTE','TRAINING');
  IF v_bad > 0 THEN RAISE EXCEPTION 'R1 incompleto: % righe legacy ancora a 9h', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_time_off_requests
   WHERE request_approved_at IS NOT NULL AND request_approved_at <= created_at
     AND request_natural_key NOT LIKE 'STORIA36%';
  IF v_bad > 0 THEN RAISE EXCEPTION 'R2 incompleto: % richieste legacy approved<created', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_attendance a
   JOIN sys.sys_users u ON u.user_id = a.attendance_subject_user_id
   WHERE a.attendance_tenant_id IS DISTINCT FROM u.user_tenant_id;
  IF v_bad > 0 THEN RAISE EXCEPTION 'R4 incompleto: % righe cross-tenant', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_leave_accrual_rules
   WHERE accrual_rule_deleted_at IS NULL
   GROUP BY accrual_rule_tenant_id, accrual_rule_leave_type
   HAVING count(*) > 1 LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'R6 incompleto: accrual rules ancora duplicate'; END IF;

  RAISE NOTICE 'storia36 C1 legacy one-shot OK: % righe toccate in questa corsa', v_tot;
END $$;

COMMIT;
