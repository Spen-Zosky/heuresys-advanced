-- 01_tenancies.sql — D2: collapse to 2 tenancies (rtl-bank.org + heuresys.com)
-- Idempotent. No legacy data needed. Run via psql.
--
-- Strategy (D2): REPURPOSE the existing synthetic reference tenancy 86ba7a65 as the real
-- rtl-bank.org customer (1-row UPDATE, zero FK churn for the 165 keep-users), then CREATE a
-- fresh heuresys.com platform tenancy and re-point the 3 heuresys.com users.

BEGIN;

-- 1) Repurpose 86ba7a65 RTL_BANK_REFERENCE -> RTL_BANK (rtl-bank.org)
UPDATE sys.sys_tenancies
SET tenant_code       = 'RTL_BANK',
    tenant_name       = 'RTL Bank',
    tenant_legal_name = 'RTL Bank S.p.A.',
    tenant_metadata   = (COALESCE(tenant_metadata, '{}'::jsonb) - 'is_synthetic' - 'purpose')
                        || jsonb_build_object(
                             'domain', 'rtl-bank.org',
                             'legacy_tenant_id', '0c54b84a-db6e-4da4-bc91-af5d480d524e',
                             'rebuilt_at', now()::text),
    updated_at        = now()
WHERE tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';

-- 2) Create the heuresys.com platform tenancy (idempotent without assuming a unique index on code)
INSERT INTO sys.sys_tenancies
  (tenant_code, tenant_name, tenant_legal_name, tenant_country_code,
   tenant_industry_code, tenant_size_band, tenant_status, tenant_metadata)
SELECT 'HEURESYS', 'Heuresys System', 'Heuresys S.r.l.', 'IT',
       NULL,                       -- VERIFY: tenant_industry_code has no CHECK/FK? legacy='HR Technology'; kept in metadata to be safe
       'S',                        -- CHECK: size_band IN (XS,S,M,L,XL)
       'ACTIVE',                   -- CHECK: status IN (ACTIVE,SUSPENDED,ARCHIVED,PENDING_ACTIVATION)
       jsonb_build_object('domain','heuresys.com','is_platform',true,
                          'industry','HR Technology & Software',
                          'legacy_tenant_id','d5855519-3ed1-4427-865f-fe75f1e42c4c')
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS');

-- 3) Re-point the 3 heuresys.com users to the new platform tenancy.
--    admin@heuresys.com (native PLATFORM_ADMIN) is a heuresys.com user and moves too — intended.
UPDATE sys.sys_users u
SET user_tenant_id = (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'),
    updated_at     = now()
WHERE split_part(u.user_email, '@', 2) = 'heuresys.com';

-- Verification (informational; does not abort): expect rtl-bank.org users stay on 86ba7a65,
-- heuresys.com users on the new tenancy.
DO $$
DECLARE rtl_n int; heu_n int;
BEGIN
  SELECT count(*) INTO rtl_n FROM sys.sys_users
    WHERE user_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND split_part(user_email,'@',2) = 'rtl-bank.org';
  SELECT count(*) INTO heu_n FROM sys.sys_users u
    JOIN sys.sys_tenancies t ON t.tenant_id = u.user_tenant_id AND t.tenant_code='HEURESYS';
  RAISE NOTICE 'rtl-bank.org users on RTL_BANK tenancy: % (expect 158); users on HEURESYS tenancy: % (expect 3)', rtl_n, heu_n;
END $$;

COMMIT;
