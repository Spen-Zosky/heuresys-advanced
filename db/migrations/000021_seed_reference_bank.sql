-- =============================================================================
-- 000021_seed_reference_bank.sql
-- Heuresys Advanced — RTL_BANK_REFERENCE foundational seeds (idempotent)
-- -----------------------------------------------------------------------------
-- Inserts the FIN_BANKING blueprint family + REGIONAL_RETAIL_BANK_MEDIUM
-- variant + 23 processes, the RTL_BANK_REFERENCE tenant, the 7 reward gates,
-- size bands, and proficiency catalogs.
--
-- The 158 synthetic Faker users + 5 branches + 25 branch positions + 30 HQ
-- positions + PRIMARY assignments are loaded by step 5.0.7
-- (db/scripts/seed-reference-bank.ts) with SEED_REFERENCE_BANK_SEED=42.
-- This migration does NOT create users/positions/assignments to keep DDL
-- ordering clean.
--
-- All inserts use ON CONFLICT DO NOTHING (or DO UPDATE where evolution is
-- expected). Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enterprise size bands
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_enterprise_size_bands (enterprise_size_band_code, enterprise_size_band_name, enterprise_size_band_min_employees, enterprise_size_band_max_employees) VALUES
  ('XS', 'Extra Small', 1,    9),
  ('S',  'Small',       10,   49),
  ('M',  'Medium',      50,   249),
  ('L',  'Large',       250,  999),
  ('XL', 'Extra Large', 1000, NULL)
