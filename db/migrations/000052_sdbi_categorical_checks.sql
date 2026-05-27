-- ============================================================================
-- Migration 000052 — SDBI categorical value-CHECK constraints (RD-08)
-- Adds value-CHECK whitelists to the categorical varchar columns of the 6 SDBI
-- macro-area targets (000046-051), derived from the actual loaded values (so all
-- existing rows satisfy them). Pattern: DROP CONSTRAINT IF EXISTS + ADD (idempotent,
-- re-run safe — same as migration 000032). All allow NULL.
-- NB: review_potential_rating EXCLUDED — mixed numeric+label values, not categorical.
-- Whitelists are point-in-time from demo data; relax via a later migration if the
-- source ever yields new values (CW-B16/B21).
-- Authored: 2026-05-27 (MVP-4 2.4.13).
-- ============================================================================
BEGIN;

-- helper macro applied inline per (table, constraint, column, values)
-- performance_reviews
ALTER TABLE sys.sys_performance_reviews DROP CONSTRAINT IF EXISTS sys_performance_reviews_type_chk;
ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_performance_reviews_type_chk CHECK (review_type IS NULL OR review_type IN ('ANNUAL','MID_YEAR'));
ALTER TABLE sys.sys_performance_reviews DROP CONSTRAINT IF EXISTS sys_performance_reviews_status_chk;
ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_performance_reviews_status_chk CHECK (review_status IS NULL OR review_status IN ('COMPLETED','IN_PROGRESS','SUBMITTED'));
-- review_cycles
ALTER TABLE sys.sys_review_cycles DROP CONSTRAINT IF EXISTS sys_review_cycles_type_chk;
ALTER TABLE sys.sys_review_cycles ADD CONSTRAINT sys_review_cycles_type_chk CHECK (cycle_type IS NULL OR cycle_type IN ('ANNUAL','QUARTERLY','SEMI_ANNUAL'));
ALTER TABLE sys.sys_review_cycles DROP CONSTRAINT IF EXISTS sys_review_cycles_status_chk;
ALTER TABLE sys.sys_review_cycles ADD CONSTRAINT sys_review_cycles_status_chk CHECK (cycle_status IS NULL OR cycle_status IN ('ACTIVE','COMPLETED','DRAFT'));
-- review_cycle_phases
ALTER TABLE sys.sys_review_cycle_phases DROP CONSTRAINT IF EXISTS sys_review_cycle_phases_status_chk;
ALTER TABLE sys.sys_review_cycle_phases ADD CONSTRAINT sys_review_cycle_phases_status_chk CHECK (phase_status IS NULL OR phase_status IN ('ACTIVE','COMPLETED','PENDING'));
-- templates
ALTER TABLE sys.sys_performance_review_templates DROP CONSTRAINT IF EXISTS sys_perf_review_templates_type_chk;
ALTER TABLE sys.sys_performance_review_templates ADD CONSTRAINT sys_perf_review_templates_type_chk CHECK (template_type IS NULL OR template_type IN ('STANDARD'));
-- mentorship_programs
ALTER TABLE sys.sys_mentorship_programs DROP CONSTRAINT IF EXISTS sys_mentorship_programs_type_chk;
ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mentorship_programs_type_chk CHECK (program_type IS NULL OR program_type IN ('DEI','LEADERSHIP','MANAGEMENT','TECHNICAL'));
ALTER TABLE sys.sys_mentorship_programs DROP CONSTRAINT IF EXISTS sys_mentorship_programs_status_chk;
ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mentorship_programs_status_chk CHECK (program_status IS NULL OR program_status IN ('ACTIVE'));
-- mentorships
ALTER TABLE sys.sys_mentorships DROP CONSTRAINT IF EXISTS sys_mentorships_status_chk;
ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_mentorships_status_chk CHECK (mentorship_status IS NULL OR mentorship_status IN ('ACTIVE','COMPLETED','ON_HOLD'));
ALTER TABLE sys.sys_mentorships DROP CONSTRAINT IF EXISTS sys_mentorships_freq_chk;
ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_mentorships_freq_chk CHECK (mentorship_meeting_frequency IS NULL OR mentorship_meeting_frequency IN ('BI-WEEKLY','BIWEEKLY','MONTHLY','WEEKLY'));
-- mentorship_sessions
ALTER TABLE sys.sys_mentorship_sessions DROP CONSTRAINT IF EXISTS sys_mentorship_sessions_status_chk;
ALTER TABLE sys.sys_mentorship_sessions ADD CONSTRAINT sys_mentorship_sessions_status_chk CHECK (session_status IS NULL OR session_status IN ('COMPLETED','SCHEDULED'));
-- feedback_360
ALTER TABLE sys.sys_feedback_360 DROP CONSTRAINT IF EXISTS sys_feedback_360_status_chk;
ALTER TABLE sys.sys_feedback_360 ADD CONSTRAINT sys_feedback_360_status_chk CHECK (feedback_status IS NULL OR feedback_status IN ('COMPLETED'));
ALTER TABLE sys.sys_feedback_360 DROP CONSTRAINT IF EXISTS sys_feedback_360_rel_chk;
ALTER TABLE sys.sys_feedback_360 ADD CONSTRAINT sys_feedback_360_rel_chk CHECK (feedback_relationship_type IS NULL OR feedback_relationship_type IN ('MANAGER','PEER','SELF'));
-- continuous_feedback
ALTER TABLE sys.sys_continuous_feedback DROP CONSTRAINT IF EXISTS sys_continuous_feedback_type_chk;
ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_continuous_feedback_type_chk CHECK (cf_feedback_type IS NULL OR cf_feedback_type IN ('COACHING','CONSTRUCTIVE','PRAISE','RECOGNITION','SUGGESTION'));
ALTER TABLE sys.sys_continuous_feedback DROP CONSTRAINT IF EXISTS sys_continuous_feedback_vis_chk;
ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_continuous_feedback_vis_chk CHECK (cf_visibility IS NULL OR cf_visibility IN ('PRIVATE'));
-- feedback_requests
ALTER TABLE sys.sys_feedback_requests DROP CONSTRAINT IF EXISTS sys_feedback_requests_status_chk;
ALTER TABLE sys.sys_feedback_requests ADD CONSTRAINT sys_feedback_requests_status_chk CHECK (request_status IS NULL OR request_status IN ('COMPLETED','DECLINED','PENDING'));
ALTER TABLE sys.sys_feedback_requests DROP CONSTRAINT IF EXISTS sys_feedback_requests_type_chk;
ALTER TABLE sys.sys_feedback_requests ADD CONSTRAINT sys_feedback_requests_type_chk CHECK (request_feedback_type IS NULL OR request_feedback_type IN ('360','MANAGER','PEER','SELF'));
-- surveys
ALTER TABLE sys.sys_surveys DROP CONSTRAINT IF EXISTS sys_surveys_type_chk;
ALTER TABLE sys.sys_surveys ADD CONSTRAINT sys_surveys_type_chk CHECK (survey_type IS NULL OR survey_type IN ('ANNUAL','CUSTOM','ENGAGEMENT','FEEDBACK','ONBOARDING','PULSE'));
ALTER TABLE sys.sys_surveys DROP CONSTRAINT IF EXISTS sys_surveys_status_chk;
ALTER TABLE sys.sys_surveys ADD CONSTRAINT sys_surveys_status_chk CHECK (survey_status IS NULL OR survey_status IN ('ACTIVE','ANALYZING','CLOSED','DRAFT'));
-- engagement_surveys
ALTER TABLE sys.sys_engagement_surveys DROP CONSTRAINT IF EXISTS sys_engagement_surveys_status_chk;
ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_engagement_surveys_status_chk CHECK (esurvey_status IS NULL OR esurvey_status IN ('ACTIVE','CLOSED'));
ALTER TABLE sys.sys_engagement_surveys DROP CONSTRAINT IF EXISTS sys_engagement_surveys_aud_chk;
ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_engagement_surveys_aud_chk CHECK (esurvey_audience_type IS NULL OR esurvey_audience_type IN ('ALL'));
-- critical_roles
ALTER TABLE sys.sys_critical_roles DROP CONSTRAINT IF EXISTS sys_critical_roles_crit_chk;
ALTER TABLE sys.sys_critical_roles ADD CONSTRAINT sys_critical_roles_crit_chk CHECK (role_criticality_level IS NULL OR role_criticality_level IN ('CRITICAL','HIGH','MEDIUM'));
ALTER TABLE sys.sys_critical_roles DROP CONSTRAINT IF EXISTS sys_critical_roles_sstatus_chk;
ALTER TABLE sys.sys_critical_roles ADD CONSTRAINT sys_critical_roles_sstatus_chk CHECK (role_succession_status IS NULL OR role_succession_status IN ('DEVELOPING','DEVELOPING_SUCCESSOR','HEALTHY','NO_SUCCESSOR','SUCCESSOR_READY'));
-- succession_plans
ALTER TABLE sys.sys_succession_plans DROP CONSTRAINT IF EXISTS sys_succession_plans_crit_chk;
ALTER TABLE sys.sys_succession_plans ADD CONSTRAINT sys_succession_plans_crit_chk CHECK (plan_criticality_level IS NULL OR plan_criticality_level IN ('CRITICAL','HIGH','MEDIUM'));
ALTER TABLE sys.sys_succession_plans DROP CONSTRAINT IF EXISTS sys_succession_plans_risk_chk;
ALTER TABLE sys.sys_succession_plans ADD CONSTRAINT sys_succession_plans_risk_chk CHECK (plan_risk_level IS NULL OR plan_risk_level IN ('CRITICAL','HIGH','LOW','MEDIUM'));
-- succession_candidates
ALTER TABLE sys.sys_succession_candidates DROP CONSTRAINT IF EXISTS sys_succession_candidates_readiness_chk;
ALTER TABLE sys.sys_succession_candidates ADD CONSTRAINT sys_succession_candidates_readiness_chk CHECK (candidate_readiness_level IS NULL OR candidate_readiness_level IN ('DEVELOPMENT_NEEDED','READY_1_YEAR','READY_2_YEARS','READY_3_PLUS_YEARS','READY_NOW'));
-- bonus_plans
ALTER TABLE sys.sys_bonus_plans DROP CONSTRAINT IF EXISTS sys_bonus_plans_type_chk;
ALTER TABLE sys.sys_bonus_plans ADD CONSTRAINT sys_bonus_plans_type_chk CHECK (bonus_plan_type IS NULL OR bonus_plan_type IN ('ANNUAL','PROJECT','QUARTERLY','REFERRAL','RETENTION','SPOT'));
ALTER TABLE sys.sys_bonus_plans DROP CONSTRAINT IF EXISTS sys_bonus_plans_status_chk;
ALTER TABLE sys.sys_bonus_plans ADD CONSTRAINT sys_bonus_plans_status_chk CHECK (bonus_plan_status IS NULL OR bonus_plan_status IN ('ACTIVE','PAID'));
ALTER TABLE sys.sys_bonus_plans DROP CONSTRAINT IF EXISTS sys_bonus_plans_calc_chk;
ALTER TABLE sys.sys_bonus_plans ADD CONSTRAINT sys_bonus_plans_calc_chk CHECK (bonus_plan_calculation_method IS NULL OR bonus_plan_calculation_method IN ('DISCRETIONARY','FIXED','PERCENTAGE','PERFORMANCE_BASED'));

COMMIT;
