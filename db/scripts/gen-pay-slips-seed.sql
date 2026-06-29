-- =============================================================================
-- gen-pay-slips-seed.sql  (GENERATOR — runs against the LEGACY DB)
-- -----------------------------------------------------------------------------
-- Emits the idempotent seed importing legacy `employee_pay_stubs` into
-- sys.sys_user_pay_slips (000167). Run against heuresys_platform; pipe stdout to
-- db/seeds/rtl-rebuild/16_user_pay_slips.generated.sql; apply to heuresys_advanced.
-- Match key: sys_users.user_external_code = 'LEGACY_EMP::' || employee_pay_stubs.employee_id.
--
-- Empty pg_dump diff: deterministic uuid_generate_v5 PK keyed on the legacy stub
-- id + fixed created_at/updated_at literals + ON CONFLICT DO NOTHING (a re-run
-- finds the same rows and changes nothing — no set_updated_at trigger fires).
-- period has dirty whitespace in the legacy data → collapse+trim. '' → NULL.
-- =============================================================================
\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP on

SELECT '-- GENERATED pay-slips seed — apply to heuresys_advanced. Idempotent (v5 PK + ON CONFLICT DO NOTHING).';
SELECT 'BEGIN;';

SELECT format(
$tmpl$INSERT INTO sys.sys_user_pay_slips (user_pay_slip_id, user_pay_slip_user_id, user_pay_slip_tenant_id, user_pay_slip_period, user_pay_slip_period_start, user_pay_slip_period_end, user_pay_slip_gross_pay, user_pay_slip_net_pay, user_pay_slip_deductions, user_pay_slip_payment_date, user_pay_slip_status, created_at, updated_at) SELECT uuid_generate_v5('c4f0a1b2-0044-4055-8066-d0e0f0a0b0c4'::uuid, %L), u.user_id, u.user_tenant_id, %L, %L::date, %L::date, %L::numeric, %L::numeric, COALESCE(%L::jsonb, '{}'::jsonb), %L::date, %L, TIMESTAMPTZ '2026-06-29 00:00:00+00', TIMESTAMPTZ '2026-06-29 00:00:00+00' FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_pay_slip_id) DO NOTHING;$tmpl$,
  ps.id::text,
  nullif(trim(regexp_replace(ps.period, '\s+', ' ', 'g')), ''),
  ps.period_start, ps.period_end, ps.gross_pay, ps.net_pay, ps.deductions::text, ps.payment_date,
  nullif(trim(ps.status), ''),
  'LEGACY_EMP::' || ps.employee_id)
FROM employee_pay_stubs ps
ORDER BY ps.employee_id, ps.period_start;

SELECT 'COMMIT;';
