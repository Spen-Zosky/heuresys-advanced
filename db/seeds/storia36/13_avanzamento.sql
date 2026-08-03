-- ============================================================================
-- db/seeds/storia36/13_avanzamento.sql — modo AVANZAMENTO (finestra MOBILE)
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md, sezione
--        "Ripetibilita': tre modi" (costruzione · custodia · avanzamento).
--
-- COSA FA
--   Estende la storia dalle punte in cui si e' fermata fino a :window_end
--   (default = IERI), con le STESSE regole e le STESSE chiavi naturali dei
--   cluster di costruzione. Una giornata prodotta qui e' indistinguibile, per
--   regola, da una prodotta dal C1: stesso hash deterministico, stesso
--   calendario, stessa forma della giornata, stessa chiave naturale.
--   Percio' le batterie esistenti coprono da sole le righe nuove — non c'e' una
--   seconda verita' da insegnare ai check (regola anti-drift AP-01).
--
-- PERIMETRO — dichiarato, non implicito
--   IN   calendario lavorativo, con le festivita' CALCOLATE (Pasqua compresa):
--        una lista scritta a mano si fermerebbe al primo anno nuovo.
--   IN   presenze + assenze (richieste time-off generate ed estese).
--   IN   buste paga + handoff payroll, solo per i mesi INTERI.
--   FUORI, ma ottenuto altrove: le APPROVAZIONI non si scrivono qui. Il seed
--        07_approvals.sql le DERIVA dai fatti (richieste time-off, comp,
--        iniziative) ed e' idempotente: storia36.sh lo ri-esegue dopo questo
--        file, e le approvazioni del periodo nuovo nascono da sole.
--   FUORI, con motivo: il pulse (sys.sys_pulse_checks) NON viene continuato.
--        E' una serie IMPORTATA dal legacy in tre provenienze distinte
--        (LEGACY_CI 1.621 · LEGACY_PC 733 · LEGACY_WB 480), senza una regola
--        d'autore e con 12 commenti distinti in tutto: continuarla vorrebbe
--        dire inventare una cadenza e una voce che nessuno ha registrato.
--        Stessa dottrina gia' applicata in C9 (sys_content_media lasciata
--        vuota) e in C10 (codici di recupero MFA non fabbricati). Il "clima"
--        della demo non invecchia comunque: viene dalle rilevazioni del C8,
--        che hanno una survey IN-CORSO.
--
-- GARANZIE
--   · IDEMPOTENTE — ri-esecuzione con la stessa finestra = 0 righe scritte.
--   · MAI IL FUTURO — fallisce forte se :window_end >= current_date: una
--     giornata in corso non ha ancora un'uscita, e la storia non contiene
--     il domani.
--   · FAIL-LOUD — post-condizioni in fondo: niente presenze oltre la finestra,
--     nessun buco di giorni lavorativi fra la vecchia punta e la nuova.
--
-- USO
--   psql ... -f db/seeds/storia36/13_avanzamento.sql            (fino a ieri)
--   psql ... -v window_end=2026-08-31 -f .../13_avanzamento.sql (fino a una data)
--   Normalmente: bash db/scripts/storia36.sh avanzamento [--window-end=...]
-- ============================================================================

\if :{?window_end}
\else
  \set window_end AUTO
\endif

BEGIN;

-- hash deterministico per i PICK pseudo-casuali — identico al C1 (MAI per chiavi)
CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- Le festivita' italiane calcolate (Pasqua compresa) vivono in staging.*,
-- create dal C0 insieme al calendario: qui si usano, non si ridefiniscono
-- (regola anti-drift AP-01 — una regola, un posto solo). Il check C12c le
-- confronta con la lista scritta a mano della finestra di costruzione.

-- La finestra richiesta, risolta una volta sola e leggibile dai blocchi DO.
CREATE TEMP TABLE _w ON COMMIT DROP AS
-- NULLIF prima del cast: col sentinella AUTO il cast non viene mai tentato
-- (una CASE lo tenterebbe lo stesso, per costant-folding del letterale).
SELECT COALESCE(NULLIF(:'window_end', 'AUTO')::date, current_date - 1) AS w_end;

-- ----------------------------------------------------------------------------
-- 1. Guardia + estensione del calendario lavorativo
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_end date;
  v_max date;
  v_n   bigint;
