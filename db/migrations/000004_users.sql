-- =============================================================================
-- 000004_users.sql
-- Heuresys Advanced — sys.sys_users (person/account anchor)
-- -----------------------------------------------------------------------------
-- The platform person anchor. Tenant-scoped (FK to sys_tenancies). NOT a
-- credential store — auth lives in 000005 (sys.sys_auth_*).
--
-- Invariants:
--   - (user_tenant_id, lower(user_email)) is unique per tenant.
--   - `user_type` = GENERATED_INCUMBENT marks blueprint-generated placeholder
--     incumbents (tenant-materialization). The synthetic flag was retired (ADR-0026, mig 000154);
--     the user_type CHECK below keeps SYNTHETIC_REFERENCE as a transition-tolerant value so the
--     migration chain stays twice-run idempotent before 000154 renames it away.
--   - No passwords/hashes ever stored on this table (per AUTH_SECURITY_PLAN).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_users (
  user_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_external_code   varchar(128),
  user_email           varchar(320) NOT NULL,
  user_display_name    varchar(255) NOT NULL,
  user_first_name      varchar(128),
  user_last_name       varchar(128),
  user_status          varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  user_type            varchar(32)  NOT NULL DEFAULT 'STANDARD',
  user_locale          varchar(16),
  user_timezone        varchar(64),
  user_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- Categorical CHECKs (idempotent drop+recreate per TARGET_SCHEMA §0.6)
ALTER TABLE sys.sys_users
  DROP CONSTRAINT IF EXISTS sys_users_user_status_check;
ALTER TABLE sys.sys_users
  ADD CONSTRAINT sys_users_user_status_check
  CHECK (user_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DEACTIVATED'));

ALTER TABLE sys.sys_users
  DROP CONSTRAINT IF EXISTS sys_users_user_type_check;
ALTER TABLE sys.sys_users
  ADD CONSTRAINT sys_users_user_type_check
  CHECK (user_type IN ('STANDARD', 'SYNTHETIC_REFERENCE', 'GENERATED_INCUMBENT', 'SERVICE'));

-- Tenant-scoped unique email (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS sys_users_tenant_email_uq
  ON sys.sys_users (user_tenant_id, lower(user_email));

CREATE INDEX IF NOT EXISTS sys_users_tenant_status_idx
  ON sys.sys_users (user_tenant_id, user_status);

CREATE INDEX IF NOT EXISTS sys_users_external_code_idx
  ON sys.sys_users (user_external_code)
  WHERE user_external_code IS NOT NULL;

-- Trigger
DO $trg$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_users_set_updated_at'
      AND tgrelid = 'sys.sys_users'::regclass
  ) THEN
    CREATE TRIGGER sys_users_set_updated_at
      BEFORE UPDATE ON sys.sys_users
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END
$trg$;
