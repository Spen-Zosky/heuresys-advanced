-- S983 WS-E — ROLLBACK della mutazione E5 (seed fattori TOTP fixture + flip policy).
-- Snapshot pre-mutazione preso 2026-06-11 (E0):
--   RTL 86ba7a65-217f-48ba-8ce5-5c09b40a66b0: enabled=t, roles={BLUEPRINT_MANAGER,HRMS_MANAGER,PROCESS_OWNER,READ_ONLY}
--   HS  8bc5bc59-f2d2-4a8a-882a-ea26ac367858: enabled=f, roles=NULL
--   sys_auth_mfa_factors: 0 righe totali
-- Eseguire con: psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f qa_artifacts/s983_mfa_rollback.sql

BEGIN;

-- 1. Rimuovi i fattori fixture E2E seminati da E5 (discriminatore = label e2e-fixture).
DELETE FROM sys.sys_auth_mfa_factors
 WHERE auth_mfa_factor_metadata->>'label' = 'e2e-fixture';

-- 2. Ripristina la policy RTL allo stato pre-E5 (attivazione S982: 4 ruoli).
UPDATE sys.sys_auth_mfa_policies
   SET auth_mfa_policy_enabled = true,
       auth_mfa_policy_role_codes = ARRAY['BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','READ_ONLY']
 WHERE auth_mfa_policy_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

-- 3. Ripristina la policy HS allo stato pre-E5 (disabilitata, no scope).
UPDATE sys.sys_auth_mfa_policies
   SET auth_mfa_policy_enabled = false,
       auth_mfa_policy_role_codes = NULL
 WHERE auth_mfa_policy_tenant_id = '8bc5bc59-f2d2-4a8a-882a-ea26ac367858';

COMMIT;

-- NB: il CODICE (helpers dual-mode, retrofit test) NON va revertato — è
-- behavior-preserving su policy OFF (provato dai gate E2/E3 su DB immutato).
