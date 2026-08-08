-- ============================================================================
-- storia36 C2 — tre cicli di performance (2023 innesto H2, 2024, 2025) + 2026
-- in corso: goals → check-in → review annuale (→ MID_YEAR 2026) → 360.
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C2)
-- Misura e macchina a stati: .storia36/analysis/c2-misura.md + c2-macchina-stati.md
--
-- Fatti che governano il design (dal codice e dal dato, non dalla doc):
--  · il ciclo performance NON ha write-path API (reviews/360/goals scritti solo
--    da import): la forma nativa è l'import SQL — la review COMPLETED
--    indistinguibile ha submitted_at+acknowledged_at e gli altri 6 timestamp
--    NULL, self_assessment_status NOT_STARTED, rating 1.00-5.00
--  · reviewer = manager gerarchico reale (reports_to; fallback admin al vertice)
--  · curva esiti ~10/70/20 (tratto stabile per utente + oscillazione annua)
--    su overall/goal_achievement/competency ± scarti deterministici
--  · goals: MBO bancari 3-7/anno (fonti nel diario C2), tipi dal catalogo reale;
--    2023 = innesto H2 (2 goal), 2024 = 4, 2026 = 4 (2025 esiste già: 944)
--  · check-in: >=2 per (soggetto, anno) dentro l'anno del goal
--  · 360: ciclo H2-2024 speculare all'H2-2025 esistente (MANAGER+SELF+PEER a
--    metà, anonimi, rating correlati alla curva)
--  · sys_assessments NON si tocca: semantica reale = skill assessment ESCO
--    (deviazione dal piano dichiarata nel diario)
--
-- Idempotente: chiavi STORIA36::C2::* con UQ (tenant, natural_key); twice-run
-- → delta 0 in staging.storia36_runs.
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
  v_admin uuid;
  v_n    bigint := 0;
  v_tot  bigint := 0;
  v_bad  bigint;
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
  -- 1. Scope RTL + manager + tratto di performance (curva 10/70/20)
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email,
         e.user_employment_hire_date AS hire,
         mgr.mgr_user_id,
         CASE WHEN pg_temp.h(u.user_id::text||'TRAIT') % 100 < 10 THEN 'TOP'
              WHEN pg_temp.h(u.user_id::text||'TRAIT') % 100 < 80 THEN 'MID'
              ELSE 'LOW' END AS trait,
         COALESCE(pos.position_title, '') AS ptitle,
         COALESCE(pos.position_title, '') ~* 'risk|compliance|audit|legal|controll' AS is_control,
         COALESCE(pos.position_title, '') ~* 'manager|director|head|chief|direttore|responsabile' AS is_mgr_role,
         COALESCE(pos.position_title, '') ~* 'teller|advisor|consulente|gestore|sales|commercial|relationship|branch|dealer' AS is_commercial
  FROM sys.sys_users u
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
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
  LEFT JOIN LATERAL (
    SELECT p.position_title
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
    WHERE a.user_position_assignment_user_id = u.user_id
      AND a.user_position_assignment_kind = 'PRIMARY'
      AND a.user_position_assignment_status = 'ACTIVE'
    LIMIT 1
  ) pos ON true
  WHERE u.user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
    AND u.user_status = 'ACTIVE'
    AND e.user_employment_hire_date IS NOT NULL;

  -- rating annuo deterministico: ANCORATO al ciclo legacy 2024 dove esiste
  -- (rilievo BLOCKER della review: senza ancora, la storia pluriennale della
  -- stessa persona era un dente di sega con correlazione ~0)
  CREATE TEMP TABLE _rating ON COMMIT DROP AS
  SELECT s.user_id, y.y,
         round(LEAST(4.90, GREATEST(1.90,
           base.b + (pg_temp.h(s.user_id::text||y.y||'RW') % 71 - 35) / 100.0
         ))::numeric, 2) AS overall
  FROM _scope s
  CROSS JOIN LATERAL (
    SELECT COALESCE(
      (SELECT pr.review_overall_rating FROM sys.sys_performance_reviews pr
        WHERE pr.review_subject_user_id = s.user_id
          AND pr.review_natural_key NOT LIKE 'STORIA36%'
          AND extract(year FROM pr.review_period_end)::int = 2024
          AND pr.review_overall_rating IS NOT NULL
        ORDER BY pr.review_period_end DESC LIMIT 1),
      CASE s.trait WHEN 'TOP' THEN 4.35 WHEN 'MID' THEN 3.45 ELSE 2.55 END)::numeric AS b
  ) base
  CROSS JOIN generate_series(2023, 2026) AS y(y);

  -- --------------------------------------------------------------------------
  -- 2. Goals: 2023 innesto H2 (2), 2024 (4), 2026 (4) — il 2025 esiste già
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _goal_titles ON COMMIT DROP AS
  SELECT * FROM (VALUES
    (1,  'Crescita raccolta gestita del portafoglio',    'PERFORMANCE'),
    (2,  'Incremento cross-selling prodotti assicurativi','CUSTOMER'),
    (3,  'Riduzione incidenza NPL del portafoglio',       'PERFORMANCE'),
    (4,  'Completamento percorso formativo MiFID II',     'DEVELOPMENT'),
    (5,  'Digitalizzazione delle pratiche di fido',       'EFFICIENCY'),
    (6,  'Miglioramento NPS di filiale',                  'CUSTOMER'),
    (7,  'Zero rilievi negli audit antiriciclaggio',      'COMPLIANCE'),
    (8,  'Onboarding nuova clientela retail',             'INDIVIDUAL'),
    (9,  'Riduzione dei tempi di istruttoria credito',    'EFFICIENCY'),
    (10, 'Qualità e completezza dei dati CRM',            'EFFICIENCY'),
    (11, 'Adozione strumenti di consulenza digitale',     'DEVELOPMENT'),
    (12, 'Contenimento del cost/income di area',          'PERFORMANCE'),
    (13, 'Rinnovo certificazione IVASS nei termini',      'COMPLIANCE'),
    (14, 'Sviluppo competenze di credito specialistico',  'DEVELOPMENT'),
    (15, 'Retention della clientela affluent',            'CUSTOMER')
  ) AS t(idx, title, gtype);

  CREATE TEMP TABLE _goals ON COMMIT DROP AS
  SELECT s.user_id, y.y, n.n,
         'STORIA36::C2::GOAL::' || s.user_id || '::' || y.y || '::' || n.n AS nk,
         tt.title || ' — MBO ' || y.y AS title,
         tt.gtype,
         gs.g_start,
         gd.g_due,
         st.status, st.progress, st.done_ts,
         CASE nc.cnt
           WHEN 2 THEN (ARRAY[0.60,0.40])[n.n]
           WHEN 3 THEN (ARRAY[0.50,0.30,0.20])[n.n]
           WHEN 4 THEN (ARRAY[0.40,0.30,0.20,0.10])[n.n]
           ELSE (ARRAY[0.30,0.25,0.20,0.15,0.10])[n.n]
         END AS gweight
  FROM _scope s
  CROSS JOIN (VALUES (2023), (2024), (2025), (2026)) AS y(y)
  CROSS JOIN LATERAL (
    SELECT CASE y.y WHEN 2023 THEN 2
           ELSE 3 + pg_temp.h(s.user_id::text||y.y||'NG') % 3 END AS cnt
  ) nc
  CROSS JOIN LATERAL generate_series(1, nc.cnt) AS n(n)
  JOIN _goal_titles tt
    ON tt.idx = CASE WHEN s.is_control
         -- funzioni di controllo: MAI obiettivi commerciali (politiche di
         -- remunerazione bancarie); pool 9 titoli, stride 2 coprimo di 9
         THEN (ARRAY[4,5,7,9,10,11,12,13,14])[1 + (pg_temp.h(s.user_id::text||y.y||'GT0') + n.n * 2) % 9]
         -- resto dell'organico: pool 11 titoli, stride 3 coprimo di 11
         ELSE (ARRAY[1,2,3,4,5,6,8,11,12,14,15])[1 + (pg_temp.h(s.user_id::text||y.y||'GT0') + n.n * 3) % 11]
       END
  CROSS JOIN LATERAL (
    SELECT CASE y.y
      WHEN 2023 THEN GREATEST(s.hire + 7, DATE '2023-08-01' + (pg_temp.h(s.user_id::text||y.y||n.n||'GS') % 25))
      WHEN 2024 THEN GREATEST(s.hire + 7, make_date(2024, 1, 8) + (pg_temp.h(s.user_id::text||y.y||n.n||'GS') % 21))
      WHEN 2025 THEN GREATEST(s.hire + 7, make_date(2025, 1, 8) + (pg_temp.h(s.user_id::text||y.y||n.n||'GS') % 21))
      ELSE GREATEST(s.hire + 7, make_date(2026, 1, 12) + (pg_temp.h(s.user_id::text||y.y||n.n||'GS') % 18))
    END AS g_start
  ) gs
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN y.y = 2023 THEN DATE '2023-12-31'
      WHEN y.y = 2024 THEN CASE WHEN pg_temp.h(s.user_id::text||y.y||n.n||'GD') % 4 = 0
                                THEN DATE '2024-06-30' ELSE DATE '2024-12-31' END
      WHEN y.y = 2025 THEN CASE WHEN pg_temp.h(s.user_id::text||y.y||n.n||'GD') % 4 = 0
                                THEN DATE '2025-06-30' ELSE DATE '2025-12-31' END
      ELSE CASE WHEN pg_temp.h(s.user_id::text||y.y||n.n||'GD') % 10 < 3
                THEN DATE '2026-06-30' ELSE DATE '2026-12-31' END
    END AS g_due
  ) gd
  CROSS JOIN LATERAL (
    SELECT * FROM (
      SELECT CASE
        WHEN y.y <= 2025 THEN
          CASE WHEN pg_temp.h(s.user_id::text||y.y||n.n||'GF') % 100 < 87 THEN 'COMPLETED' ELSE 'CANCELLED' END
        WHEN gd.g_due = DATE '2026-06-30' THEN
          CASE WHEN pg_temp.h(s.user_id::text||y.y||n.n||'GF') % 3 < 2 THEN 'COMPLETED' ELSE 'AT_RISK' END
        ELSE (ARRAY['IN_PROGRESS','ON_TRACK','AT_RISK'])[1 + pg_temp.h(s.user_id::text||y.y||n.n||'GF') % 3]
      END AS status
    ) x
    CROSS JOIN LATERAL (
      SELECT CASE
        -- COMPLETED => progress 100 (invariante legacy 100/100; l'attainment
        -- parziale vive nel review_goal_achievement_rating, non nel progress)
        WHEN x.status = 'COMPLETED' THEN 100
        WHEN x.status = 'CANCELLED' THEN pg_temp.h(s.user_id::text||y.y||n.n||'GP') % 40
        ELSE 20 + pg_temp.h(s.user_id::text||y.y||n.n||'GP') % 51
      END AS progress
    ) p
    CROSS JOIN LATERAL (
      SELECT CASE WHEN x.status = 'COMPLETED'
        THEN (SELECT max(cal_date) FROM staging.storia36_calendar
               WHERE is_workday
                 AND cal_date <= GREATEST(gs.g_start + 14,
                       LEAST(gd.g_due, c_to) - (pg_temp.h(s.user_id::text||y.y||n.n||'GDN') % 15))
                 AND cal_date >= gs.g_start)::timestamp
             + ((9 + pg_temp.h(s.user_id::text||y.y||n.n||'GDH') % 8) || ' hours')::interval
        END AS done_ts
    ) d
  ) st
  WHERE s.hire <= make_date(y.y, 10, 1)
    AND gs.g_start < gd.g_due
    -- il 2025 esiste gia' (944 goal legacy): si semina SOLO per chi non ne ha
    AND (y.y <> 2025 OR NOT EXISTS (
          SELECT 1 FROM sys.sys_goals lg
          WHERE lg.goal_subject_user_id = s.user_id
            AND lg.goal_natural_key NOT LIKE 'STORIA36%'
            AND extract(year FROM lg.goal_start_date)::int = 2025));

  INSERT INTO sys.sys_goals (
    goal_id, goal_tenant_id, goal_natural_key, goal_subject_user_id,
    goal_title, goal_description, goal_type, goal_priority,
    goal_status, goal_progress_percent, goal_start_date, goal_due_date,
    goal_completed_at, goal_weight)
  SELECT
    uuid_generate_v5(c_ns, g.nk), c_rtl, g.nk, g.user_id,
    g.title, g.title || '. Obiettivo assegnato nel ciclo MBO ' || g.y || '.',
    g.gtype,
    (ARRAY['MEDIUM','HIGH','MEDIUM','LOW'])[1 + pg_temp.h(g.nk||'PR') % 4],
    g.status, LEAST(g.progress, 100), g.g_start, g.g_due,
    g.done_ts, g.gweight
  FROM _goals g
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C2: goals inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 3. Check-in: 2 per goal attivo/concluso, dentro l'anno del goal
  --    (copre C2b anche per i goal 2025 esistenti, che non ne hanno)
  -- --------------------------------------------------------------------------
  INSERT INTO sys.sys_goal_check_ins (
    check_in_id, check_in_tenant_id, check_in_goal_id, check_in_subject_user_id,
    check_in_natural_key, check_in_date,
    check_in_previous_progress, check_in_new_progress,
    check_in_status_update, check_in_confidence_level)
  SELECT
    uuid_generate_v5(c_ns, k.nk), c_rtl, k.goal_id, k.subj, k.nk, k.d,
    k.prev_p, k.new_p,
    CASE WHEN k.i = 3 AND k.goal_status = 'COMPLETED' THEN 'COMPLETED'
         WHEN k.i = 3 AND k.goal_status = 'CANCELLED' THEN 'BLOCKED'
         WHEN pg_temp.h(k.nk||'ST') % 12 = 0 THEN 'AHEAD'
         WHEN k.new_p < 30 AND pg_temp.h(k.nk||'ST') % 3 = 0 THEN 'AT_RISK'
         ELSE 'ON_TRACK' END,
    3 + pg_temp.h(k.nk||'CF') % 2
  FROM (
    SELECT g.goal_id, g.goal_subject_user_id AS subj, i.i, g.goal_status,
           'STORIA36::C2::CHK::' || g.goal_id || '::' || i.i AS nk,
           -- snap al workday precedente in cui il soggetto NON e' assente (C1)
           (SELECT max(c2.cal_date) FROM staging.storia36_calendar c2
             WHERE c2.is_workday
               AND c2.cal_date <= LEAST(
                     g.goal_start_date + 14
                       + ((LEAST(COALESCE(g.goal_due_date, c_to), c_to,
                                 make_date(extract(year FROM g.goal_start_date)::int, 12, 20))
                           - g.goal_start_date - 14) * i.i / 3),
                     c_to)
               AND c2.cal_date >= g.goal_start_date
               AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a2
                               WHERE a2.attendance_subject_user_id = g.goal_subject_user_id
                                 AND a2.attendance_date = c2.cal_date
                                 AND a2.attendance_status IN ('VACATION','SICK','PAID_LEAVE','UNPAID_LEAVE','ABSENT'))
           ) AS d,
           (g.goal_progress_percent * (i.i - 1) / 3)::int AS prev_p,
           (g.goal_progress_percent * i.i / 3)::int AS new_p
    FROM sys.sys_goals g
    CROSS JOIN generate_series(1, 3) AS i(i)
    WHERE g.goal_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND g.goal_subject_user_id IS NOT NULL
      -- anche CANCELLED (il goal ha avuto vita prima di morire) e NOT_STARTED
      -- (check-in di kickoff senza avanzamento): C2b vuole >=2 per (soggetto,anno)
      AND g.goal_start_date >= DATE '2023-01-01'
  ) k
  WHERE k.d IS NOT NULL
    AND k.d > (SELECT hire FROM _scope s WHERE s.user_id = k.subj)
    AND k.d <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C2: check-in inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 4. Review: ANNUAL 2023/2024(mancanti)/2025 + MID_YEAR 2026 (metà organico)
  --    Forma import: COMPLETED, submitted+acknowledged, altri timestamp NULL
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _rev ON COMMIT DROP AS
  SELECT s.user_id, s.mgr_user_id, y.y,
         'STORIA36::C2::REV::' || s.user_id || '::' || y.y AS nk,
         'ANNUAL'::text AS rtype,
         make_date(y.y, 1, 1) AS p_start,
         make_date(y.y, 12, 31) AS p_end,
         r.overall
  FROM _scope s
  CROSS JOIN (VALUES (2023), (2024), (2025)) AS y(y)
  JOIN _rating r ON r.user_id = s.user_id AND r.y = y.y
  WHERE s.hire <= make_date(y.y, 10, 1)
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_performance_reviews pr
      WHERE pr.review_subject_user_id = s.user_id
        AND extract(year FROM pr.review_period_end)::int = y.y)
  UNION ALL
  SELECT s.user_id, s.mgr_user_id, 2026,
         'STORIA36::C2::REV::' || s.user_id || '::2026H1',
         'MID_YEAR',
         DATE '2026-01-01', DATE '2026-06-30',
         r.overall
  FROM _scope s
  JOIN _rating r ON r.user_id = s.user_id AND r.y = 2026
  WHERE (s.is_mgr_role OR s.is_commercial)  -- coorte di business, non campione casuale
    AND s.hire <= DATE '2026-04-01'
    AND NOT EXISTS (
      SELECT 1 FROM sys.sys_performance_reviews pr
      WHERE pr.review_subject_user_id = s.user_id
        AND extract(year FROM pr.review_period_end)::int = 2026);

  INSERT INTO sys.sys_performance_reviews (
    review_id, review_tenant_id, review_natural_key,
    review_subject_user_id, review_reviewer_user_id,
    review_period_start, review_period_end, review_type, review_status,
    review_potential_rating, review_overall_rating,
    review_goal_achievement_rating, review_competency_rating,
    review_performance_box, review_potential_box,
    review_strengths, review_areas_for_improvement, review_manager_comments,
    review_metadata,
    review_submitted_at, review_acknowledged_at, review_self_assessment_status)
  SELECT
    uuid_generate_v5(c_ns, r.nk), c_rtl, r.nk,
    r.user_id,
    COALESCE(NULLIF(r.mgr_user_id, r.user_id), v_admin),
    r.p_start, r.p_end, r.rtype, 'COMPLETED',
    CASE WHEN pg_temp.h(r.nk||'PT') % 10 < 2 THEN 'LOW'
         WHEN pg_temp.h(r.nk||'PT') % 10 < 8 THEN 'MEDIUM' ELSE 'HIGH' END,
    r.overall,
    round(LEAST(5.00, GREATEST(1.00, r.overall + (pg_temp.h(r.nk||'GA') % 5 - 2) / 10.0))::numeric, 2),
    round(LEAST(5.00, GREATEST(1.00, r.overall + (pg_temp.h(r.nk||'CO') % 5 - 2) / 10.0))::numeric, 2),
    1 + (r.overall >= 2.5)::int + (r.overall >= 4.0)::int,  -- soglie del ciclo legacy 2024
    CASE WHEN pg_temp.h(r.nk||'PT') % 10 < 2 THEN 1
         WHEN pg_temp.h(r.nk||'PT') % 10 < 8 THEN 2 ELSE 3 END,
    (ARRAY['Solida padronanza del ruolo e affidabilità costante',
           'Ottima relazione con la clientela e spirito di squadra',
           'Rigore normativo e attenzione al dettaglio',
           'Proattività nel proporre miglioramenti di processo',
           'Buona autonomia operativa e gestione delle priorità',
           'Capacità di apprendimento rapido su nuovi strumenti'])[1 + pg_temp.h(r.nk||'STR') % 6],
    (ARRAY['Ampliare la delega e la responsabilizzazione dei collaboratori',
           'Rafforzare la pianificazione delle attivita'' di lungo periodo',
           'Sviluppare la visione cross-funzionale oltre il proprio presidio',
           'Consolidare la comunicazione proattiva verso gli stakeholder',
           'Approfondire gli strumenti digitali di nuova adozione',
           'Gestire con piu'' anticipo i picchi di carico stagionali'])[1 + pg_temp.h(r.nk||'AFI') % 6],
    (ARRAY['Obiettivi sostanzialmente raggiunti nel periodo di riferimento.',
           'Percorso in linea con le attese; consolidare i risultati commerciali.',
           'Anno positivo; ampliare l''autonomia su pratiche complesse.',
           'Contributo costante al team; sviluppare la visione trasversale.',
           'Risultati oltre le attese su più obiettivi assegnati.',
           'Periodo con margini di crescita; piano di sviluppo condiviso.'])[1 + pg_temp.h(r.nk||'MC') % 6],
    jsonb_build_object('storia36_cluster', 'C2'),
    ts.sub_ts, ts.ack_ts, 'NOT_STARTED'
  FROM _rev r
  CROSS JOIN LATERAL (
    SELECT sub_d::timestamp
             + ((9 + pg_temp.h(r.nk||'SH') % 8) || ' hours')::interval
             + ((pg_temp.h(r.nk||'SM') % 60) || ' minutes')::interval AS sub_ts,
           -- candidato snap-in-avanti (non assente), poi snap-INDIETRO finale a
           -- un workday <= c_to (il cap nudo su c_to poteva cadere di domenica)
           (SELECT max(c4.cal_date) FROM staging.storia36_calendar c4
             WHERE c4.is_workday
               AND c4.cal_date <= LEAST(COALESCE(
                 (SELECT min(c3.cal_date) FROM staging.storia36_calendar c3
                   WHERE c3.is_workday AND c3.cal_date >= sub_d + 2 + pg_temp.h(r.nk||'AK') % 7
                     AND NOT EXISTS (SELECT 1 FROM sys.sys_attendance a3
                                     WHERE a3.attendance_subject_user_id = r.user_id
                                       AND a3.attendance_date = c3.cal_date
                                       AND a3.attendance_status IN ('VACATION','SICK','PAID_LEAVE','UNPAID_LEAVE','ABSENT'))),
                 sub_d + 9), c_to)
               AND c4.cal_date > sub_d)::timestamp
             + ((9 + pg_temp.h(r.nk||'AH') % 8) || ' hours')::interval AS ack_ts
    FROM (
      SELECT COALESCE(
        (SELECT max(cal_date) FROM staging.storia36_calendar
         WHERE is_workday AND cal_date <=
           CASE WHEN r.rtype = 'MID_YEAR' THEN DATE '2026-07-06' + (pg_temp.h(r.nk||'SD') % 13)
                ELSE make_date(r.y + 1, 1, 12) + (pg_temp.h(r.nk||'SD') % 20) END),
        make_date(r.y + 1, 1, 15)) AS sub_d
    ) x
  ) ts
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C2: review inserite %', v_n;

  -- 4b. Competency ratings KSABA (3 dimensioni fisse, come il ciclo 2024)
  INSERT INTO sys.sys_performance_review_competency_ratings (
    rating_id, rating_tenant_id, rating_review_id, rating_subject_user_id,
    rating_natural_key, rating_ksaba_dimension, rating_competency_name,
    rating_self_rating, rating_manager_rating, rating_weight)
  SELECT
    uuid_generate_v5(c_ns, pr.review_natural_key || '::COMP::' || d.dim),
    c_rtl, pr.review_id, pr.review_subject_user_id,
    pr.review_natural_key || '::COMP::' || d.dim,
    d.dim, d.cname,
    round(LEAST(5.00, GREATEST(1.00,
      pr.review_competency_rating + (pg_temp.h(pr.review_natural_key||d.dim||'SR') % 9 - 3) / 10.0))::numeric, 2),
    round(LEAST(5.00, GREATEST(1.00,
      pr.review_competency_rating + (pg_temp.h(pr.review_natural_key||d.dim||'MR') % 7 - 3) / 10.0))::numeric, 2),
    d.w
  FROM sys.sys_performance_reviews pr
  JOIN (VALUES
    ('KNOWLEDGE', 'Domain Knowledge',     1.20),
    ('SKILL',     'Technical Execution',  1.00),
    ('BEHAVIOR',  'Professional Conduct', 0.80)
  ) AS d(dim, cname, w) ON true
  WHERE pr.review_natural_key LIKE 'STORIA36::C2::REV::%'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C2: competency ratings inseriti %', v_n;

  -- --------------------------------------------------------------------------
  -- 5. 360 H2-2024 (speculare all'H2-2025 esistente): MANAGER + SELF per tutti
  --    gli assunti entro giu-2024, PEER per metà; anonimi, COMPLETED
  -- --------------------------------------------------------------------------
  CREATE TEMP TABLE _peer ON COMMIT DROP AS
  WITH ord AS (
    SELECT user_id, mgr_user_id, hire,
           row_number() OVER (ORDER BY pg_temp.h(user_id::text||'PEERORD')) AS rn,
           count(*) OVER () AS n
    FROM _scope
  )
  SELECT o.user_id, o.mgr_user_id, o.hire,
         (SELECT o2.user_id FROM ord o2 WHERE o2.rn = (o.rn % o.n) + 1) AS peer1,
         (SELECT o3.user_id FROM ord o3 WHERE o3.rn = ((o.rn + 1) % o.n) + 1) AS peer2
  FROM ord o;

  INSERT INTO sys.sys_feedback_360_responses (
    response_id, response_tenant_id, response_natural_key,
    response_target_user_id, response_reviewer_user_id,
    response_relationship_type, response_overall_rating,
    response_strengths, response_areas_for_improvement,
    response_is_anonymous, response_status, response_completed_at,
    response_review_id)
  SELECT
    uuid_generate_v5(c_ns, f.nk), c_rtl, f.nk,
    f.target, f.reviewer, f.kind,
    round(LEAST(5.00, GREATEST(1.00, r.overall + (pg_temp.h(f.nk||'FR') % 9 - 4) / 10.0))::numeric, 2),
    (ARRAY['Collaborazione costante', 'Affidabilità sulle scadenze', 'Disponibilità verso i colleghi',
           'Competenza tecnica solida', 'Comunicazione chiara'])[1 + pg_temp.h(f.nk||'FS') % 5],
    (ARRAY['Delegare con più fiducia', 'Comunicazione proattiva sugli avanzamenti',
           'Ampliare la visione cross-funzionale', 'Gestione del tempo nei picchi'])[1 + pg_temp.h(f.nk||'FA') % 4],
    true, 'COMPLETED',
    (SELECT max(cal_date) FROM staging.storia36_calendar
      WHERE is_workday AND cal_date <= DATE '2024-10-01' + (pg_temp.h(f.nk||'FD') % 60))::timestamp
      + ((9 + pg_temp.h(f.nk||'FH') % 8) || ' hours')::interval,
    (SELECT pr.review_id FROM sys.sys_performance_reviews pr
      WHERE pr.review_subject_user_id = f.target
        AND pr.review_type = 'ANNUAL'
        AND extract(year FROM pr.review_period_end)::int = 2024
      ORDER BY pr.review_status = 'COMPLETED' DESC LIMIT 1)
  FROM (
    SELECT p.user_id AS target,
           COALESCE(NULLIF(p.mgr_user_id, p.user_id), v_admin) AS reviewer,
           'MANAGER'::text AS kind,
           'STORIA36::C2::F360::' || p.user_id || '::2024::MANAGER' AS nk
    FROM _peer p WHERE p.hire <= DATE '2024-06-01'
    UNION ALL
    SELECT p.user_id, p.user_id, 'SELF',
           'STORIA36::C2::F360::' || p.user_id || '::2024::SELF'
    FROM _peer p WHERE p.hire <= DATE '2024-06-01'
    UNION ALL
    SELECT p.user_id,
           COALESCE(NULLIF(NULLIF(p.peer1, p.user_id), p.mgr_user_id),
                    NULLIF(NULLIF(p.peer2, p.user_id), p.mgr_user_id)),
           'PEER',
           'STORIA36::C2::F360::' || p.user_id || '::2024::PEER'
    FROM _peer p
    WHERE p.hire <= DATE '2024-06-01'
      AND pg_temp.h(p.user_id::text||'PEERG') % 2 = 0
  ) f
  JOIN _rating r ON r.user_id = f.target AND r.y = 2024
  WHERE f.reviewer IS NOT NULL
    AND NOT (f.kind IN ('MANAGER','PEER') AND f.reviewer = f.target)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C2: risposte 360 H2-2024 inserite %', v_n;

  -- --------------------------------------------------------------------------
  -- 6. Registro provenance + post-condizioni
  -- --------------------------------------------------------------------------
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C2', '02_performance.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c2a();
  PERFORM staging.storia36_check_c2b();
  PERFORM staging.storia36_check_c2c();
  PERFORM staging.storia36_check_c2d();

  SELECT count(*) INTO v_bad
  FROM sys.sys_goals
  WHERE goal_natural_key LIKE 'STORIA36::C2::%'
    AND (goal_start_date >= goal_due_date
         OR (goal_status = 'COMPLETED' AND goal_completed_at IS NULL));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'C2 post: % goal seminati incoerenti (date o completamento)', v_bad;
  END IF;

  RAISE NOTICE 'storia36 C2 OK: % righe scritte in questa corsa (delta atteso 0 alla seconda)', v_tot;
END $$;

COMMIT;
