-- =============================================================================
-- gen-contracts-seed.sql  (GENERATOR — runs against the LEGACY DB)
-- -----------------------------------------------------------------------------
-- Emits the idempotent seed importing legacy `contracts` into
-- sys.sys_user_contracts (000165). Run against heuresys_evo_platform_db; pipe
-- stdout to a .sql file; apply to heuresys_advanced.
-- Match key: sys_users.user_external_code = 'LEGACY_EMP::' || contracts.employee_id.
-- 1:N → delete-then-insert scoped to LEGACY_EMP users (idempotent). Production
-- data (no-PII abandoned). '' normalized to NULL.
-- =============================================================================
\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP on

SELECT '-- GENERATED contracts seed — apply to heuresys_advanced. Idempotent.';
SELECT 'BEGIN;';
SELECT 'DELETE FROM sys.sys_user_contracts WHERE user_contract_user_id IN (SELECT user_id FROM sys.sys_users WHERE user_external_code LIKE ''LEGACY_EMP::%'');';

SELECT format(
$tmpl$INSERT INTO sys.sys_user_contracts (user_contract_user_id, user_contract_tenant_id, user_contract_type, user_contract_code, user_contract_start_date, user_contract_end_date, user_contract_probation_end_date, user_contract_ccnl_type, user_contract_ccnl_level, user_contract_gross_annual_salary, user_contract_currency, user_contract_salary_type, user_contract_payment_frequency, user_contract_work_hours_weekly, user_contract_work_schedule_type, user_contract_part_time_percentage, user_contract_job_title, user_contract_status, user_contract_termination_date, user_contract_termination_reason, user_contract_notes) SELECT u.user_id, u.user_tenant_id, %L, %L, %L::date, %L::date, %L::date, %L, %L, %L::numeric, %L, %L, %L, %L::numeric, %L, %L::numeric, %L, %L, %L::date, %L, %L FROM sys.sys_users u WHERE u.user_external_code = %L;$tmpl$,
  nullif(trim(c.contract_type),''), nullif(trim(c.contract_code),''), c.start_date, c.end_date, c.probation_end_date,
  nullif(trim(c.ccnl_type),''), nullif(trim(c.ccnl_level),''), c.gross_annual_salary, nullif(trim(c.currency),''),
  nullif(trim(c.salary_type),''), nullif(trim(c.payment_frequency),''), c.work_hours_weekly, nullif(trim(c.work_schedule_type),''),
  c.part_time_percentage, nullif(trim(c.job_title),''), nullif(trim(c.status),''), c.termination_date,
  nullif(trim(c.termination_reason),''), nullif(trim(c.notes),''), 'LEGACY_EMP::'||c.employee_id)
FROM contracts c;

SELECT 'COMMIT;';
