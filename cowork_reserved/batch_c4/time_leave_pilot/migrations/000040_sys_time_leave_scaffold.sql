-- ============================================================================
-- Migration 000040 — sys.* Time/Leave/Attendance scaffold (6 new tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI) — Phase 3 prep · ADR-0015 (nullable lineage FK)
-- Companion doc: cowork_reserved/batch_c4/time_leave_pilot/02_TARGET_SCHEMA_PROPOSAL.md
-- ----------------------------------------------------------------------------
-- Creates 6 sys.* tables for Time/Leave/Attendance SDBI pilot (HC-2 Option B):
--   1. sys.sys_leave_accrual_rules        (20)
--   2. sys.sys_time_off_balances          (501)
--   3. sys.sys_leave_balance_transactions (27)
--   4. sys.sys_time_off_requests          (99)
--   5. sys.sys_attendance                 (5237)
--   6. sys.sys_overtime                   (383)
-- ----------------------------------------------------------------------------
-- Conventions (per ADR-0014 + Goals/OKRs pilot template):
--   - Table name: sys.sys_<entity>
--   - Column prefix: <entity>_<field>
--   - PK: <entity>_id uuid DEFAULT gen_random_uuid()
--   - Tenant FK: <entity>_tenant_id uuid NOT NULL → sys.sys_tenancies ON DELETE RESTRICT
--   - Audit: created_at, updated_at (where mutable), <entity>_created_by, <entity>_updated_by
--   - Natural key: <entity>_natural_key varchar(512) + UQ(tenant_id, natural_key)
--   - Metadata: <entity>_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--   - CHECK constraints (RD-08, NEVER ENUM)
--   - NO RLS (I5: tenant isolation via FK + middleware)
-- ----------------------------------------------------------------------------
-- Cross-OS / cross-client compat (CW-B28):
--   - NO psql metacommands (\restrict, \gexec, etc.)
--   - NO non-standard types (vector, uuid_generate_v4)
--   - Uses gen_random_uuid() (built-in PG ≥ 13, available in heuresys_advanced)
-- ----------------------------------------------------------------------------
-- Idempotency (CW-B30):
--   - CREATE TABLE IF NOT EXISTS
--   - Constraints / indexes / triggers wrapped in DO ... IF NOT EXISTS pg_*
--   - Twice-run produces zero pg_dump diff (verified by Goals/OKRs pilot precedent)
-- ----------------------------------------------------------------------------
-- CW-B29 mitigation: NO INSERT INTO sys.sys_schema_migrations
--   (pnpm db:migrate handles versioning tracking — do NOT manually mark)
-- ----------------------------------------------------------------------------
-- Authored: 2026-05-21 (Batch C4.2)
-- ============================================================================

BEGIN;

