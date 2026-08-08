-- ============================================================================
-- storia36 C1 — presenze, assenze, ferie su 36 mesi (2023-08-01 → 2026-07-26)
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C1)
-- Design: .storia36/PROGRESS.md (diario C1) — v2 dopo la review adversarial
-- 3-lenti del 2026-07-27 (le riparazioni sul dato legacy vivono in repair/,
-- FUORI dal glob custodia; questo seed è ADDITIVO e ri-eseguibile).
--
-- Scope: utenti RTL ACTIVE. I 2 never-badger QD3 (giuseppe.ferri,
-- maria.colombo) ricevono SOLO righe di assenza (ferie/malattia): la
-- convenzione «niente badge quotidiano» resta, il diritto alle ferie no.
--
-- Generatori (deterministici via pg_temp.h, id/chiavi uuid_generate_v5):
--  · estate a 5 turni scaglionati (mai >60% dell'organico in ferie insieme)
--    + coda luglio/settembre per 1 utente su 5 + luglio 2026 per 1 su 4
--  · natale 22-31/12 per metà utenti · ponte pre-1° maggio per 1 su 3
--  · settimana corta sparsa (giu/set/ott/nov) per metà utenti
--  · malattia: episodio invernale gen-feb + autunnale ott-nov + brevi 1-2 gg
--    tutto l'anno + coda lunga 15 gg (1 su 17) — media ~6-7 gg/anno
--    (INPS privato 8,6; impiegatizio bancario sotto media)
--  · PERSONAL max 3 gg/anno (cap: entitlement 4) · TRAINING ~2-3 gg/anno
--  · REMOTE ~10% (convenzione esistente; differenziazione per famiglia di
--    posizione registrata per C6)
--  · straordinari: SOLO non-esenti (F6 S1028); dove sys_overtime registra ore
--    per (utente,giorno), l'attendance le EREDITA (mai contraddirle)
--  · richieste time-off per OGNI episodio VACATION ≥2 workday e SICK ≥1
--    (certificato: in banca ogni malattia è protocollata), con created_at/
--    updated_at/approved_at STORICI e deterministici a orario lavorativo
--    (mai stati che la macchina reale non produrrebbe); approver = manager
--    reale via reports_to, fallback admin@heuresys.com (mai self-approval)
--  · entitlement ferie CCNL Credito art. 58: aree professionali 20/22/25
--    (+3 ex-festività → 23/25/28), QD 26+3=29, Dirigente 30 (convenzione,
--    fonte da consolidare in C3); pro-rata nell'anno di assunzione
--
-- Idempotente: twice-run → delta 0 registrato in staging.storia36_runs.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

-- hash deterministico per i PICK pseudo-casuali (pattern S1028) — MAI per chiavi
CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns   constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_from constant date := DATE '2023-08-01';
  c_to   constant date := DATE '2026-07-26';
  v_admin uuid;
  v_n      bigint := 0;
  v_tot    bigint := 0;
  v_bad    bigint;
  v_share  numeric;
BEGIN
  -- L'attore di fallback NON si nomina: si DERIVA dal ruolo. Fino al 2026-08-08
  -- questa riga cercava `admin@heuresys.com`, l'account tecnico rimosso dalla
  -- migrazione 000295 (`#139`): con `INTO STRICT` su zero righe l'avanzamento
  -- moriva con «query returned no rows», ed e' la causa per cui la custodia
  -- settimanale falliva da giorni (`#153`). Stessa lezione degli attori dei
  -- test (S1033): si sceglie per CARATTERISTICA, mai per nome proprio.
  SELECT u.user_id INTO v_admin
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles ur
      ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
   ORDER BY u.user_email
   LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'storia36: nessun PLATFORM_ADMIN attivo da usare come approvatore di riserva — senza un attore non si puo'' approvare nulla';
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. Scope: utenti RTL attivi, inquadramento, esenzione, manager, no_badge
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id,
         u.user_email,
         e.user_employment_hire_date AS hire,
         c.user_contract_ccnl_level AS ccnl,
         (c.user_contract_ccnl_level LIKE 'QD%'
          OR c.user_contract_ccnl_level IN ('Dirigente','Quadro')) AS exempt,
         u.user_email IN ('giuseppe.ferri@rtl-bank.org','maria.colombo@rtl-bank.org') AS no_badge,
         mgr.mgr_user_id
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  LEFT JOIN LATERAL (
    SELECT a2.user_position_assignment_user_id AS mgr_user_id
    FROM sys.sys_user_position_assignments a1
    JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
    JOIN sys.sys_user_position_assignments a2
         ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
        AND a2.user_position_assignment_kind = 'PRIMARY'
        AND a2.user_position_assignment_status = 'ACTIVE'
    WHERE a1.user_position_assignment_user_id = u.user_id
      AND a1.user_position_assignment_kind = 'PRIMARY'
      AND a1.user_position_assignment_status = 'ACTIVE'
    LIMIT 1
  ) mgr ON true
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  -- --------------------------------------------------------------------------
  -- 2. Episodi di assenza (deterministici per utente/anno)
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _epi ON COMMIT DROP AS
  -- estate 2023-2025: 5 turni scaglionati (partenze ~1/7/13/19/25 agosto ± h%4),
  -- 12 giorni di calendario (~2 settimane)
  SELECT s.user_id,
         make_date(y.y, 8, 1)
           + (pg_temp.h(s.user_id::text||y.y||'WAVE') % 5) * 6
           + (pg_temp.h(s.user_id::text||y.y||'SUM') % 4) AS d_start,
         make_date(y.y, 8, 1)
           + (pg_temp.h(s.user_id::text||y.y||'WAVE') % 5) * 6
           + (pg_temp.h(s.user_id::text||y.y||'SUM') % 4) + 11 AS d_end,
         'VACATION'::text AS leave_type, 1 AS prio
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  UNION ALL
  -- coda estiva fuori agosto per 1 su 5: fine luglio o inizio settembre (4 gg)
  SELECT s.user_id,
         CASE WHEN pg_temp.h(s.user_id::text||y.y||'JS') % 2 = 0
              THEN make_date(y.y, 7, 22) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 4)
              ELSE make_date(y.y, 9, 2) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 5) END,
         CASE WHEN pg_temp.h(s.user_id::text||y.y||'JS') % 2 = 0
              THEN make_date(y.y, 7, 22) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 4) + 3
              ELSE make_date(y.y, 9, 2) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 5) + 3 END,
         'VACATION', 1
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'JSG') % 5 = 0
  UNION ALL
  -- luglio 2026 (estate parziale, storia al presente): 1 utente su 4
  SELECT s.user_id, DATE '2026-07-20', DATE '2026-07-24', 'VACATION', 1
  FROM _scope s WHERE pg_temp.h(s.user_id::text||'SUM2026') % 4 = 0
  UNION ALL
  -- natale 22-31 dicembre: metà utenti, 2023-2025
  SELECT s.user_id, make_date(y.y, 12, 22), make_date(y.y, 12, 31), 'VACATION', 1
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'XMAS') % 2 = 0
  UNION ALL
  -- ponte pre-1° maggio (29-30 aprile): 1 su 3, 2024-2026
  SELECT s.user_id, make_date(y.y, 4, 29), make_date(y.y, 4, 30), 'VACATION', 1
  FROM _scope s CROSS JOIN generate_series(2024, 2026) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SPR') % 3 = 0
  UNION ALL
  -- settimana corta sparsa (2-3 workday) in giu/set/ott/nov: metà utenti, 2023-2025
  SELECT s.user_id,
         make_date(y.y, (ARRAY[6,9,10,11])[1 + pg_temp.h(s.user_id::text||y.y||'SPM') % 4],
                   5 + pg_temp.h(s.user_id::text||y.y||'SPD') % 18),
         make_date(y.y, (ARRAY[6,9,10,11])[1 + pg_temp.h(s.user_id::text||y.y||'SPM') % 4],
                   5 + pg_temp.h(s.user_id::text||y.y||'SPD') % 18)
           + 2 + pg_temp.h(s.user_id::text||y.y||'SPL') % 2,
         'VACATION', 1
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SPG') % 2 = 0
  UNION ALL
  -- malattia: episodio invernale gen-feb (2024-2026), 2/3 degli (utente,anno)
  SELECT s.user_id,
         make_date(y.y, 1, 7) + (pg_temp.h(s.user_id::text||y.y||'SK1') % 52),
         make_date(y.y, 1, 7) + (pg_temp.h(s.user_id::text||y.y||'SK1') % 52)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK1L') % 6),
         'SICK', 2
  FROM _scope s CROSS JOIN generate_series(2024, 2026) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SK1G') % 3 > 0
  UNION ALL
  -- malattia dicembre (influenza precoce): 1 su 4, 2023-2025
  SELECT s.user_id,
         make_date(y.y, 12, 1) + (pg_temp.h(s.user_id::text||y.y||'SK0') % 15),
         make_date(y.y, 12, 1) + (pg_temp.h(s.user_id::text||y.y||'SK0') % 15)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK0L') % 3),
         'SICK', 2
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SK0G') % 4 = 0
  UNION ALL
  -- malattia autunnale ott-nov: 2/3 degli (utente,anno), 2023-2025
  SELECT s.user_id,
         make_date(y.y, 10, 1) + (pg_temp.h(s.user_id::text||y.y||'SK2') % 40),
         make_date(y.y, 10, 1) + (pg_temp.h(s.user_id::text||y.y||'SK2') % 40)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK2L') % 6),
         'SICK', 2
  FROM _scope s CROSS JOIN generate_series(2023, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SK2G') % 3 > 0
  UNION ALL
  -- malattia breve 1-2 gg, qualunque mese (2024-2026): 1 su 3
  SELECT s.user_id,
         make_date(y.y, 1 + pg_temp.h(s.user_id::text||y.y||'SKS') % 12,
                   3 + pg_temp.h(s.user_id::text||y.y||'SKSD') % 22),
         make_date(y.y, 1 + pg_temp.h(s.user_id::text||y.y||'SKS') % 12,
                   3 + pg_temp.h(s.user_id::text||y.y||'SKSD') % 22)
           + pg_temp.h(s.user_id::text||y.y||'SKSL') % 2,
         'SICK', 2
  FROM _scope s CROSS JOIN generate_series(2024, 2026) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SKSG') % 3 = 0
  UNION ALL
  -- malattia lunga (coda INPS): 1 su 17, 15 giorni, 2024-2025
  SELECT s.user_id,
         make_date(y.y, 3, 1) + (pg_temp.h(s.user_id::text||y.y||'SKL') % 20),
         make_date(y.y, 3, 1) + (pg_temp.h(s.user_id::text||y.y||'SKL') % 20) + 14,
         'SICK', 2
  FROM _scope s CROSS JOIN generate_series(2024, 2025) AS y(y)
  WHERE pg_temp.h(s.user_id::text||y.y||'SKLG') % 17 = 0;

  -- 2b. Dedup: mai episodi sovrapposti per lo stesso utente (resta il primo
  --     per data di inizio; a parità, la priorità più alta = numero più basso)
  CREATE TEMP TABLE _epi_n ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY user_id, d_start, prio, d_end DESC, leave_type) AS eid, *
  FROM _epi;
  CREATE TEMP TABLE _epi_ded ON COMMIT DROP AS
  SELECT * FROM _epi_n e
  WHERE NOT EXISTS (
    SELECT 1 FROM _epi_n e2
    WHERE e2.user_id = e.user_id AND e2.eid < e.eid
      AND e2.d_end >= e.d_start AND e2.d_start <= e.d_end);

  -- --------------------------------------------------------------------------
  -- 3. Giorni di assenza risolti (workday, >= hire, in finestra):
  --    richieste APPROVED legacy (prio 0) vincono sugli episodi generati
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _absence ON COMMIT DROP AS
  SELECT DISTINCT ON (x.user_id, x.d) x.user_id, x.d, x.status
  FROM (
    SELECT r.request_subject_user_id AS user_id, gd.d::date AS d,
           CASE r.request_leave_type
             WHEN 'VACATION' THEN 'VACATION'
             WHEN 'SICK' THEN 'SICK'
             WHEN 'UNPAID' THEN 'UNPAID_LEAVE'
             ELSE 'PAID_LEAVE' END AS status,
           0 AS prio
    FROM sys.sys_time_off_requests r
    CROSS JOIN LATERAL generate_series(r.request_start_date, r.request_end_date, interval '1 day') AS gd(d)
    WHERE r.request_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND r.request_status = 'APPROVED'
      AND r.request_natural_key NOT LIKE 'STORIA36::C1::%'
    UNION ALL
    SELECT e.user_id, gd.d::date,
           CASE e.leave_type WHEN 'VACATION' THEN 'VACATION' ELSE 'SICK' END,
           e.prio
    FROM _epi_ded e
    CROSS JOIN LATERAL generate_series(e.d_start, e.d_end, interval '1 day') AS gd(d)
  ) x
  JOIN staging.storia36_calendar c ON c.cal_date = x.d AND c.is_workday
  JOIN _scope s ON s.user_id = x.user_id
  WHERE x.d >= GREATEST(s.hire, DATE '2023-08-01')
    AND x.d <= DATE '2026-07-26'
  ORDER BY x.user_id, x.d, x.prio;

  -- 3b. PERSONAL (permessi retribuiti): cap 3 giorni/anno GENERATI, scontando
  --     i giorni PAID_LEAVE che arrivano già dalle richieste APPROVED legacy
  --     (entitlement 4: mai superarlo per costruzione)
  CREATE TEMP TABLE _legacy_pl ON COMMIT DROP AS
  SELECT user_id, extract(year FROM d)::int AS y, count(*) AS n
  FROM _absence WHERE status = 'PAID_LEAVE'
  GROUP BY 1, 2;

  CREATE TEMP TABLE _personal ON COMMIT DROP AS
  SELECT user_id, d FROM (
    SELECT s.user_id, c.cal_date AS d,
           row_number() OVER (PARTITION BY s.user_id, extract(year FROM c.cal_date)
                              ORDER BY pg_temp.h(s.user_id::text||c.cal_date||'PP')) AS rn,
           COALESCE(lp.n, 0) AS legacy_n
    FROM _scope s
    JOIN staging.storia36_calendar c
      ON c.is_workday AND c.cal_date >= GREATEST(s.hire, DATE '2023-08-01')
                      AND c.cal_date <= DATE '2026-07-26'
    LEFT JOIN _legacy_pl lp ON lp.user_id = s.user_id AND lp.y = extract(year FROM c.cal_date)::int
    WHERE NOT s.no_badge
      AND pg_temp.h(s.user_id::text||c.cal_date||'P') % 110 = 0
      AND NOT EXISTS (SELECT 1 FROM _absence ab WHERE ab.user_id = s.user_id AND ab.d = c.cal_date)
  ) x WHERE rn <= GREATEST(0, 3 - legacy_n);

  -- --------------------------------------------------------------------------
  -- 4. Attendance: ogni workday per ogni utente (additivo); i never-badger
  --    ricevono SOLO i giorni di assenza
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_attendance (
    attendance_id, attendance_tenant_id, attendance_natural_key,
    attendance_subject_user_id, attendance_date,
    attendance_clock_in, attendance_clock_out,
    attendance_break_start, attendance_break_end,
    attendance_hours_regular, attendance_hours_overtime,
    attendance_hours_night, attendance_hours_holiday,
    attendance_status, attendance_source)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C1::ATTEND::' || s.user_id || '::' || c.cal_date),
    c_rtl,
    'STORIA36::C1::ATTEND::' || s.user_id || '::' || c.cal_date,
    s.user_id, c.cal_date,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN TIME '09:00' END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING')
         -- cap alle 22:00: oltre, il TIME wrappa a domattina e viola clock_ordered
         THEN TIME '17:30' + (LEAST(ot.ot_hours, 4.5) || ' hours')::interval END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN TIME '13:00' END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN TIME '14:00' END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN 7.5 ELSE 0 END,
    ot.ot_hours, 0, 0,
    st.status, 'IMPORT'          -- attendance_is_validated rimossa dalla migrazione 000234
  FROM _scope s
  JOIN staging.storia36_calendar c
    ON c.is_workday
   AND c.cal_date >= GREATEST(s.hire, c_from)
   AND c.cal_date <= c_to
  LEFT JOIN _absence ab ON ab.user_id = s.user_id AND ab.d = c.cal_date
  LEFT JOIN _personal pp ON pp.user_id = s.user_id AND pp.d = c.cal_date
  LEFT JOIN LATERAL (
    SELECT sum(o.overtime_hours) AS oh
    FROM sys.sys_overtime o
    WHERE o.overtime_subject_user_id = s.user_id
      AND o.overtime_date = c.cal_date
      AND o.overtime_hours > 0
  ) so ON true
  CROSS JOIN LATERAL (
    SELECT COALESCE(ab.status,
      CASE WHEN pp.user_id IS NOT NULL THEN 'PAID_LEAVE'
           WHEN pg_temp.h(s.user_id::text||c.cal_date||'T') % 90 = 0 THEN 'TRAINING'
           WHEN pg_temp.h(s.user_id::text||c.cal_date||'R') % 10 = 0 THEN 'REMOTE'
           ELSE 'PRESENT' END) AS status
  ) st
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN s.exempt OR st.status NOT IN ('PRESENT','REMOTE','TRAINING') THEN 0
      WHEN so.oh IS NOT NULL THEN so.oh
      WHEN st.status = 'PRESENT' AND pg_temp.h(s.user_id::text||c.cal_date||'O') % 8 = 0
        THEN 0.5 * (1 + pg_temp.h(s.user_id::text||c.cal_date||'OL') % 3)
      ELSE 0 END AS ot_hours
  ) ot
  WHERE (NOT s.no_badge) OR ab.d IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: attendance inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 5. Richieste time-off dagli episodi (VACATION >=2 workday, SICK >=1),
  --    con timeline STORICA: created < approved < inizio (VACATION, su
  --    giorni lavorativi a orario d'ufficio) · created/approved il mattino
  --    del primo giorno (SICK). Mai self-approval (fallback admin).
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_time_off_requests (
    request_id, request_tenant_id, request_natural_key,
    request_subject_user_id, request_leave_type,
    request_start_date, request_end_date, request_days_requested,
    request_status, request_approver_user_id, request_approved_at,
    request_medical_cert_required, request_medical_cert_uploaded,
    created_at, updated_at)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C1::REQ::' || e.user_id || '::' || b.b_start),
    c_rtl,
    'STORIA36::C1::REQ::' || e.user_id || '::' || b.b_start,
    e.user_id, e.leave_type,
    b.b_start, b.b_end, w.wd,
    'APPROVED',
    CASE WHEN s.mgr_user_id IS NULL OR s.mgr_user_id = e.user_id
         THEN v_admin ELSE s.mgr_user_id END,
    ts.approved_ts,
    e.leave_type = 'SICK',
    e.leave_type = 'SICK',
    tc.created_ts,
    ts.approved_ts
  FROM _epi_ded e
  JOIN _scope s ON s.user_id = e.user_id
  CROSS JOIN LATERAL (
    SELECT GREATEST(e.d_start, s.hire, c_from) AS b_start,
           LEAST(e.d_end, c_to) AS b_end
  ) b
  CROSS JOIN LATERAL (
    SELECT count(*)::numeric AS wd FROM staging.storia36_calendar c
    WHERE c.cal_date BETWEEN b.b_start AND b.b_end AND c.is_workday
  ) w
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN e.leave_type = 'SICK'
           THEN b.b_start::timestamp
                + ((8 + pg_temp.h(e.user_id::text||b.b_start||'CH') % 2) || ' hours')::interval
                + ((pg_temp.h(e.user_id::text||b.b_start||'CM') % 60) || ' minutes')::interval
           ELSE COALESCE(
                  (SELECT max(cal_date) FROM staging.storia36_calendar
                   WHERE is_workday
                     AND cal_date <= b.b_start - (2 + pg_temp.h(e.user_id::text||b.b_start||'CD') % 6)),
                  b.b_start - (2 + pg_temp.h(e.user_id::text||b.b_start||'CD') % 6))::timestamp
                + ((9 + pg_temp.h(e.user_id::text||b.b_start||'CH') % 8) || ' hours')::interval
                + ((pg_temp.h(e.user_id::text||b.b_start||'CM') % 60) || ' minutes')::interval
      END AS created_ts
  ) tc
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN e.leave_type = 'SICK'
           THEN tc.created_ts + ((2 + pg_temp.h(e.user_id::text||b.b_start||'AH') % 5) || ' hours')::interval
           ELSE COALESCE(
                  -- approvazione su un giorno lavorativo fra creazione e inizio...
                  (SELECT max(cal_date) FROM staging.storia36_calendar
                   WHERE is_workday
                     AND cal_date > tc.created_ts::date
                     AND cal_date < b.b_start)::timestamp
                  + ((9 + pg_temp.h(e.user_id::text||b.b_start||'AH') % 8) || ' hours')::interval
                  + ((pg_temp.h(e.user_id::text||b.b_start||'AM') % 60) || ' minutes')::interval,
                  -- ...o, se non esiste (inizio di lunedì), stesso giorno poche ore dopo
                  tc.created_ts + ((1 + pg_temp.h(e.user_id::text||b.b_start||'AH') % 6) || ' hours')::interval)
      END AS approved_ts
  ) ts
  WHERE b.b_start <= b.b_end
    AND ((e.leave_type = 'VACATION' AND w.wd >= 2) OR (e.leave_type = 'SICK' AND w.wd >= 1))
    AND ts.approved_ts > tc.created_ts
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_time_off_requests r
      WHERE r.request_subject_user_id = e.user_id
        AND r.request_status = 'APPROVED'
        AND r.request_natural_key NOT LIKE 'STORIA36::C1::%'
        AND r.request_start_date <= b.b_end
        AND r.request_end_date >= b.b_start)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: richieste time-off inserite %', v_n;

  -- 5b. Auto-riallineamento delle SOLE righe di questo seed (STORIA36::C1) ai
  --     giorni di richieste APPROVED: se una richiesta cambia dopo la semina
  --     (es. one-shot che sposta date legacy), il seed sana le proprie righe.
  --     MAI righe organiche/legacy (quelle sono dominio del triage manuale) —
  --     per questo è custodia-safe.
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
    AND a.attendance_natural_key LIKE 'STORIA36::C1::%'
    AND a.attendance_status IS DISTINCT FROM m.want;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: righe proprie riallineate a richieste APPROVED %', v_n;

  -- --------------------------------------------------------------------------
  -- 6. Balances: INSERT anni mancanti 2023-2025 (entitlement CCNL Credito:
  --    aree 23/25/28 per anzianità · QD 29 · Dirigente 30; SICK 180 comporto;
  --    PERSONAL 4 — convenzioni allineate al legacy riparato)
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_time_off_balances (
    balance_id, balance_tenant_id, balance_natural_key,
    balance_subject_user_id, balance_leave_type, balance_year,
    balance_total_days, balance_used_days, balance_pending_days,
    balance_carryover_days, balance_accrued_days, balance_adjustment_days)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C1::BAL::' || s.user_id || '::' || t.lt || '::' || y.y),
    c_rtl,
    'STORIA36::C1::BAL::' || s.user_id || '::' || t.lt || '::' || y.y,
    s.user_id, t.lt, y.y,
    ent.tot, 0, 0, 0, ent.tot, 0
  FROM _scope s
  CROSS JOIN generate_series(2023, 2025) AS y(y)
  CROSS JOIN (VALUES ('VACATION'), ('SICK'), ('PERSONAL')) AS t(lt)
  CROSS JOIN LATERAL (
    SELECT CASE t.lt
      WHEN 'VACATION' THEN round(
        (CASE WHEN s.ccnl LIKE 'QD%' THEN 29
              WHEN s.ccnl = 'Dirigente' THEN 30
              WHEN y.y - extract(year FROM s.hire) >= 10 THEN 28
              WHEN y.y - extract(year FROM s.hire) >= 5  THEN 25
              ELSE 23 END)
        * CASE WHEN extract(year FROM s.hire) = y.y
               THEN (13 - extract(month FROM s.hire)) / 12.0
               ELSE 1 END)
      WHEN 'SICK' THEN 180
      ELSE 4 END AS tot
  ) ent
  WHERE extract(year FROM s.hire) <= y.y
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: balances inserite %', v_n;

  -- 6b. used_days = derivato dalla storia attendance (guardato, idempotente)
  UPDATE sys.sys_time_off_balances b
     SET balance_used_days = d.n, updated_at = now()
  FROM (
    SELECT b2.balance_id,
           COALESCE((SELECT count(*)::numeric FROM sys.sys_attendance a
             WHERE a.attendance_subject_user_id = b2.balance_subject_user_id
               AND extract(year FROM a.attendance_date)::int = b2.balance_year
               AND a.attendance_status = CASE b2.balance_leave_type
                     WHEN 'VACATION' THEN 'VACATION'
                     WHEN 'SICK' THEN 'SICK'
                     ELSE 'PAID_LEAVE' END), 0) AS n
    FROM sys.sys_time_off_balances b2
    WHERE b2.balance_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND b2.balance_leave_type IN ('VACATION','SICK','PERSONAL')
      AND b2.balance_year BETWEEN 2023 AND 2026
  ) d
  WHERE d.balance_id = b.balance_id
    AND b.balance_used_days IS DISTINCT FROM d.n;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: balances used_days allineati %', v_n;

  -- 6c. Regolarizzazione contabile: se il goduto derivato supera comunque il
  --     maturato (accade solo per giorni ereditati da richieste APPROVED
  --     legacy, es. lutto/studio mappati su PAID_LEAVE), la differenza va in
  --     adjustment_days con motivazione — mai un residuo negativo silenzioso
  UPDATE sys.sys_time_off_balances
     SET balance_adjustment_days = balance_used_days - balance_total_days - balance_carryover_days,
         balance_adjustment_reason = 'Regolarizzazione: permessi aggiuntivi da richieste approvate (lutto/studio/altro) oltre l''entitlement standard',
         updated_at = now()
   WHERE balance_tenant_id = c_rtl
     AND balance_used_days > balance_total_days + balance_carryover_days + balance_adjustment_days
     AND balance_adjustment_days IS DISTINCT FROM (balance_used_days - balance_total_days - balance_carryover_days);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: balances regolarizzati con adjustment %', v_n;

  -- --------------------------------------------------------------------------
  -- 7. Busta paga 2026-07 (copia della 2026-06 per utente, pagata lunedì 27;
  --    CCNL Credito = 13 mensilità, nessuna quattordicesima a luglio)
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_user_pay_slips (
    user_pay_slip_id, user_pay_slip_user_id, user_pay_slip_tenant_id,
    user_pay_slip_period, user_pay_slip_period_start, user_pay_slip_period_end,
    user_pay_slip_gross_pay, user_pay_slip_net_pay, user_pay_slip_deductions,
    user_pay_slip_payment_date, user_pay_slip_status, user_pay_slip_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C1::SLIP::' || p.user_pay_slip_user_id || '::2026-07'),
    p.user_pay_slip_user_id, p.user_pay_slip_tenant_id,
    '2026-07', DATE '2026-07-01', DATE '2026-07-31',
    p.user_pay_slip_gross_pay, p.user_pay_slip_net_pay, p.user_pay_slip_deductions,
    DATE '2026-07-27', p.user_pay_slip_status,
    p.user_pay_slip_metadata || jsonb_build_object('storia36', 'C1')
  FROM sys.sys_user_pay_slips p
  WHERE p.user_pay_slip_period = '2026-06'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_user_pay_slips q
      WHERE q.user_pay_slip_user_id = p.user_pay_slip_user_id
        AND q.user_pay_slip_period = '2026-07')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C1: buste 2026-07 inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 8. Registro provenance
  -- --------------------------------------------------------------------------
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C1', '01_attendance_timeoff.sql', v_tot, v_tot);

  -- --------------------------------------------------------------------------
  -- 9. Post-condizioni fail-loud
  -- --------------------------------------------------------------------------
  -- 9a. nessuna presenza in giorni non lavorativi
  SELECT count(*) INTO v_bad
  FROM sys.sys_attendance a
  JOIN staging.storia36_calendar c ON c.cal_date = a.attendance_date
  WHERE NOT c.is_workday;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'C1 post: % righe attendance in giorni non lavorativi', v_bad;
  END IF;

  -- 9b. copertura piena per chi badge-a (tutti tranne i never-badger)
  SELECT count(*) INTO v_bad
  FROM _scope s
  JOIN staging.storia36_calendar c
    ON c.is_workday AND c.cal_date >= GREATEST(s.hire, c_from) AND c.cal_date <= c_to
  WHERE NOT s.no_badge
    AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a
                    WHERE a.attendance_subject_user_id = s.user_id
                      AND a.attendance_date = c.cal_date);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'C1 post: % workday scoperti', v_bad;
  END IF;

  -- 9c. ogni richiesta APPROVED coperta da attendance coerente — LIMITATO ai
  --     giorni non occupati da righe legacy: il seed è additivo e garantisce
  --     solo le PROPRIE righe; le contraddizioni con righe pre-esistenti sono
  --     dominio del triage/one-shot (la batteria C1c(i) resta stretta su tutto)
  DECLARE
    v_diag text;
  BEGIN
    SELECT count(*), (array_agg(r.request_natural_key || '|' || gd.d::date))[1:3]::text
      INTO v_bad, v_diag
    FROM sys.sys_time_off_requests r
    CROSS JOIN LATERAL generate_series(GREATEST(r.request_start_date, c_from),
                                       LEAST(r.request_end_date, c_to), interval '1 day') AS gd(d)
    JOIN staging.storia36_calendar c ON c.cal_date = gd.d::date AND c.is_workday
    WHERE r.request_tenant_id = c_rtl
      AND r.request_status = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1 FROM sys.sys_attendance a
        WHERE a.attendance_subject_user_id = r.request_subject_user_id
          AND a.attendance_date = gd.d::date
          AND a.attendance_status = CASE r.request_leave_type
                WHEN 'VACATION' THEN 'VACATION'
                WHEN 'SICK' THEN 'SICK'
                WHEN 'UNPAID' THEN 'UNPAID_LEAVE'
                ELSE 'PAID_LEAVE' END)
      AND NOT EXISTS (
        SELECT 1 FROM sys.sys_attendance a2
        WHERE a2.attendance_subject_user_id = r.request_subject_user_id
          AND a2.attendance_date = gd.d::date
          AND a2.attendance_natural_key NOT LIKE 'STORIA36::C1::%');
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'C1 post: % workday di richieste APPROVED senza attendance coerente — %', v_bad, v_diag;
    END IF;
  END;

  -- 9d. mai più del 60% dello scope in VACATION nello stesso workday
  SELECT max(share) INTO v_share FROM (
    SELECT a.attendance_date,
           avg((a.attendance_status = 'VACATION')::int) AS share
    FROM sys.sys_attendance a
    JOIN staging.storia36_calendar c ON c.cal_date = a.attendance_date AND c.is_workday
    WHERE a.attendance_tenant_id = c_rtl
    GROUP BY 1
  ) x;
  IF v_share > 0.60 THEN
    RAISE EXCEPTION 'C1 post: quota massima VACATION per workday = % (> 0.60)', round(v_share, 3);
  END IF;

  -- 9e. mai goduto oltre il maturato
  DECLARE
    v_diag2 text;
  BEGIN
    SELECT count(*),
           (array_agg(balance_leave_type || '/' || balance_year || ' used=' || balance_used_days
                      || ' tot=' || balance_total_days || ' u=' || balance_subject_user_id))[1:4]::text
      INTO v_bad, v_diag2
    FROM sys.sys_time_off_balances
    WHERE balance_tenant_id = c_rtl
      AND balance_used_days > balance_total_days + balance_carryover_days + balance_adjustment_days;
    IF v_bad > 0 THEN
      RAISE EXCEPTION 'C1 post: % balances con goduto oltre il maturato — %', v_bad, v_diag2;
    END IF;
  END;

  -- 9f. richieste APPROVED: mai approvate prima di essere create, mai self-approval
  SELECT count(*) INTO v_bad
  FROM sys.sys_time_off_requests
  WHERE request_tenant_id = c_rtl
    AND ((request_approved_at IS NOT NULL AND request_approved_at <= created_at)
         OR (request_status = 'APPROVED' AND request_approver_user_id = request_subject_user_id));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'C1 post: % richieste con timeline impossibile o self-approval', v_bad;
  END IF;

  RAISE NOTICE 'storia36 C1 OK: % righe scritte in questa corsa (delta atteso 0 alla seconda)', v_tot;
END $$;

COMMIT;
