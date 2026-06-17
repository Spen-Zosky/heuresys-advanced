-- 54_raci_demo_rtl_s994.sql
-- =============================================================================
-- ITEM #11 (S994) — RACI OU<->process DEMO seed on the RTL_BANK TEST tenant.
--
-- WHAT THIS IS
--   A LIVE demonstration of the real `sys.sys_organization_unit_processes` RACI
--   capability (org_unit_process_role in OWNER/CONTRIBUTOR/CONSULTED/INFORMED).
--   The advanced module is REAL (API /v1/organization-unit-processes/*); only the
--   *content* of these 12 rows is an AUTHORED DEMO crosswalk, NOT production truth.
--   "Which OU is R/A/C/I in production" remains a product (WHAT) decision for Enzo.
--
-- WHY A CROSSWALK (no mechanical join)
--   The legacy source `org_unit_process_mapping` (12 rows, responsibility_level
--   primary/secondary) references legacy codes (org_unit_templates DEPT-AFC-2 ...,
--   business_processes BP-001 ...) that have ZERO overlap with the advanced
--   RTL_BANK organization_unit_code (DIR-AML ...) + the tenant-less v5
--   sys_blueprint_process_registry codes (00..22). So the 12 legacy mappings are
--   used only as SHAPE/inspiration; each is hand-mapped onto a banking-plausible
--   (RTL OU, v5 process) pair using REAL codes so the FKs resolve.
--
-- SAFETY
--   * Writes ONLY to RTL_BANK (tenant_id 86ba7a65-217f-48ba-8ce5-5c09b40a66b0).
--     The tenant is resolved from sys.sys_organization_units.organization_unit_tenant_id
--     of the RTL OU codes below -> structurally impossible to touch HEURESYS.
--   * Idempotent: ON CONFLICT (org_unit, process) DO NOTHING (unique
--     sys_oup_ou_process_uq). Re-runs insert 0.
--   * Deterministic PK: uuid_generate_v5(<fixed namespace>, ou_code||':'||proc_code)
--     (RFC-4122 v5, uuid-ossp from mig 000001 — NEVER md5()::uuid which violates
--     RFC-4122 and zod z.uuid() on the read path).
--   * Fixed timestamps (empty pg_dump diff on re-run).
--   * Every row is labelled a DEMO in org_unit_process_metadata
--     ({"demo": true, "item": "S994-#11", "legacy_source": "<BP-code>", ...}).
--
-- COLLISION NOTE
--   organization-unit-processes.integration.test.ts wipes assignments on the
--   first 2 RTL OUs by code (DIR-AML, DIR-BACKOFF) in beforeAll/afterAll. This
--   demo deliberately uses NEITHER, so the seeded rows survive that test suite.
--   It also avoids the 1 pre-existing real row (UFF-CRED-RETAIL -> process 19).
--
-- CROSSWALK (legacy code -> RTL OU code -> v5 process code -> RACI role)
--   role derivation: primary -> OWNER ; secondary -> CONTRIBUTOR ;
--   2 secondary rows promoted to CONSULTED / INFORMED so all 4 RACI roles appear.
--
--   #  legacy(OU/proc/level)                RTL OU code   v5 proc  role
--   1  DIR-QSE / BP-003 AML / primary       DIV-RISK      02       OWNER
--   2  DEPT-AFC-2 / BP-001 Credito / pri    DIR-CREDITI   05       OWNER
--   3  DEPT-CORP-1 / BP-002 Pagam. / pri    DIR-PAY       04       OWNER
--   4  DEPT-HR-2 / BP-004 HR / primary      DIV-HR        17       OWNER
--   5  DEPT-HR-2 / BP-005 Contab. / pri     DIV-CFO       18       OWNER
--   6  DEPT-OPS-2 / BP-007 Wealth / pri     DIR-CORP      07       OWNER
--   7  DEPT-QSE-1 / BP-008 ITSM / primary   DIV-IT        16       OWNER
--   8  DEPT-COMM-2 / BP-004 -> mkt / pri    DIV-MKT       15       OWNER
--   9  DEPT-AFC-2 / BP-006 Risk / second    DIR-RISKM     10       CONTRIBUTOR
--   10 DEPT-HR-1 / BP-004 HR / secondary    DIV-COMM      17       CONTRIBUTOR
--   11 DEPT-QSE-1 / BP-007 / sec -> C       DIV-LEGAL     11       CONSULTED
--   12 DIR-QSE / BP-009 Audit / sec -> I    DIV-OPS       12       INFORMED
--
--   Distribution: 8 OWNER + 2 CONTRIBUTOR + 1 CONSULTED + 1 INFORMED = 12.
-- =============================================================================

\set ON_ERROR_STOP on

-- Fixed v5 namespace (a stable random UUID, used only as the deterministic-id seed).
-- Derived ids = uuid_generate_v5('a1b2c3d4-0011-4022-8033-d0e0f0a0b0c0', ou_code||':'||proc_code).

WITH crosswalk(legacy_src, ou_code, proc_code, role) AS (
  VALUES
    ('BP-003', 'DIV-RISK',    '02', 'OWNER'),       -- KYC / AML
    ('BP-001', 'DIR-CREDITI', '05', 'OWNER'),       -- Credit Origination
    ('BP-002', 'DIR-PAY',     '04', 'OWNER'),       -- Payments & Transfers
    ('BP-004', 'DIV-HR',      '17', 'OWNER'),       -- Human Capital Management
    ('BP-005', 'DIV-CFO',     '18', 'OWNER'),       -- Finance & Accounting
    ('BP-007', 'DIR-CORP',    '07', 'OWNER'),       -- Wealth Advisory
    ('BP-008', 'DIV-IT',      '16', 'OWNER'),       -- IT & Cybersecurity
    ('BP-004', 'DIV-MKT',     '15', 'OWNER'),       -- Marketing & Communications
    ('BP-006', 'DIR-RISKM',   '10', 'CONTRIBUTOR'), -- Risk Management
    ('BP-004', 'DIV-COMM',    '17', 'CONTRIBUTOR'), -- HCM (secondary)
    ('BP-007', 'DIV-LEGAL',   '11', 'CONSULTED'),   -- Compliance & Regulatory Reporting
    ('BP-009', 'DIV-OPS',     '12', 'INFORMED')     -- Internal Audit
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
    'demo', true,
    'item', 'S994-#11',
    'note', 'AUTHORED DEMO crosswalk on RTL_BANK TEST tenant — NOT production truth',
    'legacy_source', cw.legacy_src,
    'legacy_table', 'heuresys_platform.org_unit_process_mapping'
  ),
  TIMESTAMPTZ '2026-06-17 00:00:00+00',
  TIMESTAMPTZ '2026-06-17 00:00:00+00'
FROM crosswalk cw
JOIN sys.sys_organization_units ou
  ON ou.organization_unit_code = cw.ou_code
 AND ou.organization_unit_tenant_id =
       (SELECT organization_unit_tenant_id FROM sys.sys_organization_units
         WHERE organization_unit_code = 'RTL'                       -- RTL_BANK root OU
         LIMIT 1)
JOIN sys.sys_blueprint_process_registry p
  ON p.blueprint_process_code = cw.proc_code
ON CONFLICT (org_unit_process_org_unit_id, org_unit_process_blueprint_process_id) DO NOTHING;
