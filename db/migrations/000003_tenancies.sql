-- =============================================================================
-- 000003_tenancies.sql
-- Heuresys Advanced — sys.sys_tenancies (multi-tenant root registry)
-- -----------------------------------------------------------------------------
-- Tenancy is the root of every canonical FK chain (invariant I5: tenant
-- isolation via FK + API middleware; NO RLS). `tenant_code` is the natural
-- key for idempotent seeding (e.g. RTL_BANK_REFERENCE in 000021).
--
-- Note: no `created_by` / `updated_by` here — at bootstrap there are no
-- users yet (users themselves reference tenancies in 000004).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_tenancies (
  tenant_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code          varchar(64)  NOT NULL,
  tenant_name          varchar(255) NOT NULL,
  tenant_legal_name    varchar(255),
  tenant_country_code  char(2),
  tenant_industry_code varchar(64),
  tenant_size_band     varchar(32),
  tenant_status        varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  tenant_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

-- Categorical CHECK constraints (idempotent: drop + recreate)
ALTER TABLE sys.sys_tenancies
  DROP CONSTRAINT IF EXISTS sys_tenancies_tenant_status_check;
ALTER TABLE sys.sys_tenancies
  ADD CONSTRAINT sys_tenancies_tenant_status_check
  CHECK (tenant_status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'PENDING_ACTIVATION'));

ALTER TABLE sys.sys_tenancies
  DROP CONSTRAINT IF EXISTS sys_tenancies_tenant_size_band_check;
ALTER TABLE sys.sys_tenancies
  ADD CONSTRAINT sys_tenancies_tenant_size_band_check
  CHECK (tenant_size_band IS NULL OR tenant_size_band IN ('XS', 'S', 'M', 'L', 'XL'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_tenancies_tenant_code_uq
  ON sys.sys_tenancies (tenant_code);

CREATE INDEX IF NOT EXISTS sys_tenancies_status_idx
  ON sys.sys_tenancies (tenant_status);

CREATE INDEX IF NOT EXISTS sys_tenancies_industry_idx
  ON sys.sys_tenancies (tenant_industry_code);

-- Trigger: keep updated_at fresh on UPDATE
DO $trg$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_tenancies_set_updated_at'
      AND tgrelid = 'sys.sys_tenancies'::regclass
  ) THEN
    CREATE TRIGGER sys_tenancies_set_updated_at
      BEFORE UPDATE ON sys.sys_tenancies
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END
$trg$;
