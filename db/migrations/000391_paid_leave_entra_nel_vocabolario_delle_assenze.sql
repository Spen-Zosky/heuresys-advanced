-- 000391 — B9: PAID_LEAVE entra nel vocabolario delle richieste di assenza.
--
-- IL FATTO (misurato 2026-09-09): 1.335 giorni di assenza retribuita in sys.sys_attendance
-- (attendance_status = 'PAID_LEAVE') non hanno una richiesta corrispondente in
-- sys.sys_time_off_requests; per 869 di essi il tipo PAID_LEAVE non e' nemmeno fra i valori
-- che quella tabella accetta (sys_tor_leave_type_check, 10 valori, mig. 000040). Non e' che
-- manchi la richiesta: e' che non si sarebbe potuta scrivere.
--
-- QUESTO FILE allarga il vocabolario. Non backfilla i 1.335 giorni: quella e' una voce a
-- se', fuori da questo ciclo (nessuna guardia/post-condizione per un backfill di richieste
-- storiche era stata decomposta nel mandato).

\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE sys.sys_time_off_requests DROP CONSTRAINT sys_tor_leave_type_check;
ALTER TABLE sys.sys_time_off_requests
  ADD CONSTRAINT sys_tor_leave_type_check
  CHECK (request_leave_type::text = ANY (ARRAY[
    'VACATION','SICK','PERSONAL','MATERNITY','PATERNITY',
    'BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER',
    'PAID_LEAVE'
  ]::text[]));

COMMIT;
