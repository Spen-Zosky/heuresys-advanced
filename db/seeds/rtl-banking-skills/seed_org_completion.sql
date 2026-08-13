-- =============================================================================
-- Blocco D — Organigramma completion seed for tenant RTL_BANK
-- Tenant: 86ba7a65-217f-48ba-8ce5-5c09b40a66b0  (RTL Bank, customer-example)
--
-- Completes the RTL org chart so it is coherent for a supervised bank:
--   1. NEW OU "Direzione Tesoreria e Mercati" (DIR-TREAS) under Divisione CFO
--      (treasury/ALM/markets is a finance function -> CFO is the coherent parent)
--   2. NEW OU "Direzione Internal Audit" (DIR-AUDIT) reporting directly to the
--      HQ/CEO (mandatory independent function for a supervised bank; was absent)
--   3. Populate the 2 EMPTY divisions (0 positions): Marketing (DIV-MKT) and
--      Legal & Compliance (DIR-COMPL) with a Head + specialists
--   4. Fix the orphan position POS-c550cecf "HR Manager" (no OU) -> attach to
--      Divisione Human Resources (DIV-HR) + ensure an owner
--   5. Re-attach the 8 Securities Dealers currently mis-filed in RETAIL BRANCHES
--      (FIL-BG-CEN, FIL-BS-CEN) to Treasury (a trader has no place in a retail
--      branch). The 5 dealers already in DIV-CRED are left as-is (out of the
--      explicit "in filiale" scope; a markets desk under Commercial Banking is
--      defensible) — flagged for review in the run report.
--   6. Teams are 1:1 with OU in the RTL pattern -> create matching teams for the
--      2 new OUs (DIV-MKT/DIR-COMPL already have their teams).
--
-- Job roles: reuses the bank roles already DEFINED-but-UNUSED in the global
--   catalog (RTL-AUDIT internal auditor, RTL-MKT marketing specialist,
--   RTL-FX trader FX, PROTO-7-3 tesoriere bancario, RTL-ROLE-COMPLIANCE-OFFICER).
--   ONE new role is created (RTL-LEGAL "Legal Counsel") because NO legal role
--   exists in the catalog and a Legal division needs one; attached to the
--   existing LEGAL job family ("Affari legali e conformità").
--
-- New leadership positions for Treasury/Audit stay VACANT (no incumbent) — this
--   is realistic and avoids inventing users. Marketing/Legal Heads are assigned
--   the users already set as the respective OU manager (Sergio Caputo / Alice
--   Esposito), making the manager the incumbent of the unit's head position.
--
-- IDEMPOTENT: single transaction; deterministic UUID v5 ids + ON CONFLICT DO
--   UPDATE on the natural keys (tenant,code). Re-running yields identical rows
--   and stable counts (the dealer move is idempotent by set membership).
-- SCOPE: touches ONLY the RTL tenant. Never HEURESYS, never other tenants.
-- Run:  PGCLIENTENCODING=UTF8 psql -h localhost -p 5433 -U heuresys \
--         -d heuresys_advanced -f db/seeds/rtl-banking-skills/seed_org_completion.sql
-- =============================================================================
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\set rtl '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Guard: the RTL tenant + the structural anchors this seed hangs off must
--    exist. Fail loud otherwise (never seed into a wrong/empty DB).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';  -- RTL_BANK
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.sys_tenancies WHERE tenant_id = v_tenant) THEN
    RAISE EXCEPTION 'RTL tenant % not found', v_tenant;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys.sys_organization_units
                 WHERE organization_unit_tenant_id = v_tenant
                   AND organization_unit_code IN ('RTL','DIV-CFO','DIV-MKT','DIR-COMPL','DIV-HR')
                 GROUP BY organization_unit_tenant_id HAVING count(*) = 5) THEN
    RAISE EXCEPTION 'Expected anchor OUs (RTL,DIV-CFO,DIV-MKT,DIR-COMPL,DIV-HR) missing for RTL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys.sys_positions
                 WHERE position_tenant_id = v_tenant
                   AND position_code IN ('POS-00000321','POS-00000384')
                 GROUP BY position_tenant_id HAVING count(*) = 2) THEN
    RAISE EXCEPTION 'Expected anchor positions (POS-00000321 CEO, POS-00000384 Finance Director) missing';
  END IF;
END $$;

-- created_by actor (soft: NULL if the platform admin is absent)
CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT :'rtl'::uuid AS tenant_id,
       (SELECT u.user_id FROM sys.sys_users u
               JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                AND ur.user_auth_role_revoked_at IS NULL
               JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
              WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
              ORDER BY u.user_email LIMIT 1) AS admin_id,
       (SELECT organization_unit_type_id FROM sys.sys_organization_unit_types
          WHERE organization_unit_type_code = 'DIVISION') AS division_type_id;