ON CONFLICT (enterprise_size_band_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Operating model catalog
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_operating_model_catalog (operating_model_code, operating_model_name) VALUES
  ('RETAIL',         'Retail'),
  ('WHOLESALE',      'Wholesale'),
  ('MIXED',          'Mixed retail + wholesale'),
  ('B2B_SERVICES',   'B2B services'),
  ('PUBLIC_SECTOR',  'Public sector'),
  ('MANUFACTURING',  'Manufacturing')
ON CONFLICT (operating_model_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Organization unit types
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_organization_unit_types (organization_unit_type_code, organization_unit_type_name) VALUES
  ('HEADQUARTERS', 'Headquarters'),
  ('DIVISION',     'Division'),
  ('DEPARTMENT',   'Department'),
  ('TEAM',         'Team'),
  ('BRANCH',       'Branch'),
  ('OFFICE',       'Office'),
  ('PLANT',        'Plant'),
  ('WAREHOUSE',    'Warehouse')
ON CONFLICT (organization_unit_type_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. KPI assessment methods + weighting rules
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_kpi_assessment_methods (kpi_assessment_method_code, kpi_assessment_method_name) VALUES
  ('DELTA_VS_TARGET', 'Delta vs target'),
  ('PERCENTILE',      'Percentile rank'),
  ('BANDED',          'Banded scoring'),
  ('LINEAR_SCORE',    'Linear score'),
  ('STEPPED',         'Stepped curve')
ON CONFLICT (kpi_assessment_method_code) DO NOTHING;

INSERT INTO sys.sys_kpi_weighting_rules (kpi_weighting_rule_code, kpi_weighting_rule_name, kpi_weighting_rule_kind) VALUES
  ('LINEAR_DEFAULT', 'Linear default',      'LINEAR'),
  ('CAPPED_120',     'Capped at 120%',      'CAPPED'),
  ('STEP_25_50_75',  'Step 25/50/75 bands', 'STEP')
ON CONFLICT (kpi_weighting_rule_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 5. Assessment methods
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_assessment_methods (assessment_method_code, assessment_method_name) VALUES
  ('RATING',         'Rating scale'),
  ('NARRATIVE',      'Narrative'),
  ('EVIDENCE_BASED', 'Evidence-based'),
  ('PEER_360',       '360 peer review'),
  ('MANAGER_DIRECT', 'Manager direct')
ON CONFLICT (assessment_method_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 6. Blueprint family + variant — FIN_BANKING / REGIONAL_RETAIL_BANK_MEDIUM
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_blueprint_families (blueprint_family_code, blueprint_family_name, blueprint_family_description) VALUES
  ('FIN_BANKING', 'Financial Services — Banking', 'Retail and commercial banking blueprint family.')
ON CONFLICT (blueprint_family_code) DO NOTHING;

INSERT INTO sys.sys_blueprint_variants (blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name, blueprint_variant_size_band_id)
SELECT
  bf.blueprint_family_id,
  'REGIONAL_RETAIL_BANK_MEDIUM',
  'Regional Retail Bank (Medium)',
  sb.enterprise_size_band_id
FROM sys.sys_blueprint_families bf
CROSS JOIN sys.sys_enterprise_size_bands sb
WHERE bf.blueprint_family_code = 'FIN_BANKING'
  AND sb.enterprise_size_band_code = 'M'
ON CONFLICT (blueprint_variant_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 7. RTL_BANK_REFERENCE tenant
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_legal_name, tenant_country_code, tenant_industry_code, tenant_size_band, tenant_status, tenant_metadata) VALUES
  ('RTL_BANK_REFERENCE',
   'Retail Bank Reference',
   'RTL Bank Reference S.p.A. (synthetic)',
   'IT',
   'FIN_BANKING',
   'M',
   'ACTIVE',
   jsonb_build_object(
     'purpose', 'reference_tenant',
     'is_synthetic', true,
     'regulatory_intensity', 'HIGH',
     'blueprint_variant_code', 'REGIONAL_RETAIL_BANK_MEDIUM'))
ON CONFLICT (tenant_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 8. Reward gate catalog — FIN_BANKING (7 gates per TARGET_SCHEMA §10)
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_reward_gate_catalog (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code, reward_gate_catalog_name, reward_gate_catalog_description, reward_gate_catalog_is_blocking)
SELECT bv.blueprint_variant_id, code, name, descr, true
FROM sys.sys_blueprint_variants bv
CROSS JOIN (VALUES
  ('CONDUCT_GATE',         'Conduct Gate',         'No conduct violations during evaluation period.'),
  ('COMPLIANCE_GATE',      'Compliance Gate',      'All mandatory compliance training completed.'),
  ('RISK_GATE',            'Risk Gate',            'No open critical risk findings.'),
  ('TRAINING_GATE',        'Training Gate',        'All required training completed and assessed.'),
  ('CERTIFICATION_GATE',   'Certification Gate',   'All required certifications current.'),
  ('CUSTOMER_HARM_GATE',   'Customer Harm Gate',   'No substantiated customer harm complaints.'),
  ('AUDIT_FINDING_GATE',   'Audit Finding Gate',   'No open critical audit findings.')
) AS gates(code, name, descr)
WHERE bv.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'
ON CONFLICT (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Blueprint process registry — 23 FIN_BANKING processes (00-22)
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_blueprint_process_registry (blueprint_process_variant_id, blueprint_process_code, blueprint_process_name, blueprint_process_ordinal)
SELECT bv.blueprint_variant_id, code, name, ordinal
FROM sys.sys_blueprint_variants bv
CROSS JOIN (VALUES
  ('00', 'Enterprise Strategy & Governance',  0),
  ('01', 'Customer Acquisition & Onboarding', 1),
  ('02', 'KYC / AML',                          2),
  ('03', 'Account Opening & Maintenance',     3),
  ('04', 'Payments & Transfers',              4),
  ('05', 'Credit Origination',                5),
  ('06', 'Credit Monitoring & Workout',       6),
  ('07', 'Wealth Advisory',                   7),
  ('08', 'Retail Investments',                8),
  ('09', 'Treasury & ALM',                    9),
  ('10', 'Risk Management',                  10),
  ('11', 'Compliance & Regulatory Reporting', 11),
  ('12', 'Internal Audit',                   12),
  ('13', 'Branch Operations',                13),
  ('14', 'Customer Service',                 14),
  ('15', 'Marketing & Communications',       15),
  ('16', 'IT & Cybersecurity',               16),
  ('17', 'Human Capital Management',         17),
  ('18', 'Finance & Accounting',             18),
  ('19', 'Procurement & Vendor Management',  19),
  ('20', 'Facilities & Real Estate',         20),
  ('21', 'Legal',                            21),
  ('22', 'Data & Analytics',                 22)
) AS procs(code, name, ordinal)
WHERE bv.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'
ON CONFLICT (blueprint_process_variant_id, blueprint_process_code) DO NOTHING;
