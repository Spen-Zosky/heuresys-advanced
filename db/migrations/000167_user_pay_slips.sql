-- =============================================================================
-- 000167_user_pay_slips.sql
-- Heuresys Advanced — pay-slips (cedolini) satellite (S1011 F4)
-- -----------------------------------------------------------------------------
-- Brings the legacy portal payroll/cedolini history into the advanced model:
-- the issued pay-slips (period, gross/net, deductions breakdown, payment date)
-- per user. Import-fed read model for CONSULTATION only (NOT a payroll-execution
-- runtime — I8). Data is production. 1:N (several slips per user over time).
--
-- status is a varchar+CHECK categorical (RD-08) — the only net-new convention
-- vs the 000164/000165 satellites (whose mirror status cols were plain varchar);
-- the whitelist is permissive enough for the legacy 'available' plus the usual
-- issued/paid/draft/cancelled lifecycle.
--
-- Idempotent (CREATE TABLE IF NOT EXISTS + guarded trigger). Mirror columns are
-- plain varchar/numeric/date/jsonb (imported values, not system-governed).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_user_pay_slips (
  user_pay_slip_id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pay_slip_user_id       uuid          NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_pay_slip_tenant_id     uuid          NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_pay_slip_period        varchar(64),
  user_pay_slip_period_start  date,
  user_pay_slip_period_end    date,
  user_pay_slip_gross_pay     numeric(15,2),
  user_pay_slip_net_pay       numeric(15,2),
  user_pay_slip_deductions    jsonb         NOT NULL DEFAULT '{}'::jsonb,
  user_pay_slip_payment_date  date,
  user_pay_slip_status        varchar(32)   CHECK (user_pay_slip_status IS NULL OR user_pay_slip_status IN
                                              ('available', 'issued', 'paid', 'draft', 'cancelled')),
  user_pay_slip_metadata      jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz   NOT NULL DEFAULT now(),
  created_by                  uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_by                  uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_pay_slips_user_idx
  ON sys.sys_user_pay_slips (user_pay_slip_user_id);
CREATE INDEX IF NOT EXISTS sys_user_pay_slips_tenant_idx
  ON sys.sys_user_pay_slips (user_pay_slip_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_pay_slips_set_updated_at' AND tgrelid = 'sys.sys_user_pay_slips'::regclass) THEN
    CREATE TRIGGER sys_user_pay_slips_set_updated_at BEFORE UPDATE ON sys.sys_user_pay_slips FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
