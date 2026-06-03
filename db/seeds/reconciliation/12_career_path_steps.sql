-- db/seeds/reconciliation/12_career_path_steps.sql
-- F3 PARTIAL import: sys.sys_career_path_steps from legacy public.career_path_levels (35/75 resolve).
-- Path FK via LEGACY_CP:: (35 levels of 7 imported paths); the 40 levels of non-imported paths skip.
-- origin/target_position_id stay NULL (career_path_levels.target_job_id is 100% NULL — no step-level position).
-- Staging: staging.tmp_f3c_cpl (id, path_id, title, level_order, skill_gap_threshold).
-- IDEMPOTENT: anti-join on (path_id, ordinal).
BEGIN;
INSERT INTO sys.sys_career_path_steps (
  career_path_step_path_id, career_path_step_ordinal,
  career_path_step_required_proficiency_uplift, career_path_step_metadata)
SELECT cp.career_path_id, s.level_order, jsonb_build_object('skill_gap_threshold', coalesce(s.skill_gap_threshold, 0.5)),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'career_path_levels', 'source_id', s.id, 'title', s.title, 'level_order', s.level_order)))
FROM staging.tmp_f3c_cpl s
JOIN sys.sys_career_paths cp ON cp.career_path_code = 'LEGACY_CP::' || s.path_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_career_path_steps st
  WHERE st.career_path_step_path_id = cp.career_path_id AND st.career_path_step_ordinal = s.level_order);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_career_path_steps;
  RAISE NOTICE 'career_path_steps: % rows', v; IF v=0 THEN RAISE EXCEPTION 'career_path_steps: 0 imported'; END IF; END $$;
COMMIT;
