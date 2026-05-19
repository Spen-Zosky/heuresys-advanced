-- =============================================================================
-- 000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql
-- Heuresys Advanced — Goal 003 Items D + M (CP-v2-1 file structure: 2 Parts)
-- -----------------------------------------------------------------------------
-- Part 1 (Item D, P4): brownfield.tenant_id_mappings table + Wave 1 seed rows.
-- Part 2 (Item M, P7): brownfield.validate_lookup_fk_payload() SQL function +
--                     INSERT trigger on brownfield.column_mappings.
--
-- Both Parts ship in a single migration per PROMPT v2 §6 file-naming
-- requirement + counter-proposal CP-v2-1 accepted in APPROVAL 003.
--
-- =============================================================================
-- PART 1 — brownfield.tenant_id_mappings (Item D, forward investment)
-- =============================================================================
--
-- Rationale (PROMPT v2 §1.1 P4 + Goal 003 EXEC step 0.8 evidence):
--   - tenant_metadata jsonb does NOT contain legacy_id key (0/2 tenancies)
--   - user_metadata jsonb does NOT contain legacy_id key (0/163 users)
--   → Item A primary jsonb-convention path is DEAD-CODE in Goal 003.
--     Active path is FALLBACK-ONLY via this table (legacy_tenant_id) +
--     sys.sys_users.user_email (legacy_user_id).
--
-- Schema:
--   legacy_id varchar PRIMARY KEY: the legacy UUID (or other identifier) from
--                                   legacy_mirror source tables' tenant_id column.
--   canonical_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id):
--                                   the target sys.* canonical tenancy.
--   notes text: human documentation of mapping reason.
--   created_at timestamptz DEFAULT now(): audit timestamp.
--
-- Seed strategy for Goal 003 (single-tenant Wave 1 scope):
--   4 distinct legacy_tenant_id values observed in legacy_mirror Wave 1 sources
--   (competencies + courses + certifications + learning_paths cross-checked):
--     0c54b84a-db6e-4da4-bc91-af5d480d524e
--     1d7bf448-ceac-4215-917d-45ff13678104
--     d5855519-3ed1-4427-865f-fe75f1e42c4c
--     fb1e866c-e90a-4e25-a146-f68d660a0be8
--   All 4 map to RTL_BANK_REFERENCE.tenant_id in Goal 003 (only canonical
--   tenancy with status='ACTIVE' present; SmartFood/EcoNova/Heuresys System
--   tenancies created in Goal 004 Wave 2). Goal 004 reconciliation will
--   UPDATE these mappings to per-tenant canonical IDs as the other 3
--   tenancies are created.
--
-- Idempotency: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT DO NOTHING.
-- Reversibility:
--   DROP TABLE IF EXISTS brownfield.tenant_id_mappings;  -- removes seed too
-- =============================================================================

