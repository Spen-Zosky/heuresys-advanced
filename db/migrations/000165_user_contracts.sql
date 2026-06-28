-- =============================================================================
-- 000165_user_contracts.sql
-- Heuresys Advanced — employment contracts satellite (S1010 F2)
-- -----------------------------------------------------------------------------
-- Brings the legacy portal "Contratti" tab into the advanced model: the
-- contract history (type, CCNL, RAL, FTE, schedule, dates) per user. Import-fed
-- read model for consultation (NOT a contract-management runtime — I8). Data is
-- production (no-PII abandoned, ADR-0023/0026). Mirror columns are plain
-- varchar/numeric/date (imported values, not system-governed categoricals).
--
-- 1:N (a user can have several contracts over time). Idempotent (CREATE TABLE
-- IF NOT EXISTS + guarded trigger). Pattern mirrors 000164.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_user_contracts (
  user_contract_id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_contract_user_id               uuid          NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_contract_tenant_id             uuid          NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_contract_type                  varchar(64),
  user_contract_code                  varchar(64),
  user_contract_start_date            date,
  user_contract_end_date              date,
  user_contract_probation_end_date    date,
  user_contract_ccnl_type             varchar(64),
  user_contract_ccnl_level            varchar(64),
  user_contract_gross_annual_salary   numeric(15,2),
  user_contract_currency              varchar(3),
  user_contract_salary_type           varchar(32),
  user_contract_payment_frequency     varchar(32),
  user_contract_work_hours_weekly     numeric(5,2),
  user_contract_work_schedule_type    varchar(32),
  user_contract_part_time_percentage  numeric(5,2),
  user_contract_job_title             varchar(255),
  user_contract_status                varchar(32),
  user_contract_termination_date      date,
  user_contract_termination_reason    varchar(255),
  user_contract_notes                 text,
  user_contract_metadata              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz   NOT NULL DEFAULT now(),
  created_by                          uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                          timestamptz   NOT NULL DEFAULT now(),
  updated_by                          uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS sys_user_contracts_user_idx
  ON sys.sys_user_contracts (user_contract_user_id);
CREATE INDEX IF NOT EXISTS sys_user_contracts_tenant_idx
  ON sys.sys_user_contracts (user_contract_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_contracts_set_updated_at' AND tgrelid = 'sys.sys_user_contracts'::regclass) THEN
    CREATE TRIGGER sys_user_contracts_set_updated_at BEFORE UPDATE ON sys.sys_user_contracts FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