-- =====================================================================
-- §1 — sys.sys_leave_accrual_rules  (CATALOG, no FK to time-leave tables)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_leave_accrual_rules (
  accrual_rule_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  accrual_rule_tenant_id                uuid             NOT NULL,
  accrual_rule_natural_key              varchar(512)     NOT NULL,
  accrual_rule_leave_type               varchar(50)      NOT NULL,
  accrual_rule_name                     varchar(100)     NOT NULL,
  accrual_rule_description              text,
  accrual_rule_method                   varchar(20)      NOT NULL DEFAULT 'MONTHLY',
  accrual_rule_amount                   numeric(5,2)     NOT NULL,
  accrual_rule_max_accrual              numeric(5,2),
  accrual_rule_allow_carryover          boolean          NOT NULL DEFAULT true,
  accrual_rule_max_carryover_days       numeric(5,2),
  accrual_rule_carryover_expiry_months  integer,
  accrual_rule_min_tenure_months        integer          NOT NULL DEFAULT 0,
  accrual_rule_prorated_first_year      boolean          NOT NULL DEFAULT true,
  accrual_rule_ccnl_type                varchar(100),
  accrual_rule_is_ccnl_default          boolean          NOT NULL DEFAULT false,
  accrual_rule_is_active                boolean          NOT NULL DEFAULT true,
  accrual_rule_deleted_at               timestamptz,
  accrual_rule_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  accrual_rule_created_by               uuid,
  accrual_rule_updated_by               uuid,
  created_at                            timestamptz      NOT NULL DEFAULT now(),
  updated_at                            timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_leave_type_check') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_leave_type_check CHECK (
      accrual_rule_leave_type IN ('VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_method_check') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_method_check CHECK (
      accrual_rule_method IN ('MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','PER_PAY_PERIOD','LUMP_SUM')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_amount_positive') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_amount_positive CHECK (accrual_rule_amount >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_updated_after') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_tenant_fk') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_tenant_fk FOREIGN KEY (accrual_rule_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_created_by_fk') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_created_by_fk FOREIGN KEY (accrual_rule_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lar_updated_by_fk') THEN
    ALTER TABLE sys.sys_leave_accrual_rules ADD CONSTRAINT sys_lar_updated_by_fk FOREIGN KEY (accrual_rule_updated_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_leave_accrual_rules_natural_key_uq ON sys.sys_leave_accrual_rules (accrual_rule_tenant_id, accrual_rule_natural_key);
CREATE INDEX IF NOT EXISTS sys_leave_accrual_rules_type_idx              ON sys.sys_leave_accrual_rules (accrual_rule_tenant_id, accrual_rule_leave_type);
CREATE INDEX IF NOT EXISTS sys_leave_accrual_rules_ccnl_idx              ON sys.sys_leave_accrual_rules (accrual_rule_ccnl_type) WHERE accrual_rule_ccnl_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_leave_accrual_rules_active_idx            ON sys.sys_leave_accrual_rules (accrual_rule_tenant_id) WHERE accrual_rule_is_active = true AND accrual_rule_deleted_at IS NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_leave_accrual_rules_set_updated_at') THEN
    CREATE TRIGGER sys_leave_accrual_rules_set_updated_at BEFORE UPDATE ON sys.sys_leave_accrual_rules
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §2 — sys.sys_time_off_balances  (ACCUMULATOR)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_time_off_balances (
  balance_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_tenant_id                uuid             NOT NULL,
  balance_natural_key              varchar(512)     NOT NULL,
  balance_subject_user_id          uuid             NOT NULL,
  balance_leave_type               varchar(50)      NOT NULL,
  balance_year                     integer          NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),
  balance_total_days               numeric(5,2)     NOT NULL DEFAULT 0,
  balance_used_days                numeric(5,2)     NOT NULL DEFAULT 0,
  balance_pending_days             numeric(5,2)     NOT NULL DEFAULT 0,
  balance_carryover_days           numeric(5,2)     NOT NULL DEFAULT 0,
  balance_carryover_expires_at     date,
  balance_accrued_days             numeric(5,2)     NOT NULL DEFAULT 0,
  balance_adjustment_days          numeric(5,2)     NOT NULL DEFAULT 0,
  balance_adjustment_reason        text,
  balance_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_leave_type_check') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_leave_type_check CHECK (
      balance_leave_type IN ('VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_year_check') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_year_check CHECK (balance_year BETWEEN 2000 AND 2100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_days_non_neg') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_days_non_neg CHECK (
      balance_total_days >= 0 AND balance_used_days >= 0 AND balance_pending_days >= 0
      AND balance_carryover_days >= 0 AND balance_accrued_days >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_updated_after') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_tenant_fk') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_tenant_fk FOREIGN KEY (balance_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tob_subject_user_fk') THEN
    ALTER TABLE sys.sys_time_off_balances ADD CONSTRAINT sys_tob_subject_user_fk FOREIGN KEY (balance_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_tob_natural_key_uq ON sys.sys_time_off_balances (balance_tenant_id, balance_natural_key);
CREATE UNIQUE INDEX IF NOT EXISTS sys_tob_business_uq    ON sys.sys_time_off_balances (balance_tenant_id, balance_subject_user_id, balance_leave_type, balance_year);
CREATE INDEX IF NOT EXISTS sys_tob_user_year_idx          ON sys.sys_time_off_balances (balance_subject_user_id, balance_year);
CREATE INDEX IF NOT EXISTS sys_tob_leave_type_idx         ON sys.sys_time_off_balances (balance_tenant_id, balance_leave_type);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_time_off_balances_set_updated_at') THEN
    CREATE TRIGGER sys_time_off_balances_set_updated_at BEFORE UPDATE ON sys.sys_time_off_balances
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §3 — sys.sys_leave_balance_transactions  (EVENT-LOG, FK to balances)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_leave_balance_transactions (
  transaction_id                   uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_tenant_id            uuid             NOT NULL,
  transaction_natural_key          varchar(512)     NOT NULL,
  transaction_balance_id           uuid             NOT NULL,
  transaction_type                 varchar(50)      NOT NULL,
  transaction_days_amount          numeric(5,2)     NOT NULL,
  transaction_reference_type       varchar(50),
  transaction_reference_id         uuid,
  transaction_description          text,
  transaction_performed_by_user_id uuid,
  transaction_metadata             jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lbt_type_check') THEN
    ALTER TABLE sys.sys_leave_balance_transactions ADD CONSTRAINT sys_lbt_type_check CHECK (
      transaction_type IN ('ACCRUAL','USAGE','ADJUSTMENT','CARRYOVER','EXPIRY','RESET','TRANSFER')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lbt_tenant_fk') THEN
    ALTER TABLE sys.sys_leave_balance_transactions ADD CONSTRAINT sys_lbt_tenant_fk FOREIGN KEY (transaction_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lbt_balance_fk') THEN
    ALTER TABLE sys.sys_leave_balance_transactions ADD CONSTRAINT sys_lbt_balance_fk FOREIGN KEY (transaction_balance_id) REFERENCES sys.sys_time_off_balances(balance_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_lbt_performed_by_fk') THEN
    ALTER TABLE sys.sys_leave_balance_transactions ADD CONSTRAINT sys_lbt_performed_by_fk FOREIGN KEY (transaction_performed_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_lbt_natural_key_uq ON sys.sys_leave_balance_transactions (transaction_tenant_id, transaction_natural_key);
CREATE INDEX IF NOT EXISTS sys_lbt_balance_idx           ON sys.sys_leave_balance_transactions (transaction_balance_id);
CREATE INDEX IF NOT EXISTS sys_lbt_tenant_idx            ON sys.sys_leave_balance_transactions (transaction_tenant_id);
CREATE INDEX IF NOT EXISTS sys_lbt_created_at_idx        ON sys.sys_leave_balance_transactions (created_at DESC);


-- =====================================================================
-- §4 — sys.sys_time_off_requests  (WORKFLOW)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_time_off_requests (
  request_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  request_tenant_id                uuid             NOT NULL,
  request_natural_key              varchar(512)     NOT NULL,
  request_subject_user_id          uuid             NOT NULL,
  request_leave_type               varchar(50)      NOT NULL,
  request_start_date               date             NOT NULL,
  request_end_date                 date             NOT NULL,
  request_days_requested           numeric(5,2)     NOT NULL,
  request_half_day_start           boolean          NOT NULL DEFAULT false,
  request_half_day_end             boolean          NOT NULL DEFAULT false,
  request_reason                   text,
  request_status                   varchar(20)      NOT NULL DEFAULT 'PENDING',
  request_approver_user_id         uuid,
  request_approved_at              timestamptz,
  request_rejection_reason         text,
  request_overlap_approved         boolean          NOT NULL DEFAULT false,
  request_medical_cert_required    boolean          NOT NULL DEFAULT false,
  request_medical_cert_uploaded    boolean          NOT NULL DEFAULT false,
  request_cancellation_requested   boolean          NOT NULL DEFAULT false,
  request_cancellation_reason      text,
  request_cancelled_at             timestamptz,
  request_cancelled_by_user_id     uuid,
  request_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_leave_type_check') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_leave_type_check CHECK (
      request_leave_type IN ('VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_status_check') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_status_check CHECK (
      request_status IN ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_dates_ordered') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_dates_ordered CHECK (request_end_date >= request_start_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_days_positive') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_days_positive CHECK (request_days_requested > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_updated_after') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_tenant_fk') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_tenant_fk FOREIGN KEY (request_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_subject_user_fk') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_subject_user_fk FOREIGN KEY (request_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_approver_fk') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_approver_fk FOREIGN KEY (request_approver_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_tor_cancelled_by_fk') THEN
    ALTER TABLE sys.sys_time_off_requests ADD CONSTRAINT sys_tor_cancelled_by_fk FOREIGN KEY (request_cancelled_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_tor_natural_key_uq  ON sys.sys_time_off_requests (request_tenant_id, request_natural_key);
CREATE INDEX IF NOT EXISTS sys_tor_user_start_idx          ON sys.sys_time_off_requests (request_subject_user_id, request_start_date);
CREATE INDEX IF NOT EXISTS sys_tor_status_idx              ON sys.sys_time_off_requests (request_tenant_id, request_status);
CREATE INDEX IF NOT EXISTS sys_tor_approver_pending_idx    ON sys.sys_time_off_requests (request_approver_user_id) WHERE request_status = 'PENDING';

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_time_off_requests_set_updated_at') THEN
    CREATE TRIGGER sys_time_off_requests_set_updated_at BEFORE UPDATE ON sys.sys_time_off_requests
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §5 — sys.sys_attendance  (DAILY FACT — HC-5 GENERATED hours_total)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_attendance (
  attendance_id                    uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_tenant_id             uuid             NOT NULL,
  attendance_natural_key           varchar(512)     NOT NULL,
  attendance_subject_user_id       uuid             NOT NULL,
  attendance_date                  date             NOT NULL,
  attendance_clock_in              time,
  attendance_clock_out             time,
  attendance_break_start           time,
  attendance_break_end             time,
  attendance_hours_regular         numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_overtime        numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_night           numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_holiday         numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_total           numeric(5,2)     GENERATED ALWAYS AS (
    attendance_hours_regular + attendance_hours_overtime +
    attendance_hours_night + attendance_hours_holiday
  ) STORED,
  attendance_status                varchar(32)      NOT NULL DEFAULT 'PRESENT',
  attendance_source                varchar(32)      NOT NULL DEFAULT 'MANUAL',
  attendance_source_reference      text,
  attendance_is_validated          boolean          NOT NULL DEFAULT false,
  attendance_validated_by_user_id  uuid,
  attendance_validated_at          timestamptz,
  attendance_notes                 text,
  attendance_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  attendance_created_by            uuid,
  attendance_updated_by            uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_status_check') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_status_check CHECK (
      attendance_status IN ('PRESENT','ABSENT','SICK','HOLIDAY','VACATION','PAID_LEAVE','UNPAID_LEAVE','TRAINING','REMOTE','BUSINESS_TRIP')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_source_check') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_source_check CHECK (
      attendance_source IN ('MANUAL','BADGE','MOBILE_APP','BIOMETRIC','IMPORT','SYSTEM','API')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_hours_non_neg') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_hours_non_neg CHECK (
      attendance_hours_regular >= 0 AND attendance_hours_overtime >= 0
      AND attendance_hours_night >= 0 AND attendance_hours_holiday >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_updated_after') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_break_ordered') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_break_ordered CHECK (
      attendance_break_end IS NULL OR attendance_break_start IS NULL OR attendance_break_end >= attendance_break_start
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_clock_ordered') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_clock_ordered CHECK (
      attendance_clock_out IS NULL OR attendance_clock_in IS NULL OR attendance_clock_out >= attendance_clock_in
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_validation_coherent') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_validation_coherent CHECK (
      (attendance_is_validated = false)
      OR (attendance_is_validated = true AND attendance_validated_by_user_id IS NOT NULL AND attendance_validated_at IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_tenant_fk') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_tenant_fk FOREIGN KEY (attendance_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_subject_user_fk') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_subject_user_fk FOREIGN KEY (attendance_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_validated_by_fk') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_validated_by_fk FOREIGN KEY (attendance_validated_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_created_by_fk') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_created_by_fk FOREIGN KEY (attendance_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_attendance_updated_by_fk') THEN
    ALTER TABLE sys.sys_attendance ADD CONSTRAINT sys_attendance_updated_by_fk FOREIGN KEY (attendance_updated_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_attendance_natural_key_uq ON sys.sys_attendance (attendance_tenant_id, attendance_natural_key);
CREATE UNIQUE INDEX IF NOT EXISTS sys_attendance_business_uq    ON sys.sys_attendance (attendance_tenant_id, attendance_subject_user_id, attendance_date);
CREATE INDEX IF NOT EXISTS sys_attendance_user_date_idx          ON sys.sys_attendance (attendance_subject_user_id, attendance_date);
CREATE INDEX IF NOT EXISTS sys_attendance_status_idx             ON sys.sys_attendance (attendance_tenant_id, attendance_status);
CREATE INDEX IF NOT EXISTS sys_attendance_date_idx               ON sys.sys_attendance (attendance_tenant_id, attendance_date);
CREATE INDEX IF NOT EXISTS sys_attendance_unvalidated_idx        ON sys.sys_attendance (attendance_tenant_id) WHERE attendance_is_validated = false;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_attendance_set_updated_at') THEN
    CREATE TRIGGER sys_attendance_set_updated_at BEFORE UPDATE ON sys.sys_attendance
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §6 — sys.sys_overtime  (WORKFLOW + COMPENSATION)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_overtime (
  overtime_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_tenant_id               uuid             NOT NULL,
  overtime_natural_key             varchar(512)     NOT NULL,
  overtime_subject_user_id         uuid             NOT NULL,
  overtime_date                    date             NOT NULL,
  overtime_type                    varchar(32)      NOT NULL,
  overtime_hours                   numeric(5,2)     NOT NULL,
  overtime_rate_multiplier         numeric(3,2),
  overtime_hourly_rate             numeric(8,2),
  overtime_total_compensation      numeric(10,2),
  overtime_status                  varchar(20)      NOT NULL DEFAULT 'PENDING',
  overtime_requested_by_user_id    uuid,
  overtime_requested_at            timestamptz      NOT NULL DEFAULT now(),
  overtime_approved_by_user_id     uuid,
  overtime_approved_at             timestamptz,
  overtime_rejection_reason        text,
  overtime_exported_at             timestamptz,
  overtime_reason                  text,
  overtime_notes                   text,
  overtime_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_type_check') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_type_check CHECK (
      overtime_type IN ('WEEKDAY','WEEKEND','NIGHT','HOLIDAY','EMERGENCY','PROJECT','ON_CALL')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_status_check') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_status_check CHECK (
      overtime_status IN ('PENDING','APPROVED','REJECTED','EXPORTED','PAID','CANCELLED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_hours_positive') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_hours_positive CHECK (overtime_hours > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_rate_positive') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_rate_positive CHECK (overtime_rate_multiplier IS NULL OR overtime_rate_multiplier > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_updated_after') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_approval_coh') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_approval_coh CHECK (
      overtime_status NOT IN ('APPROVED','EXPORTED','PAID')
      OR (overtime_approved_by_user_id IS NOT NULL AND overtime_approved_at IS NOT NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_tenant_fk') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_tenant_fk FOREIGN KEY (overtime_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_subject_user_fk') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_subject_user_fk FOREIGN KEY (overtime_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_requested_by_fk') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_requested_by_fk FOREIGN KEY (overtime_requested_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_overtime_approved_by_fk') THEN
    ALTER TABLE sys.sys_overtime ADD CONSTRAINT sys_overtime_approved_by_fk FOREIGN KEY (overtime_approved_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  -- payroll_job_id intentionally NOT added as FK (HC-6: stored in overtime_metadata->>'legacy_payroll_job_id')
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_overtime_natural_key_uq ON sys.sys_overtime (overtime_tenant_id, overtime_natural_key);
CREATE INDEX IF NOT EXISTS sys_overtime_user_date_idx          ON sys.sys_overtime (overtime_subject_user_id, overtime_date);
CREATE INDEX IF NOT EXISTS sys_overtime_status_idx             ON sys.sys_overtime (overtime_tenant_id, overtime_status);
CREATE INDEX IF NOT EXISTS sys_overtime_date_idx               ON sys.sys_overtime (overtime_tenant_id, overtime_date);
CREATE INDEX IF NOT EXISTS sys_overtime_pending_idx            ON sys.sys_overtime (overtime_tenant_id) WHERE overtime_status = 'PENDING';

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_overtime_set_updated_at') THEN
    CREATE TRIGGER sys_overtime_set_updated_at BEFORE UPDATE ON sys.sys_overtime
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


COMMIT;

-- ============================================================================
-- End migration 000040
-- ============================================================================
