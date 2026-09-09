-- 000392 — correzione a B3 (mig. 000387): v_straordinari_non_autorizzati guardava la
-- colonna sbagliata.
--
-- IL FATTO (scoperto scrivendo B9, 2026-09-09, stessa sessione): la vista usava
-- `max(overtime_requested_at)` per stabilire da quando il processo di richiesta e' fermo.
-- Ma `overtime_requested_at` e' QUANDO la richiesta e' stata sottomessa, non il giorno di
-- lavoro a cui si riferisce — e differisce da `overtime_date` (misurato: l'ultima richiesta
-- approvata ha requested_at=2025-12-10, ma overtime_date=2025-12-12, la data che il bundle
-- cita testualmente: "l'ultimo straordinario autorizzato e' del 12/12/2025"). Usare la
-- colonna sbagliata restringeva la finestra di due giorni e sottostimava la sanatoria di
-- B9 di 22 righe / 23,50 ore (2458 invece di 2436 / 2434,50 — la prova generale della
-- sanatoria l'ha scoperto: la guardia ha rifiutato di scrivere finche' i due numeri non
-- coincidevano).
--
-- Nessun cambiamento di comportamento oltre alla correzione della finestra: la logica
-- (processo fermo => presenze successive non autorizzate) resta la stessa.

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE VIEW sys.v_straordinari_non_autorizzati AS
  WITH ultima_richiesta AS (
    SELECT coalesce(max(overtime_date), '1900-01-01'::date) AS ultima
      FROM sys.sys_overtime
  )
  SELECT
    a.attendance_tenant_id       AS tenant_id,
    a.attendance_subject_user_id AS persona_id,
    count(*)                     AS giorni_non_autorizzati,
    sum(a.attendance_hours_overtime) AS ore_non_autorizzate,
    min(a.attendance_date)       AS dal,
    max(a.attendance_date)       AS al
  FROM sys.sys_attendance a
  CROSS JOIN ultima_richiesta u
  WHERE a.attendance_hours_overtime > 0
    AND a.attendance_date > u.ultima
  GROUP BY 1, 2;

COMMENT ON VIEW sys.v_straordinari_non_autorizzati IS
  'SENTINELLA (B3, 2026-09-09; corretta mig. 000392). Ore di straordinario registrate in '
  'sys_attendance DOPO che il processo di richiesta sys_overtime si e'' fermato (nessuna '
  'richiesta, di qualunque stato, con OVERTIME_DATE oltre quella soglia — non '
  'requested_at, che e'' quando la richiesta e'' stata scritta, non il giorno di lavoro cui '
  'si riferisce). Non zero righe attese per disegno: e'' la fotografia di un processo di '
  'business, non un vincolo strutturale. Sanate da B9 dello stesso ciclo; se il processo si '
  'ferma di nuovo, la vista torna a vedere.';

COMMIT;
