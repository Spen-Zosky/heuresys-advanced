-- ============================================================================
-- Migration 000121 — T2.5: org-unit ↔ business-process assignment (1 table)
-- ----------------------------------------------------------------------------
-- Associates a tenant-scoped organization unit (sys.sys_organization_units) with a
-- GLOBAL blueprint process step (sys.sys_blueprint_process_registry — the catalog is
-- platform-level, NOT tenant-scoped). The ASSIGNMENT row is owned by the org unit's
-- tenant (I5 = FK + API middleware filter, NEVER RLS): two tenants may each
-- independently assign THEIR OU to the SAME global process; the by-process panel is
-- therefore tenant-filtered. org_unit_process_role is RACI-style (RD-08 varchar+CHECK,
-- never ENUM). Spec source: docs/integrations/tenant_onboarding_esco_04_*.md §2.
-- ----------------------------------------------------------------------------
-- Conventions mirror 000100: sys.sys_<plural>; FK fields prefixed org_unit_process_;
--   PK uuid DEFAULT gen_random_uuid(); tenant_id NOT NULL -> sys.sys_tenancies
--   ON DELETE CASCADE; FKs ON DELETE CASCADE (per spec DDL); jsonb metadata
--   DEFAULT '{}'; updated_at + sys_set_updated_at trigger (mutable).
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT + guarded
--   TRIGGER. Twice-run = empty pg_dump diff.
-- RBAC permission gate (organization_unit_processes:{read,create,delete}) is seeded
--   in the sibling migration 000122 (mirror 000100/000114 table-vs-perms split).
-- Authored: 2026-06-15 (T2.5, ESCO/tenant-onboarding workstream).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_processes (
  organization_unit_process_id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_process_tenant_id            uuid        NOT NULL,
  org_unit_process_org_unit_id          uuid        NOT NULL,
  org_unit_process_blueprint_process_id uuid        NOT NULL,
  org_unit_process_role                 varchar(16) NOT NULL DEFAULT 'OWNER',
  org_unit_process_metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at                            timestamptz NOT NULL DEFAULT now(),
  updated_at                            timestamptz NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_oup_role_check') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_oup_role_check CHECK (
      org_unit_process_role IN ('OWNER','CONTRIBUTOR','CONSULTED','INFORMED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_oup_updated_after') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_oup_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_oup_tenant_fk') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_oup_tenant_fk FOREIGN KEY (org_unit_process_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_oup_org_unit_fk') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_oup_org_unit_fk FOREIGN KEY (org_unit_process_org_unit_id) REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_oup_process_fk') THEN
    ALTER TABLE sys.sys_organization_unit_processes ADD CONSTRAINT sys_oup_process_fk FOREIGN KEY (org_unit_process_blueprint_process_id) REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

-- An (org_unit, process) pair is assigned at most once (uq_ou_process in the spec).
CREATE UNIQUE INDEX IF NOT EXISTS sys_oup_ou_process_uq ON sys.sys_organization_unit_processes (org_unit_process_org_unit_id, org_unit_process_blueprint_process_id);
CREATE INDEX IF NOT EXISTS sys_oup_tenant_idx  ON sys.sys_organization_unit_processes (org_unit_process_tenant_id);
CREATE INDEX IF NOT EXISTS sys_oup_process_idx ON sys.sys_organization_unit_processes (org_unit_process_blueprint_process_id);
CREATE INDEX IF NOT EXISTS sys_oup_org_unit_idx ON sys.sys_organization_unit_processes (org_unit_process_org_unit_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_organization_unit_processes_set_updated_at') THEN
    CREATE TRIGGER sys_organization_unit_processes_set_updated_at BEFORE UPDATE ON sys.sys_organization_unit_processes
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000100 §4).
-- App-authored assignment table, NOT a legacy-import target -> EXCLUDE / bucket D.
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_organization_unit_processes', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored org-unit<->business-process RACI assignment (T2.5, mig 000121). Created in-app via /v1/organization-unit-processes; no legacy source. Not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000121: expected 0 UNCLASSIFIED after registering assignment table, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-condition (idempotent): assert the assignment table exists.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r' AND c.relname = 'sys_organization_unit_processes';
  IF n_tables <> 1 THEN
    RAISE EXCEPTION '000121: expected sys_organization_unit_processes to exist, found %', n_tables;
  END IF;
  RAISE NOTICE '000121: org-unit<->process assignment OK — table present + registered EXCLUDE.';
END $$;
