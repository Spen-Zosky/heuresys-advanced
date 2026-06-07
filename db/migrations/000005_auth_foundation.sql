-- =============================================================================
-- 000005_auth_foundation.sql
-- Heuresys Advanced — 11 auth tables (sys.sys_auth_*) + 8 roles + ~100 permissions
-- -----------------------------------------------------------------------------
-- Per AUTH_SECURITY_PLAN §2. The auth layer is structurally separate from
-- sys.sys_users (person anchor). Tables:
--   1.  sys_auth_identities          (auth identity per user × provider)
--   2.  sys_auth_credentials         (Argon2id hashes; partial unique current)
--   3.  sys_auth_sessions            (placeholder; future SSO)
--   4.  sys_auth_refresh_tokens      (rotation chain with family_id)
--   5.  sys_auth_login_events        (audit trail of auth state changes)
--   6.  sys_auth_password_reset_tokens
--   7.  sys_auth_mfa_factors         (foundation; enforcement post-MVP)
--   8.  sys_auth_roles               (8 canonical roles)
--   9.  sys_auth_permissions         (~100 perms)
--   10. sys_auth_role_permissions    (M:N, role × perm)
--   11. sys_user_auth_roles          (user × role × tenant assignment)
--
-- Permission seeding: 81 admin + 19 ESS self-scope (per AUTH_SECURITY_PLAN
-- §6 + §6.1). Role-permission mapping seed is appended at the bottom.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 sys.sys_auth_identities
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_identities (
  auth_identity_id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_identity_user_id          uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_identity_provider         varchar(32)  NOT NULL DEFAULT 'LOCAL',
  auth_identity_provider_subject varchar(255),
  auth_identity_email_verified   boolean      NOT NULL DEFAULT false,
  auth_identity_is_active        boolean      NOT NULL DEFAULT true,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_auth_identities
  DROP CONSTRAINT IF EXISTS sys_auth_identities_provider_check;
ALTER TABLE sys.sys_auth_identities
  ADD CONSTRAINT sys_auth_identities_provider_check
  CHECK (auth_identity_provider IN ('LOCAL', 'SSO_OIDC', 'SSO_SAML'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_identities_user_provider_uq
  ON sys.sys_auth_identities (auth_identity_user_id, auth_identity_provider);

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_identities_provider_subject_uq
  ON sys.sys_auth_identities (auth_identity_provider, auth_identity_provider_subject)
  WHERE auth_identity_provider_subject IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_auth_identities_set_updated_at' AND tgrelid = 'sys.sys_auth_identities'::regclass) THEN
    CREATE TRIGGER sys_auth_identities_set_updated_at BEFORE UPDATE ON sys.sys_auth_identities FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2.2 sys.sys_auth_credentials
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_credentials (
  auth_credential_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_credential_identity_id  uuid         NOT NULL REFERENCES sys.sys_auth_identities(auth_identity_id) ON DELETE CASCADE,
  auth_credential_algorithm    varchar(32)  NOT NULL DEFAULT 'ARGON2ID',
  auth_credential_hash         text         NOT NULL,
  auth_credential_is_current   boolean      NOT NULL DEFAULT true,
  auth_credential_must_rotate  boolean      NOT NULL DEFAULT false,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  rotated_at                   timestamptz
);

ALTER TABLE sys.sys_auth_credentials
  DROP CONSTRAINT IF EXISTS sys_auth_credentials_algorithm_check;
ALTER TABLE sys.sys_auth_credentials
  ADD CONSTRAINT sys_auth_credentials_algorithm_check
  CHECK (auth_credential_algorithm IN ('ARGON2ID', 'ARGON2I', 'BCRYPT_LEGACY'));

-- Partial unique: at most one current credential per identity
CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_credentials_one_current_per_identity
  ON sys.sys_auth_credentials (auth_credential_identity_id)
  WHERE auth_credential_is_current = true;

-- -----------------------------------------------------------------------------
-- 2.3 sys.sys_auth_sessions (placeholder; not on MVP-1 hot path)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_sessions (
  auth_session_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_user_id     uuid        NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_session_tenant_id   uuid        NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  auth_session_ip          inet,
  auth_session_user_agent  text,
  auth_session_revoked_at  timestamptz,
  auth_session_expires_at  timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_auth_sessions_user_active_idx
  ON sys.sys_auth_sessions (auth_session_user_id)
  WHERE auth_session_revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2.4 sys.sys_auth_refresh_tokens — rotation core
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_refresh_tokens (
  auth_refresh_token_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_refresh_token_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_refresh_token_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  auth_refresh_token_family_id     uuid         NOT NULL,
  auth_refresh_token_previous_id   uuid         REFERENCES sys.sys_auth_refresh_tokens(auth_refresh_token_id) ON DELETE SET NULL,
  auth_refresh_token_hash          char(64)     NOT NULL,
  auth_refresh_token_issued_at     timestamptz  NOT NULL DEFAULT now(),
  auth_refresh_token_expires_at    timestamptz  NOT NULL,
  auth_refresh_token_used_at       timestamptz,
  auth_refresh_token_revoked_at    timestamptz,
  auth_refresh_token_revoke_reason varchar(64),
  auth_refresh_token_ip            inet,
  auth_refresh_token_user_agent    text
);

ALTER TABLE sys.sys_auth_refresh_tokens
  DROP CONSTRAINT IF EXISTS sys_auth_refresh_tokens_revoke_reason_check;
ALTER TABLE sys.sys_auth_refresh_tokens
  ADD CONSTRAINT sys_auth_refresh_tokens_revoke_reason_check
  CHECK (auth_refresh_token_revoke_reason IS NULL OR auth_refresh_token_revoke_reason IN
    ('LOGOUT', 'REPLAY_DETECTED', 'REVOKED_BY_ADMIN', 'PASSWORD_CHANGED', 'EXPIRED', 'TENANT_SUSPENDED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_refresh_tokens_hash_uq
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_hash);

CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_user_family_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_user_id, auth_refresh_token_family_id);

CREATE INDEX IF NOT EXISTS sys_auth_refresh_tokens_active_idx
  ON sys.sys_auth_refresh_tokens (auth_refresh_token_user_id)
  WHERE auth_refresh_token_used_at IS NULL AND auth_refresh_token_revoked_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2.5 sys.sys_auth_login_events (audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_login_events (
  auth_login_event_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_login_event_user_id   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  auth_login_event_tenant_id uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE SET NULL,
  auth_login_event_type      varchar(64)  NOT NULL,
  auth_login_event_ip        inet,
  auth_login_event_user_agent text,
  auth_login_event_details   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_auth_login_events
  DROP CONSTRAINT IF EXISTS sys_auth_login_events_type_check;
ALTER TABLE sys.sys_auth_login_events
  ADD CONSTRAINT sys_auth_login_events_type_check
  CHECK (auth_login_event_type IN (
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_UNKNOWN_USER', 'LOGOUT',
    'REFRESH_OK', 'REFRESH_REPLAY_DETECTED', 'REFRESH_EXPIRED',
    'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED_BY_USER',
    'MFA_OK', 'MFA_FAIL', 'REVOKED_BY_ADMIN', 'ACCOUNT_LOCKED',
    'ROLE_GRANTED', 'ROLE_REVOKED'
  ));

CREATE INDEX IF NOT EXISTS sys_auth_login_events_user_idx
  ON sys.sys_auth_login_events (auth_login_event_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sys_auth_login_events_type_idx
  ON sys.sys_auth_login_events (auth_login_event_type, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2.6 sys.sys_auth_password_reset_tokens
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_password_reset_tokens (
  auth_password_reset_token_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_password_reset_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_password_reset_token_hash  char(64)     NOT NULL,
  auth_password_reset_expires_at  timestamptz  NOT NULL,
  auth_password_reset_used_at     timestamptz,
  auth_password_reset_requester_ip inet,
  created_at                      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_password_reset_token_hash_uq
  ON sys.sys_auth_password_reset_tokens (auth_password_reset_token_hash);

CREATE INDEX IF NOT EXISTS sys_auth_password_reset_user_active_idx
  ON sys.sys_auth_password_reset_tokens (auth_password_reset_user_id)
  WHERE auth_password_reset_used_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2.7 sys.sys_auth_mfa_factors (foundation; enforcement post-MVP)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_factors (
  auth_mfa_factor_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_factor_user_id      uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  auth_mfa_factor_kind         varchar(32)  NOT NULL,
  auth_mfa_factor_secret       text,
  auth_mfa_factor_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  auth_mfa_factor_verified     boolean      NOT NULL DEFAULT false,
  auth_mfa_factor_last_used_at timestamptz,
  created_at                   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_auth_mfa_factors
  DROP CONSTRAINT IF EXISTS sys_auth_mfa_factors_kind_check;
ALTER TABLE sys.sys_auth_mfa_factors
  ADD CONSTRAINT sys_auth_mfa_factors_kind_check
  CHECK (auth_mfa_factor_kind IN ('TOTP', 'WEBAUTHN', 'EMAIL_OTP', 'SMS_OTP'));

CREATE INDEX IF NOT EXISTS sys_auth_mfa_factors_user_idx
  ON sys.sys_auth_mfa_factors (auth_mfa_factor_user_id);

-- -----------------------------------------------------------------------------
-- 2.8 sys.sys_auth_roles + 8-role seed
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_roles (
  auth_role_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_role_code        varchar(64)  NOT NULL,
  auth_role_name        varchar(128) NOT NULL,
  auth_role_description text,
  auth_role_is_platform boolean      NOT NULL DEFAULT false,
  created_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_roles_code_uq
  ON sys.sys_auth_roles (auth_role_code);

INSERT INTO sys.sys_auth_roles (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform) VALUES
  ('PLATFORM_ADMIN',    'Platform Administrator',  'Cross-tenant administration of the platform itself.', true),
  ('TENANT_ADMIN',      'Tenant Administrator',    'Full administration within a single tenant.',         false),
  ('BLUEPRINT_MANAGER', 'Blueprint Manager',       'Manages enterprise typing and blueprint activation.', false),
  ('HRMS_MANAGER',      'HRMS Manager',            'Manages positions, skills, KPIs, learning, gaps.',    false),
  ('PROCESS_OWNER',     'Process Owner',           'Owns specific BPM processes.',                        false),
  ('MANAGER',           'Line Manager',            'Manages a team / set of positions.',                  false),
  ('USER',              'Standard User',           'Authenticated user with self-service access.',        false),
  ('READ_ONLY',         'Read-Only Observer',      'Read-only access to in-scope resources.',             false)
ON CONFLICT (auth_role_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2.9 sys.sys_auth_permissions + seed (~100 perms: 81 admin + 19 ESS self)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_permissions (
  auth_permission_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_permission_code        varchar(128) NOT NULL,
  auth_permission_name        varchar(128) NOT NULL,
  auth_permission_resource    varchar(64)  NOT NULL,
  auth_permission_action      varchar(64)  NOT NULL,
  auth_permission_description text,
  created_at                  timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_auth_permissions_code_uq
  ON sys.sys_auth_permissions (auth_permission_code);

CREATE INDEX IF NOT EXISTS sys_auth_permissions_resource_idx
  ON sys.sys_auth_permissions (auth_permission_resource);

-- Admin permission seeds (resource:action). ~81 rows.
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action) VALUES
  -- tenant (4)
  ('tenant:list',                          'List tenants',                          'tenant',                    'list'),
  ('tenant:read',                          'Read tenant',                           'tenant',                    'read'),
  ('tenant:create',                        'Create tenant',                         'tenant',                    'create'),
  ('tenant:update',                        'Update tenant',                         'tenant',                    'update'),
  ('tenant:delete',                        'Delete tenant',                         'tenant',                    'delete'),
  -- user (5)
  ('user:list',                            'List users',                            'user',                      'list'),
  ('user:read',                            'Read user',                             'user',                      'read'),
  ('user:create',                          'Create user',                           'user',                      'create'),
  ('user:update',                          'Update user',                           'user',                      'update'),
  ('user:delete',                          'Delete user',                           'user',                      'delete'),
  -- user_profile (2)
  ('user_profile:read',                    'Read user profile',                     'user_profile',              'read'),
  ('user_profile:update',                  'Update user profile',                   'user_profile',              'update'),
  -- user_position_assignment (4)
  ('user_position_assignment:list',        'List position assignments',             'user_position_assignment',  'list'),
  ('user_position_assignment:read',        'Read position assignment',              'user_position_assignment',  'read'),
  ('user_position_assignment:create',      'Create position assignment',            'user_position_assignment',  'create'),
  ('user_position_assignment:update',      'Update position assignment',            'user_position_assignment',  'update'),
  ('user_position_assignment:delete',      'Delete position assignment',            'user_position_assignment',  'delete'),
  -- enterprise_typing (3)
  ('enterprise_typing:read',               'Read enterprise typing',                'enterprise_typing',         'read'),
  ('enterprise_typing:create',             'Create enterprise typing',              'enterprise_typing',         'create'),
  ('enterprise_typing:update',             'Update enterprise typing',              'enterprise_typing',         'update'),
  -- blueprint (3)
  ('blueprint:read',                       'Read blueprint',                        'blueprint',                 'read'),
  ('blueprint:activate',                   'Activate blueprint variant',            'blueprint',                 'activate'),
  ('blueprint:override',                   'Override activated blueprint',          'blueprint',                 'override'),
  -- bpm_process (2)
  ('bpm_process:read',                     'Read BPM process',                      'bpm_process',               'read'),
  ('bpm_process:update',                   'Update BPM process',                    'bpm_process',               'update'),
  -- organization_unit (5)
  ('organization_unit:list',               'List organization units',               'organization_unit',         'list'),
  ('organization_unit:read',               'Read organization unit',                'organization_unit',         'read'),
  ('organization_unit:create',             'Create organization unit',              'organization_unit',         'create'),
  ('organization_unit:update',             'Update organization unit',              'organization_unit',         'update'),
  ('organization_unit:delete',             'Delete organization unit',              'organization_unit',         'delete'),
  -- position (5)
  ('position:list',                        'List positions',                        'position',                  'list'),
  ('position:read',                        'Read position',                         'position',                  'read'),
  ('position:create',                      'Create position',                       'position',                  'create'),
  ('position:update',                      'Update position',                       'position',                  'update'),
  ('position:delete',                      'Delete position',                       'position',                  'delete'),
  -- job_role (3)
  ('job_role:read',                        'Read job role',                         'job_role',                  'read'),
  ('job_role:create',                      'Create job role',                       'job_role',                  'create'),
  ('job_role:update',                      'Update job role',                       'job_role',                  'update'),
  -- skill (3)
  ('skill:read',                           'Read skill',                            'skill',                     'read'),
  ('skill:create',                         'Create skill',                          'skill',                     'create'),
  ('skill:update',                         'Update skill',                          'skill',                     'update'),
  -- kpi (4)
  ('kpi:read',                             'Read KPI',                              'kpi',                       'read'),
  ('kpi:create',                           'Create KPI',                            'kpi',                       'create'),
  ('kpi:update',                           'Update KPI',                            'kpi',                       'update'),
  ('kpi:delete',                           'Delete KPI',                            'kpi',                       'delete'),
  -- learning (4)
  ('learning:read',                        'Read learning module',                  'learning',                  'read'),
  ('learning:create',                      'Create learning module',                'learning',                  'create'),
  ('learning:update',                      'Update learning module',                'learning',                  'update'),
  ('learning:delete',                      'Delete learning module',                'learning',                  'delete'),
  -- training_initiative (4)
  ('training_initiative:list',             'List training initiatives',             'training_initiative',       'list'),
  ('training_initiative:read',             'Read training initiative',              'training_initiative',       'read'),
  ('training_initiative:create',           'Create training initiative',            'training_initiative',       'create'),
  ('training_initiative:update',           'Update training initiative',            'training_initiative',       'update'),
  -- assessment (3)
  ('assessment:read',                      'Read assessment',                       'assessment',                'read'),
  ('assessment:create',                    'Create assessment',                     'assessment',                'create'),
  ('assessment:update',                    'Update assessment',                     'assessment',                'update'),
  -- gap_analysis (3)
  ('gap_analysis:read',                    'Read gap analysis',                     'gap_analysis',              'read'),
  ('gap_analysis:create',                  'Create gap closure plan',               'gap_analysis',              'create'),
  ('gap_analysis:update',                  'Update gap closure plan',               'gap_analysis',              'update'),
  -- career_succession (3)
  ('career_succession:read',               'Read career & succession',              'career_succession',         'read'),
  ('career_succession:create',             'Create career/succession entry',        'career_succession',         'create'),
  ('career_succession:update',             'Update career/succession entry',        'career_succession',         'update'),
  -- compensation_intelligence (2)
  ('compensation_intelligence:read',       'Read compensation intelligence',        'compensation_intelligence', 'read'),
  ('compensation_intelligence:update',     'Update compensation intelligence',      'compensation_intelligence', 'update'),
  -- visualization (3)
  ('visualization:read',                   'Read visualization',                    'visualization',             'read'),
  ('visualization:create',                 'Create visualization graph',            'visualization',             'create'),
  ('visualization:update_layout',          'Update visualization layout',           'visualization',             'update_layout'),
  -- seed_acquisition (3)
  ('seed_acquisition:trigger',             'Trigger seed acquisition run',          'seed_acquisition',          'trigger'),
  ('seed_acquisition:read',                'Read seed acquisition runs',            'seed_acquisition',          'read'),
  ('seed_acquisition:approve',             'Approve seed candidates',               'seed_acquisition',          'approve'),
  -- brownfield_adaptation (3)
  ('brownfield_adaptation:trigger',        'Trigger brownfield wave',               'brownfield_adaptation',     'trigger'),
  ('brownfield_adaptation:read',           'Read brownfield inventory/runs',        'brownfield_adaptation',     'read'),
  ('brownfield_adaptation:approve',        'Approve brownfield import',             'brownfield_adaptation',     'approve'),
  -- role (3)
  ('role:read',                            'Read roles & permissions',              'role',                      'read'),
  ('role:create',                          'Create role',                           'role',                      'create'),
  ('role:update',                          'Update role',                           'role',                      'update'),
  ('role:assign',                          'Assign role to user',                   'role',                      'assign'),
  -- auth (admin revoke) (1)
  ('auth:revoke_user',                     'Revoke a user''s refresh tokens',       'auth',                      'revoke_user'),
  -- learning catalogue browse (also granted to USER but is not self-scoped)
  ('learning:browse_catalogue',            'Browse learning catalogue',             'learning',                  'browse_catalogue')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- ESS self-scope permission seeds (19 rows per AUTH_SECURITY_PLAN §6.1).
-- Action format uses 'verb:self' or '*:self' to disambiguate from admin perms.
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action) VALUES
  ('user_profile:read:self',               'Read own profile (ESS)',                'user_profile',              'read:self'),
  ('user_profile:update:self',             'Update own profile (ESS)',              'user_profile',              'update:self'),
  ('user_position_assignment:read:self',   'Read own position assignments (ESS)',   'user_position_assignment',  'read:self'),
  ('skill:read:self',                      'Read own skills (ESS)',                 'skill',                     'read:self'),
  ('skill:self_assess',                    'Submit skill self-assessment (ESS)',    'skill',                     'self_assess'),
  ('learning:read:self',                   'Read own learning assignments (ESS)',   'learning',                  'read:self'),
  ('learning:enroll:self',                 'Self-enroll in learning module (ESS)',  'learning',                  'enroll:self'),
  ('kpi:read:self',                        'Read own KPIs (ESS)',                   'kpi',                       'read:self'),
  ('gap_analysis:read:self',               'Read own gap analysis (ESS)',           'gap_analysis',              'read:self'),
  ('career_succession:read:self',          'Read own career/succession (ESS)',      'career_succession',         'read:self'),
  ('career:request_target:self',           'Request career target (ESS)',           'career',                    'request_target:self'),
  ('assessment:read:self',                 'Read own received assessments (ESS)',   'assessment',                'read:self'),
  ('certification:read:self',              'Read own certifications (ESS)',         'certification',             'read:self'),
  ('certification:upload:self',            'Upload certification URI (ESS)',        'certification',             'upload:self'),
  ('document:read:self',                   'Read own documents (ESS)',              'document',                  'read:self'),
  ('document:upload:self',                 'Upload document URI (ESS)',             'document',                  'upload:self'),
  ('notification:read:self',               'Read own inbox (ESS)',                  'notification',              'read:self'),
  ('notification:mark_read:self',          'Mark notification read (ESS)',          'notification',              'mark_read:self'),
  ('compensation_intelligence:read:self',  'Read own compensation summary (ESS)',   'compensation_intelligence', 'read:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2.10 sys.sys_auth_role_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_auth_role_permissions (
  auth_role_id       uuid         NOT NULL REFERENCES sys.sys_auth_roles(auth_role_id) ON DELETE CASCADE,
  auth_permission_id uuid         NOT NULL REFERENCES sys.sys_auth_permissions(auth_permission_id) ON DELETE CASCADE,
  granted_at         timestamptz  NOT NULL DEFAULT now(),
  PRIMARY KEY (auth_role_id, auth_permission_id)
);

-- Role × Permission seed mapping per AUTH_SECURITY_PLAN §6 + §6.1.
-- Strategy: PLATFORM_ADMIN gets every permission; other roles get curated sets.
-- All inserts are idempotent (PRIMARY KEY collision = no-op).

-- PLATFORM_ADMIN — everything
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE r.auth_role_code = 'PLATFORM_ADMIN'
ON CONFLICT DO NOTHING;

-- TENANT_ADMIN — everything within own tenant scope (no tenant:create/delete)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE r.auth_role_code = 'TENANT_ADMIN'
  AND p.auth_permission_code NOT IN ('tenant:create', 'tenant:delete', 'role:create', 'role:update', 'brownfield_adaptation:approve',
                                     'reference_sync:read', 'reference_sync:trigger')
ON CONFLICT DO NOTHING;

-- BLUEPRINT_MANAGER — typing, blueprint, processes, base read of most resources
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:list', 'user:read',
    'user_position_assignment:list', 'user_position_assignment:read',
    'enterprise_typing:read', 'enterprise_typing:create', 'enterprise_typing:update',
    'blueprint:read', 'blueprint:activate', 'blueprint:override',
    'bpm_process:read', 'bpm_process:update',
    'organization_unit:list', 'organization_unit:read',
    'position:list', 'position:read',
    'job_role:read',
    'skill:read', 'kpi:read', 'learning:read',
    'training_initiative:list', 'training_initiative:read',
    'visualization:read', 'visualization:create', 'visualization:update_layout'
  )
WHERE r.auth_role_code = 'BLUEPRINT_MANAGER'
ON CONFLICT DO NOTHING;

-- HRMS_MANAGER — positions, skills, KPIs, learning, gaps, career, comp (restricted)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:list', 'user:read', 'user:create', 'user:update',
    'user_profile:read', 'user_profile:update',
    'user_position_assignment:list', 'user_position_assignment:read', 'user_position_assignment:create', 'user_position_assignment:update', 'user_position_assignment:delete',
    'enterprise_typing:read',
    'blueprint:read', 'bpm_process:read',
    'organization_unit:list', 'organization_unit:read', 'organization_unit:create', 'organization_unit:update',
    'position:list', 'position:read', 'position:create', 'position:update', 'position:delete',
    'job_role:read', 'job_role:create', 'job_role:update',
    'skill:read', 'skill:create', 'skill:update',
    'kpi:read', 'kpi:create', 'kpi:update', 'kpi:delete',
    'learning:read', 'learning:create', 'learning:update', 'learning:delete', 'learning:browse_catalogue',
    'training_initiative:list', 'training_initiative:read', 'training_initiative:create', 'training_initiative:update',
    'assessment:read', 'assessment:create', 'assessment:update',
    'gap_analysis:read', 'gap_analysis:create', 'gap_analysis:update',
    'career_succession:read', 'career_succession:create', 'career_succession:update',
    'compensation_intelligence:read',
    'visualization:read', 'visualization:create', 'visualization:update_layout'
  )
WHERE r.auth_role_code = 'HRMS_MANAGER'
ON CONFLICT DO NOTHING;

-- PROCESS_OWNER — own processes + read
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:list', 'user:read',
    'user_position_assignment:list', 'user_position_assignment:read',
    'enterprise_typing:read', 'blueprint:read',
    'bpm_process:read', 'bpm_process:update',
    'organization_unit:list', 'organization_unit:read',
    'position:list', 'position:read', 'job_role:read',
    'skill:read', 'kpi:read', 'kpi:update',
    'learning:read', 'training_initiative:list', 'training_initiative:read',
    'visualization:read'
  )
WHERE r.auth_role_code = 'PROCESS_OWNER'
ON CONFLICT DO NOTHING;

-- MANAGER — team scope (scope filter enforced at repository, not by perm bit)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:list', 'user:read', 'user:update',
    'user_profile:read', 'user_profile:update',
    'user_position_assignment:list', 'user_position_assignment:read', 'user_position_assignment:create', 'user_position_assignment:update',
    'enterprise_typing:read', 'blueprint:read', 'bpm_process:read',
    'organization_unit:list', 'organization_unit:read', 'organization_unit:update',
    'position:list', 'position:read', 'position:update',
    'job_role:read', 'skill:read', 'kpi:read',
    'learning:read', 'learning:browse_catalogue',
    'training_initiative:list', 'training_initiative:read',
    'assessment:read', 'assessment:create',
    'gap_analysis:read',
    'career_succession:read',
    'visualization:read', 'visualization:update_layout'
  )
WHERE r.auth_role_code = 'MANAGER'
ON CONFLICT DO NOTHING;

-- USER — pure self-scope (ESS) + base read of catalogues
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:read',
    'user_profile:read:self', 'user_profile:update:self',
    'user_position_assignment:read:self',
    'enterprise_typing:read', 'blueprint:read', 'bpm_process:read',
    'organization_unit:list', 'organization_unit:read',
    'position:list', 'position:read', 'job_role:read',
    'skill:read', 'skill:read:self', 'skill:self_assess',
    'kpi:read:self',
    'learning:read', 'learning:browse_catalogue', 'learning:read:self', 'learning:enroll:self',
    'training_initiative:list', 'training_initiative:read',
    'assessment:read:self',
    'gap_analysis:read:self',
    'career_succession:read:self', 'career:request_target:self',
    'certification:read:self', 'certification:upload:self',
    'document:read:self', 'document:upload:self',
    'notification:read:self', 'notification:mark_read:self',
    'compensation_intelligence:read:self',
    'visualization:read'
  )
WHERE r.auth_role_code = 'USER'
ON CONFLICT DO NOTHING;

-- READ_ONLY — read everything visible to USER but no mutations
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:read',
    'user_profile:read:self',
    'user_position_assignment:read:self',
    'enterprise_typing:read', 'blueprint:read', 'bpm_process:read',
    'organization_unit:list', 'organization_unit:read',
    'position:list', 'position:read', 'job_role:read',
    'skill:read', 'skill:read:self',
    'kpi:read:self',
    'learning:read', 'learning:browse_catalogue', 'learning:read:self',
    'training_initiative:list', 'training_initiative:read',
    'assessment:read:self',
    'gap_analysis:read:self',
    'career_succession:read:self',
    'certification:read:self',
    'document:read:self',
    'notification:read:self',
    'visualization:read'
  )
WHERE r.auth_role_code = 'READ_ONLY'
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2.11 sys.sys_user_auth_roles — user × role × tenant assignment
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_auth_roles (
  user_auth_role_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_auth_role_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_auth_role_role_id     uuid         NOT NULL REFERENCES sys.sys_auth_roles(auth_role_id) ON DELETE CASCADE,
  user_auth_role_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  user_auth_role_granted_by  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_auth_role_granted_at  timestamptz  NOT NULL DEFAULT now(),
  user_auth_role_revoked_at  timestamptz
);

CREATE INDEX IF NOT EXISTS sys_user_auth_roles_user_idx
  ON sys.sys_user_auth_roles (user_auth_role_user_id);

CREATE INDEX IF NOT EXISTS sys_user_auth_roles_role_idx
  ON sys.sys_user_auth_roles (user_auth_role_role_id);

-- Partial unique: one ACTIVE (non-revoked) assignment per (user, role, tenant).
-- Tenant NULL coalesced to a sentinel UUID for platform-wide roles.
CREATE UNIQUE INDEX IF NOT EXISTS sys_user_auth_roles_active_uq
  ON sys.sys_user_auth_roles (
    user_auth_role_user_id,
    user_auth_role_role_id,
    COALESCE(user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE user_auth_role_revoked_at IS NULL;
