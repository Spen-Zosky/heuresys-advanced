-- =============================================================================
-- 000119_enterprise_typing_test_tenants.sql
-- T1.3 (#3 ESCO / tenant-onboarding, debt D-31) — FASE 0 of HEU-FLOW-001:
-- wire the enterprise typing profile for the 2 reference TEST tenants.
-- -----------------------------------------------------------------------------
-- Decision (Enzo, 2026-06-15, AskUserQuestion "Conferma ATECO_2025"):
--   canonical industry axis = ATECO_2025.
--   RTL_BANK -> 64.19 "Altre intermediazioni monetarie" (a retail/regional bank,
--               NOT central bank 64.11; the L4 group code, not the e-money/CDP
--               L5/L6 specializations) + operating_model RETAIL + size M
--               + 158 employees (real RTL user count) + regulatory HIGH (banking).
--   HEURESYS -> 62.10 "Attività di programmazione informatica" (ATECO_2025 has NO
--               legacy "62.01 produzione software"; 62.10 is the canonical
--               software-programming code) + operating_model B2B_SERVICES + size S
--               + regulatory MEDIUM (default).
-- size_band mapping (M->M, S->S) is deterministic (exact code match).
-- §0.5 reconciliation: the #9 agent safety rail "writes only on RTL_BANK, never
-- HEURESYS" governs CONSEQUENTIAL agent writes; this additive, reversible typing
-- wire of BOTH reference tenants is explicitly Enzo-confirmed for T1.3.
-- -----------------------------------------------------------------------------
-- Idempotent: INSERT ... ON CONFLICT (enterprise_typing_tenant_id) DO UPDATE
-- (HEURESYS already has an all-NULL profile -> UPDATE; RTL_BANK has none -> INSERT).
-- WHERE-guarded on tenant existence: a no-op on a DB where the reference tenants
-- are not yet seeded (twice-run safe; same behaviour class as mig 000110).
-- Invariants: I5 (tenant FK, no RLS), RD-08 (varchar+CHECK reg-intensity),
-- I9 unaffected, I12/ADR-0023 (synthetic no-PII).
-- =============================================================================

INSERT INTO sys.sys_enterprise_typing_profiles
  (enterprise_typing_tenant_id,
   enterprise_typing_industry_class_id,
   enterprise_typing_size_band_id,
   enterprise_typing_operating_model_id,
   enterprise_typing_regulatory_intensity,
   enterprise_typing_employee_count,
   enterprise_typing_country_code,
   enterprise_typing_metadata)
SELECT
  t.tenant_id,
  ac.activity_classification_id,
  sb.enterprise_size_band_id,
  om.operating_model_id,
  v.reg_intensity,
  v.employee_count,
  'IT',
  jsonb_build_object(
    'source',        'T1.3 tenant-onboarding FASE 0',
    'industry_axis', 'ATECO_2025',
    'industry_code', v.ateco_code,
    'decided_by',    'Enzo 2026-06-15',
    'spec',          'docs/integrations/tenant_onboarding_esco_04_tenant_onboarding_spec_2026-06-15.md')
FROM (VALUES
    ('RTL_BANK', '64.19', 'M', 'RETAIL',       'HIGH',   158),
    ('HEURESYS', '62.10', 'S', 'B2B_SERVICES', 'MEDIUM', NULL::int)
  ) AS v(tenant_code, ateco_code, size_code, op_model, reg_intensity, employee_count)
JOIN sys.sys_tenancies                t  ON t.tenant_code = v.tenant_code
JOIN sys.sys_activity_classifications ac ON ac.activity_classification_scheme = 'ATECO_2025'
                                        AND ac.activity_classification_code   = v.ateco_code
JOIN sys.sys_enterprise_size_bands    sb ON sb.enterprise_size_band_code      = v.size_code
JOIN sys.sys_operating_model_catalog  om ON om.operating_model_code           = v.op_model
ON CONFLICT (enterprise_typing_tenant_id) DO UPDATE SET
  enterprise_typing_industry_class_id    = EXCLUDED.enterprise_typing_industry_class_id,
  enterprise_typing_size_band_id         = EXCLUDED.enterprise_typing_size_band_id,
  enterprise_typing_operating_model_id   = EXCLUDED.enterprise_typing_operating_model_id,
  enterprise_typing_regulatory_intensity = EXCLUDED.enterprise_typing_regulatory_intensity,
  enterprise_typing_employee_count       = EXCLUDED.enterprise_typing_employee_count,
  enterprise_typing_country_code         = EXCLUDED.enterprise_typing_country_code,
  enterprise_typing_metadata             = EXCLUDED.enterprise_typing_metadata,
  updated_at                             = now();

-- -----------------------------------------------------------------------------
-- DOWN (manual, for reference): revert the two TEST-tenant typing profiles.
--   UPDATE sys.sys_enterprise_typing_profiles SET
--     enterprise_typing_industry_class_id=NULL, enterprise_typing_size_band_id=NULL,
--     enterprise_typing_operating_model_id=NULL, enterprise_typing_employee_count=NULL,
--     enterprise_typing_regulatory_intensity='MEDIUM', enterprise_typing_country_code=NULL,
--     enterprise_typing_metadata='{}'::jsonb
--   WHERE enterprise_typing_tenant_id IN
--     (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code IN ('RTL_BANK','HEURESYS'));
-- (RTL_BANK row, newly INSERTed, may instead be DELETEd.)
-- =============================================================================