-- ----------------------------------------------------------------------------
-- 1. Missing job role: Legal Counsel (no legal role exists in the catalog).
--    Attached to the existing LEGAL family "Affari legali e conformità".
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_job_roles
  (job_role_id, job_role_family_id, job_role_code, job_role_name,
   job_role_description, job_role_seniority_level, created_by)
VALUES
  (uuid_generate_v5(uuid_ns_url(), 'rtl-role:RTL-LEGAL'),
   (SELECT job_role_family_id FROM sys.sys_job_roles
      WHERE job_role_code = 'RTL-ROLE-COMPLIANCE-OFFICER'),   -- LEGAL family
   'RTL-LEGAL', 'Legal Counsel',
   'In-house legal counsel — contracts, corporate & regulatory law, litigation support.',
   'SENIOR', (SELECT admin_id FROM _cfg))
ON CONFLICT (job_role_code) DO UPDATE
  SET job_role_name        = EXCLUDED.job_role_name,
      job_role_family_id   = EXCLUDED.job_role_family_id,
      job_role_description  = EXCLUDED.job_role_description,
      job_role_seniority_level = EXCLUDED.job_role_seniority_level;

-- ----------------------------------------------------------------------------
-- 2. New organization units (type DIVISION). Manager left NULL (vacant leadership).
--    DIR-TREAS  -> under Divisione CFO
--    DIR-AUDIT  -> under HQ (RTL), independent audit function reporting to CEO
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_organization_units
  (organization_unit_id, organization_unit_tenant_id, organization_unit_code,
   organization_unit_name, organization_unit_type_id, organization_unit_type,
   organization_unit_parent_id, organization_unit_manager_user_id, created_by)
VALUES
  (uuid_generate_v5(uuid_ns_url(), 'rtl-ou:DIR-TREAS'), :'rtl'::uuid, 'DIR-TREAS',
   'Direzione Tesoreria e Mercati',
   (SELECT division_type_id FROM _cfg), 'DIVISION',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = :'rtl'::uuid AND organization_unit_code = 'DIV-CFO'),
   NULL, (SELECT admin_id FROM _cfg)),
  (uuid_generate_v5(uuid_ns_url(), 'rtl-ou:DIR-AUDIT'), :'rtl'::uuid, 'DIR-AUDIT',
   'Direzione Internal Audit',
   (SELECT division_type_id FROM _cfg), 'DIVISION',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = :'rtl'::uuid AND organization_unit_code = 'RTL'),
   NULL, (SELECT admin_id FROM _cfg))
ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO UPDATE
  SET organization_unit_name      = EXCLUDED.organization_unit_name,
      organization_unit_type_id   = EXCLUDED.organization_unit_type_id,
      organization_unit_type      = EXCLUDED.organization_unit_type,
      organization_unit_parent_id = EXCLUDED.organization_unit_parent_id;

-- ----------------------------------------------------------------------------
-- 3. Teams 1:1 with the 2 new OUs (RTL pattern). Lead left NULL (vacant).
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_teams
  (team_id, team_tenant_id, team_code, team_name, team_organization_unit_id,
   team_lead_user_id, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-team:' || ou.organization_unit_code),
       :'rtl'::uuid, ou.organization_unit_code, ou.organization_unit_name,
       ou.organization_unit_id, NULL, (SELECT admin_id FROM _cfg)
FROM sys.sys_organization_units ou
WHERE ou.organization_unit_tenant_id = :'rtl'::uuid
  AND ou.organization_unit_code IN ('DIR-TREAS','DIR-AUDIT')
ON CONFLICT (team_tenant_id, team_code) DO UPDATE
  SET team_name                = EXCLUDED.team_name,
      team_organization_unit_id = EXCLUDED.team_organization_unit_id;

-- ----------------------------------------------------------------------------
-- 4. HEAD positions (inserted first so subordinates can reference them).
--    Treasury/Audit heads: VACANT. Marketing/Legal heads: owner = OU manager.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_positions
  (position_id, position_tenant_id, position_code, position_title,
   position_organization_unit_id, position_job_role_id,
   position_reports_to_position_id, position_owner_user_id,
   position_criticality, created_by)
VALUES
  -- Head of Treasury -> reports to Finance Director (DIV-CFO apex), vacant
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-TREAS-HEAD'), :'rtl'::uuid,
   'POS-TREAS-HEAD', 'Head of Treasury',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-TREAS'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='PROTO-7-3'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-00000384'),
   NULL, 'HIGH', (SELECT admin_id FROM _cfg)),
  -- Head of Internal Audit -> reports to CEO, vacant
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-AUDIT-HEAD'), :'rtl'::uuid,
   'POS-AUDIT-HEAD', 'Head of Internal Audit',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-AUDIT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-AUDIT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-00000321'),
   NULL, 'CRITICAL', (SELECT admin_id FROM _cfg)),
  -- Head of Marketing -> reports to CEO, owner = Sergio Caputo (DIV-MKT manager)
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-MKT-HEAD'), :'rtl'::uuid,
   'POS-MKT-HEAD', 'Head of Marketing',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIV-MKT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-MKT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-00000321'),
   (SELECT organization_unit_manager_user_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIV-MKT'),
   'HIGH', (SELECT admin_id FROM _cfg)),
  -- Head of Legal & Compliance -> reports to CEO, owner = Alice Esposito (DIR-COMPL manager)
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-LEGAL-HEAD'), :'rtl'::uuid,
   'POS-LEGAL-HEAD', 'Head of Legal & Compliance',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-COMPL'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-LEGAL'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-00000321'),
   (SELECT organization_unit_manager_user_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-COMPL'),
   'HIGH', (SELECT admin_id FROM _cfg))
