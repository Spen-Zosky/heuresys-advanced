// GENERATO da docs/kb/tools/build_origine_moduli.py dall'atlante: non si modifica a mano.
// Piano interfacce L10, A-14: per ogni modulo, i prefissi delle rotte e le tabelle sys.*.
export interface ModuloDelleTabelle {
  prefissi: readonly string[];
  tabelle: readonly string[];
}

export const MODULI_DELLE_TABELLE: Readonly<Record<string, ModuloDelleTabelle>> = {
  "activity-classification-mappings": {
    "prefissi": [
      "/v1/activity-classification-mappings"
    ],
    "tabelle": [
      "sys_activity_classification_mappings",
      "sys_activity_classifications"
    ]
  },
  "activity-classifications": {
    "prefissi": [
      "/v1/activity-classifications"
    ],
    "tabelle": [
      "sys_activity_classifications"
    ]
  },
  "advisor": {
    "prefissi": [
      "/v1/advisor"
    ],
    "tabelle": [
      "sys_advisor_suggestions"
    ]
  },
  "agent-tokens": {
    "prefissi": [
      "/v1/auth/agent-tokens"
    ],
    "tabelle": [
      "sys_auth_refresh_tokens",
      "sys_tenancies"
    ]
  },
  "analytics": {
    "prefissi": [
      "/v1/analytics"
    ],
    "tabelle": [
      "sys_attendance",
      "sys_compensation_bands",
      "sys_kpi_definitions",
      "sys_kpi_targets",
      "sys_organization_units",
      "sys_overtime",
      "sys_position_compensation_profiles",
      "sys_positions",
      "sys_skill_categories",
      "sys_skills",
      "sys_user_position_assignments",
      "sys_user_skill_evidence",
      "sys_users"
    ]
  },
  "approvals": {
    "prefissi": [
      "/v1/approvals"
    ],
    "tabelle": [
      "sys_approval_requests",
      "sys_approval_steps",
      "sys_inbox_notifications",
      "sys_tenant_process_steps",
      "sys_tenant_processes",
      "sys_users"
    ]
  },
  "assessment-methods": {
    "prefissi": [
      "/v1/assessment-methods"
    ],
    "tabelle": [
      "sys_assessment_methods"
    ]
  },
  "assessment-results": {
    "prefissi": [
      "/v1/assessment-results"
    ],
    "tabelle": [
      "sys_assessment_results",
      "sys_assessments"
    ]
  },
  "assessments": {
    "prefissi": [
      "/v1/assessments"
    ],
    "tabelle": [
      "sys_assessments",
      "sys_users"
    ]
  },
  "auth": {
    "prefissi": [
      "/v1/auth",
      "/v1/auth/mfa"
    ],
    "tabelle": [
      "sys_auth_credentials",
      "sys_auth_identities",
      "sys_auth_login_events",
      "sys_auth_mfa_exemptions",
      "sys_auth_mfa_factors",
      "sys_auth_mfa_otp_challenges",
      "sys_auth_mfa_policies",
      "sys_auth_mfa_recovery_codes",
      "sys_auth_mfa_webauthn_credentials",
      "sys_auth_password_reset_tokens",
      "sys_auth_permissions",
      "sys_auth_refresh_tokens",
      "sys_auth_role_permissions",
      "sys_auth_roles",
      "sys_user_auth_roles",
      "sys_users"
    ]
  },
  "blueprint-activations": {
    "prefissi": [
      "/v1/blueprint-activations"
    ],
    "tabelle": [
      "sys_blueprint_activations",
      "sys_blueprint_variant_versions",
      "sys_blueprint_variants",
      "sys_tenancies"
    ]
  },
  "blueprint-families": {
    "prefissi": [
      "/v1/blueprint-families"
    ],
    "tabelle": [
      "sys_blueprint_families",
      "sys_blueprint_variants"
    ]
  },
  "blueprint-overrides": {
    "prefissi": [
      "/v1/blueprint-overrides"
    ],
    "tabelle": [
      "sys_blueprint_activations",
      "sys_blueprint_overrides",
      "sys_blueprint_process_registry"
    ]
  },
  "blueprint-processes": {
    "prefissi": [
      "/v1/blueprint-processes"
    ],
    "tabelle": [
      "sys_blueprint_process_registry",
      "sys_blueprint_variant_versions",
      "sys_blueprint_variants"
    ]
  },
  "blueprint-variants": {
    "prefissi": [
      "/v1/blueprint-variants"
    ],
    "tabelle": [
      "sys_blueprint_families",
      "sys_blueprint_variants",
      "sys_enterprise_size_bands"
    ]
  },
  "branches": {
    "prefissi": [
      "/v1/branches"
    ],
    "tabelle": [
      "sys_branches"
    ]
  },
  "calibration-sessions": {
    "prefissi": [
      "/v1/calibration-sessions"
    ],
    "tabelle": [
      "sys_calibration_discussions",
      "sys_calibration_participants",
      "sys_calibration_sessions",
      "sys_users"
    ]
  },
  "candidate-applications": {
    "prefissi": [
      "/v1/candidate-applications"
    ],
    "tabelle": [
      "sys_candidate_applications",
      "sys_candidates",
      "sys_job_postings",
      "sys_job_requisitions",
      "sys_positions"
    ]
  },
  "candidates": {
    "prefissi": [
      "/v1/candidates"
    ],
    "tabelle": [
      "sys_candidate_applications",
      "sys_candidates",
      "sys_job_postings",
      "sys_job_requisitions",
      "sys_positions",
      "sys_users"
    ]
  },
  "capability-composition": {
    "prefissi": [
      "/v1/capability"
    ],
    "tabelle": [
      "sys_capability_score_lineage",
      "sys_capability_scores",
      "sys_compensation_bands",
      "sys_organization_units",
      "sys_position_compensation_profiles",
      "sys_position_skill_requirements",
      "sys_positions",
      "sys_skill_groups",
      "sys_skill_proficiency_levels",
      "sys_skills",
      "sys_tenancies",
      "sys_user_position_assignments",
      "sys_user_skill_evidence",
      "sys_user_skills",
      "sys_users"
    ]
  },
  "capability-maturity": {
    "prefissi": [
      "/v1/capability"
    ],
    "tabelle": [
      "sys_capability_maturity_scores",
      "sys_capability_scores",
      "sys_organization_units",
      "sys_positions",
      "sys_skill_gap_scores",
      "sys_succession_readiness_scores",
      "sys_user_kpi_evidence",
      "sys_user_position_assignments"
    ]
  },
  "career-path-steps": {
    "prefissi": [
      "/v1/career-path-steps"
    ],
    "tabelle": [
      "sys_career_path_steps",
      "sys_career_paths",
      "sys_positions"
    ]
  },
  "career-paths": {
    "prefissi": [
      "/v1/career-paths"
    ],
    "tabelle": [
      "sys_career_path_steps",
      "sys_career_paths"
    ]
  },
  "compensation": {
    "prefissi": [
      "/v1/compensation"
    ],
    "tabelle": [
      "sys_bonus_pools",
      "sys_compensation_bands",
      "sys_compensation_recommendations",
      "sys_objective_reward_rules",
      "sys_organization_units",
      "sys_payout_curves",
      "sys_payroll_handoff_records",
      "sys_position_compensation_profiles",
      "sys_position_economic_weight",
      "sys_positions",
      "sys_reward_gate_catalog",
      "sys_reward_gate_results",
      "sys_reward_gates",
      "sys_users",
      "sys_variable_pay_calculations"
    ]
  },
  "content": {
    "prefissi": [
      "/v1/content"
    ],
    "tabelle": [
      "sys_content_categories",
      "sys_content_documents",
      "sys_content_media",
      "sys_content_versions",
      "sys_users"
    ]
  },
  "content-blueprint-links": {
    "prefissi": [
      "/v1/content-blueprint-links"
    ],
    "tabelle": [
      "sys_blueprint_process_registry",
      "sys_blueprint_variants",
      "sys_content_blueprint_links",
      "sys_content_documents"
    ]
  },
  "dashboard": {
    "prefissi": [
      "/v1/dashboard"
    ],
    "tabelle": [
      "sys_approval_requests",
      "sys_assessments",
      "sys_auth_credentials",
      "sys_blueprint_activations",
      "sys_blueprint_process_registry",
      "sys_blueprint_variants",
      "sys_compensation_recommendations",
      "sys_dashboard_block_data_classes",
      "sys_dashboard_blocks",
      "sys_dashboards",
      "sys_learning_gaps",
      "sys_learning_paths",
      "sys_organization_unit_processes",
      "sys_organization_units",
      "sys_positions",
      "sys_skills",
      "sys_tenancies",
      "sys_tenant_blueprints",
      "sys_time_off_requests",
      "sys_user_learning_assignments",
      "sys_user_pay_slips",
      "sys_user_position_assignments",
      "sys_user_skills",
      "sys_user_timeline_events",
      "sys_users"
    ]
  },
  "data-classification": {
    "prefissi": [
      "/v1/data-classification"
    ],
    "tabelle": [
      "sys_classificazione_direzione_dato"
    ]
  },
  "delegations": {
    "prefissi": [
      "/v1/delegations"
    ],
    "tabelle": [
      "sys_approval_requests",
      "sys_approval_steps",
      "sys_organization_units",
      "sys_positions",
      "sys_tenant_process_steps",
      "sys_tenant_processes",
      "sys_time_off_requests",
      "sys_training_initiatives",
      "sys_user_delegations",
      "sys_user_learning_assignments",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "engagement": {
    "prefissi": [
      "/v1/engagement"
    ],
    "tabelle": [
      "sys_pulse_checks",
      "sys_survey_questions",
      "sys_survey_responses",
      "sys_survey_templates",
      "sys_surveys"
    ]
  },
  "engagement-feedback": {
    "prefissi": [
      "/v1/engagement-feedback"
    ],
    "tabelle": [
      "sys_engagement_action_plans",
      "sys_engagement_feedback"
    ]
  },
  "enterprise-size-bands": {
    "prefissi": [
      "/v1/enterprise-size-bands"
    ],
    "tabelle": [
      "sys_enterprise_size_bands"
    ]
  },
  "enterprise-typing-profiles": {
    "prefissi": [
      "/v1/enterprise-typing-profiles"
    ],
    "tabelle": [
      "sys_enterprise_typing_profiles"
    ]
  },
  "evidence": {
    "prefissi": [
      "/v1/evidence"
    ],
    "tabelle": [
      "sys_behavioral_assessments",
      "sys_continuous_feedback",
      "sys_feedback_360_responses",
      "sys_kpi_assessment_results",
      "sys_kpi_definitions",
      "sys_learning_modules",
      "sys_performance_review_competency_ratings",
      "sys_person_evidence_records",
      "sys_skills",
      "sys_user_assessment_evidence",
      "sys_user_learning_evidence",
      "sys_user_skill_evidence",
      "sys_users",
      "v_source_lineage_normalizzata"
    ]
  },
  "gdpr": {
    "prefissi": [
      "/v1/gdpr"
    ],
    "tabelle": [
      "sys_gdpr_data_map",
      "sys_gdpr_requests",
      "sys_user_consents",
      "sys_users"
    ]
  },
  "generated-origins": {
    "prefissi": [
      "/v1/generated-origins"
    ],
    "tabelle": [
      "sys_generated_record_origins"
    ]
  },
  "goals": {
    "prefissi": [
      "/v1/goals"
    ],
    "tabelle": [
      "sys_goal_alignments",
      "sys_goal_check_ins",
      "sys_goal_comments",
      "sys_goal_milestones",
      "sys_goal_templates",
      "sys_goal_updates",
      "sys_goals"
    ]
  },
  "hierarchy-levels": {
    "prefissi": [
      "/v1/hierarchy-levels"
    ],
    "tabelle": [
      "sys_blueprint_activations",
      "sys_blueprint_content_ccnl_levels",
      "sys_blueprint_content_positions",
      "sys_blueprint_content_units",
      "sys_blueprint_variant_versions",
      "sys_organization_units",
      "sys_positions",
      "sys_user_contracts",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "insights": {
    "prefissi": [
      "/v1/insights"
    ],
    "tabelle": [
      "sys_attendance",
      "sys_compensation_bands",
      "sys_engagement_survey_responses",
      "sys_flight_risk_scores",
      "sys_job_role_embeddings",
      "sys_position_compensation_profiles",
      "sys_positions",
      "sys_pulse_checks",
      "sys_skill_gap_scores",
      "sys_succession_readiness_scores",
      "sys_survey_responses",
      "sys_user_kpi_evidence",
      "sys_user_position_assignments",
      "sys_user_profile_embeddings",
      "sys_users"
    ]
  },
  "interview-feedback": {
    "prefissi": [
      "/v1/interview-feedback"
    ],
    "tabelle": [
      "sys_candidate_applications",
      "sys_interview_feedback",
      "sys_interviews",
      "sys_job_postings",
      "sys_job_requisitions",
      "sys_positions",
      "sys_users"
    ]
  },
  "interviews": {
    "prefissi": [
      "/v1/interviews"
    ],
    "tabelle": [
      "sys_candidate_applications",
      "sys_interviews",
      "sys_job_postings",
      "sys_job_requisitions",
      "sys_positions"
    ]
  },
  "job-families": {
    "prefissi": [
      "/v1/job-families"
    ],
    "tabelle": [
      "sys_job_families"
    ]
  },
  "job-offers": {
    "prefissi": [
      "/v1/job-offers"
    ],
    "tabelle": [
      "sys_candidate_applications",
      "sys_job_offers"
    ]
  },
  "job-postings": {
    "prefissi": [
      "/v1/job-postings"
    ],
    "tabelle": [
      "sys_job_postings",
      "sys_job_requisitions",
      "sys_positions"
    ]
  },
  "job-requisitions": {
    "prefissi": [
      "/v1/job-requisitions"
    ],
    "tabelle": [
      "sys_job_requisitions",
      "sys_positions"
    ]
  },
  "job-roles": {
    "prefissi": [
      "/v1/job-roles"
    ],
    "tabelle": [
      "sys_job_families",
      "sys_job_roles"
    ]
  },
  "kpi-definitions": {
    "prefissi": [
      "/v1/kpi-definitions"
    ],
    "tabelle": [
      "sys_kpi_assessment_methods",
      "sys_kpi_definitions",
      "sys_kpi_measurements",
      "sys_kpi_metric_definitions",
      "sys_kpi_weighting_rules"
    ]
  },
  "leads": {
    "prefissi": [
      "/v1/leads"
    ],
    "tabelle": [
      "sys_leads"
    ]
  },
  "learning-gaps": {
    "prefissi": [
      "/v1/learning-gaps"
    ],
    "tabelle": [
      "sys_gap_analysis_results",
      "sys_gap_closure_actions",
      "sys_gap_closure_plans",
      "sys_learning_gaps",
      "sys_positions",
      "sys_skills",
      "sys_users"
    ]
  },
  "learning-modules": {
    "prefissi": [
      "/v1/learning-modules"
    ],
    "tabelle": [
      "sys_learning_modules"
    ]
  },
  "learning-path-steps": {
    "prefissi": [
      "/v1/learning-path-steps"
    ],
    "tabelle": [
      "sys_learning_modules",
      "sys_learning_path_steps",
      "sys_learning_paths"
    ]
  },
  "learning-paths": {
    "prefissi": [
      "/v1/learning-paths"
    ],
    "tabelle": [
      "sys_learning_path_steps",
      "sys_learning_paths"
    ]
  },
  "mandate-acts": {
    "prefissi": [
      "/v1/mandate-acts"
    ],
    "tabelle": [
      "sys_auth_roles",
      "sys_mandate_acts",
      "sys_user_auth_roles",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "me": {
    "prefissi": [
      "/v1/me"
    ],
    "tabelle": [
      "sys_approval_requests",
      "sys_assessments",
      "sys_attendance",
      "sys_blueprint_process_registry",
      "sys_capability_scores",
      "sys_career_path_steps",
      "sys_career_paths",
      "sys_flight_risk_scores",
      "sys_goals",
      "sys_inbox_notifications",
      "sys_kpi_definitions",
      "sys_kpi_targets",
      "sys_learning_gaps",
      "sys_learning_modules",
      "sys_learning_paths",
      "sys_mentor_match_scores",
      "sys_mentorships",
      "sys_model_predictions",
      "sys_notification_preferences",
      "sys_organization_unit_processes",
      "sys_organization_units",
      "sys_overtime",
      "sys_performance_reviews",
      "sys_position_career_paths",
      "sys_position_kpi_requirements",
      "sys_positions",
      "sys_predictive_models",
      "sys_pulse_checks",
      "sys_skill_gap_scores",
      "sys_skill_proficiency_levels",
      "sys_skills",
      "sys_succession_readiness_scores",
      "sys_survey_assignments",
      "sys_survey_questions",
      "sys_survey_responses",
      "sys_surveys",
      "sys_tenant_process_steps",
      "sys_tenant_processes",
      "sys_time_off_balances",
      "sys_training_initiatives",
      "sys_ui_interface_data_classes",
      "sys_ui_interfaces",
      "sys_user_addresses",
      "sys_user_bank_details",
      "sys_user_career_plans",
      "sys_user_certifications",
      "sys_user_contracts",
      "sys_user_demographics",
      "sys_user_documents",
      "sys_user_education_records",
      "sys_user_employment",
      "sys_user_family_members",
      "sys_user_identity_documents",
      "sys_user_kpi_evidence",
      "sys_user_learning_assignments",
      "sys_user_pay_slips",
      "sys_user_position_assignments",
      "sys_user_preferences",
      "sys_user_professional_experiences",
      "sys_user_profiles",
      "sys_user_skill_evidence",
      "sys_user_skills",
      "sys_user_target_positions",
      "sys_users"
    ]
  },
  "mentorship": {
    "prefissi": [
      "/v1/mentorship"
    ],
    "tabelle": [
      "sys_mentor_match_scores",
      "sys_mentorship_programs",
      "sys_mentorship_sessions",
      "sys_mentorships"
    ]
  },
  "mfa-policy": {
    "prefissi": [
      "/v1/mfa-policy"
    ],
    "tabelle": [
      "sys_auth_mfa_exemptions",
      "sys_auth_mfa_policies",
      "sys_tenancies",
      "sys_users"
    ]
  },
  "notifications": {
    "prefissi": [
      "/v1/notifications"
    ],
    "tabelle": [
      "sys_inbox_notifications",
      "sys_users"
    ]
  },
  "observability": {
    "prefissi": [
      "/v1/observability"
    ],
    "tabelle": [
      "sys_auth_login_events",
      "sys_auth_refresh_tokens",
      "sys_tenancies",
      "sys_users"
    ]
  },
  "occupation-classifications": {
    "prefissi": [
      "/v1/occupation-classifications"
    ],
    "tabelle": [
      "sys_occupation_classifications"
    ]
  },
  "okrs": {
    "prefissi": [
      "/v1/okrs"
    ],
    "tabelle": [
      "sys_okr_check_ins",
      "sys_okr_key_results",
      "sys_okrs"
    ]
  },
  "operating-models": {
    "prefissi": [
      "/v1/operating-models"
    ],
    "tabelle": [
      "sys_operating_model_catalog"
    ]
  },
  "org-health": {
    "prefissi": [
      "/v1/org-health"
    ],
    "tabelle": [
      "sys_attendance",
      "sys_capability_maturity_scores",
      "sys_flight_risk_scores",
      "sys_goals",
      "sys_organization_units",
      "sys_performance_reviews",
      "sys_positions",
      "sys_survey_questions",
      "sys_survey_responses",
      "sys_surveys",
      "sys_user_position_assignments"
    ]
  },
  "organization-unit-history": {
    "prefissi": [
      "/v1/organization-unit-history"
    ],
    "tabelle": [
      "sys_organization_unit_history",
      "sys_organization_units"
    ]
  },
  "organization-unit-kpi-templates": {
    "prefissi": [
      "/v1/organization-unit-kpi-templates"
    ],
    "tabelle": [
      "sys_kpi_definitions",
      "sys_organization_unit_kpi_templates",
      "sys_organization_units"
    ]
  },
  "organization-unit-processes": {
    "prefissi": [
      "/v1/organization-unit-processes"
    ],
    "tabelle": [
      "sys_blueprint_process_registry",
      "sys_blueprint_variants",
      "sys_organization_unit_processes",
      "sys_organization_units"
    ]
  },
  "organization-units": {
    "prefissi": [
      "/v1/organization-units"
    ],
    "tabelle": [
      "sys_organization_units"
    ]
  },
  "performance-reviews": {
    "prefissi": [
      "/v1/performance-reviews"
    ],
    "tabelle": [
      "sys_performance_reviews",
      "sys_users",
      "sys_valutazione_condivisione_eccezioni"
    ]
  },
  "platform-tenant-assignments": {
    "prefissi": [
      "/v1/platform-tenant-assignments"
    ],
    "tabelle": [
      "sys_platform_user_tenant_assignments",
      "sys_tenancies",
      "sys_users"
    ]
  },
  "position-career-paths": {
    "prefissi": [
      "/v1/position-career-paths"
    ],
    "tabelle": [
      "sys_career_paths",
      "sys_position_career_paths",
      "sys_positions"
    ]
  },
  "position-succession-relevance": {
    "prefissi": [
      "/v1/position-succession-relevance"
    ],
    "tabelle": [
      "sys_position_succession_relevance",
      "sys_positions"
    ]
  },
  "positions": {
    "prefissi": [
      "/v1/positions"
    ],
    "tabelle": [
      "sys_kpi_definitions",
      "sys_learning_modules",
      "sys_learning_paths",
      "sys_position_intelligence_profiles_v",
      "sys_position_kpi_requirements",
      "sys_position_learning_requirements",
      "sys_position_skill_requirement_history",
      "sys_position_skill_requirements",
      "sys_positions",
      "sys_skill_learning_mappings",
      "sys_skills",
      "sys_users"
    ]
  },
  "predictions": {
    "prefissi": [
      "/v1/predictions"
    ],
    "tabelle": [
      "sys_model_predictions",
      "sys_predictive_models"
    ]
  },
  "process-kpi-templates": {
    "prefissi": [
      "/v1/process-kpi-templates"
    ],
    "tabelle": [
      "sys_blueprint_process_registry",
      "sys_kpi_definitions",
      "sys_process_kpi_templates"
    ]
  },
  "projects": {
    "prefissi": [
      "/v1/projects"
    ],
    "tabelle": [
      "sys_project_members",
      "sys_projects",
      "sys_users"
    ]
  },
  "provenance": {
    "prefissi": [
      "/v1/provenance"
    ],
    "tabelle": [
      "v_source_lineage_normalizzata"
    ]
  },
  "public-job-postings": {
    "prefissi": [
      "/v1/public"
    ],
    "tabelle": [
      "sys_job_postings",
      "sys_tenancies"
    ]
  },
  "public-stats": {
    "prefissi": [
      "/v1/public"
    ],
    "tabelle": [
      "sys_auth_permissions",
      "sys_auth_role_permissions",
      "sys_auth_roles",
      "sys_esco_occupation_mappings",
      "sys_occupation_skill_requirements",
      "sys_organization_units",
      "sys_positions",
      "sys_skills",
      "sys_teams",
      "sys_ui_interfaces",
      "sys_users"
    ]
  },
  "reference-sync": {
    "prefissi": [
      "/v1/reference-sync"
    ],
    "tabelle": [
      "sys_activity_classifications",
      "sys_esco_occupation_mappings",
      "sys_skills"
    ]
  },
  "review-cycles": {
    "prefissi": [
      "/v1/review-cycles"
    ],
    "tabelle": [
      "sys_review_cycles"
    ]
  },
  "seed-acquisition-runs": {
    "prefissi": [
      "/v1/seed-acquisition-runs"
    ],
    "tabelle": [
      "sys_seed_acquisition_runs"
    ]
  },
  "seed-approval-decisions": {
    "prefissi": [
      "/v1/seed-approval-decisions"
    ],
    "tabelle": [
      "sys_seed_approval_decisions",
      "sys_seed_candidate_records"
    ]
  },
  "seed-candidate-records": {
    "prefissi": [
      "/v1/seed-candidate-records"
    ],
    "tabelle": [
      "sys_seed_candidate_records",
      "sys_seed_source_evidence",
      "sys_seed_validation_results"
    ]
  },
  "semantic-matching": {
    "prefissi": [
      "/v1/matching"
    ],
    "tabelle": [
      "sys_esco_occupation_embeddings",
      "sys_esco_occupation_mappings",
      "sys_job_role_embeddings",
      "sys_job_roles",
      "sys_positions",
      "sys_skill_embeddings",
      "sys_skills",
      "sys_user_profile_embeddings",
      "sys_user_skill_evidence",
      "sys_users"
    ]
  },
  "skill-aliases": {
    "prefissi": [
      "/v1/skill-aliases"
    ],
    "tabelle": [
      "sys_skill_aliases",
      "sys_skills"
    ]
  },
  "skill-categories": {
    "prefissi": [
      "/v1/skill-categories"
    ],
    "tabelle": [
      "sys_skill_categories",
      "sys_skill_families",
      "sys_skills"
    ]
  },
  "skill-families": {
    "prefissi": [
      "/v1/skill-families"
    ],
    "tabelle": [
      "sys_skill_categories",
      "sys_skill_families"
    ]
  },
  "skill-proficiency-levels": {
    "prefissi": [
      "/v1/skill-proficiency-levels"
    ],
    "tabelle": [
      "sys_skill_proficiency_levels"
    ]
  },
  "skill-taxonomy-edges": {
    "prefissi": [
      "/v1/skill-taxonomy-edges"
    ],
    "tabelle": [
      "sys_skill_taxonomy_edges",
      "sys_skills"
    ]
  },
  "skills": {
    "prefissi": [
      "/v1/skills"
    ],
    "tabelle": [
      "fn_skill_graph_edges",
      "fn_skill_graph_nodes",
      "sys_skills"
    ]
  },
  "succession-pools": {
    "prefissi": [
      "/v1/succession-pools"
    ],
    "tabelle": [
      "sys_positions",
      "sys_succession_pools",
      "sys_successor_candidates",
      "sys_user_position_assignments"
    ]
  },
  "successor-candidates": {
    "prefissi": [
      "/v1/successor-candidates"
    ],
    "tabelle": [
      "sys_succession_pools",
      "sys_successor_candidates",
      "sys_users"
    ]
  },
  "successor-readiness": {
    "prefissi": [
      "/v1/successor-readiness"
    ],
    "tabelle": [
      "sys_successor_candidates",
      "sys_successor_readiness"
    ]
  },
  "surveys": {
    "prefissi": [
      "/v1/surveys"
    ],
    "tabelle": [
      "sys_engagement_survey_responses",
      "sys_engagement_survey_templates",
      "sys_engagement_surveys"
    ]
  },
  "talent-review": {
    "prefissi": [
      "/v1/talent-review"
    ],
    "tabelle": [
      "sys_critical_positions",
      "sys_critical_role_coverage_status",
      "sys_employee_position_fit_scores",
      "sys_positions",
      "sys_readiness_scores",
      "sys_succession_scores",
      "sys_talent_scores",
      "sys_users"
    ]
  },
  "teams": {
    "prefissi": [
      "/v1/teams"
    ],
    "tabelle": [
      "sys_team_members",
      "sys_teams",
      "sys_users"
    ]
  },
  "tenant-blueprints": {
    "prefissi": [
      "/v1/tenant-blueprints"
    ],
    "tabelle": [
      "sys_auth_permissions",
      "sys_auth_role_permissions",
      "sys_auth_roles",
      "sys_blueprint_families",
      "sys_blueprint_process_registry",
      "sys_blueprint_variant_versions",
      "sys_blueprint_variants",
      "sys_enterprise_size_bands",
      "sys_tenancies",
      "sys_tenant_blueprint_process_decisions",
      "sys_tenant_blueprint_snapshots",
      "sys_tenant_blueprint_versions",
      "sys_tenant_blueprints",
      "sys_user_auth_roles",
      "sys_users"
    ]
  },
  "tenant-consolidation": {
    "prefissi": [
      "/v1/consolidation-vocabulary",
      "/v1/tenant-consolidations"
    ],
    "tabelle": [
      "sys_auth_permissions",
      "sys_auth_role_permissions",
      "sys_blueprint_activations",
      "sys_blueprint_content_goals",
      "sys_blueprint_content_kpis",
      "sys_blueprint_content_positions",
      "sys_blueprint_content_process_steps",
      "sys_blueprint_content_skills",
      "sys_blueprint_content_units",
      "sys_blueprint_process_registry",
      "sys_blueprint_variant_versions",
      "sys_job_roles",
      "sys_kpi_definitions",
      "sys_organization_units",
      "sys_platform_vocabulary_equivalences",
      "sys_position_skill_requirements",
      "sys_positions",
      "sys_skills",
      "sys_tenancies",
      "sys_tenant_consolidation_decisions",
      "sys_tenant_consolidation_proposals",
      "sys_tenant_consolidation_rounds",
      "sys_tenant_consolidation_working_items",
      "sys_tenant_consolidations",
      "sys_tenant_process_steps",
      "sys_tenant_processes",
      "sys_user_auth_roles",
      "sys_user_delegations"
    ]
  },
  "tenant-import-runs": {
    "prefissi": [
      "/v1/tenant-import-runs"
    ],
    "tabelle": [
      "sys_approval_requests",
      "sys_auth_permissions",
      "sys_auth_role_permissions",
      "sys_auth_roles",
      "sys_position_skill_requirements",
      "sys_positions",
      "sys_seed_acquisition_runs",
      "sys_seed_candidate_records",
      "sys_seed_validation_results",
      "sys_skills",
      "sys_tenancies",
      "sys_user_auth_roles",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "tenant-materialization": {
    "prefissi": [
      "/v1/tenant-materialization"
    ],
    "tabelle": [
      "sys_blueprint_content_kpis",
      "sys_blueprint_content_positions",
      "sys_blueprint_content_skills",
      "sys_blueprint_content_units",
      "sys_blueprint_families",
      "sys_blueprint_variant_versions",
      "sys_blueprint_variants",
      "sys_kpi_definitions",
      "sys_organization_unit_types",
      "sys_organization_units",
      "sys_positions",
      "sys_skill_categories",
      "sys_skills",
      "sys_tenancies",
      "sys_user_kpi_evidence",
      "sys_user_position_assignments",
      "sys_user_skill_evidence",
      "sys_users"
    ]
  },
  "tenants": {
    "prefissi": [
      "/v1/tenants"
    ],
    "tabelle": [
      "sys_blueprint_variant_versions",
      "sys_industry_codes",
      "sys_tenancies"
    ]
  },
  "time-off": {
    "prefissi": [
      "/v1/time-off"
    ],
    "tabelle": [
      "sys_leave_accrual_rules",
      "sys_leave_balance_transactions",
      "sys_positions",
      "sys_time_off_balances",
      "sys_time_off_requests",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "training-initiatives": {
    "prefissi": [
      "/v1/training-initiatives"
    ],
    "tabelle": [
      "sys_learning_modules",
      "sys_training_initiatives",
      "sys_users"
    ]
  },
  "user-career-plans": {
    "prefissi": [
      "/v1/user-career-plans"
    ],
    "tabelle": [
      "sys_career_paths",
      "sys_positions",
      "sys_user_career_plans",
      "sys_users"
    ]
  },
  "user-position-assignments": {
    "prefissi": [
      "/v1/user-position-assignments"
    ],
    "tabelle": [
      "sys_auth_permissions",
      "sys_auth_role_permissions",
      "sys_positions",
      "sys_user_auth_roles",
      "sys_user_position_assignments",
      "sys_users"
    ]
  },
  "user-target-positions": {
    "prefissi": [
      "/v1/user-target-positions"
    ],
    "tabelle": [
      "sys_positions",
      "sys_user_target_positions",
      "sys_users"
    ]
  },
  "user-timeline": {
    "prefissi": [
      "/v1/user-timeline"
    ],
    "tabelle": [
      "sys_user_timeline_events"
    ]
  },
  "users": {
    "prefissi": [
      "/v1/users"
    ],
    "tabelle": [
      "sys_auth_roles",
      "sys_user_auth_roles",
      "sys_users"
    ]
  },
  "visualization-edges": {
    "prefissi": [
      "/v1/visualization-edges"
    ],
    "tabelle": [
      "sys_visualization_edges",
      "sys_visualization_graphs",
      "sys_visualization_nodes"
    ]
  },
  "visualization-exports": {
    "prefissi": [
      "/v1/visualization-exports"
    ],
    "tabelle": [
      "sys_visualization_exports",
      "sys_visualization_graphs"
    ]
  },
  "visualization-graphs": {
    "prefissi": [
      "/v1/visualization-graphs"
    ],
    "tabelle": [
      "sys_visualization_edges",
      "sys_visualization_graphs",
      "sys_visualization_layouts",
      "sys_visualization_node_layouts",
      "sys_visualization_nodes",
      "sys_visualization_styles"
    ]
  },
  "visualization-layouts": {
    "prefissi": [
      "/v1/visualization-layouts"
    ],
    "tabelle": [
      "sys_visualization_graphs",
      "sys_visualization_layouts"
    ]
  },
  "visualization-node-layouts": {
    "prefissi": [
      "/v1/visualization-node-layouts"
    ],
    "tabelle": [
      "sys_visualization_graphs",
      "sys_visualization_layouts",
      "sys_visualization_node_layouts",
      "sys_visualization_nodes"
    ]
  },
  "visualization-nodes": {
    "prefissi": [
      "/v1/visualization-nodes"
    ],
    "tabelle": [
      "sys_visualization_graphs",
      "sys_visualization_nodes"
    ]
  },
  "visualization-styles": {
    "prefissi": [
      "/v1/visualization-styles"
    ],
    "tabelle": [
      "sys_visualization_graphs",
      "sys_visualization_styles"
    ]
  }
};
