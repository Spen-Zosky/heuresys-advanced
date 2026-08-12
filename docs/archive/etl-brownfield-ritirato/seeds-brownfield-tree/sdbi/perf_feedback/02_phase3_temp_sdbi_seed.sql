-- db/seeds/brownfield/sdbi/perf_feedback/02_phase3_temp_sdbi_seed.sql  (SDBI Phase 3 seed)
-- D6 — SDBI Option-B slice: PerformanceReviews + Feedback360.
-- Reference: db/seeds/brownfield/sdbi/goals_pilot/02_phase3_temp_sdbi_seed.sql + _template/.
--
-- Loads the RAW legacy-shaped staging mirrors (temp_sdbi.pf_*) from CSVs extracted RTL-scoped
-- directly from the legacy VM. The task authorizes a direct staging COPY (file-based scp) rather
-- than routing through legacy_mirror — chosen here as the simplest correct path.
--
-- PRE-STEP (run once, outside this file, before \copy — produces the 4 CSVs):
--   On the legacy VM (oracle-vm-default, db heuresys_platform, read-only, no-PII ADR-0023),
--   COPY each source RTL-scoped (tenant_id IN the 2 legacy RTL tenants
--   '0c54b84a-…' , 'd5855519-…' -> canonical RTL) to /tmp/d6_export/{pr,crr,f360,cf}.csv
--   WITH (FORMAT csv), column order EXACTLY matching the \copy column lists below, then scp
--   the CSVs to a local dir. (The COPY SELECTs are the column lists below, in order.)
--   See docs/kb/D6_SDBI_OPTION_B_DESIGN.md §3 for the RTL tenant set + resolvability table.
--
-- Idempotent: TRUNCATE-then-COPY (the staging tables hold only this run's raw rows; Phase 5
--   resolves + upserts into sys.* with ON CONFLICT, so re-running 02 then 03 is a no-op net).
-- Run via: psql … -v ON_ERROR_STOP=1 -f this_file   (after editing the CSV paths below).
--
-- NOTE: the \copy source paths below are placeholders ('<CSV_DIR>/…'); set them to the local
-- directory the CSVs were scp'd to before running. During the S961 supervised run the CSVs lived
-- in a throwaway local dir and were loaded with these exact column lists.

BEGIN;

TRUNCATE temp_sdbi.pf_performance_reviews,
         temp_sdbi.pf_competency_review_ratings,
         temp_sdbi.pf_feedback_360,
         temp_sdbi.pf_continuous_feedback;

\copy temp_sdbi.pf_performance_reviews (_legacy_id,_legacy_tenant_id,_legacy_employee_id,_legacy_reviewer_id,_legacy_calibrated_by,_legacy_finalized_by,_legacy_review_cycle_id,_legacy_template_id,review_period_start,review_period_end,review_type,review_status,potential_rating,overall_rating,goal_achievement_rating,competency_rating,self_rating,calibrated_rating,pre_calibration_rating,performance_box,potential_box,strengths,areas_for_improvement,manager_comments,employee_comments,self_comments,development_plan,career_aspirations,calibration_notes,section_ratings,competency_ratings,goal_ratings,recommended_actions,self_submitted_at,manager_submitted_at,calibrated_at,finalized_at,self_review_completed_at,shared_at,submitted_at,acknowledged_at,self_assessment_status,created_at,updated_at) FROM '<CSV_DIR>/pr.csv' WITH (FORMAT csv)

\copy temp_sdbi.pf_competency_review_ratings (_legacy_id,_legacy_tenant_id,_legacy_performance_review_id,_legacy_employee_id,_legacy_competency_id,ksaba_dimension,competency_name,self_rating,self_comment,self_evidence,manager_rating,manager_comment,weight,created_at,updated_at) FROM '<CSV_DIR>/crr.csv' WITH (FORMAT csv)

\copy temp_sdbi.pf_feedback_360 (_legacy_id,_legacy_tenant_id,_legacy_target_employee_id,_legacy_reviewer_employee_id,_legacy_review_cycle_id,_legacy_performance_review_id,_legacy_questionnaire_id,_legacy_request_id,relationship_type,overall_rating,strengths,areas_for_improvement,is_anonymous,status,sentiment_score,submission_time_seconds,completed_at,created_at) FROM '<CSV_DIR>/f360.csv' WITH (FORMAT csv)

\copy temp_sdbi.pf_continuous_feedback (_legacy_id,_legacy_tenant_id,_legacy_from_employee_id,_legacy_to_employee_id,_legacy_related_goal_id,_legacy_competency_id,_legacy_performance_review_id,feedback_type,message,category,visibility,is_private,tags,sentiment_score,acknowledged,acknowledged_at,created_at) FROM '<CSV_DIR>/cf.csv' WITH (FORMAT csv)

COMMIT;

-- Verify staging counts (expect RTL: 161 / 465 / 390 / 474)
SELECT 'pf_performance_reviews'        AS t, count(*) FROM temp_sdbi.pf_performance_reviews
UNION ALL SELECT 'pf_competency_review_ratings', count(*) FROM temp_sdbi.pf_competency_review_ratings
UNION ALL SELECT 'pf_feedback_360',              count(*) FROM temp_sdbi.pf_feedback_360
UNION ALL SELECT 'pf_continuous_feedback',       count(*) FROM temp_sdbi.pf_continuous_feedback;
