-- ============================================================================
-- storia36 C2 — riparazioni ONE-SHOT sul dato LEGACY del ciclo performance
-- (triage esito c dalla misura C2, .storia36/analysis/c2-misura.md).
-- FUORI dal glob custodia (repair/ = one-shot manuali). Guardate e idempotenti.
--
--  P1 1.000 check-in con subject = admin@heuresys.com (cross-tenant, bug
--     dell'import legacy: subject = creatore) → subject = soggetto del goal
--  P2 100 goal COMPLETED con completed_at NULL → data di completamento
--     deterministica dentro [start, LEAST(due, fine storia)]
--  P3 review con reviewer diverso dal manager gerarchico (o NULL) → manager
--     reale via reports_to (fallback admin per il vertice)
--  P4 goal NOT_STARTED con progress > 0 → IN_PROGRESS
--  P5 goal con progress disallineato dall'ultimo check-in → allineato
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_admin uuid;
  v_n   bigint := 0;
  v_tot bigint := 0;
  v_bad bigint;
BEGIN
  -- L'attore si DERIVA dal ruolo: fino al 2026-08-08 questa riga cercava
  -- `admin@heuresys.com`, rimosso dalla migrazione 000295 (`#139`), e con
  -- `INTO STRICT` su zero righe questo file di riparazione moriva appena
  -- qualcuno lo rilanciava.
  SELECT u.user_id INTO v_admin
    FROM sys.sys_users u
    JOIN sys.sys_user_auth_roles ur
      ON ur.user_auth_role_user_id = u.user_id AND ur.user_auth_role_revoked_at IS NULL
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
   WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
   ORDER BY u.user_email
   LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'nessun PLATFORM_ADMIN attivo da usare come attore';
  END IF;

  -- P1: subject dei check-in = soggetto del goal (mai il creatore cross-tenant)
  UPDATE sys.sys_goal_check_ins c
     SET check_in_subject_user_id = g.goal_subject_user_id
  FROM sys.sys_goals g
  WHERE g.goal_id = c.check_in_goal_id
    AND g.goal_subject_user_id IS NOT NULL
    AND c.check_in_subject_user_id IS DISTINCT FROM g.goal_subject_user_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'P1 check-in subject riallineati al goal: %', v_n;

  -- P2: goal COMPLETED senza data di completamento
  UPDATE sys.sys_goals g
     SET goal_completed_at = f.done_ts, updated_at = now()
  FROM (
    SELECT g2.goal_id,
           (GREATEST(g2.goal_start_date + 7,
                     LEAST(COALESCE(g2.goal_due_date, DATE '2026-07-20'), DATE '2026-07-20')
                       - (pg_temp.h(g2.goal_id::text||'GC') % 20)))::timestamp
             + ((9 + pg_temp.h(g2.goal_id::text||'GH') % 8) || ' hours')::interval AS done_ts
    FROM sys.sys_goals g2
    WHERE g2.goal_status = 'COMPLETED' AND g2.goal_completed_at IS NULL
  ) f
  WHERE f.goal_id = g.goal_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'P2 goal COMPLETED datati: %', v_n;

  -- P3: reviewer = manager gerarchico reale (fallback admin per il vertice)
  UPDATE sys.sys_performance_reviews r
     SET review_reviewer_user_id = f.want, updated_at = now()
  FROM (
    SELECT r2.review_id,
           COALESCE(NULLIF(m.mgr, r2.review_subject_user_id), v_admin) AS want
    FROM sys.sys_performance_reviews r2
    LEFT JOIN LATERAL (
      SELECT a2.user_position_assignment_user_id AS mgr
      FROM sys.sys_user_position_assignments a1
      JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
      JOIN sys.sys_user_position_assignments a2
           ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
          AND a2.user_position_assignment_kind = 'PRIMARY'
          AND a2.user_position_assignment_status = 'ACTIVE'
      WHERE a1.user_position_assignment_user_id = r2.review_subject_user_id
        AND a1.user_position_assignment_kind = 'PRIMARY'
        AND a1.user_position_assignment_status = 'ACTIVE'
      LIMIT 1
    ) m ON true
    WHERE r2.review_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND r2.review_subject_user_id IS NOT NULL
  ) f
  WHERE f.review_id = r.review_id
    AND r.review_reviewer_user_id IS DISTINCT FROM f.want;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'P3 reviewer → manager gerarchico: %', v_n;

  -- P4: NOT_STARTED con progresso già maturato → IN_PROGRESS
  UPDATE sys.sys_goals
     SET goal_status = 'IN_PROGRESS', updated_at = now()
   WHERE goal_status = 'NOT_STARTED' AND goal_progress_percent > 0;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'P4 NOT_STARTED con progress>0 → IN_PROGRESS: %', v_n;

  -- P5: progress del goal = ultimo check-in
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
  RAISE NOTICE 'P5 progress allineato all''ultimo check-in: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C2', 'repair/2026-07-28_c2_legacy_oneshot.sql', v_tot, v_tot);

  -- Post-condizioni
  SELECT count(*) INTO v_bad
  FROM sys.sys_goal_check_ins c JOIN sys.sys_goals g ON g.goal_id = c.check_in_goal_id
  WHERE g.goal_subject_user_id IS NOT NULL
    AND c.check_in_subject_user_id IS DISTINCT FROM g.goal_subject_user_id;
  IF v_bad > 0 THEN RAISE EXCEPTION 'P1 incompleto: % check-in disallineati', v_bad; END IF;

  SELECT count(*) INTO v_bad FROM sys.sys_goals
  WHERE goal_status = 'COMPLETED' AND goal_completed_at IS NULL;
  IF v_bad > 0 THEN RAISE EXCEPTION 'P2 incompleto: % COMPLETED senza data', v_bad; END IF;

  RAISE NOTICE 'storia36 C2 legacy one-shot OK: % righe toccate in questa corsa', v_tot;
END $$;

COMMIT;
