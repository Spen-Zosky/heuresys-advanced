-- ============================================================================
-- 000146_capability_scores.sql — Gap#1 Step 3 (MLCE Phase-1) score tables.
-- Two tables backing /v1/capability/composition:
--   sys_capability_scores         — one ACTIVE row per (subject_type, subject_id)
--                                   per cohort computed_at; value/coverage 0..100,
--                                   aggregation_mode, child_count, payload jsonb.
--   sys_capability_score_lineage  — append-with-cohort ledger: one row per arc
--                                   (parent -> child) so every aggregate is
--                                   reproducible from its children + the mode.
-- subject_id / parent_id / child_id are POLYMORPHIC (employee=user, position,
-- org_unit, org=tenant) -> no FK on them (integrity in the service, exactly like
-- the insights score tables, mig 000082). Tenant FK CASCADE (I5). Read path uses
-- DISTINCT ON (... computed_at DESC) for "active = latest cohort"; recompute is a
-- bounded delete-then-insert (D-18) so re-running never grows the tables.
-- Conventions mirror sys_flight_risk_scores (000082): sys.sys_<plural>; prefix
-- <table>_<field>; numeric(5,2)+CHECK 0..100; varchar+CHECK (RD-08); jsonb payload;
-- timestamptz (RD-09); reconciliation registry bucket-D EXCLUDE + 0-UNCLASSIFIED.
-- Idempotent: CREATE ... IF NOT EXISTS + guarded ADD CONSTRAINT + ON CONFLICT.
-- Authored: 2026-06-20 (Gap#1 Step 3 MLCE).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_capability_scores (
  capability_score_id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_score_tenant_id        uuid         NOT NULL
                                      REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  -- EMPLOYEE / POSITION / ORG_UNIT / ORG (RD-08 varchar+CHECK).
  capability_score_subject_type     varchar(16)  NOT NULL,
  -- Polymorphic subject (user_id / position_id / organization_unit_id / tenant_id). No FK.
  capability_score_subject_id       uuid         NOT NULL,
  -- 0..100 composite capability.
  capability_score_value            numeric(5,2) NOT NULL,
  -- 0..100 required-skill coverage.
  capability_score_coverage         numeric(5,2) NOT NULL,
  -- WEIGHTED_AVG / SIMPLE_AVG / MIN / WORST_CRITICAL / COVERAGE.
  capability_score_aggregation_mode varchar(24)  NOT NULL,
  capability_score_model_version    varchar(32)  NOT NULL,
  capability_score_child_count      integer      NOT NULL DEFAULT 0,
  -- Explainability: payload.derivation = {rule_id, aggregation_mode, model_version, inputs:[…]}.
  capability_score_payload          jsonb        NOT NULL DEFAULT '{}',
  capability_score_computed_at      timestamptz  NOT NULL DEFAULT now(),
  created_at                        timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_score_subject_type_check') THEN
    ALTER TABLE sys.sys_capability_scores ADD CONSTRAINT sys_capability_score_subject_type_check
      CHECK (capability_score_subject_type IN ('EMPLOYEE','POSITION','ORG_UNIT','ORG'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_score_mode_check') THEN
    ALTER TABLE sys.sys_capability_scores ADD CONSTRAINT sys_capability_score_mode_check
      CHECK (capability_score_aggregation_mode IN ('WEIGHTED_AVG','SIMPLE_AVG','MIN','WORST_CRITICAL','COVERAGE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_score_value_check') THEN
    ALTER TABLE sys.sys_capability_scores ADD CONSTRAINT sys_capability_score_value_check
      CHECK (capability_score_value >= 0 AND capability_score_value <= 100
             AND capability_score_coverage >= 0 AND capability_score_coverage <= 100);
  END IF;
END
$cs$;

-- "active = latest computed_at per (subject_type, subject_id)" within a tenant.
CREATE INDEX IF NOT EXISTS sys_capability_scores_subject_idx
  ON sys.sys_capability_scores
     (capability_score_tenant_id, capability_score_subject_type, capability_score_subject_id, capability_score_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_capability_scores_tenant_idx
  ON sys.sys_capability_scores (capability_score_tenant_id);

CREATE TABLE IF NOT EXISTS sys.sys_capability_score_lineage (
  capability_score_lineage_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_score_lineage_tenant_id   uuid         NOT NULL
                                         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  capability_score_lineage_parent_type varchar(16)  NOT NULL,
  capability_score_lineage_parent_id   uuid         NOT NULL,
  capability_score_lineage_child_type  varchar(16)  NOT NULL,
  capability_score_lineage_child_id    uuid         NOT NULL,
  -- child value + effective (re-normalized) weight frozen at compute -> arc is reproducible.
  capability_score_lineage_child_value numeric(5,2) NOT NULL,
  capability_score_lineage_weight      numeric(10,4) NOT NULL,
  capability_score_lineage_computed_at timestamptz  NOT NULL DEFAULT now(),
  created_at                           timestamptz  NOT NULL DEFAULT now()
);

DO $cl$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_lineage_parent_type_check') THEN
    ALTER TABLE sys.sys_capability_score_lineage ADD CONSTRAINT sys_capability_lineage_parent_type_check
      CHECK (capability_score_lineage_parent_type IN ('EMPLOYEE','POSITION','ORG_UNIT','ORG'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_lineage_child_type_check') THEN
    ALTER TABLE sys.sys_capability_score_lineage ADD CONSTRAINT sys_capability_lineage_child_type_check
      CHECK (capability_score_lineage_child_type IN ('EMPLOYEE','POSITION','ORG_UNIT','ORG'));
  END IF;
END
$cl$;

CREATE INDEX IF NOT EXISTS sys_capability_lineage_parent_idx
  ON sys.sys_capability_score_lineage
     (capability_score_lineage_tenant_id, capability_score_lineage_parent_type, capability_score_lineage_parent_id, capability_score_lineage_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_capability_lineage_tenant_idx
  ON sys.sys_capability_score_lineage (capability_score_lineage_tenant_id);

-- =====================================================================
-- Reconciliation registry: in-platform-derived analytics (Gap#1 MLCE),
-- NOT a legacy reconciliation target -> EXCLUDE / bucket D (mirrors 000082).
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_capability_scores', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — in-platform-derived analytics (Gap#1 MLCE composite, mig 000146). Per-subject score recomputed bottom-up from live sys.* (required skills, held evidence, org hierarchy) via a documented deterministic rule (POST /v1/capability/composition/recompute); never imported from legacy. Mirrors sys_flight_risk_scores (000082).]'),
  ('sys_capability_score_lineage', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — audit ledger for sys_capability_scores (Gap#1 MLCE, mig 000146): one arc (parent->child) per cohort so each aggregate is reproducible. App-generated, not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000146: expected 0 UNCLASSIFIED after registering capability tables, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000146: sys_capability_scores + lineage created + registered EXCLUDE; reconciliation 0 UNCLASSIFIED.';
END $rc$;
