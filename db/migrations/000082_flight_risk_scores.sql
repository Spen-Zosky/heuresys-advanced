-- ============================================================================
-- Migration 000082 — Cap③ data-mining: in-platform flight-risk score table
-- ----------------------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-06-07-data-mining-design.md (slice A, P1).
-- Adds a DEDICATED score family for attrition / flight-risk. We do NOT overwrite
-- sys_talent_scores: that table is a LIVE 9-box talent grid
-- (talent_score_potential/performance/band='STAR…', payload.legacy) — overwriting
-- it with a flight-risk band would corrupt that read-model. The spec §3/§4 admits
-- a new score family following the identical column convention; this is it.
--
-- The score is IN-PLATFORM-DERIVED (no ML, no external service): a documented
-- weighted-linear rule over live sys.* features, recomputed via
-- POST /v1/insights/recompute. Provenance lives in *_payload.derivation; the row
-- is reproducible from features + rule + model_version. Append-with-latest-wins
-- (the *_user_idx DESC index serves "active = latest computed_at per subject").
--
-- Conventions mirror sys_*_scores (000.. talent/readiness) + 000081:
--   sys.sys_<plural>; prefix flight_risk_score_<field>; PK uuid DEFAULT
--   gen_random_uuid(); tenant FK -> sys.sys_tenancies(tenant_id); subject FK
--   -> sys.sys_users(user_id) ON DELETE CASCADE (employee-centric I14);
--   numeric score; band varchar+CHECK (RD-08, never ENUM); jsonb payload;
--   timestamptz (RD-09). Tenant isolation = FK + API middleware (I5, never RLS).
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT.
-- Authored: 2026-06-07 (cap③ P1 flight-risk).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_flight_risk_scores (
  flight_risk_score_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_risk_score_tenant_id     uuid         NOT NULL
                                    REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  flight_risk_score_user_id       uuid         NOT NULL
                                    REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  -- 0..100, higher = higher attrition risk.
  flight_risk_score_value         numeric(5,2) NOT NULL,
  -- LOW / MEDIUM / HIGH / CRITICAL (RD-08 varchar+CHECK).
  flight_risk_score_band          varchar(16)  NOT NULL,
  -- Stamped so a weight/threshold revision supersedes prior rows without data loss.
  flight_risk_score_model_version varchar(32)  NOT NULL,
  -- Explainability + provenance: payload.derivation = {rule_id, features:[…], dropped:[…]}.
  flight_risk_score_payload       jsonb        NOT NULL DEFAULT '{}',
  flight_risk_score_computed_at   timestamptz  NOT NULL DEFAULT now(),
  created_at                      timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_flight_risk_band_check') THEN
    ALTER TABLE sys.sys_flight_risk_scores
      ADD CONSTRAINT sys_flight_risk_band_check
      CHECK (flight_risk_score_band IN ('LOW','MEDIUM','HIGH','CRITICAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_flight_risk_value_check') THEN
    ALTER TABLE sys.sys_flight_risk_scores
      ADD CONSTRAINT sys_flight_risk_value_check
      CHECK (flight_risk_score_value >= 0 AND flight_risk_score_value <= 100);
  END IF;
END
$cs$;

-- "active score = latest computed_at per subject" (read path uses DISTINCT ON).
CREATE INDEX IF NOT EXISTS sys_flight_risk_user_idx
  ON sys.sys_flight_risk_scores (flight_risk_score_user_id, flight_risk_score_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_flight_risk_tenant_idx
  ON sys.sys_flight_risk_scores (flight_risk_score_tenant_id);

-- =====================================================================
-- Reconciliation registry: keep the "0 UNCLASSIFIED" invariant.
-- In-platform-derived analytics output (cap③), NOT a legacy reconciliation
-- target -> EXCLUDE / bucket D (mirrors the embedding sidecars + 000081).
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name,
   reconciliation_registry_bucket,
   reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_flight_risk_scores', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — in-platform-derived analytics (cap③ data-mining flight-risk, mig 000082). Per-subject score recomputed from live sys.* features via a documented weighted-linear rule (POST /v1/insights/recompute); never imported from legacy. Mirrors the embedding sidecars / sys_auth_mfa_otp_challenges (app-generated, not a reconciliation target).]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified
  FROM sys.v_reconciliation_status
  WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000082: expected 0 UNCLASSIFIED after registering sys_flight_risk_scores, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000082: sys_flight_risk_scores created + registered EXCLUDE; reconciliation registry 0 UNCLASSIFIED.';
END $rc$;
