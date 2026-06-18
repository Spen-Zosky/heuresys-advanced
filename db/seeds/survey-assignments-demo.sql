-- ============================================================================
-- db/seeds/survey-assignments-demo.sql — Surveys-M2 demo assignments (RTL).
-- ----------------------------------------------------------------------------
-- M2 makes survey audience explicit (sys_survey_assignments). This seed assigns
-- every 'active' survey of the RTL_BANK reference tenant to the 5 real seeded
-- personas, so the ESS /v1/me/surveys path + the Playwright E2E have live data
-- (an employee with an assigned, not-yet-completed survey). Idempotent (ON
-- CONFLICT DO NOTHING) + dynamic (resolves survey/user ids by query, no hardcode).
-- Writes ONLY to RTL_BANK (synthetic, no-PII — ADR-0023), NEVER HEURESYS.
-- Safe to re-run. Authored: 2026-06-18 (Surveys-M2).
-- ============================================================================

INSERT INTO sys.sys_survey_assignments
  (survey_assignment_survey_id, survey_assignment_user_id, survey_assignment_tenant_id)
SELECT s.survey_id, u.user_id, s.survey_tenant_id
FROM sys.sys_surveys s
JOIN sys.sys_users u ON u.user_tenant_id = s.survey_tenant_id
WHERE s.survey_status = 'active'
  AND s.survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
  AND u.user_email IN (
    'federica.marchetti@rtl-bank.org',
    'paolo.caputo@rtl-bank.org',
    'tommaso.fiore@rtl-bank.org',
    'antonio.parisi@rtl-bank.org'
  )
ON CONFLICT (survey_assignment_survey_id, survey_assignment_user_id) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_survey_assignments a
  JOIN sys.sys_surveys s ON s.survey_id = a.survey_assignment_survey_id
  WHERE s.survey_status = 'active' AND a.survey_assignment_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  RAISE NOTICE 'survey-assignments-demo: % active-survey assignments present for RTL personas', n;
END $$;
