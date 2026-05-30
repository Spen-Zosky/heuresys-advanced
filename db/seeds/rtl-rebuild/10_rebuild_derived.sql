-- 10_rebuild_derived.sql — refresh derived/materialized data after the rebuild.
-- Idempotent. Run via psql AFTER 09. Non-destructive.
--
-- Architecture note (LIVE DATA doctrine, NEXT_SESSION_MVP_2A.md): the org-chart, dashboards,
-- compensation-intelligence and career-succession views read LIVE from /v1/* endpoints hitting
-- sys_positions / sys_user_position_assignments / sys_organization_units. Once 02-08 wired the real
-- org, those surfaces render authentic data automatically — NO derived seed is needed for them.
-- The pre-rebuild demo seeds db/seeds/org_chart_rtl_demo.sql and db/seeds/rtl_positions_hierarchy.sql
-- targeted the SYNTHETIC scaffold (now deleted in 09) and are NOT re-run here.
--
-- What genuinely needs a refresh = materialized views (e.g. the PIP, I9/ADR-0008) which cache rows.

DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT schemaname, matviewname FROM pg_matviews WHERE schemaname = 'sys' LOOP
    EXECUTE format('REFRESH MATERIALIZED VIEW %I.%I', r.schemaname, r.matviewname);
    RAISE NOTICE 'refreshed materialized view %.%', r.schemaname, r.matviewname;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'Refreshed % materialized view(s) in schema sys.', n;
END $$;

-- VERIFY (pre-computed score tables, if any are seed-generated rather than live/endpoint-computed):
--   sys_succession_scores, sys_readiness_scores, sys_reward_gate_results, sys_gap_analysis_results,
--   sys_talent_scores, sys_employee_position_fit_scores. Inspect whether each is populated by an
--   endpoint/service on read (live) or by a generator seed. Those that are generator-seeded must be
--   regenerated from the real incumbents; those computed live need no action. (Most v5 intelligence
--   surfaces are endpoint-computed per the LIVE DATA doctrine.)

-- Informational: confirm the real org is in place for the live surfaces.
DO $$
DECLARE pos int; asg int; ou int;
BEGIN
  SELECT count(*) INTO pos FROM sys.sys_positions WHERE position_metadata ? 'legacy_employee_id';
  SELECT count(*) INTO ou  FROM sys.sys_organization_units WHERE organization_unit_metadata ? 'legacy_org_unit_id';
  SELECT count(*) INTO asg FROM sys.sys_user_position_assignments a
    JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
    WHERE split_part(u.user_email,'@',2) IN ('rtl-bank.org','heuresys.com');
  RAISE NOTICE 'Live org ready: real positions=%, real OUs=%, real-user assignments=%', pos, ou, asg;
END $$;