CREATE TABLE IF NOT EXISTS brownfield.tenant_id_mappings (
  legacy_id           varchar(255) PRIMARY KEY,
  canonical_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  notes               text,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE brownfield.tenant_id_mappings IS
  'Goal 003 Item D (forward investment): maps legacy source tenant IDs to canonical sys.sys_tenancies.tenant_id. Wave 1 (Goal 003) seeds all 4 observed legacy IDs → RTL_BANK_REFERENCE. Wave 2 (Goal 004) reconciles per-tenant as SmartFood/EcoNova/Heuresys System tenancies are created.';

COMMENT ON COLUMN brownfield.tenant_id_mappings.legacy_id IS
  'Legacy UUID (string form) from legacy_mirror.<table>.tenant_id column. PK = idempotent INSERT key.';

COMMENT ON COLUMN brownfield.tenant_id_mappings.canonical_tenant_id IS
  'Canonical sys.sys_tenancies.tenant_id resolved via this mapping.';

-- Seed Wave 1 mappings: all 4 legacy tenant_ids → RTL_BANK_REFERENCE
-- (RTL_BANK_REFERENCE.tenant_id resolved at INSERT time via subquery —
--  safer than hardcoding UUID since downstream environments may differ).
INSERT INTO brownfield.tenant_id_mappings (legacy_id, canonical_tenant_id, notes)
SELECT
  v.legacy_id,
  (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code='RTL_BANK_REFERENCE'),
  'Goal 003 Wave 1 seed: all legacy tenants point to RTL_BANK_REFERENCE in single-tenant scope. Goal 004 Wave 2 will reconcile to per-tenant canonical IDs once SmartFood/EcoNova/Heuresys System tenancies are created.'
FROM (VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e'),
  ('1d7bf448-ceac-4215-917d-45ff13678104'),
  ('d5855519-3ed1-4427-865f-fe75f1e42c4c'),
  ('fb1e866c-e90a-4e25-a146-f68d660a0be8')
) AS v(legacy_id)
ON CONFLICT (legacy_id) DO NOTHING;

-- =============================================================================
-- PART 2 — brownfield.validate_lookup_fk_payload() + INSERT trigger
-- (Item M, P7, CP2 accepted)
-- =============================================================================
--
-- Closes U-2026-05-19-01 cross-check at DB level: any future INSERT of a
-- LOOKUP_FK column_mapping with a malformed (target_table, match_on) payload
-- raises a trigger EXCEPTION before the row lands.
--
-- Accepted payload forms (returns true):
--   (a) Literal column existing on sys.<target_table>           e.g., (sys_skills, skill_name)
--   (b) Expression <col>_metadata->>'<key>' where <col>_metadata is jsonb
--                                                                e.g., (sys_learning_modules, learning_module_metadata->>'legacy_id')
--   (c) Form legacy_<X>_id where sys.<target>.<X>_metadata is jsonb
--                                                                e.g., (sys_skills, legacy_skill_id) — deferred to Goal 004+ when data populates
--   (d) Goal 003 Item A scope-locked fallback pairs:             (sys_tenancies, legacy_tenant_id), (sys_users, legacy_user_id)
--
-- Rejects everything else (raises detailed EXCEPTION with the offending values).
--
-- Idempotency: CREATE OR REPLACE FUNCTION; DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- Reversibility:
--   DROP TRIGGER IF EXISTS brownfield_column_mappings_lookup_fk_validate ON brownfield.column_mappings;
--   DROP FUNCTION IF EXISTS brownfield.validate_lookup_fk_payload_trigger();
--   DROP FUNCTION IF EXISTS brownfield.validate_lookup_fk_payload(varchar, varchar);
-- =============================================================================

CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_payload(
  p_target_table varchar,
  p_match_on     varchar
) RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_entity_name  varchar;
  v_metadata_col varchar;
  v_col_exists   boolean;
BEGIN
  -- Reject NULL payload fields upfront
  IF p_target_table IS NULL OR p_match_on IS NULL THEN
    RETURN false;
  END IF;

  -- Form (a): literal column existing on sys.<target_table>
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sys'
       AND table_name   = p_target_table
       AND column_name  = p_match_on
  ) INTO v_col_exists;
  IF v_col_exists THEN
    RETURN true;
  END IF;

  -- Form (b): expression <col>_metadata->>'<key>' where <col>_metadata is jsonb
  IF p_match_on ~ '^[a-z_][a-z0-9_]*->>''[a-z_][a-z0-9_]*''$' THEN
    v_metadata_col := substring(p_match_on FROM '^([a-z_][a-z0-9_]*)->>');
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'sys'
         AND table_name   = p_target_table
         AND column_name  = v_metadata_col
         AND data_type    IN ('jsonb', 'json')
    ) INTO v_col_exists;
    IF v_col_exists THEN
      RETURN true;
    END IF;
  END IF;

  -- Form (c): legacy_<X>_id where sys.<target>.<X>_metadata is jsonb
  -- (deferred primary path; accepted at validation level for future Goal 004+ usage)
  IF p_match_on ~ '^legacy_[a-z_][a-z0-9_]*_id$' THEN
    v_entity_name := substring(p_match_on FROM '^legacy_([a-z_][a-z0-9_]*)_id$');
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'sys'
         AND table_name   = p_target_table
         AND column_name  = (v_entity_name || '_metadata')
         AND data_type    IN ('jsonb', 'json')
    ) INTO v_col_exists;
    IF v_col_exists THEN
      RETURN true;
    END IF;
  END IF;

  -- Form (d): Goal 003 Item A scope-locked fallback pairs (FALLBACK-ONLY active path)
  IF (p_target_table = 'sys_tenancies' AND p_match_on = 'legacy_tenant_id')
     OR (p_target_table = 'sys_users'  AND p_match_on = 'legacy_user_id')
  THEN
    RETURN true;
  END IF;

  -- Otherwise reject
  RETURN false;
END;
$$;

COMMENT ON FUNCTION brownfield.validate_lookup_fk_payload(varchar, varchar) IS
  'Goal 003 Item M (CP2): validates LOOKUP_FK column_mapping payloads at DB level. Returns true if (target_table, match_on) resolves to (a) literal column on sys.<target>, (b) <col>_metadata->>''<key>'' jsonb-expr form, (c) legacy_<X>_id with sys.<target>.<X>_metadata jsonb (deferred primary path), or (d) Goal 003 Item A scope-locked fallback pairs. Used by INSERT trigger on brownfield.column_mappings.';

-- Trigger glue
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_payload_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_target_table varchar;
  v_match_on     varchar;
  v_valid        boolean;
BEGIN
  -- Trigger applies only to LOOKUP_FK rows; defensive check
  IF NEW.column_mapping_transform IS DISTINCT FROM 'LOOKUP_FK' THEN
    RETURN NEW;
  END IF;

  v_target_table := NEW.column_mapping_transform_payload->>'target_table';
  v_match_on     := NEW.column_mapping_transform_payload->>'match_on';

  v_valid := brownfield.validate_lookup_fk_payload(v_target_table, v_match_on);

  IF NOT v_valid THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'U-2026-05-19-01 LOOKUP_FK payload rejected: target_table=%L match_on=%L does not match any accepted form (literal column, jsonb-expr ->>, legacy_<X>_id with metadata, or Goal 003 Item A scope-locked fallback).',
        v_target_table, v_match_on
      ),
      HINT  = 'Either correct the payload to use an existing sys.<target_table> column, the <col>_metadata->>''legacy_id'' jsonb form, or — if intentional new fallback semantic — extend brownfield.validate_lookup_fk_payload() via a new migration.',
      ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION brownfield.validate_lookup_fk_payload_trigger() IS
  'Goal 003 Item M: BEFORE INSERT trigger glue. Extracts payload->target_table + match_on, calls validate_lookup_fk_payload(), raises EXCEPTION on false. Applies to brownfield.column_mappings rows with column_mapping_transform=LOOKUP_FK.';

-- DROP TRIGGER IF EXISTS pattern for idempotent re-apply
DROP TRIGGER IF EXISTS brownfield_column_mappings_lookup_fk_validate ON brownfield.column_mappings;

CREATE TRIGGER brownfield_column_mappings_lookup_fk_validate
  BEFORE INSERT ON brownfield.column_mappings
  FOR EACH ROW
  WHEN (NEW.column_mapping_transform = 'LOOKUP_FK')
  EXECUTE FUNCTION brownfield.validate_lookup_fk_payload_trigger();

-- =============================================================================
-- end of 000033_brownfield_tenant_id_mappings_and_validate_lookup_fk.sql
-- =============================================================================
