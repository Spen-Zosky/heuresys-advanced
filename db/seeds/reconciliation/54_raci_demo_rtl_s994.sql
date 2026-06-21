-- 54_raci_demo_rtl_s994.sql
-- =============================================================================
-- ITEM #5/#11 (S1002) — RACI OU<->process APPROVED PRODUCTION mapping on RTL_BANK.
--
-- WHAT THIS IS
--   The real `sys.sys_organization_unit_processes` RACI capability
--   (org_unit_process_role in OWNER/CONTRIBUTOR/CONSULTED/INFORMED), populated with
--   the COMPLETE OU↔process responsibility matrix APPROVED BY ENZO (S1002, 2026-06-21).
--   Supersedes the S994 12-row DEMO crosswalk: "which OU is R/A/C/I in production"
--   was the open product (WHAT) decision — now decided. 23 processes × the RTL org
--   structure (9 DIV-* divisions + 8 DIR-* specialized directions + HQ), 1 OWNER
--   (Accountable) per process + CONTRIBUTOR/CONSULTED/INFORMED. 105 assignments.
--
-- DERIVATION (evidence-based on the live org structure)
--   OWNER = the most specific appropriate unit (the dedicated DIR-* where one exists,
--   e.g. KYC/AML→DIR-AML, Payments→DIR-PAY, Credit→DIR-CREDITI; else the DIV-*).
--   R/C/I = the related divisions. HQ (RTL) owns enterprise governance + internal
--   audit and is INFORMED on cross-enterprise processes. Proposed by Claude from the
--   org+process graph, reviewed and approved by Enzo (S1002).
--
-- SAFETY
--   * Writes ONLY to RTL_BANK (tenant resolved from the RTL root OU's tenant_id ->
--     structurally impossible to touch HEURESYS).
--   * Declarative REPLACE: clean-slate DELETE of all RTL assignments (removes the old
--     S994 demo rows + the legacy stray UFF-CRED-RETAIL row), then INSERT the 105
--     approved rows. Idempotent: deterministic v5 PK + fixed timestamps => twice-run
--     produces an identical state (empty pg_dump diff); the DELETE+INSERT churn within
--     a run does not change the final dump.
--   * Deterministic PK: uuid_generate_v5(<fixed namespace>, ou_code||':'||proc_code)
--     (RFC-4122 v5, uuid-ossp from mig 000001 — NEVER md5()::uuid).
--
-- TEST COLLISION (resolved S1002)
--   organization-unit-processes.integration.test.ts pins to the first 2 RTL OUs by
--   code (DIR-AML, DIR-BACKOFF) and wiped their assignments in beforeAll/afterAll.
--   This mapping USES both as owners, so the test was made SNAPSHOT-RESTORE (D-23
--   pattern): it now captures + restores their seeded rows around its create/delete
--   tests, so the approved RACI survives the suite.
-- =============================================================================

\set ON_ERROR_STOP on

-- Clean-slate: remove every existing RTL assignment (old demo + legacy stray) so this
-- seed is the single declarative source of the RTL RACI matrix.
DELETE FROM sys.sys_organization_unit_processes
 WHERE org_unit_process_tenant_id =
       (SELECT organization_unit_tenant_id FROM sys.sys_organization_units
         WHERE organization_unit_code = 'RTL' LIMIT 1);

