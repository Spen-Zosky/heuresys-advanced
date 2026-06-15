-- ============================================================================
-- Migration 000123 — T1.2: ESCO occupation -> skill requirements (1 table)
-- ----------------------------------------------------------------------------
-- Spec: docs/integrations/tenant_onboarding_esco_03_esco_population_spec_2026-06-15.md §2.
-- Renders queryable from the DB the legacy ESCO occupation->skill relation (until now only
-- a non-imported legacy dump). Feeds skill-portfolio-from-occupation (FASE 3-ESCO) and the
-- "Skills Group Share" analytics chart. The catalog is GLOBAL / tenant-less (ESCO is a public
-- taxonomy, not per-organization data) -> occupation_skill_req_is_global DEFAULT true, NO
-- tenant column / NO tenant FK (I5 = FK + middleware filter, NEVER RLS — and here there is
-- simply no tenant dimension). Synthetic no-PII case-study source (I12 / ADR-0023).
-- ----------------------------------------------------------------------------
-- Resolution paths (verified live S990, 100% resolution against the current catalog):
--   SKILL:      sys.sys_skills.skill_code = 'OLDDB::esco_skills::' || <dump.skill_id>
--               -> sys_skills.skill_id (uuid) + sys_skills.skill_esco_uri (both non-null on all
--                  14011 OLDDB-prefixed skills). FK ON DELETE SET NULL: if a skill is later
--                  removed, the relation row survives carrying the ESCO skill URI (the catalog
--                  fact outlives the local skill row) — occupation_skill_req_skill_esco_uri NOT NULL.
--   OCCUPATION: legacy esco_occupations.id -> its `uri` column (1:1, 3040 occupations).
--   RELATION:   legacy 'essential' -> 'ESSENTIAL', 'optional' -> 'OPTIONAL' (RD-08 varchar+CHECK).
-- The 126051-row IMPORT itself lives in the companion seed
--   db/seeds/reconciliation/52_occupation_skill_requirements.sql (loads both committed dumps into
--   a guarded public.esco_* staging area, INSERT ... SELECT ... ON CONFLICT DO NOTHING, then
--   DROPs the staging tables — no public pollution left behind). Expected: 67600 ESSENTIAL +
--   58451 OPTIONAL = 126051, 0 dropped (full distinct (occupation_uri, skill_esco_uri) key).
-- ----------------------------------------------------------------------------
-- Conventions mirror 000064 (the org-unit-template IMPORT layer) + 000121: sys.sys_<plural>;
--   column prefix occupation_skill_req_; PK uuid DEFAULT gen_random_uuid(); jsonb metadata;
--   updated_at + sys_set_updated_at trigger (mutable). Idempotent: CREATE TABLE/INDEX IF NOT
--   EXISTS + guarded ADD CONSTRAINT + guarded TRIGGER + registry INSERT ... ON CONFLICT DO
--   NOTHING. Twice-run = empty pg_dump diff. Applied under `psql -1 -f` (single implicit txn).
-- Authored: 2026-06-15 (T1.2, ESCO/tenant-onboarding workstream).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_occupation_skill_requirements (
  occupation_skill_requirement_id     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_skill_req_occupation_uri text        NOT NULL,
  occupation_skill_req_skill_id       uuid,
  occupation_skill_req_skill_esco_uri text        NOT NULL,
  occupation_skill_req_relation       varchar(16) NOT NULL,
  occupation_skill_req_is_global      boolean     NOT NULL DEFAULT true,
  occupation_skill_req_metadata       jsonb,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_osr_relation_check') THEN
    ALTER TABLE sys.sys_occupation_skill_requirements ADD CONSTRAINT sys_osr_relation_check CHECK (
      occupation_skill_req_relation IN ('ESSENTIAL','OPTIONAL'));  -- RD-08: varchar+CHECK, NEVER ENUM
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_osr_updated_after') THEN
    ALTER TABLE sys.sys_occupation_skill_requirements ADD CONSTRAINT sys_osr_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_osr_skill_fk') THEN
    ALTER TABLE sys.sys_occupation_skill_requirements ADD CONSTRAINT sys_osr_skill_fk
      FOREIGN KEY (occupation_skill_req_skill_id) REFERENCES sys.sys_skills(skill_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_occ_skill') THEN
    ALTER TABLE sys.sys_occupation_skill_requirements ADD CONSTRAINT uq_occ_skill
      UNIQUE (occupation_skill_req_occupation_uri, occupation_skill_req_skill_esco_uri);
  END IF;
END;
$cs$;

CREATE INDEX IF NOT EXISTS sys_occ_skill_req_occ_idx   ON sys.sys_occupation_skill_requirements (occupation_skill_req_occupation_uri);
CREATE INDEX IF NOT EXISTS sys_occ_skill_req_skill_idx ON sys.sys_occupation_skill_requirements (occupation_skill_req_skill_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_occupation_skill_requirements_set_updated_at') THEN
    CREATE TRIGGER sys_occupation_skill_requirements_set_updated_at BEFORE UPDATE ON sys.sys_occupation_skill_requirements
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000064 §4).
-- This is the NEW IMPORT target for the ESCO occupation->skill relation -> bucket A / IMPORT.
-- (sys_position_skill_requirements stays REFERENCE_ONLY; occupation-level != position-level,
--  spec §2.2 — semantic decision is Enzo's authority; this row records the new IMPORT table.)
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry (
  reconciliation_registry_table_name,
  reconciliation_registry_bucket,
  reconciliation_registry_declared_status,
  reconciliation_registry_legacy_source,
  reconciliation_registry_legacy_source_rows,
  reconciliation_registry_rationale
) VALUES (
  'sys_occupation_skill_requirements',
  'A',
  'IMPORT',
  'esco_occupation_skills',
  126051,
  '[sign-off: IMPORT — ESCO occupation->skill requirements (essential/optional). Source legacy '
  || 'public.esco_occupation_skills (126051 rows) resolved to sys_skills via skill_code '
  || 'OLDDB::esco_skills:: + esco_occupations.uri. GLOBAL/tenant-less catalog. Populated by '
  || 'db/seeds/reconciliation/52_occupation_skill_requirements.sql (T1.2, mig 000123).]'
)
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000123: expected 0 UNCLASSIFIED after registering the IMPORT table, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-condition (idempotent): assert the import table exists + is registered.
-- ============================================================================
DO $$
DECLARE n_tables int; n_reg int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r' AND c.relname = 'sys_occupation_skill_requirements';
  IF n_tables <> 1 THEN
    RAISE EXCEPTION '000123: expected sys_occupation_skill_requirements to exist, found %', n_tables;
  END IF;
  SELECT count(*) INTO n_reg FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name = 'sys_occupation_skill_requirements'
     AND reconciliation_registry_bucket = 'A';
  IF n_reg <> 1 THEN
    RAISE EXCEPTION '000123: expected sys_occupation_skill_requirements registered as bucket A, found %', n_reg;
  END IF;
  RAISE NOTICE '000123: ESCO occupation->skill requirements OK — table present + registered A/IMPORT.';
END $$;
