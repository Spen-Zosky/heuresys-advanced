-- ============================================================================
-- 000147_capability_maturity_scores.sql — Gap#1 Step 4 (Maturity engine).
-- Read-only L0..L5 maturity scorecard per org-unit. CONSUMES the MLCE composite
-- (sys_capability_scores, ORG_UNIT) + a coded rubric (rubric_version) and derives
-- an SQL-auditable level. One ACTIVE row per (tenant, org_unit, capability_ref)
-- per cohort computed_at; bounded delete-then-insert per tenant (D-18).
--   capability_ref DEFAULT 'OVERALL' future-proofs an org-unit × capability grain
--   without a schema change (D-grain). composite = the MLCE number it derives from
--   (the auditable bridge). payload.criteria[] = the per-level gate outcomes.
-- Conventions mirror sys_capability_scores (000146) + insights tables: varchar+CHECK
-- (RD-08), numeric(5,2), jsonb payload, timestamptz (RD-09), tenant FK CASCADE (I5),
-- reconciliation registry bucket-D EXCLUDE + 0-UNCLASSIFIED.
-- Idempotent: CREATE ... IF NOT EXISTS + guarded ADD CONSTRAINT + ON CONFLICT.
-- Authored: 2026-06-20 (Gap#1 Step 4 Maturity).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_capability_maturity_scores (
  capability_maturity_score_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_maturity_score_tenant_id     uuid         NOT NULL
                                            REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  capability_maturity_score_org_unit_id   uuid         NOT NULL
                                            REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE CASCADE,
  -- 'OVERALL' (v1) | a capability ref (future grain) — no schema change to slice later.
  capability_maturity_score_capability_ref varchar(64) NOT NULL DEFAULT 'OVERALL',
  -- L0..L5 (RD-08 varchar+CHECK).
  capability_maturity_score_level         varchar(2)   NOT NULL,
  -- the MLCE composite (0..100) this level derives from (auditable bridge).
  capability_maturity_score_composite     numeric(5,2) NOT NULL,
  capability_maturity_score_rubric_version varchar(32) NOT NULL,
  capability_maturity_score_model_version varchar(32)  NOT NULL,
  -- payload = {ruleId, rubricVersion, composite, mlceLineageRef, criteria:[{level,label,met,metric,value,threshold,operator}]}.
  capability_maturity_score_payload       jsonb        NOT NULL DEFAULT '{}',
  capability_maturity_score_computed_at   timestamptz  NOT NULL DEFAULT now(),
  created_at                              timestamptz  NOT NULL DEFAULT now()
);

DO $cm$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_maturity_level_check') THEN
    ALTER TABLE sys.sys_capability_maturity_scores ADD CONSTRAINT sys_capability_maturity_level_check
      CHECK (capability_maturity_score_level IN ('L0','L1','L2','L3','L4','L5'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_capability_maturity_composite_check') THEN
    ALTER TABLE sys.sys_capability_maturity_scores ADD CONSTRAINT sys_capability_maturity_composite_check
      CHECK (capability_maturity_score_composite >= 0 AND capability_maturity_score_composite <= 100);
  END IF;
END
$cm$;

-- "active = latest computed_at per (org_unit, capability_ref)" within a tenant.
CREATE INDEX IF NOT EXISTS sys_capability_maturity_subject_idx
  ON sys.sys_capability_maturity_scores
     (capability_maturity_score_tenant_id, capability_maturity_score_org_unit_id,
      capability_maturity_score_capability_ref, capability_maturity_score_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_capability_maturity_tenant_idx
  ON sys.sys_capability_maturity_scores (capability_maturity_score_tenant_id);

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_capability_maturity_scores', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — in-platform-derived scorecard (Gap#1 Maturity engine, mig 000147). Per-org-unit L0..L5 level derived from the MLCE composite (sys_capability_scores) + a coded rubric via POST /v1/capability/maturity/recompute; never imported from legacy. Mirrors sys_capability_scores (000146).]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000147: expected 0 UNCLASSIFIED after registering maturity table, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000147: sys_capability_maturity_scores created + registered EXCLUDE; reconciliation 0 UNCLASSIFIED.';
END $rc$;
