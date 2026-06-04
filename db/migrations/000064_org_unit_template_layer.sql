-- 000064_org_unit_template_layer.sql
-- D4 / Wall W2 — Option A (org-unit TEMPLATE layer, full-fidelity).
-- Authoritative design: docs/kb/D4_ORG_UNIT_TEMPLATE_DESIGN.md (Option A, all 6 D4.x recommendations).
--
-- The wall: legacy org_unit_kpis (100) hangs off org_unit_templates (225, design/blueprint layer,
-- TENANT-LESS), disjoint from the advanced instance table sys_organization_units. kpi_id resolves
-- 100/100 (S958.1 catalog unification); the ONLY wall is the unit FK. Option A introduces a real
-- tenant-less template taxonomy (mirroring the proven sys_blueprint_process_registry pattern that
-- backs sys_process_kpi_templates) and repoints the KPI-template FK to it via a nullable
-- unit_template_id + XOR CHECK, so the named target sys_organization_unit_kpi_templates shows 100 rows.
--
-- Invariants: I1 (positions FK only sys_organization_units instances, never templates) — UNTOUCHED.
--   I3/I4 (sys.sys_<plural>) — new base table sys.sys_organization_unit_templates. I5 (tenant isolation
--   = FK + middleware, NEVER RLS) — UPHELD: the template taxonomy is GLOBAL / tenant-less, like
--   sys_organization_unit_types and sys_blueprint_process_registry; it lives outside the middleware
--   tenant filter as blueprint reference data. RD-08 (categorical = varchar+CHECK, never ENUM) — the
--   nature CHECK. RD-09 (date vs timestamptz) — audit cols are timestamptz (time-of-day relevant).
--
-- Idempotent: CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, guarded trigger/constraint creation.
-- NO inner BEGIN/COMMIT (runner applies with psql -1). NO data (the 225 templates + 100 KPIs land in
-- db/seeds/reconciliation/40_org_unit_kpi_templates.sql). Twice-run-clean (empty pg_dump diff).

-- ============================================================================================
-- (1) The template taxonomy (TENANT-LESS, global blueprint — mirrors sys_blueprint_process_registry)
-- ============================================================================================
CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_templates (
  organization_unit_template_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_template_blueprint_id  uuid         NOT NULL,              -- legacy template_id group (the 9)
  organization_unit_template_code          varchar(64)  NOT NULL,              -- CEO, DIR-*, DEPT-*
  organization_unit_template_name          varchar(255) NOT NULL,              -- legacy name_it
  organization_unit_template_name_en       varchar(255),                       -- legacy name_en
  organization_unit_template_parent_id     uuid         REFERENCES sys.sys_organization_unit_templates(organization_unit_template_id) ON DELETE SET NULL,
  organization_unit_template_type_id       uuid         REFERENCES sys.sys_organization_unit_types(organization_unit_type_id) ON DELETE SET NULL,
  organization_unit_template_level         smallint,
  organization_unit_template_nature        varchar(20),                        -- CHECK in {Strategic,Tactical,Operational}
  organization_unit_template_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,  -- legacy id, area_code, responsibilities[], ...
  created_at                               timestamptz  NOT NULL DEFAULT now(),
  created_by                               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                               timestamptz  NOT NULL DEFAULT now(),
  updated_by                               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_org_unit_template_blueprint_code_uq
    UNIQUE (organization_unit_template_blueprint_id, organization_unit_template_code)
);

-- nature CHECK (RD-08: varchar+CHECK, never ENUM). Mirror the legacy ck_unit_nature set.
ALTER TABLE sys.sys_organization_unit_templates
  DROP CONSTRAINT IF EXISTS sys_org_unit_template_nature_check;
ALTER TABLE sys.sys_organization_unit_templates
  ADD CONSTRAINT sys_org_unit_template_nature_check
  CHECK (organization_unit_template_nature IS NULL
         OR organization_unit_template_nature IN ('Strategic','Tactical','Operational'));

-- helpful lookup index (blueprint group scans + parent walk)
CREATE INDEX IF NOT EXISTS sys_org_unit_template_blueprint_idx
  ON sys.sys_organization_unit_templates (organization_unit_template_blueprint_id);
CREATE INDEX IF NOT EXISTS sys_org_unit_template_parent_idx
  ON sys.sys_organization_unit_templates (organization_unit_template_parent_id);

