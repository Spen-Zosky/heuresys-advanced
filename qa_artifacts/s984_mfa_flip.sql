-- S984 WS-E E5 — FLIP della policy mandatory-MFA a copertura totale (gemello di s983_mfa_rollback.sql).
-- Decisione PM S983 (2026-06-11): copertura totale = entrambi i tenant, tutti i ruoli (role_codes=NULL = all-roles).
-- Prerequisiti: (1) CI verde sul set codice E1-E4 (push 5c64f63); (2) fattori TOTP fixture seminati
--               via `pnpm db:seed-test-admin` (6 personas, label e2e-fixture); (3) Actions idle.
-- Eseguire con: psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -f qa_artifacts/s984_mfa_flip.sql
-- Rollback: qa_artifacts/s983_mfa_rollback.sql

BEGIN;

-- RTL Bank: da slice 4 ruoli (S982) a tutti i ruoli.
UPDATE sys.sys_auth_mfa_policies
   SET auth_mfa_policy_enabled = true,
       auth_mfa_policy_role_codes = NULL
 WHERE auth_mfa_policy_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

-- Heuresys System: da disabilitata ad attiva, tutti i ruoli.
UPDATE sys.sys_auth_mfa_policies
   SET auth_mfa_policy_enabled = true,
       auth_mfa_policy_role_codes = NULL
 WHERE auth_mfa_policy_tenant_id = '8bc5bc59-f2d2-4a8a-882a-ea26ac367858';

COMMIT;

-- Readback atteso: 2 righe, entrambe enabled=t role_codes=NULL.
SELECT auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes
  FROM sys.sys_auth_mfa_policies
 WHERE auth_mfa_policy_tenant_id IN ('86ba7a65-217f-48ba-8ce5-5c09b40a66b0',
                                     '8bc5bc59-f2d2-4a8a-882a-ea26ac367858')
 ORDER BY auth_mfa_policy_tenant_id;
