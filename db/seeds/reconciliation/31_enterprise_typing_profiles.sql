-- 31_enterprise_typing_profiles.sql — F4 bucket-C. One typing profile per tenant (tenant-level).
-- regulatory_intensity=HIGH (RTL is a regulated bank — the case study sector). Derived per active tenant.
-- IDEMPOTENT: anti-join (tenant).
BEGIN;
INSERT INTO sys.sys_enterprise_typing_profiles (
  enterprise_typing_tenant_id, enterprise_typing_regulatory_intensity, enterprise_typing_assessed_at,
  enterprise_typing_metadata)
SELECT t.tenant_id, 'HIGH', now(),
  jsonb_build_object('derived','case-study banking sector default','tenant_code',t.tenant_code)
FROM sys.sys_tenancies t
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_enterprise_typing_profiles x WHERE x.enterprise_typing_tenant_id=t.tenant_id);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_enterprise_typing_profiles;
  RAISE NOTICE 'enterprise_typing_profiles: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
