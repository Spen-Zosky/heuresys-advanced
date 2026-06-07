-- ============================================================================
-- Migration 000092 — Cap③ data-mining P2: succession-readiness + skill-gap score tables
-- ----------------------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-06-07-data-mining-design.md §3 (slices B/C),
-- §9.3/§9.4 (the human-authored derivation rules, signed off by Enzo).
--
-- Two DEDICATED in-platform score families (mirroring slice A / sys_flight_risk_scores,
-- mig 000082) — NOT a reuse of the legacy-seeded sys_readiness_scores (90) /
-- sys_employee_position_fit_scores (146), whose recompute would corrupt those
-- legacy read-models. Both are IN-PLATFORM-DERIVED (no ML): a documented rule over
-- live sys.* features + the ② embedding substrate, recomputed via
-- POST /v1/insights/{succession-readiness,skill-gap}/recompute. Provenance in
-- *_payload.derivation; append-with-latest-wins (the *_user_idx DESC index).
--
-- Conventions verbatim from 000082: sys.sys_<plural>; prefix per table; PK uuid
-- DEFAULT gen_random_uuid(); tenant FK -> sys.sys_tenancies(tenant_id) ON DELETE
-- CASCADE; subject FK -> sys.sys_users(user_id) ON DELETE CASCADE (I14); position
-- FK -> sys.sys_positions(position_id) ON DELETE CASCADE; numeric(5,2) value;
-- categorical varchar+CHECK (RD-08, never ENUM); jsonb payload; timestamptz (RD-09).
-- Tenant isolation = FK + API middleware (I5, never RLS). Reuses insights:view/admin
-- (no new permission). Idempotent. Authored: 2026-06-07 (cap③ P2 slices B/C).
-- ============================================================================

-- ── Slice B: succession-readiness, per (user, candidate target position) ──
CREATE TABLE IF NOT EXISTS sys.sys_succession_readiness_scores (
  succession_readiness_score_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  succession_readiness_score_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  succession_readiness_score_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  succession_readiness_score_position_id   uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  -- 0..100, higher = more ready to step into the target position.
  succession_readiness_score_value         numeric(5,2) NOT NULL,
  -- READY_NOW / READY_6_MONTHS / READY_1_YEAR / READY_2_YEARS / NOT_READY (RD-08).
  succession_readiness_score_horizon       varchar(20)  NOT NULL,
  succession_readiness_score_model_version varchar(32)  NOT NULL,
  succession_readiness_score_payload       jsonb        NOT NULL DEFAULT '{}',
  succession_readiness_score_computed_at   timestamptz  NOT NULL DEFAULT now(),
  created_at                               timestamptz  NOT NULL DEFAULT now()
);

-- ── Slice C: skill-gap vs current position role, per user ──
CREATE TABLE IF NOT EXISTS sys.sys_skill_gap_scores (
  skill_gap_score_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_gap_score_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  skill_gap_score_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  skill_gap_score_position_id   uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  -- 0..100, higher = larger skill gap for the subject's CURRENT role.
  skill_gap_score_value         numeric(5,2) NOT NULL,
  -- ALIGNED / MINOR_GAP / MODERATE_GAP / MAJOR_GAP (RD-08).
  skill_gap_score_segment       varchar(20)  NOT NULL,
  skill_gap_score_model_version varchar(32)  NOT NULL,
  skill_gap_score_payload       jsonb        NOT NULL DEFAULT '{}',
  skill_gap_score_computed_at   timestamptz  NOT NULL DEFAULT now(),
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_succession_readiness_horizon_check') THEN
    ALTER TABLE sys.sys_succession_readiness_scores
      ADD CONSTRAINT sys_succession_readiness_horizon_check
      CHECK (succession_readiness_score_horizon IN ('READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS','NOT_READY'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_succession_readiness_value_check') THEN
    ALTER TABLE sys.sys_succession_readiness_scores
      ADD CONSTRAINT sys_succession_readiness_value_check
      CHECK (succession_readiness_score_value >= 0 AND succession_readiness_score_value <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_skill_gap_segment_check') THEN
    ALTER TABLE sys.sys_skill_gap_scores
      ADD CONSTRAINT sys_skill_gap_segment_check
      CHECK (skill_gap_score_segment IN ('ALIGNED','MINOR_GAP','MODERATE_GAP','MAJOR_GAP'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_skill_gap_value_check') THEN
    ALTER TABLE sys.sys_skill_gap_scores
      ADD CONSTRAINT sys_skill_gap_value_check
      CHECK (skill_gap_score_value >= 0 AND skill_gap_score_value <= 100);
  END IF;
END
$cs$;

-- "active score = latest computed_at" reads (DISTINCT ON (user[,position])).
CREATE INDEX IF NOT EXISTS sys_succession_readiness_user_idx
  ON sys.sys_succession_readiness_scores (succession_readiness_score_user_id, succession_readiness_score_position_id, succession_readiness_score_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_succession_readiness_tenant_idx
  ON sys.sys_succession_readiness_scores (succession_readiness_score_tenant_id);
CREATE INDEX IF NOT EXISTS sys_skill_gap_user_idx
  ON sys.sys_skill_gap_scores (skill_gap_score_user_id, skill_gap_score_computed_at DESC);
CREATE INDEX IF NOT EXISTS sys_skill_gap_tenant_idx
  ON sys.sys_skill_gap_scores (skill_gap_score_tenant_id);

-- Reconciliation registry: in-platform-derived analytics → EXCLUDE / bucket D
-- (mirrors sys_flight_risk_scores / embedding sidecars). Keep 0 UNCLASSIFIED.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket, reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source, reconciliation_registry_rationale)
VALUES
  ('sys_succession_readiness_scores', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — in-platform-derived analytics (cap③ data-mining slice B succession-readiness, mig 000092). Per (user,target-position) readiness recomputed from live sys.* features + ② embeddings via a documented weighted rule; never imported from legacy.]'),
  ('sys_skill_gap_scores', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — in-platform-derived analytics (cap③ data-mining slice C skill-gap, mig 000092). Per-subject current-role skill-gap recomputed from ② profile embeddings + evidence sparsity via a documented rule; never imported from legacy.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000092: expected 0 UNCLASSIFIED after registering the P2 score tables, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000092: succession-readiness + skill-gap score tables created + registered EXCLUDE; reconciliation registry 0 UNCLASSIFIED.';
END $rc$;
