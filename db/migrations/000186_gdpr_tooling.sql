-- ============================================================================
-- 000186 — D-14 F3/F4: GDPR tooling foundation.
--
-- 1. sys_gdpr_data_map    — classification REGISTRY of every table holding a
--                           data subject's personal data: data-class, erasure
--                           strategy (DELETE / ANONYMIZE / RETAIN + legal
--                           basis), optional retention window. Seeded from the
--                           REAL FK graph (pg_constraint → sys_users, verified
--                           S1023). ACTOR references (created_by / updated_by /
--                           *_by / assessor / reviewer / verified_by) are NOT
--                           subject data and are deliberately excluded — the
--                           anti-drift integration test encodes this rule.
-- 2. sys_user_consents    — append-only consent ledger (GRANT/REVOKE events).
-- 3. sys_gdpr_requests    — DSR accountability log (Art. 5(2)): every export /
--                           erasure / retention run is recorded with a report.
-- 4. gdpr:* permissions   — read / export / erase / retention, granted to
--                           PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER.
--
-- Erasure doctrine (technical scope decided by Claude, S1023 — revisable via
-- registry data, not code): PERSONAL/DERIVED → DELETE; the sys_users root row
-- → ANONYMIZE (hard-deleting it would CASCADE into legally-retained tables);
-- FINANCIAL_LEGAL (payslips, contracts, employment, position history, variable
-- pay) → RETAIN under labor-law retention; EVALUATION (assessments, KPI
-- evidence, feedback, engagement) → RETAIN under defence-of-legal-claims;
-- AUTH_SECURITY → DELETE (kills login) except login_events (RETAIN,
-- retention-driven — D-59: 400 days) and auth role grants (authz audit trail).
-- Idempotent: IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.
-- ============================================================================

-- ---------------------------------------------------------------- 1. registry
CREATE TABLE IF NOT EXISTS sys.sys_gdpr_data_map (
  gdpr_data_map_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gdpr_map_table_schema varchar(63) NOT NULL DEFAULT 'sys',
  gdpr_map_table_name   varchar(63) NOT NULL,
  gdpr_map_subject_fk   varchar(63) NOT NULL,
  gdpr_map_data_class   varchar(24) NOT NULL
    CHECK (gdpr_map_data_class IN
      ('IDENTITY','PERSONAL','FINANCIAL_LEGAL','EVALUATION','OPERATIONAL','AUTH_SECURITY','DERIVED')),
  gdpr_map_erasure_strategy varchar(16) NOT NULL
    CHECK (gdpr_map_erasure_strategy IN ('DELETE','ANONYMIZE','RETAIN')),
  gdpr_map_retention_days integer,
  gdpr_map_age_column   varchar(63),
  gdpr_map_legal_basis  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_gdpr_data_map_uq UNIQUE (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk),
  -- a retention window is meaningless without the column measuring age
  CONSTRAINT sys_gdpr_data_map_retention_needs_age
    CHECK (gdpr_map_retention_days IS NULL OR gdpr_map_age_column IS NOT NULL)
);

-- ------------------------------------------------------- 2. consent ledger
CREATE TABLE IF NOT EXISTS sys.sys_user_consents (
  consent_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_tenant_id   uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  consent_user_id     uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  consent_purpose     varchar(48) NOT NULL
    CHECK (consent_purpose IN
      ('ANALYTICS_PROFILING','MARKETING_COMMUNICATIONS','INTERNAL_PHOTO_USE','THIRD_PARTY_SHARING')),
  consent_action      varchar(8) NOT NULL CHECK (consent_action IN ('GRANT','REVOKE')),
  consent_source      varchar(24) NOT NULL DEFAULT 'ESS' CHECK (consent_source IN ('ESS','ADMIN','IMPORT')),
  consent_note        text,
  consent_occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);
