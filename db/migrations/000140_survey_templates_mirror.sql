-- 000140_survey_templates_mirror.sql
-- Surveys NORMALIZED-MIRROR completion (#6/#10, S996). m2b (mig 000097) shipped the
-- normalized survey cluster (sys_surveys/_questions/_responses/_pulse_checks) but left
-- the legacy survey_templates catalog un-mirrored. This adds it as a read-model table
-- parallel to sys_surveys.
--
-- NB: legacy `surveys` carries NO template_id (verified live) → there is NO FK link from
-- sys_surveys to a template; the catalog is standalone (templates are authoring artifacts,
-- not referenced by instances). survey_template_type is a bare varchar (mirrors
-- sys_surveys.survey_type, which is unconstrained — open legacy domain). I5: tenant FK +
-- API middleware filter (never RLS). RBAC reuses surveys:read (mig 000078) — no new perm.
-- Data via seed 55 (the 2 templates whose legacy tenants map to a v5 tenant). Idempotent.

CREATE TABLE IF NOT EXISTS sys.sys_survey_templates (
  survey_template_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_template_tenant_id         uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  survey_template_natural_key       text NOT NULL,
  survey_template_name              varchar(300) NOT NULL,
  survey_template_description       text,
  survey_template_type              varchar(60),
  survey_template_questions         jsonb NOT NULL DEFAULT '[]'::jsonb,
  survey_template_is_anonymous      boolean NOT NULL DEFAULT true,
  survey_template_estimated_minutes integer,
  survey_template_is_system         boolean NOT NULL DEFAULT false,
  survey_template_metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_survey_templates_natural_key_uq UNIQUE (survey_template_tenant_id, survey_template_natural_key)
);
CREATE INDEX IF NOT EXISTS sys_survey_templates_tenant_idx ON sys.sys_survey_templates (survey_template_tenant_id);

-- reconciliation registry: classify the new table (keep 0-UNCLASSIFIED even when empty,
-- e.g. CI runs migrations without the seed). Real legacy import → bucket A / IMPORT.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_wall, reconciliation_registry_rationale, reconciliation_registry_decided_at)
VALUES
  ('sys_survey_templates', 'A', 'IMPORT', 'survey_templates', NULL,
   '[#6/#10 S996] Survey template catalog mirror — completes the m2b normalized cluster (000097). Legacy survey_templates has no FK from surveys; standalone authoring catalog. Imported via seed 55 (LEGACY_TPL:: natural key), only the templates whose legacy tenant maps to a v5 tenant (RTL + HEURESYS).', now())
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE has_tbl boolean; n_unclassified int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'sys' AND table_name = 'sys_survey_templates'
  ) INTO has_tbl;
  IF NOT has_tbl THEN
    RAISE EXCEPTION '000140: sys_survey_templates was not created';
  END IF;
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000140: reconciliation registry has % UNCLASSIFIED rows (expected 0)', n_unclassified;
  END IF;
  RAISE NOTICE '000140: sys_survey_templates mirror ready + registered (A/IMPORT). 0 UNCLASSIFIED.';
END $$;