-- guarded set_updated_at trigger (mirror 000058)
DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname = 'sys_org_unit_templates_set_updated_at'
                   AND tgrelid = 'sys.sys_organization_unit_templates'::regclass) THEN
    CREATE TRIGGER sys_org_unit_templates_set_updated_at BEFORE UPDATE
      ON sys.sys_organization_unit_templates FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- ============================================================================================
-- (2) Dual-mode the KPI-template target: add a nullable template FK, relax unit_id + tenant_id to
--     NULLABLE, add a XOR CHECK (exactly one of {unit_id, unit_template_id} is non-null).
--     The only schema change to a populated object is widening two columns on the EMPTY target
--     (sys_organization_unit_kpi_templates, 0 rows) — a non-destructive widening.
-- ============================================================================================
ALTER TABLE sys.sys_organization_unit_kpi_templates
  ADD COLUMN IF NOT EXISTS organization_unit_kpi_template_unit_template_id uuid
    REFERENCES sys.sys_organization_unit_templates(organization_unit_template_id) ON DELETE CASCADE;

-- relax instance unit_id NOT-NULL -> NULLABLE (blueprint-keyed rows leave it NULL)
ALTER TABLE sys.sys_organization_unit_kpi_templates
  ALTER COLUMN organization_unit_kpi_template_unit_id DROP NOT NULL;

-- relax tenant_id NOT-NULL -> NULLABLE (D4.2: GLOBAL / tenant-less blueprint KPI templates)
ALTER TABLE sys.sys_organization_unit_kpi_templates
  ALTER COLUMN organization_unit_kpi_template_tenant_id DROP NOT NULL;

-- XOR CHECK: a row is EITHER an instance KPI-template (unit_id) OR a blueprint KPI-template
-- (unit_template_id), never both, never neither.
ALTER TABLE sys.sys_organization_unit_kpi_templates
  DROP CONSTRAINT IF EXISTS sys_org_unit_kpi_template_unit_xor_check;
ALTER TABLE sys.sys_organization_unit_kpi_templates
  ADD CONSTRAINT sys_org_unit_kpi_template_unit_xor_check
  CHECK ( (organization_unit_kpi_template_unit_id IS NOT NULL)
          <> (organization_unit_kpi_template_unit_template_id IS NOT NULL) );

-- preserve the legacy 1:1 uniqueness for blueprint-keyed rows. The existing UNIQUE
-- (unit_id, kpi_id) does not cover template rows (unit_id NULL there). Add a partial UNIQUE on
-- (unit_template_id, kpi_id) mirroring the legacy UNIQUE(org_unit_template_id, kpi_code).
CREATE UNIQUE INDEX IF NOT EXISTS sys_org_unit_kpi_template_tpl_kpi_uq
  ON sys.sys_organization_unit_kpi_templates
     (organization_unit_kpi_template_unit_template_id, organization_unit_kpi_template_kpi_id)
  WHERE organization_unit_kpi_template_unit_template_id IS NOT NULL;

-- ============================================================================================
-- (3) Registry invariant (0 UNCLASSIFIED): the NEW base table must carry an explicit terminal
--     status BEFORE the seed runs (the status resolver fn_reconciliation_status() iterates EVERY
--     sys base table; a table with no rows + no card mapping + no registry row -> UNCLASSIFIED).
--     Declared IMPORT / bucket A / source org_unit_templates. Once the seed loads 225 rows it is
--     POPULATED via has_rows. ON CONFLICT DO NOTHING keeps it idempotent.
-- ============================================================================================
INSERT INTO sys.sys_reconciliation_registry (
  reconciliation_registry_table_name,
  reconciliation_registry_bucket,
  reconciliation_registry_declared_status,
  reconciliation_registry_legacy_source,
  reconciliation_registry_legacy_source_rows,
  reconciliation_registry_rationale
) VALUES (
  'sys_organization_unit_templates',
  'A',
  'IMPORT',
  'org_unit_templates',
  225,
  'D4/W2 Option A: tenant-less org-unit blueprint taxonomy hosting the legacy org_unit_kpis '
  || 'template layer (225 = 9 blueprints x 25 codes). Mirrors sys_blueprint_process_registry. '
  || 'Populated by db/seeds/reconciliation/40_org_unit_kpi_templates.sql.'
) ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE v_unclassified int;
BEGIN
  SELECT count(*) INTO v_unclassified
    FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  RAISE NOTICE '000064: org-unit template layer created; UNCLASSIFIED now=% (must stay 0)', v_unclassified;
  IF v_unclassified <> 0 THEN
    RAISE EXCEPTION '000064: % UNCLASSIFIED sys tables after migration (expected 0)', v_unclassified;
  END IF;
END $$;