-- Total-order tiebreaker: under transactional test isolation (D-52) — and in
-- any same-transaction burst — consent_occurred_at collapses to the same
-- frozen timestamp, making "latest event" ambiguous. The identity column
-- gives the ledger a strict insertion order. (ADD COLUMN IF NOT EXISTS keeps
-- the migration idempotent on DBs that already ran the first version.)
ALTER TABLE sys.sys_user_consents
  ADD COLUMN IF NOT EXISTS consent_seq bigint GENERATED ALWAYS AS IDENTITY;

CREATE INDEX IF NOT EXISTS sys_user_consents_user_purpose_idx
  ON sys.sys_user_consents (consent_user_id, consent_purpose, consent_occurred_at DESC);
CREATE INDEX IF NOT EXISTS sys_user_consents_tenant_idx
  ON sys.sys_user_consents (consent_tenant_id);

-- --------------------------------------------------- 3. DSR accountability
CREATE TABLE IF NOT EXISTS sys.sys_gdpr_requests (
  gdpr_request_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gdpr_request_tenant_id uuid REFERENCES sys.sys_tenancies(tenant_id) ON DELETE SET NULL,
  gdpr_request_subject_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  gdpr_request_type    varchar(16) NOT NULL CHECK (gdpr_request_type IN ('EXPORT','ERASURE','RETENTION_RUN')),
  gdpr_request_status  varchar(12) NOT NULL CHECK (gdpr_request_status IN ('COMPLETED','DRY_RUN')),
  gdpr_request_requested_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  gdpr_request_report  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sys_gdpr_requests_subject_idx
  ON sys.sys_gdpr_requests (gdpr_request_subject_user_id, created_at DESC);

-- ------------------------------------------------- 3b. reconciliation registry
-- Every new sys.* table needs a classification row or the 000062
-- "0 UNCLASSIFIED" assert fails on the next full-chain re-run (the invariant
-- that caught exactly this gap in S1023). App-generated → EXCLUDE / bucket D.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_gdpr_data_map', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated GDPR classification registry (D-14 F3, mig 000186), seeded by migration; not a legacy-reconciliation target.]'),
  ('sys_user_consents', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated consent ledger (D-14 F4, mig 000186), populated at runtime by the ESS surface; no legacy source.]'),
  ('sys_gdpr_requests', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated DSR accountability log (D-14 F3, mig 000186), populated at runtime; no legacy source.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- ------------------------------------------------------------ 4. permissions
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('gdpr:read',      'Read the GDPR data map and DSR request log', 'gdpr', 'read'),
  ('gdpr:export',    'Run a DSR export for a data subject',        'gdpr', 'export'),
  ('gdpr:erase',     'Run a GDPR erasure for a data subject',      'gdpr', 'erase'),
  ('gdpr:retention', 'Run the data-retention sweep',               'gdpr', 'retention')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
   AND p.auth_permission_code IN ('gdpr:read','gdpr:export','gdpr:erase','gdpr:retention')
ON CONFLICT DO NOTHING;

-- Self-service floor (I17): own-data export + consent ledger for EVERY role.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('gdpr:export:self',    'Export one''s own personal data (Art. 15/20)', 'gdpr',    'export:self'),
  ('consent:manage:self', 'Read and record one''s own consents',          'consent', 'manage:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code IN ('gdpr:export:self','consent:manage:self')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------- registry seed
-- Subject-FK columns verified against pg_constraint (S1023). One row per
-- (table, subject column); both directions of continuous/360 feedback are the
-- subject's personal data for EXPORT purposes.
INSERT INTO sys.sys_gdpr_data_map
  (gdpr_map_table_name, gdpr_map_subject_fk, gdpr_map_data_class,
   gdpr_map_erasure_strategy, gdpr_map_retention_days, gdpr_map_age_column, gdpr_map_legal_basis)
VALUES
  -- root (anonymize: hard delete would cascade into legally-retained tables)
  ('sys_users', 'user_id', 'IDENTITY', 'ANONYMIZE', NULL, NULL,
   'Contract execution; root row anonymized on erasure to preserve legally-retained children'),
  -- person satellites — PERSONAL → DELETE
  ('sys_user_addresses',               'user_address_user_id',            'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_bank_details',            'user_bank_user_id',               'PERSONAL', 'DELETE', NULL, NULL,
   'Payment execution ends with employment; payslips retain the payment record'),
  ('sys_user_career_plans',            'user_career_plan_user_id',        'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_certifications',          'user_certification_user_id',      'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_demographics',            'user_demographics_user_id',       'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_documents',               'user_document_user_id',           'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_education_records',       'user_education_record_user_id',   'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_family_members',          'user_family_member_user_id',      'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_identity_documents',      'user_identity_document_user_id',  'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_preferences',             'user_preference_user_id',         'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_professional_experiences','user_prof_exp_user_id',           'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_profiles',                'user_profile_user_id',            'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_skills',                  'user_skill_user_id',              'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_skill_evidence',          'user_skill_evidence_user_id',     'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_target_positions',        'user_target_position_user_id',    'PERSONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_learning_assignments',    'user_learning_assignment_user_id','OPERATIONAL', 'DELETE', NULL, NULL, NULL),
  ('sys_user_profile_embeddings',      'user_id',                         'DERIVED', 'DELETE', NULL, NULL,
   'ML-derived profile vector — derived personal data'),
  -- legally-retained employment record — FINANCIAL_LEGAL → RETAIN
  ('sys_user_pay_slips',            'user_pay_slip_user_id',            'FINANCIAL_LEGAL', 'RETAIN', NULL, NULL,
   'Labor-law payslip retention (IT: 5y+ fiscal / 10y civil prescription)'),
  ('sys_user_contracts',            'user_contract_user_id',            'FINANCIAL_LEGAL', 'RETAIN', NULL, NULL,
   'Employment contract retention (IT: 10y civil prescription)'),
  ('sys_user_employment',           'user_employment_user_id',          'FINANCIAL_LEGAL', 'RETAIN', NULL, NULL,
   'Employment history — pension/social-security obligations'),
  ('sys_user_position_assignments', 'user_position_assignment_user_id', 'FINANCIAL_LEGAL', 'RETAIN', NULL, NULL,
   'Org/employment history — employment record'),
  ('sys_user_learning_evidence',    'user_learning_evidence_user_id',   'OPERATIONAL', 'RETAIN', NULL, NULL,
   'Mandatory-training completion proof (D.Lgs 81/08)'),
  -- evaluation record — RETAIN (defence of legal claims)
  ('sys_user_assessment_evidence',  'user_assessment_evidence_user_id', 'EVALUATION', 'RETAIN', NULL, NULL,
   'Performance record — defence of legal claims'),
  ('sys_user_kpi_evidence',         'user_kpi_evidence_user_id',        'EVALUATION', 'RETAIN', NULL, NULL,
   'Performance record — defence of legal claims'),
  -- auth & security
  ('sys_user_auth_roles',           'user_auth_role_user_id',   'AUTH_SECURITY', 'RETAIN', NULL, NULL,
   'Authorization audit trail'),
  ('sys_auth_identities',           'auth_identity_user_id',    'AUTH_SECURITY', 'DELETE', NULL, NULL,
   'Erasure revokes the login identity (credentials cascade)'),
  ('sys_auth_sessions',             'auth_session_user_id',     'AUTH_SECURITY', 'DELETE', NULL, NULL, NULL),
  ('sys_auth_refresh_tokens',       'auth_refresh_token_user_id','AUTH_SECURITY','DELETE', 90, 'auth_refresh_token_issued_at',
   'Token hygiene — expired tokens swept'),
  ('sys_auth_password_reset_tokens','auth_password_reset_user_id','AUTH_SECURITY','DELETE', 30, 'created_at', NULL),
  ('sys_auth_mfa_factors',          'auth_mfa_factor_user_id',  'AUTH_SECURITY', 'DELETE', NULL, NULL, NULL),
  ('sys_auth_mfa_otp_challenges',   'auth_mfa_otp_user_id',     'AUTH_SECURITY', 'DELETE', 30, 'created_at', NULL),
  ('sys_auth_mfa_recovery_codes',   'recovery_code_user_id',    'AUTH_SECURITY', 'DELETE', NULL, NULL, NULL),
  ('sys_auth_mfa_webauthn_credentials','auth_webauthn_cred_user_id','AUTH_SECURITY','DELETE', NULL, NULL, NULL),
  ('sys_auth_mfa_exemptions',       'auth_mfa_exemption_user_id','AUTH_SECURITY','DELETE', NULL, NULL, NULL),
  ('sys_auth_login_events',         'auth_login_event_user_id', 'AUTH_SECURITY', 'RETAIN', 400, 'created_at',
   'Security audit log — D-59: 400-day retention then hard delete'),
  -- consents & DSR log (accountability — exported, retained)
  ('sys_user_consents',             'consent_user_id',          'PERSONAL', 'RETAIN', NULL, NULL,
   'Proof-of-consent history (accountability, Art. 7(1))'),
  ('sys_gdpr_requests',             'gdpr_request_subject_user_id','OPERATIONAL','RETAIN', NULL, NULL,
   'DSR accountability log (Art. 5(2))'),
  -- business tables where the user is the SUBJECT — EVALUATION/OPERATIONAL
  ('sys_assessments',               'assessment_subject_user_id',  'EVALUATION', 'RETAIN', NULL, NULL,
   'Performance record — defence of legal claims'),
  ('sys_attendance',                'attendance_subject_user_id',  'OPERATIONAL', 'RETAIN', NULL, NULL,
   'Attendance record — labor-law relevance'),
  ('sys_behavioral_assessments',    'behavioral_assessment_user_id','EVALUATION','RETAIN', NULL, NULL,
   'Performance record — defence of legal claims'),
  ('sys_compensation_recommendations','compensation_recommendation_user_id','FINANCIAL_LEGAL','RETAIN', NULL, NULL,
   'Compensation decision record'),
  ('sys_continuous_feedback',       'feedback_to_user_id',   'EVALUATION', 'RETAIN', NULL, NULL,
   'Feedback received — performance record'),
  ('sys_continuous_feedback',       'feedback_from_user_id', 'EVALUATION', 'RETAIN', NULL, NULL,
   'Feedback authored — opinions expressed by the subject'),
  ('sys_employee_position_fit_scores','employee_position_fit_score_user_id','DERIVED','RETAIN', NULL, NULL,
   'Derived analytics — org planning'),
  ('sys_engagement_survey_responses','response_subject_user_id','EVALUATION','RETAIN', NULL, NULL,
   'Engagement responses — org analytics'),
  ('sys_engagement_action_plans',   'action_plan_owner_user_id','OPERATIONAL','RETAIN', NULL, NULL, NULL),
  ('sys_feedback_360_responses',    'response_target_user_id',  'EVALUATION', 'RETAIN', NULL, NULL,
   '360 feedback received — performance record'),
  ('sys_feedback_360_responses',    'response_reviewer_user_id','EVALUATION', 'RETAIN', NULL, NULL,
   '360 feedback authored — opinions expressed by the subject'),
  ('sys_flight_risk_scores',        'flight_risk_score_user_id','DERIVED', 'RETAIN', NULL, NULL,
   'Derived analytics — org planning'),
  ('sys_gap_analysis_results',      'gap_analysis_result_user_id','DERIVED','RETAIN', NULL, NULL, NULL),
  ('sys_gap_closure_plans',         'gap_closure_plan_owner_user_id','OPERATIONAL','RETAIN', NULL, NULL, NULL),
  ('sys_gap_closure_actions',       'gap_closure_action_owner_user_id','OPERATIONAL','RETAIN', NULL, NULL, NULL),
  ('sys_variable_pay_calculations', 'variable_pay_calculation_user_id','FINANCIAL_LEGAL','RETAIN', NULL, NULL,
   'Variable-pay calculation record')
ON CONFLICT (gdpr_map_table_schema, gdpr_map_table_name, gdpr_map_subject_fk) DO NOTHING;
