-- @migrate: once
-- #164 F4 — questo file CREA oggetti dello schema `brownfield`, ritirato dalla
-- 000297. Senza il marcatore la catena lo ricreerebbe a ogni deploy e il ritiro
-- oscillerebbe (ADR-0035). Su un database nuovo gira comunque: il registro e' vuoto.
-- =============================================================================
-- 000043_lookup_fk_2hop_validator.sql
-- ADR-0017 (Cowork C9.2, SR_X9) — LOOKUP_FK_2HOP transform validator function
-- and trigger dispatch (LOOKUP_FK vs LOOKUP_FK_2HOP).
--
-- Spec authority: cowork_reserved/batch_c9/adr_0017_lookup_fk_2hop/01_ADR_0017_SPEC.md §7
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP+CREATE TRIGGER, twice-run safe.
-- =============================================================================

BEGIN;

-- §1 Validator function for LOOKUP_FK_2HOP payload
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_2hop_payload(
  p_payload jsonb, p_mapping_id uuid
)
RETURNS void AS $$
DECLARE
  _k text;
BEGIN
  IF p_payload->>'target_table' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing target_table (mapping=%)', p_mapping_id;
  END IF;
  IF p_payload->>'match_on' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing match_on (mapping=%)', p_mapping_id;
  END IF;
  IF p_payload->'lookup_2hop' IS NULL THEN
    RAISE EXCEPTION 'LOOKUP_FK_2HOP missing lookup_2hop block (mapping=%)', p_mapping_id;
  END IF;
  FOR _k IN SELECT unnest(ARRAY['intermediate_schema','intermediate_table','intermediate_match_col','intermediate_pk_col']) LOOP
    IF p_payload->'lookup_2hop'->>_k IS NULL THEN
      RAISE EXCEPTION 'LOOKUP_FK_2HOP lookup_2hop missing % (mapping=%)', _k, p_mapping_id;
    END IF;
  END LOOP;
END $$ LANGUAGE plpgsql;

-- §2 Dispatch function: route to validator by column_mapping_transform code.
-- LOOKUP_FK uses pre-existing brownfield.validate_lookup_fk_payload_trigger()
-- (mig 000033) which extracts target_table+match_on from JSONB and calls
-- the boolean-returning validate_lookup_fk_payload(varchar, varchar). The
-- dispatch invokes that existing trigger function by delegating to the same
-- code path; for LOOKUP_FK_2HOP it calls the new jsonb/uuid validator.
CREATE OR REPLACE FUNCTION brownfield.validate_lookup_fk_dispatch()
RETURNS TRIGGER AS $$
DECLARE
  v_target_table varchar;
  v_match_on     varchar;
  v_valid        boolean;
BEGIN
  IF NEW.column_mapping_transform = 'LOOKUP_FK' THEN
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
  ELSIF NEW.column_mapping_transform = 'LOOKUP_FK_2HOP' THEN
    PERFORM brownfield.validate_lookup_fk_2hop_payload(
      NEW.column_mapping_transform_payload, NEW.column_mapping_id
    );
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- §3 Replace existing trigger (from mig 000033) with dispatch logic
DROP TRIGGER IF EXISTS brownfield_column_mappings_lookup_fk_validate ON brownfield.column_mappings;
CREATE TRIGGER brownfield_column_mappings_lookup_fk_validate
  BEFORE INSERT ON brownfield.column_mappings
  FOR EACH ROW
  WHEN (NEW.column_mapping_transform IN ('LOOKUP_FK', 'LOOKUP_FK_2HOP'))
  EXECUTE FUNCTION brownfield.validate_lookup_fk_dispatch();

COMMENT ON FUNCTION brownfield.validate_lookup_fk_2hop_payload(jsonb, uuid) IS
  'ADR-0017 (X9 Block A) — validate LOOKUP_FK_2HOP payload field presence at registry INSERT.';
COMMENT ON FUNCTION brownfield.validate_lookup_fk_dispatch() IS
  'ADR-0017 (X9 Block A) — dispatch BEFORE INSERT trigger to LOOKUP_FK or LOOKUP_FK_2HOP validator.';

COMMIT;