BEGIN
  SELECT w_end INTO v_end FROM _w;

  IF v_end >= current_date THEN
    RAISE EXCEPTION 'avanzamento: finestra % non ammessa (oggi e'' %) — la storia si ferma a IERI: una giornata in corso non ha ancora un''uscita',
      v_end, current_date;
  END IF;

  SELECT max(cal_date) INTO v_max FROM staging.storia36_calendar;
  IF v_max IS NULL THEN
    RAISE EXCEPTION 'avanzamento: calendario assente — serve prima la costruzione (00_foundation.sql)';
  END IF;

  IF v_end > v_max THEN
    INSERT INTO staging.storia36_calendar (cal_date, is_workday, holiday_name)
    SELECT x.d, (extract(isodow FROM x.d) < 6 AND x.hn IS NULL), x.hn
    FROM (
      SELECT gs.d::date AS d, staging.storia36_holiday_it(gs.d::date) AS hn
      FROM generate_series(v_max + 1, v_end, interval '1 day') AS gs(d)
    ) x
    ON CONFLICT (cal_date) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'storia36 ADV: calendario esteso di % giorni (fino al %)', v_n, v_end;
  ELSE
    RAISE NOTICE 'storia36 ADV: calendario gia'' copre il % — nessuna estensione', v_end;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Presenze e assenze — dalle punte correnti fino alla finestra
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c_rtl  constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns   constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_from constant date := DATE '2023-08-01';
  v_end   date;
  v_start date;
  v_admin uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT w_end INTO v_end FROM _w;
  SELECT max(attendance_date) + 1 INTO v_start
    FROM sys.sys_attendance WHERE attendance_tenant_id = c_rtl;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'avanzamento: nessuna presenza in archivio — serve prima la costruzione (C1)';
  END IF;

  IF v_start > v_end THEN
    RAISE NOTICE 'storia36 ADV: presenze gia'' aggiornate al % — niente da estendere', v_start - 1;
    INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
    VALUES ('ADV', '13_avanzamento.sql (presenze)', 0, 0);
    RETURN;
  END IF;

  SELECT user_id INTO STRICT v_admin FROM sys.sys_users WHERE user_email = 'admin@heuresys.com';
  RAISE NOTICE 'storia36 ADV: estendo le presenze da % a %', v_start, v_end;

  -- 2.1 Scope — identico al C1 (utenti RTL attivi, inquadramento, manager)
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
  WHERE u.user_tenant_id = c_rtl
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  -- 2.2 Anni toccati dall'estensione: le famiglie di episodi del C1 si valutano
  --     su questi, cosi' la storia PROSEGUE con la stessa forma invece di
  --     ripartire da una regola nuova.
  CREATE TEMP TABLE _yrs ON COMMIT DROP AS
  SELECT DISTINCT extract(year FROM g.d)::int AS y
  FROM generate_series(v_start, v_end, interval '1 day') AS g(d);

  -- 2.3 Episodi di assenza — stesse famiglie e stessi sali del C1
  CREATE TEMP TABLE _epi ON COMMIT DROP AS
  -- estate: 5 turni scaglionati da inizio agosto, 12 giorni di calendario
  SELECT s.user_id,
         make_date(y.y, 8, 1)
           + (pg_temp.h(s.user_id::text||y.y||'WAVE') % 5) * 6
           + (pg_temp.h(s.user_id::text||y.y||'SUM') % 4) AS d_start,
         make_date(y.y, 8, 1)
           + (pg_temp.h(s.user_id::text||y.y||'WAVE') % 5) * 6
           + (pg_temp.h(s.user_id::text||y.y||'SUM') % 4) + 11 AS d_end,
         'VACATION'::text AS leave_type, 1 AS prio
  FROM _scope s CROSS JOIN _yrs y
  UNION ALL
  -- coda estiva fuori agosto per 1 su 5
  SELECT s.user_id,
         CASE WHEN pg_temp.h(s.user_id::text||y.y||'JS') % 2 = 0
              THEN make_date(y.y, 7, 22) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 4)
              ELSE make_date(y.y, 9, 2) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 5) END,
         CASE WHEN pg_temp.h(s.user_id::text||y.y||'JS') % 2 = 0
              THEN make_date(y.y, 7, 22) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 4) + 3
              ELSE make_date(y.y, 9, 2) + (pg_temp.h(s.user_id::text||y.y||'JSD') % 5) + 3 END,
         'VACATION', 1
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'JSG') % 5 = 0
  UNION ALL
  -- natale 22-31 dicembre: meta' degli utenti
  SELECT s.user_id, make_date(y.y, 12, 22), make_date(y.y, 12, 31), 'VACATION', 1
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'XMAS') % 2 = 0
  UNION ALL
  -- ponte pre-1° maggio (29-30 aprile): 1 su 3
  SELECT s.user_id, make_date(y.y, 4, 29), make_date(y.y, 4, 30), 'VACATION', 1
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SPR') % 3 = 0
  UNION ALL
  -- settimana corta sparsa (2-3 workday) in giu/set/ott/nov: meta' degli utenti
  SELECT s.user_id,
         make_date(y.y, (ARRAY[6,9,10,11])[1 + pg_temp.h(s.user_id::text||y.y||'SPM') % 4],
                   5 + pg_temp.h(s.user_id::text||y.y||'SPD') % 18),
         make_date(y.y, (ARRAY[6,9,10,11])[1 + pg_temp.h(s.user_id::text||y.y||'SPM') % 4],
                   5 + pg_temp.h(s.user_id::text||y.y||'SPD') % 18)
           + 2 + pg_temp.h(s.user_id::text||y.y||'SPL') % 2,
         'VACATION', 1
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SPG') % 2 = 0
  UNION ALL
  -- malattia: episodio invernale gen-feb, 2/3 degli (utente,anno)
  SELECT s.user_id,
         make_date(y.y, 1, 7) + (pg_temp.h(s.user_id::text||y.y||'SK1') % 52),
         make_date(y.y, 1, 7) + (pg_temp.h(s.user_id::text||y.y||'SK1') % 52)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK1L') % 6),
         'SICK', 2
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SK1G') % 3 > 0
  UNION ALL
  -- malattia dicembre (influenza precoce): 1 su 4
  SELECT s.user_id,
         make_date(y.y, 12, 1) + (pg_temp.h(s.user_id::text||y.y||'SK0') % 15),
         make_date(y.y, 12, 1) + (pg_temp.h(s.user_id::text||y.y||'SK0') % 15)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK0L') % 3),
         'SICK', 2
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SK0G') % 4 = 0
  UNION ALL
  -- malattia autunnale ott-nov: 2/3 degli (utente,anno)
  SELECT s.user_id,
         make_date(y.y, 10, 1) + (pg_temp.h(s.user_id::text||y.y||'SK2') % 40),
         make_date(y.y, 10, 1) + (pg_temp.h(s.user_id::text||y.y||'SK2') % 40)
           + 1 + (pg_temp.h(s.user_id::text||y.y||'SK2L') % 6),
         'SICK', 2
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SK2G') % 3 > 0
  UNION ALL
  -- malattia breve 1-2 gg, qualunque mese: 1 su 3
  SELECT s.user_id,
         make_date(y.y, 1 + pg_temp.h(s.user_id::text||y.y||'SKS') % 12,
                   3 + pg_temp.h(s.user_id::text||y.y||'SKSD') % 22),
         make_date(y.y, 1 + pg_temp.h(s.user_id::text||y.y||'SKS') % 12,
                   3 + pg_temp.h(s.user_id::text||y.y||'SKSD') % 22)
           + pg_temp.h(s.user_id::text||y.y||'SKSL') % 2,
         'SICK', 2
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SKSG') % 3 = 0
  UNION ALL
  -- malattia lunga (coda INPS): 1 su 17, 15 giorni
  SELECT s.user_id,
         make_date(y.y, 3, 1) + (pg_temp.h(s.user_id::text||y.y||'SKL') % 20),
         make_date(y.y, 3, 1) + (pg_temp.h(s.user_id::text||y.y||'SKL') % 20) + 14,
         'SICK', 2
  FROM _scope s CROSS JOIN _yrs y
  WHERE pg_temp.h(s.user_id::text||y.y||'SKLG') % 17 = 0;

  -- 2.4 Dedup identico al C1 (resta il primo per inizio; a parita', prio piu' alta)
  CREATE TEMP TABLE _epi_n ON COMMIT DROP AS
  SELECT row_number() OVER (ORDER BY user_id, d_start, prio, d_end DESC, leave_type) AS eid, *
  FROM _epi;
  CREATE TEMP TABLE _epi_ded ON COMMIT DROP AS
  SELECT * FROM _epi_n e
  WHERE NOT EXISTS (
    SELECT 1 FROM _epi_n e2
    WHERE e2.user_id = e.user_id AND e2.eid < e.eid
      AND e2.d_end >= e.d_start AND e2.d_start <= e.d_end)
    -- solo cio' che tocca la finestra nuova: il passato e' gia' scritto
    AND e.d_end >= v_start AND e.d_start <= v_end;

  -- 2.5 Richieste time-off: si inseriscono le nuove e si ESTENDE la coda di
  --     quelle che il C1 aveva tagliato sul suo confine (una ferie a cavallo
  --     della punta non diventa due richieste: e' la stessa, che prosegue).
  CREATE TEMP TABLE _req ON COMMIT DROP AS
  SELECT e.user_id, e.leave_type,
         b.b_start, b.b_end, w.wd,
         'STORIA36::C1::REQ::' || e.user_id || '::' || b.b_start AS nk,
         CASE WHEN s.mgr_user_id IS NULL OR s.mgr_user_id = e.user_id
              THEN v_admin ELSE s.mgr_user_id END AS approver,
         tc.created_ts, ts.approved_ts
  FROM _epi_ded e
  JOIN _scope s ON s.user_id = e.user_id
  -- La chiave che l'episodio avrebbe se fosse gia' stato materializzato dalla
  -- costruzione: distingue una CODA (ferie iniziate prima della punta, che
  -- proseguono) da un episodio NUOVO.
  CROSS JOIN LATERAL (
    SELECT 'STORIA36::C1::REQ::' || e.user_id || '::' || GREATEST(e.d_start, s.hire, c_from) AS orig_nk
  ) o
  CROSS JOIN LATERAL (
    SELECT EXISTS (SELECT 1 FROM sys.sys_time_off_requests r0
                    WHERE r0.request_tenant_id = c_rtl
                      AND r0.request_natural_key = o.orig_nk) AS coda
  ) q
  CROSS JOIN LATERAL (
    -- Un episodio nuovo NON puo' reclamare giorni che la costruzione ha gia'
    -- deciso (li' la persona risulta al lavoro): la richiesta parte dalla nuova
    -- finestra. Una coda invece mantiene la sua data d'inizio vera.
    SELECT CASE WHEN q.coda THEN GREATEST(e.d_start, s.hire, c_from)
                ELSE GREATEST(e.d_start, s.hire, c_from, v_start) END AS b_start,
           LEAST(e.d_end, v_end) AS b_end
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
                  (SELECT max(cal_date) FROM staging.storia36_calendar
                   WHERE is_workday
                     AND cal_date > tc.created_ts::date
                     AND cal_date < b.b_start)::timestamp
                  + ((9 + pg_temp.h(e.user_id::text||b.b_start||'AH') % 8) || ' hours')::interval
                  + ((pg_temp.h(e.user_id::text||b.b_start||'AM') % 60) || ' minutes')::interval,
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
        AND r.request_end_date >= b.b_start);

  INSERT INTO sys.sys_time_off_requests (
    request_id, request_tenant_id, request_natural_key,
    request_subject_user_id, request_leave_type,
    request_start_date, request_end_date, request_days_requested,
    request_status, request_approver_user_id, request_approved_at,
    request_medical_cert_required, request_medical_cert_uploaded,
    created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, k.nk), c_rtl, k.nk,
         k.user_id, k.leave_type, k.b_start, k.b_end, k.wd,
         'APPROVED', k.approver, k.approved_ts,
         k.leave_type = 'SICK', k.leave_type = 'SICK',
         k.created_ts, k.approved_ts
  FROM _req k
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 ADV: richieste time-off nuove %', v_n;

  -- la coda di un'assenza gia' registrata: si allunga la richiesta esistente,
  -- solo se e' una scritta dal programma (mai una riga organica)
  UPDATE sys.sys_time_off_requests r
     SET request_end_date = k.b_end,
         request_days_requested = k.wd,
         updated_at = k.approved_ts
  FROM _req k
  WHERE r.request_tenant_id = c_rtl
    AND r.request_natural_key = k.nk
    AND r.request_natural_key LIKE 'STORIA36::C1::REQ::%'
    AND r.request_end_date < k.b_end;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 ADV: richieste prolungate oltre la vecchia punta %', v_n;

  -- 2.6 Giorni di assenza risolti nella finestra nuova (stessa precedenza del
  --     C1: le richieste APPROVED non-programma vincono sugli episodi generati)
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
    WHERE r.request_tenant_id = c_rtl
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
  WHERE x.d >= GREATEST(s.hire, v_start)
    AND x.d <= v_end
  ORDER BY x.user_id, x.d, x.prio;

  -- 2.7 Permessi retribuiti: la quota annua e' gia' in parte consumata dalle
  --     giornate scritte prima — si conta il RESIDUO sulle presenze reali,
  --     non si riparte da zero (altrimenti l'anno di transizione sforerebbe).
  CREATE TEMP TABLE _personal ON COMMIT DROP AS
  SELECT user_id, d FROM (
    SELECT s.user_id, c.cal_date AS d,
           row_number() OVER (PARTITION BY s.user_id, extract(year FROM c.cal_date)
                              ORDER BY pg_temp.h(s.user_id::text||c.cal_date||'PP')) AS rn,
           COALESCE(gia.n, 0) AS gia_n
    FROM _scope s
    JOIN staging.storia36_calendar c
      ON c.is_workday AND c.cal_date >= GREATEST(s.hire, v_start)
                      AND c.cal_date <= v_end
    LEFT JOIN LATERAL (
      SELECT count(*) AS n FROM sys.sys_attendance a
      WHERE a.attendance_subject_user_id = s.user_id
        AND a.attendance_status = 'PAID_LEAVE'
        AND extract(year FROM a.attendance_date) = extract(year FROM c.cal_date)
    ) gia ON true
    WHERE NOT s.no_badge
      AND pg_temp.h(s.user_id::text||c.cal_date||'P') % 110 = 0
      AND NOT EXISTS (SELECT 1 FROM _absence ab WHERE ab.user_id = s.user_id AND ab.d = c.cal_date)
  ) x WHERE rn <= GREATEST(0, 3 - gia_n);

  -- 2.8 Presenze: ogni giorno lavorativo della finestra nuova, stessa forma
  --     della giornata del C1 (09:00-17:30, pausa 13-14, 7,5 ore ordinarie)
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
         THEN TIME '17:30' + (LEAST(ot.ot_hours, 4.5) || ' hours')::interval END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN TIME '13:00' END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN TIME '14:00' END,
    CASE WHEN st.status IN ('PRESENT','REMOTE','TRAINING') THEN 7.5 ELSE 0 END,
    ot.ot_hours, 0, 0,
    st.status, 'IMPORT'          -- attendance_is_validated rimossa dalla migrazione 000234
  FROM _scope s
  JOIN staging.storia36_calendar c
    ON c.is_workday
   AND c.cal_date >= GREATEST(s.hire, v_start)
   AND c.cal_date <= v_end
  LEFT JOIN _absence ab ON ab.user_id = s.user_id AND ab.d = c.cal_date
  LEFT JOIN _personal pp ON pp.user_id = s.user_id AND pp.d = c.cal_date
  LEFT JOIN LATERAL (
    SELECT sum(o.overtime_hours) AS oh
    FROM sys.sys_overtime o
    WHERE o.overtime_subject_user_id = s.user_id
      AND o.overtime_date = c.cal_date
      AND o.overtime_hours > 0
  ) so ON true
  -- Nel C1 il giorno d'aula nasceva dal sorteggio e il C4 ci allineava DOPO le
  -- edizioni. Qui non c'e' un "dopo": una giornata di formazione senza un corso
  -- dietro sarebbe una giornata che l'azienda ha registrato e che non risulta da
  -- nessuna parte (e' esattamente cio' che il check C4e vieta). Percio' TRAINING
  -- solo se in quel giorno c'e' una traccia d'aula vera.
  LEFT JOIN LATERAL (
    SELECT true AS si
    FROM sys.sys_user_learning_evidence le
    WHERE le.user_learning_evidence_user_id = s.user_id
      AND le.user_learning_evidence_completed_at::date = c.cal_date
      AND le.user_learning_evidence_metadata->>'kind' = 'AULA'
    LIMIT 1
  ) aula ON true
  CROSS JOIN LATERAL (
    SELECT COALESCE(ab.status,
      CASE WHEN pp.user_id IS NOT NULL THEN 'PAID_LEAVE'
           WHEN COALESCE(aula.si, false) THEN 'TRAINING'
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
  RAISE NOTICE 'storia36 ADV: presenze inserite %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('ADV', '13_avanzamento.sql (presenze)', v_tot, v_tot);
END $$;

-- ----------------------------------------------------------------------------
-- 2b. Rinnovi delle abilitazioni obbligatorie
--     La frontiera della storia e' la punta delle presenze (cosi' la legge il
--     check C4b). Spostandola in avanti, un'abilitazione la cui scadenza cade
--     nel tratto nuovo resterebbe scaduta e mai rinnovata: non perche' qualcuno
--     abbia sbagliato, ma solo perche' il tempo e' passato. La catena dei
--     rinnovi si estende con la STESSA regola del C4 (rinnovo nei 30 giorni
--     PRIMA della scadenza, cadenza = validita' mediana dello schema) e con le
--     STESSE chiavi: i progressivi gia' scritti non si toccano.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns  constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  v_end date;
  v_to  date;
  v_n   bigint := 0;
BEGIN
  SELECT w_end INTO v_end FROM _w;
  -- si rinnova fino alla frontiera reale della storia (punta delle presenze),
  -- che dopo la sezione 2 puo' essere piu' avanti della finestra richiesta
  SELECT GREATEST(v_end, COALESCE(max(attendance_date), v_end)) INTO v_to
    FROM sys.sys_attendance WHERE attendance_tenant_id = c_rtl;

  CREATE TEMP TABLE _rscope ON COMMIT DROP AS
  SELECT u.user_id, e.user_employment_hire_date AS hire
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  WHERE u.user_tenant_id = c_rtl
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  INSERT INTO sys.sys_user_certifications (
    user_certification_id, user_certification_user_id, user_certification_tenant_id,
    user_certification_name, user_certification_issuer,
    user_certification_issued_date, user_certification_expires_date,
    user_certification_credential_id, user_certification_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C4::CERT::' || b.cid || '::' || g.n),
         b.uid, c_rtl, b.nome, b.issuer,
         GREATEST(
           LEAST((b.chain_start + ((g.n - 1) * b.cad_days))::date
                   - (pg_temp.h(b.cid::text || g.n || 'CI') % 30), v_to),
           b.hire),
         (b.chain_start + (g.n * b.cad_days))::date,
         b.credenziale,
         jsonb_build_object('storia36', 'C4', 'rinnovo_di', b.cid, 'progressivo', g.n)
    FROM (
      SELECT DISTINCT ON (c.user_certification_user_id, c.user_certification_name,
                          c.user_certification_issuer)
             c.user_certification_id AS cid, c.user_certification_user_id AS uid,
             c.user_certification_name AS nome, c.user_certification_issuer AS issuer,
             c.user_certification_credential_id AS credenziale, s.hire,
             GREATEST(c.user_certification_expires_date, s.hire) AS chain_start,
             round(staging.storia36_cert_validity_years(
                     c.user_certification_name, c.user_certification_issuer) * 365)::int AS cad_days
        FROM sys.sys_user_certifications c
        JOIN _rscope s ON s.user_id = c.user_certification_user_id
       WHERE c.user_certification_tenant_id = c_rtl
         AND staging.storia36_cert_is_abilitante(c.user_certification_issuer)
         AND c.user_certification_expires_date IS NOT NULL
         AND c.user_certification_metadata->>'storia36' IS NULL
       ORDER BY c.user_certification_user_id, c.user_certification_name,
                c.user_certification_issuer, c.user_certification_expires_date DESC
    ) b
    -- il limite superiore e' generoso di proposito: e' la WHERE a fermare la
    -- catena alla frontiera, non un tetto che tra qualche anno smetterebbe di
    -- bastare in silenzio
    CROSS JOIN generate_series(1, 24) AS g(n)
   WHERE b.cad_days > 30
     AND (b.chain_start + ((g.n - 1) * b.cad_days))::date < v_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 ADV: rinnovi di abilitazioni inseriti % (frontiera %)', v_n, v_to;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('ADV', '13_avanzamento.sql (rinnovi)', v_n, v_n);
END $$;

-- ----------------------------------------------------------------------------
-- 3. Buste paga e handoff payroll — solo per i mesi INTERI
--    (una busta si emette a mese chiuso: un mese in corso non ne ha una)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns  constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  v_end   date;
  v_last  date;   -- ultimo mese chiuso dentro la finestra
  v_from  date;   -- primo mese da coprire
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT w_end INTO v_end FROM _w;

  -- ultimo mese INTERO contenuto nella finestra
  v_last := (date_trunc('month', v_end + 1) - interval '1 month')::date;
  IF (v_last + interval '1 month - 1 day')::date > v_end THEN
    v_last := (v_last - interval '1 month')::date;
  END IF;

  SELECT (date_trunc('month', max(user_pay_slip_period_start)) + interval '1 month')::date
    INTO v_from
    FROM sys.sys_user_pay_slips WHERE user_pay_slip_tenant_id = c_rtl;

  IF v_from IS NULL OR v_last IS NULL OR v_from > v_last THEN
    RAISE NOTICE 'storia36 ADV: buste gia'' aggiornate — nessun mese intero nuovo';
    INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
    VALUES ('ADV', '13_avanzamento.sql (buste)', 0, 0);
    RETURN;
  END IF;

  RAISE NOTICE 'storia36 ADV: estendo le buste dai mesi % a %', v_from, v_last;

  CREATE TEMP TABLE _cscope ON COMMIT DROP AS
  SELECT u.user_id, e.user_employment_hire_date AS hire,
         c.user_contract_ccnl_level AS ccnl,
         c.user_contract_gross_annual_salary AS ral
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
  LEFT JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
  WHERE u.user_tenant_id = c_rtl
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  INSERT INTO sys.sys_user_pay_slips (
    user_pay_slip_id, user_pay_slip_user_id, user_pay_slip_tenant_id,
    user_pay_slip_period, user_pay_slip_period_start, user_pay_slip_period_end,
    user_pay_slip_gross_pay, user_pay_slip_net_pay, user_pay_slip_deductions,
    user_pay_slip_payment_date, user_pay_slip_status, user_pay_slip_metadata)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::SLIP::' || k.user_id || '::' || k.per),
    k.user_id, c_rtl, k.per, k.m, (k.m + interval '1 month - 1 day')::date,
    k.gross, round(k.gross * 0.72, 2),
    jsonb_build_object('gross', k.gross,
                       'inps',  round(k.gross * 0.0919, 2),
                       'irpef', round(k.gross * 0.1881, 2),
                       'total_deductions', round(k.gross * 0.0919, 2) + round(k.gross * 0.1881, 2),
                       'net',   round(k.gross * 0.72, 2)),
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= LEAST(k.m + 26, v_end)),
    'paid',
    jsonb_build_object('storia36', 'ADV')
  FROM (
    SELECT s.user_id, gm.m::date AS m, to_char(gm.m, 'YYYY-MM') AS per,
           round(
             (staging.storia36_ral_at(s.ral, s.ccnl, gm.m::date) / 13.0
              * CASE WHEN extract(month FROM gm.m) = 12 THEN 2 ELSE 1 END)
             * CASE WHEN date_trunc('month', s.hire) = gm.m
                    THEN ((gm.m + interval '1 month')::date - s.hire)::numeric
                         / ((gm.m + interval '1 month')::date - gm.m::date)
                    ELSE 1 END
             + COALESCE((SELECT sum(v.variable_pay_calculation_amount_eur)
                         FROM sys.sys_variable_pay_calculations v
                         WHERE v.variable_pay_calculation_user_id = s.user_id
                           AND extract(month FROM gm.m) = 6
                           AND extract(year FROM v.variable_pay_calculation_period_start)::int
                               = extract(year FROM gm.m)::int - 1), 0),
           2) AS gross
    FROM _cscope s
    CROSS JOIN LATERAL generate_series(
      GREATEST(date_trunc('month', s.hire)::date, v_from), v_last, interval '1 month') AS gm(m)
    WHERE s.ral IS NOT NULL
  ) k
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_user_pay_slips p
    WHERE p.user_pay_slip_user_id = k.user_id
      AND date_trunc('month', p.user_pay_slip_period_start) = k.m)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 ADV: buste paga inserite %', v_n;

  -- il mese precedente non e' piu' "spedito": il payroll l'ha preso in carico
  UPDATE sys.sys_payroll_handoff_records
     SET payroll_handoff_record_status = 'ACKNOWLEDGED'
   WHERE payroll_handoff_record_tenant_id = c_rtl
     AND payroll_handoff_record_status = 'SENT'
     AND payroll_handoff_record_period_start < v_last;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  INSERT INTO sys.sys_payroll_handoff_records (
    payroll_handoff_record_id, payroll_handoff_record_tenant_id,
    payroll_handoff_record_period_start, payroll_handoff_record_period_end,
    payroll_handoff_record_recipient_system, payroll_handoff_record_payload,
    payroll_handoff_record_handed_off_at, payroll_handoff_record_status)
  SELECT
    uuid_generate_v5(c_ns, 'STORIA36::C3::HAND::' || to_char(gm.m, 'YYYY-MM')),
    c_rtl, gm.m::date, (gm.m + interval '1 month - 1 day')::date,
    'ZUCCHETTI_PAGHE',
    (SELECT jsonb_build_object('storia36', 'ADV',
                               'period', to_char(gm.m, 'YYYY-MM'),
                               'headcount', count(*),
                               'total_gross', sum(p.user_pay_slip_gross_pay),
                               'total_net', sum(p.user_pay_slip_net_pay))
       FROM sys.sys_user_pay_slips p
      WHERE p.user_pay_slip_tenant_id = c_rtl
        AND date_trunc('month', p.user_pay_slip_period_start) = gm.m),
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= LEAST(gm.m::date + 22, v_end))::timestamp
      + ((10 + pg_temp.h(to_char(gm.m, 'YYYY-MM')||'HH') % 6) || ' hours')::interval,
    CASE WHEN gm.m::date = v_last THEN 'SENT' ELSE 'ACKNOWLEDGED' END
  FROM generate_series(v_from, v_last, interval '1 month') AS gm(m)
  WHERE NOT EXISTS (
    SELECT 1 FROM sys.sys_payroll_handoff_records hr
    WHERE hr.payroll_handoff_record_tenant_id = c_rtl
      AND hr.payroll_handoff_record_period_start = gm.m::date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 ADV: handoff payroll inseriti %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('ADV', '13_avanzamento.sql (buste)', v_tot, v_tot);
END $$;

-- ----------------------------------------------------------------------------
-- 4. Post-condizioni fail-loud — la spec dell'avanzamento, non una fotografia
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_end  date;
  v_bad  bigint;
  v_max  date;
BEGIN
  SELECT w_end INTO v_end FROM _w;

  -- (i) niente presenze nel futuro (ne' oggi, che e' una giornata in corso).
  --     La proprieta' e' sulla STORIA, non sulla finestra richiesta: una punta
  --     piu' avanti puo' venire legittimamente da un avanzamento precedente.
  SELECT count(*) INTO v_bad FROM sys.sys_attendance
   WHERE attendance_tenant_id = c_rtl AND attendance_date >= current_date;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'avanzamento: % presenze datate oggi o nel futuro (oggi %)', v_bad, current_date;
  END IF;

  -- (ii) nessun buco: ogni giorno lavorativo fino alla punta ha presenze
  SELECT max(attendance_date) INTO v_max FROM sys.sys_attendance
   WHERE attendance_tenant_id = c_rtl;
  SELECT count(*) INTO v_bad
    FROM staging.storia36_calendar c
   WHERE c.is_workday
     AND c.cal_date BETWEEN DATE '2023-08-01' AND v_max
     AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a
                     WHERE a.attendance_tenant_id = c_rtl AND a.attendance_date = c.cal_date);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'avanzamento: % giorni lavorativi senza alcuna presenza fino al %', v_bad, v_max;
  END IF;

  -- (iii) nessuna busta per un mese che non e' ancora finito
  SELECT count(*) INTO v_bad FROM sys.sys_user_pay_slips
   WHERE user_pay_slip_tenant_id = c_rtl AND user_pay_slip_period_end > current_date;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'avanzamento: % buste per un mese non ancora chiuso (oggi %)', v_bad, current_date;
  END IF;

  RAISE NOTICE 'storia36 ADV: post-condizioni OK — punta presenze %, finestra %', v_max, v_end;
END $$;

COMMIT;
