-- ============================================================================
-- Migration 000079 — SDBI B-10b milestone 3: PredictionsML read-model (2 tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI) · ADR-0024 / I14 (employee-centric crosswalk)
-- Sibling: 000077_engagement_surveys_schema.sql (B-10b m2, S973). Same conventions.
-- Exposes the legacy precomputed predictive-analytics cluster as a READ MODEL.
-- NO in-platform ML, NO recomputation: legacy precomputed values are imported as-is.
-- Creates 2 sys.* base tables folding 4 legacy tables:
--   1. sys.sys_predictive_models  (<- legacy predictive_models)        model registry
--   2. sys.sys_model_predictions  (<- legacy model_predictions +
--        performance_predictions + turnover_risk_scores)              generic typed prediction read-model
-- The legacy recompute-VIEW mv_talent_signals is INTENTIONALLY NOT imported: it is an
--   inline-CASE recomputation that overlaps the existing sys.sys_talent_scores (154 rows).
--   sys_talent_scores is left untouched.
-- ----------------------------------------------------------------------------
-- Conventions mirror 000077 verbatim:
--   sys.sys_<plural>; column prefix <entity>_<field>; PK <entity>_id uuid DEFAULT gen_random_uuid();
--   <entity>_tenant_id uuid NOT NULL -> sys.sys_tenancies (I5, NO RLS);
--   person FK <entity>_subject_user_id -> sys.sys_users ON DELETE SET NULL (I14; unresolved -> NULL
--     + legacy id in *_metadata, never dropped);
--   natural key + UQ(tenant_id, natural_key); jsonb cols NOT NULL DEFAULT '{}';
--   CHECK (RD-08, never ENUM); date/timestamptz (RD-09).
-- TENANCY: predictive_models is tenant-aware in legacy (tenant_id NOT NULL) -> tenant_id NOT NULL here
--   too, matching the sibling convention (mentorship/surveys are tenant-NOT-NULL). Tenant -> RESTRICT.
-- IMMUTABILITY: both tables are append-only historical snapshots imported from legacy precomputed
--   values -> NO updated_at column, NO sys_set_updated_at trigger on EITHER table. Point-in-time
--   read-model: prediction_computed_at / prediction_valid_until preserve provenance.
-- model FK: sys_model_predictions.prediction_model_id -> sys_predictive_models ON DELETE SET NULL
--   (unresolved legacy model -> NULL + legacy model id in prediction_metadata).
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ADD CONSTRAINT + CREATE INDEX IF NOT EXISTS.
--   Applied under `psql -1 -f` (single implicit txn). Purely additive.
-- Authored: 2026-06-07 (S973).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_predictive_models  (<- legacy predictive_models)
--      model registry; immutable read-model -> NO updated_at/trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_predictive_models (
  model_id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  model_tenant_id          uuid           NOT NULL,
  model_natural_key        varchar(512)   NOT NULL,
  model_name               varchar(255)   NOT NULL,
  model_type               varchar(50)    NOT NULL,
  model_version            varchar(50)    NOT NULL DEFAULT '1',
  model_algorithm          varchar(100),
  model_target_variable    varchar(100),
  model_status             varchar(20)    NOT NULL DEFAULT 'active',
  model_accuracy_metrics   jsonb          NOT NULL DEFAULT '{}'::jsonb,
  model_metadata           jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pmodel_type_check') THEN
    ALTER TABLE sys.sys_predictive_models ADD CONSTRAINT sys_pmodel_type_check CHECK (
      model_type IN ('classification','regression','clustering','timeseries','other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pmodel_status_check') THEN
    ALTER TABLE sys.sys_predictive_models ADD CONSTRAINT sys_pmodel_status_check CHECK (
      model_status IN ('draft','active','archived','deprecated'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pmodel_tenant_fk') THEN
    ALTER TABLE sys.sys_predictive_models ADD CONSTRAINT sys_pmodel_tenant_fk FOREIGN KEY (model_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_pmodel_natural_key_uq ON sys.sys_predictive_models (model_tenant_id, model_natural_key);
CREATE INDEX IF NOT EXISTS sys_pmodel_tenant_idx ON sys.sys_predictive_models (model_tenant_id);
CREATE INDEX IF NOT EXISTS sys_pmodel_type_idx   ON sys.sys_predictive_models (model_tenant_id, model_type);

-- §1 is an immutable read-model: no updated_at column, no set_updated_at trigger.

-- =====================================================================
-- §2 — sys.sys_model_predictions  (<- legacy model_predictions +
--      performance_predictions + turnover_risk_scores, folded by prediction_type)
--      append-only historical read-model -> NO updated_at/trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_model_predictions (
  prediction_id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_tenant_id       uuid           NOT NULL,
  prediction_natural_key     varchar(512)   NOT NULL,
  prediction_model_id        uuid,
  prediction_subject_user_id uuid,
  prediction_type            varchar(20)    NOT NULL,
  prediction_value           numeric,
  prediction_label           varchar(100),
  prediction_confidence      numeric(5,4),
  prediction_details         jsonb          NOT NULL DEFAULT '{}'::jsonb,
  prediction_valid_until     timestamptz,
  prediction_computed_at     timestamptz,
  prediction_metadata        jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mpred_type_check') THEN
    ALTER TABLE sys.sys_model_predictions ADD CONSTRAINT sys_mpred_type_check CHECK (
      prediction_type IN ('GENERIC','PERFORMANCE','TURNOVER'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mpred_confidence_range') THEN
    ALTER TABLE sys.sys_model_predictions ADD CONSTRAINT sys_mpred_confidence_range CHECK (
      prediction_confidence IS NULL OR (prediction_confidence >= 0 AND prediction_confidence <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mpred_tenant_fk') THEN
    ALTER TABLE sys.sys_model_predictions ADD CONSTRAINT sys_mpred_tenant_fk FOREIGN KEY (prediction_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mpred_model_fk') THEN
    ALTER TABLE sys.sys_model_predictions ADD CONSTRAINT sys_mpred_model_fk FOREIGN KEY (prediction_model_id) REFERENCES sys.sys_predictive_models(model_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mpred_subject_user_fk') THEN
    ALTER TABLE sys.sys_model_predictions ADD CONSTRAINT sys_mpred_subject_user_fk FOREIGN KEY (prediction_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_mpred_natural_key_uq ON sys.sys_model_predictions (prediction_tenant_id, prediction_natural_key);
CREATE INDEX IF NOT EXISTS sys_mpred_tenant_idx  ON sys.sys_model_predictions (prediction_tenant_id);
CREATE INDEX IF NOT EXISTS sys_mpred_type_idx    ON sys.sys_model_predictions (prediction_tenant_id, prediction_type);
CREATE INDEX IF NOT EXISTS sys_mpred_subject_idx ON sys.sys_model_predictions (prediction_subject_user_id) WHERE prediction_subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_mpred_model_idx   ON sys.sys_model_predictions (prediction_model_id) WHERE prediction_model_id IS NOT NULL;

-- §2 is an append-only read-model: no updated_at column, no set_updated_at trigger.

-- ============================================================================
-- Post-conditions (idempotent): assert the 2 base tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_predictive_models','sys_model_predictions');
  IF n_tables <> 2 THEN
    RAISE EXCEPTION '000079: expected 2 predictionsml base tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000079: predictionsml schema OK — 2/2 base tables present.';
END $$;
