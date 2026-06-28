-- =============================================================================
-- 000164_user_anagraphic_satellites.sql
-- Heuresys Advanced — anagraphic / identity satellites for sys_users (6 tables)
-- -----------------------------------------------------------------------------
-- Brings the rich employee-personal data of the legacy portal profile into the
-- advanced employee-centric model (ADR-0024). No-PII policy is ABANDONED
-- (ADR-0023/0026): these fields (tax_id, identity documents, addresses, family,
-- banking, compensation/SAP/lifecycle) are treated as PRODUCTION DATA — they are
-- dedicated satellites, NOT "out-of-scope". Payroll EXECUTION stays out (I8):
-- sys_user_employment is an import-fed read model for consultation/intelligence,
-- the platform does not run payroll.
--
-- All tables: tenant-scoped + user-scoped (FK sys_users / sys_tenancies) + audit
-- columns + set_updated_at trigger. Pattern mirrors 000006. Idempotent
-- (CREATE TABLE IF NOT EXISTS, guarded triggers) — twice-run = empty diff.
--
-- Categorical fields use varchar + CHECK (RD-08, never ENUM). Date-only columns
-- use `date` (RD-09). Schema discipline I3/I4: sys.sys_<plural>.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_user_demographics (1:1) — personal anagraphic + contacts + emergency
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_demographics (
  user_demographics_id                     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_demographics_user_id                uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_demographics_tenant_id              uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_demographics_middle_name            varchar(128),
  user_demographics_birth_date             date,
  user_demographics_birth_place            varchar(128),
  user_demographics_gender                 varchar(16)  CHECK (user_demographics_gender IN ('MALE','FEMALE','OTHER','UNSPECIFIED')),
  user_demographics_nationality            varchar(8),
  user_demographics_marital_status         varchar(16)  CHECK (user_demographics_marital_status IN ('SINGLE','MARRIED','DIVORCED','WIDOWED','SEPARATED','CIVIL_UNION','OTHER','UNSPECIFIED')),
  user_demographics_tax_id                 varchar(32),
  user_demographics_phone_mobile           varchar(64),
  user_demographics_phone_home             varchar(64),
  user_demographics_personal_email         varchar(320),
  user_demographics_emergency_name         varchar(128),
  user_demographics_emergency_phone        varchar(64),
  user_demographics_emergency_relationship varchar(64),
  user_demographics_metadata               jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                               timestamptz  NOT NULL DEFAULT now(),
  created_by                               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                               timestamptz  NOT NULL DEFAULT now(),
  updated_by                               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_demographics_user_uq
  ON sys.sys_user_demographics (user_demographics_user_id);
CREATE INDEX IF NOT EXISTS sys_user_demographics_tenant_idx
  ON sys.sys_user_demographics (user_demographics_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_demographics_set_updated_at' AND tgrelid = 'sys.sys_user_demographics'::regclass) THEN
    CREATE TRIGGER sys_user_demographics_set_updated_at BEFORE UPDATE ON sys.sys_user_demographics FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_user_identity_documents (1:N) — national ID / passport / driver lic.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_identity_documents (
  user_identity_document_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identity_document_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_identity_document_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_identity_document_kind        varchar(24)  NOT NULL CHECK (user_identity_document_kind IN ('NATIONAL_ID','PASSPORT','DRIVER_LICENSE')),
  user_identity_document_number      varchar(64)  NOT NULL,
  user_identity_document_expiry_date date,
  user_identity_document_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now(),
  created_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                         timestamptz  NOT NULL DEFAULT now(),
  updated_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_identity_documents_user_kind_uq
  ON sys.sys_user_identity_documents (user_identity_document_user_id, user_identity_document_kind);
CREATE INDEX IF NOT EXISTS sys_user_identity_documents_tenant_idx
  ON sys.sys_user_identity_documents (user_identity_document_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_identity_documents_set_updated_at' AND tgrelid = 'sys.sys_user_identity_documents'::regclass) THEN
    CREATE TRIGGER sys_user_identity_documents_set_updated_at BEFORE UPDATE ON sys.sys_user_identity_documents FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 3. sys.sys_user_addresses (1:N) — permanent residence + temporary domicile
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_addresses (
  user_address_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_address_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_address_kind        varchar(16)  NOT NULL CHECK (user_address_kind IN ('PERMANENT','TEMPORARY')),
  user_address_street      varchar(255),
  user_address_city        varchar(128),
  user_address_postal_code varchar(32),
  user_address_country     varchar(8),
  user_address_region      varchar(64),
  user_address_is_primary  boolean      NOT NULL DEFAULT false,
  user_address_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  created_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_addresses_user_kind_uq
  ON sys.sys_user_addresses (user_address_user_id, user_address_kind);
CREATE INDEX IF NOT EXISTS sys_user_addresses_tenant_idx
  ON sys.sys_user_addresses (user_address_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_addresses_set_updated_at' AND tgrelid = 'sys.sys_user_addresses'::regclass) THEN
    CREATE TRIGGER sys_user_addresses_set_updated_at BEFORE UPDATE ON sys.sys_user_addresses FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 4. sys.sys_user_family_members (1:N) — dependents & relatives
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_family_members (
  user_family_member_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_family_member_user_id      uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_family_member_tenant_id    uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_family_member_first_name   varchar(128),
  user_family_member_last_name    varchar(128),
  user_family_member_relationship varchar(32),
  user_family_member_birth_date   date,
  user_family_member_gender       varchar(16)  CHECK (user_family_member_gender IN ('MALE','FEMALE','OTHER','UNSPECIFIED')),
  user_family_member_is_dependent boolean      NOT NULL DEFAULT false,
  user_family_member_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  created_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_family_members_user_idx
  ON sys.sys_user_family_members (user_family_member_user_id);
CREATE INDEX IF NOT EXISTS sys_user_family_members_tenant_idx
  ON sys.sys_user_family_members (user_family_member_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_family_members_set_updated_at' AND tgrelid = 'sys.sys_user_family_members'::regclass) THEN
    CREATE TRIGGER sys_user_family_members_set_updated_at BEFORE UPDATE ON sys.sys_user_family_members FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 5. sys.sys_user_bank_details (1:1) — IBAN / SWIFT / bank
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_bank_details (
  user_bank_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_bank_user_id        uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_bank_tenant_id      uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_bank_iban           varchar(34),
  user_bank_swift_bic      varchar(11),
  user_bank_bank_name      varchar(128),
  user_bank_account_number varchar(64),
  user_bank_metadata       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  created_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_bank_details_user_uq
  ON sys.sys_user_bank_details (user_bank_user_id);
CREATE INDEX IF NOT EXISTS sys_user_bank_details_tenant_idx
  ON sys.sys_user_bank_details (user_bank_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_bank_details_set_updated_at' AND tgrelid = 'sys.sys_user_bank_details'::regclass) THEN
    CREATE TRIGGER sys_user_bank_details_set_updated_at BEFORE UPDATE ON sys.sys_user_bank_details FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 6. sys.sys_user_employment (1:1) — compensation + SAP + lifecycle (import-fed,
--    read model for consultation/intelligence; NOT payroll execution, I8)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_user_employment (
  user_employment_id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_employment_user_id              uuid          NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_employment_tenant_id            uuid          NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  -- compensation (RAL / pay scale)
  user_employment_salary               numeric(15,2),
  user_employment_currency             varchar(3),
  user_employment_pay_scale_area       varchar(64),
  user_employment_pay_scale_type       varchar(64),
  user_employment_pay_scale_group      varchar(64),
  user_employment_pay_scale_level      varchar(32),
  user_employment_pay_periods_per_year smallint,
  user_employment_work_schedule_pct    numeric(5,2),
  -- SAP keys
  user_employment_pernr                varchar(16),
  user_employment_company_code         varchar(16),
  user_employment_personnel_area       varchar(16),
  user_employment_personnel_subarea    varchar(16),
  -- lifecycle
  user_employment_hire_date            date,
  user_employment_seniority_date       date,
  user_employment_probation_end_date   date,
  user_employment_contract_end_date    date,
  user_employment_termination_date     date,
  user_employment_termination_reason   varchar(128),
  user_employment_status               varchar(32),
  user_employment_metadata             jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz   NOT NULL DEFAULT now(),
  created_by                           uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                           timestamptz   NOT NULL DEFAULT now(),
  updated_by                           uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_user_employment_user_uq
  ON sys.sys_user_employment (user_employment_user_id);
CREATE INDEX IF NOT EXISTS sys_user_employment_tenant_idx
  ON sys.sys_user_employment (user_employment_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_employment_set_updated_at' AND tgrelid = 'sys.sys_user_employment'::regclass) THEN
    CREATE TRIGGER sys_user_employment_set_updated_at BEFORE UPDATE ON sys.sys_user_employment FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