ON CONFLICT (position_tenant_id, position_code) DO UPDATE
  SET position_title                 = EXCLUDED.position_title,
      position_organization_unit_id  = EXCLUDED.position_organization_unit_id,
      position_job_role_id           = EXCLUDED.position_job_role_id,
      position_reports_to_position_id = EXCLUDED.position_reports_to_position_id,
      position_owner_user_id         = EXCLUDED.position_owner_user_id,
      position_criticality           = EXCLUDED.position_criticality;

-- ----------------------------------------------------------------------------
-- 5. SUBORDINATE positions (all VACANT), reporting to their Head.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_positions
  (position_id, position_tenant_id, position_code, position_title,
   position_organization_unit_id, position_job_role_id,
   position_reports_to_position_id, position_owner_user_id,
   position_criticality, created_by)
VALUES
  -- Treasury FX / money-markets specialists (vacant)
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-TREAS-FX-01'), :'rtl'::uuid,
   'POS-TREAS-FX-01', 'FX & Money Markets Dealer',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-TREAS'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-FX'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-TREAS-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-TREAS-FX-02'), :'rtl'::uuid,
   'POS-TREAS-FX-02', 'FX & Money Markets Dealer',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-TREAS'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-FX'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-TREAS-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  -- Internal Auditors (vacant)
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-AUDIT-01'), :'rtl'::uuid,
   'POS-AUDIT-01', 'Internal Auditor',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-AUDIT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-AUDIT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-AUDIT-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-AUDIT-02'), :'rtl'::uuid,
   'POS-AUDIT-02', 'Internal Auditor',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-AUDIT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-AUDIT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-AUDIT-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  -- Marketing specialists (vacant)
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-MKT-01'), :'rtl'::uuid,
   'POS-MKT-01', 'Marketing Specialist',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIV-MKT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-MKT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-MKT-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-MKT-02'), :'rtl'::uuid,
   'POS-MKT-02', 'Marketing Specialist',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIV-MKT'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-MKT'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-MKT-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  -- Legal & Compliance staff (vacant): 1 Compliance Officer + 1 Legal Counsel
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-LEGAL-COMPL-01'), :'rtl'::uuid,
   'POS-LEGAL-COMPL-01', 'Compliance Officer',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-COMPL'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-ROLE-COMPLIANCE-OFFICER'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-LEGAL-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg)),
  (uuid_generate_v5(uuid_ns_url(), 'rtl-pos:POS-LEGAL-COUNSEL-01'), :'rtl'::uuid,
   'POS-LEGAL-COUNSEL-01', 'Legal Counsel',
   (SELECT organization_unit_id FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code='DIR-COMPL'),
   (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-LEGAL'),
   (SELECT position_id FROM sys.sys_positions
      WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-LEGAL-HEAD'),
   NULL, 'MEDIUM', (SELECT admin_id FROM _cfg))
ON CONFLICT (position_tenant_id, position_code) DO UPDATE
  SET position_title                 = EXCLUDED.position_title,
      position_organization_unit_id  = EXCLUDED.position_organization_unit_id,
      position_job_role_id           = EXCLUDED.position_job_role_id,
      position_reports_to_position_id = EXCLUDED.position_reports_to_position_id,
      position_criticality           = EXCLUDED.position_criticality;

-- ----------------------------------------------------------------------------
-- 6. Fix orphan position POS-c550cecf "HR Manager": attach to Divisione HR and
--    ensure an owner (keeps the existing one; falls back to the DIV-HR manager
--    if it were ever NULL). Idempotent.
-- ----------------------------------------------------------------------------
UPDATE sys.sys_positions p
SET position_organization_unit_id = hr.organization_unit_id,
    position_owner_user_id        = COALESCE(p.position_owner_user_id, hr.organization_unit_manager_user_id)
FROM sys.sys_organization_units hr
WHERE hr.organization_unit_tenant_id = :'rtl'::uuid
  AND hr.organization_unit_code = 'DIV-HR'
  AND p.position_tenant_id = :'rtl'::uuid
  AND p.position_code = 'POS-c550cecf';

-- ----------------------------------------------------------------------------
-- 7. Re-attach the 8 Securities Dealers mis-filed in retail branches
--    (FIL-BG-CEN, FIL-BS-CEN) to Treasury, reporting to the Head of Treasury.
--    Idempotent by set membership: after the move they are in DIR-TREAS, so the
--    branch filter no longer matches on re-run (0 rows). The 5 dealers in
--    DIV-CRED are intentionally NOT moved (out of "in filiale" scope).
-- ----------------------------------------------------------------------------
UPDATE sys.sys_positions p
SET position_organization_unit_id  = (SELECT organization_unit_id FROM sys.sys_organization_units
                                        WHERE organization_unit_tenant_id=:'rtl'::uuid
                                          AND organization_unit_code='DIR-TREAS'),
    position_reports_to_position_id = (SELECT position_id FROM sys.sys_positions
                                        WHERE position_tenant_id=:'rtl'::uuid
                                          AND position_code='POS-TREAS-HEAD')
WHERE p.position_tenant_id = :'rtl'::uuid
  AND p.position_job_role_id = (SELECT job_role_id FROM sys.sys_job_roles
                                  WHERE job_role_code='RTL-ROLE-SECURITIES-DEALER')
  AND p.position_organization_unit_id IN (
        SELECT organization_unit_id FROM sys.sys_organization_units
        WHERE organization_unit_tenant_id=:'rtl'::uuid
          AND organization_unit_code IN ('FIL-BG-CEN','FIL-BS-CEN'));

-- ----------------------------------------------------------------------------
-- 8. Re-staff the two branches emptied by step 7. Their prior seed was
--    incoherent (a retail branch composed ONLY of securities dealers, no branch
--    staff). Mirror the model branch FIL-MI-CEN (RTL-ROLE-BANK-TELLER) with a
--    realistic teller line, VACANT, reporting to the Retail Director
--    (POS-00000436, head of DIV-RETAIL). This keeps the "0 empty OU" invariant.
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_positions
  (position_id, position_tenant_id, position_code, position_title,
   position_organization_unit_id, position_job_role_id,
   position_reports_to_position_id, position_owner_user_id,
   position_criticality, created_by)
SELECT uuid_generate_v5(uuid_ns_url(), 'rtl-pos:' || t.code),
       :'rtl'::uuid, t.code, 'Bank Teller',
       (SELECT organization_unit_id FROM sys.sys_organization_units
          WHERE organization_unit_tenant_id=:'rtl'::uuid AND organization_unit_code=t.ou),
       (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code='RTL-ROLE-BANK-TELLER'),
       (SELECT position_id FROM sys.sys_positions
          WHERE position_tenant_id=:'rtl'::uuid AND position_code='POS-00000436'),
       NULL, 'LOW', (SELECT admin_id FROM _cfg)
FROM (VALUES
   ('POS-FIL-BG-TELLER-01','FIL-BG-CEN'),
   ('POS-FIL-BG-TELLER-02','FIL-BG-CEN'),
   ('POS-FIL-BG-TELLER-03','FIL-BG-CEN'),
   ('POS-FIL-BS-TELLER-01','FIL-BS-CEN'),
   ('POS-FIL-BS-TELLER-02','FIL-BS-CEN'),
   ('POS-FIL-BS-TELLER-03','FIL-BS-CEN')
) AS t(code, ou)
ON CONFLICT (position_tenant_id, position_code) DO UPDATE
  SET position_title                 = EXCLUDED.position_title,
      position_organization_unit_id  = EXCLUDED.position_organization_unit_id,
      position_job_role_id           = EXCLUDED.position_job_role_id,
      position_reports_to_position_id = EXCLUDED.position_reports_to_position_id,
      position_criticality           = EXCLUDED.position_criticality;

COMMIT;