-- Fixed v5 namespace (stable random UUID, deterministic-id seed):
-- id = uuid_generate_v5('a1b2c3d4-0011-4022-8033-d0e0f0a0b0c0', ou_code||':'||proc_code).
WITH raci(ou_code, proc_code, role) AS (
  VALUES
    -- 00 Enterprise Strategy & Governance
    ('RTL','00','OWNER'), ('DIV-CFO','00','CONTRIBUTOR'), ('DIV-RISK','00','CONSULTED'), ('DIV-LEGAL','00','CONSULTED'), ('DIV-HR','00','INFORMED'),
    -- 01 Customer Acquisition & Onboarding
    ('DIV-RETAIL','01','OWNER'), ('DIV-MKT','01','CONTRIBUTOR'), ('DIV-COMM','01','CONTRIBUTOR'), ('DIR-AML','01','CONSULTED'), ('DIV-OPS','01','INFORMED'),
    -- 02 KYC / AML
    ('DIR-AML','02','OWNER'), ('DIV-RETAIL','02','CONTRIBUTOR'), ('DIV-COMM','02','CONTRIBUTOR'), ('DIV-LEGAL','02','CONSULTED'), ('DIV-RISK','02','INFORMED'),
    -- 03 Account Opening & Maintenance
    ('DIR-BACKOFF','03','OWNER'), ('DIV-RETAIL','03','CONTRIBUTOR'), ('DIR-AML','03','CONSULTED'), ('DIV-OPS','03','INFORMED'),
    -- 04 Payments & Transfers
    ('DIR-PAY','04','OWNER'), ('DIR-BACKOFF','04','CONTRIBUTOR'), ('DIV-RISK','04','CONSULTED'), ('DIV-CFO','04','INFORMED'),
    -- 05 Credit Origination
    ('DIR-CREDITI','05','OWNER'), ('DIR-CORP','05','CONTRIBUTOR'), ('DIV-RETAIL','05','CONTRIBUTOR'), ('DIR-RISKM','05','CONSULTED'), ('DIV-LEGAL','05','INFORMED'),
    -- 06 Credit Monitoring & Workout
    ('DIR-CREDITI','06','OWNER'), ('DIR-RISKM','06','CONTRIBUTOR'), ('DIV-LEGAL','06','CONSULTED'), ('DIV-CFO','06','INFORMED'),
    -- 07 Wealth Advisory
    ('DIR-CORP','07','OWNER'), ('DIV-RETAIL','07','CONTRIBUTOR'), ('DIV-RISK','07','CONSULTED'), ('DIV-CFO','07','INFORMED'),
    -- 08 Retail Investments
    ('DIV-RETAIL','08','OWNER'), ('DIR-CORP','08','CONTRIBUTOR'), ('DIV-RISK','08','CONSULTED'), ('DIV-LEGAL','08','CONSULTED'), ('DIV-CFO','08','INFORMED'),
    -- 09 Treasury & ALM
    ('DIV-CFO','09','OWNER'), ('DIR-RISKM','09','CONTRIBUTOR'), ('DIV-RISK','09','CONSULTED'), ('RTL','09','INFORMED'),
    -- 10 Risk Management
    ('DIR-RISKM','10','OWNER'), ('DIV-RISK','10','CONTRIBUTOR'), ('DIV-CFO','10','CONSULTED'), ('DIV-LEGAL','10','CONSULTED'), ('RTL','10','INFORMED'),
    -- 11 Compliance & Regulatory Reporting
    ('DIV-LEGAL','11','OWNER'), ('DIR-AML','11','CONTRIBUTOR'), ('DIV-RISK','11','CONSULTED'), ('DIV-CFO','11','CONSULTED'), ('RTL','11','INFORMED'),
    -- 12 Internal Audit
    ('RTL','12','OWNER'), ('DIV-RISK','12','CONTRIBUTOR'), ('DIV-LEGAL','12','CONSULTED'), ('DIV-OPS','12','INFORMED'),
    -- 13 Branch Operations
    ('DIV-OPS','13','OWNER'), ('DIV-RETAIL','13','CONTRIBUTOR'), ('DIR-BACKOFF','13','CONTRIBUTOR'), ('DIV-IT','13','CONSULTED'), ('DIV-CFO','13','INFORMED'),
    -- 14 Customer Service
    ('DIV-RETAIL','14','OWNER'), ('DIV-OPS','14','CONTRIBUTOR'), ('DIV-MKT','14','CONSULTED'), ('DIV-IT','14','INFORMED'),
    -- 15 Marketing & Communications
    ('DIV-MKT','15','OWNER'), ('DIV-RETAIL','15','CONTRIBUTOR'), ('DIV-COMM','15','CONTRIBUTOR'), ('DIV-LEGAL','15','CONSULTED'), ('RTL','15','INFORMED'),
    -- 16 IT & Cybersecurity
    ('DIV-IT','16','OWNER'), ('DIR-INFRA','16','CONTRIBUTOR'), ('DIR-DEV','16','CONTRIBUTOR'), ('DIV-RISK','16','CONSULTED'), ('RTL','16','INFORMED'),
    -- 17 Human Capital Management
    ('DIV-HR','17','OWNER'), ('DIV-COMM','17','CONTRIBUTOR'), ('DIV-OPS','17','CONTRIBUTOR'), ('DIV-CFO','17','CONSULTED'), ('RTL','17','INFORMED'),
    -- 18 Finance & Accounting
    ('DIV-CFO','18','OWNER'), ('DIR-BACKOFF','18','CONTRIBUTOR'), ('DIV-RISK','18','CONSULTED'), ('RTL','18','INFORMED'),
    -- 19 Procurement & Vendor Management
    ('DIV-CFO','19','OWNER'), ('DIV-OPS','19','CONTRIBUTOR'), ('DIV-LEGAL','19','CONSULTED'), ('DIV-IT','19','CONSULTED'), ('RTL','19','INFORMED'),
    -- 20 Facilities & Real Estate
    ('DIV-OPS','20','OWNER'), ('DIV-CFO','20','CONTRIBUTOR'), ('DIV-LEGAL','20','CONSULTED'), ('RTL','20','INFORMED'),
    -- 21 Legal
    ('DIV-LEGAL','21','OWNER'), ('DIR-AML','21','CONTRIBUTOR'), ('DIV-RISK','21','CONSULTED'), ('RTL','21','INFORMED'),
    -- 22 Data & Analytics
    ('DIV-IT','22','OWNER'), ('DIR-DEV','22','CONTRIBUTOR'), ('DIV-RISK','22','CONSULTED'), ('DIV-MKT','22','CONSULTED'), ('RTL','22','INFORMED')
)
INSERT INTO sys.sys_organization_unit_processes (
  organization_unit_process_id,
  org_unit_process_tenant_id,
  org_unit_process_org_unit_id,
  org_unit_process_blueprint_process_id,
  org_unit_process_role,
  org_unit_process_metadata,
  created_at,
  updated_at
)
SELECT
  uuid_generate_v5('a1b2c3d4-0011-4022-8033-d0e0f0a0b0c0'::uuid, cw.ou_code || ':' || cw.proc_code),
  ou.organization_unit_tenant_id,                  -- RTL tenant, resolved from the OU (cannot be HEURESYS)
  ou.organization_unit_id,
  p.blueprint_process_id,
  cw.role,
  jsonb_build_object(
    'approved', true,
    'item', 'S1002-#5/#11',
    'note', 'Approved production RACI mapping on RTL_BANK (Enzo, S1002 2026-06-21) — supersedes the S994 demo crosswalk',
    'by', 'Enzo'
  ),
  TIMESTAMPTZ '2026-06-21 00:00:00+00',
  TIMESTAMPTZ '2026-06-21 00:00:00+00'
FROM raci cw
JOIN sys.sys_organization_units ou
  ON ou.organization_unit_code = cw.ou_code
 AND ou.organization_unit_tenant_id =
       (SELECT organization_unit_tenant_id FROM sys.sys_organization_units
         WHERE organization_unit_code = 'RTL' LIMIT 1)
JOIN sys.sys_blueprint_process_registry p
  ON p.blueprint_process_code = cw.proc_code
ON CONFLICT (org_unit_process_org_unit_id, org_unit_process_blueprint_process_id) DO NOTHING;

-- Verify: every approved row resolved (catches an OU/process code typo) — exactly 105.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_organization_unit_processes
   WHERE org_unit_process_tenant_id =
         (SELECT organization_unit_tenant_id FROM sys.sys_organization_units
           WHERE organization_unit_code = 'RTL' LIMIT 1);
  IF n <> 105 THEN
    RAISE EXCEPTION '54_raci: expected 105 RTL RACI assignments, found % (check OU/process codes)', n;
  END IF;
  RAISE NOTICE '54_raci: % RTL RACI assignments (S1002 approved production mapping, 23 processes).', n;
END $$;
