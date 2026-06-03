-- 000058_reconciliation_registry.sql
-- F1 of the reconciliation-closure cycle (spec docs/superpowers/specs/2026-06-03-reconciliation-closure-design.md §3).
-- Gives every sys.* table an explicit, queryable terminal status. Pure metadata: does NOT
-- touch any of the 65 business tables. Idempotent: CREATE ... IF NOT EXISTS + CREATE OR REPLACE.
-- RD-08: categorical = varchar(N) + CHECK, never ENUM. Audit cols + guarded updated_at trigger
-- mirror 000053. The 65 classified rows are loaded by db/seeds/reconciliation/04_registry.sql.

CREATE TABLE IF NOT EXISTS sys.sys_reconciliation_registry (
  reconciliation_registry_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_registry_table_name      varchar(255) NOT NULL,
  reconciliation_registry_bucket          varchar(1)   NOT NULL,
  reconciliation_registry_declared_status varchar(20)  NOT NULL,
  reconciliation_registry_legacy_source   varchar(255),
  reconciliation_registry_legacy_source_rows integer,
  reconciliation_registry_wall            text,
  reconciliation_registry_rationale       text         NOT NULL,
  reconciliation_registry_decided_at      timestamptz  NOT NULL DEFAULT now(),
  created_at                              timestamptz  NOT NULL DEFAULT now(),
  created_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                              timestamptz  NOT NULL DEFAULT now(),
  updated_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_reconciliation_registry_table_uq UNIQUE (reconciliation_registry_table_name)
);

ALTER TABLE sys.sys_reconciliation_registry
  DROP CONSTRAINT IF EXISTS sys_reconciliation_registry_bucket_check;
ALTER TABLE sys.sys_reconciliation_registry
  ADD CONSTRAINT sys_reconciliation_registry_bucket_check
  CHECK (reconciliation_registry_bucket IN ('A','B','C','D'));

ALTER TABLE sys.sys_reconciliation_registry
  DROP CONSTRAINT IF EXISTS sys_reconciliation_registry_status_check;
ALTER TABLE sys.sys_reconciliation_registry
  ADD CONSTRAINT sys_reconciliation_registry_status_check
  CHECK (reconciliation_registry_declared_status IN
         ('IMPORT','REFERENCE_ONLY','EXCLUDE','NO_SOURCE','NEEDS_DECISION'));

-- wall holds either a canonical wall slug or a free-text 'other:<desc>' (up to ~150 chars);
-- widen to text for DBs created before this fix (idempotent no-op on fresh DBs).
ALTER TABLE sys.sys_reconciliation_registry
  ALTER COLUMN reconciliation_registry_wall TYPE text;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='sys_reconciliation_registry_set_updated_at'
                 AND tgrelid='sys.sys_reconciliation_registry'::regclass) THEN
    CREATE TRIGGER sys_reconciliation_registry_set_updated_at BEFORE UPDATE
      ON sys.sys_reconciliation_registry FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- Status resolver: live EXISTS (cheap, stops at first row) + card classification + registry.
-- STABLE (reads tables). One row per sys base table (relkind='r').
CREATE OR REPLACE FUNCTION sys.fn_reconciliation_status()
RETURNS TABLE (
  table_name           text,
  has_rows             boolean,
  card_classification  text,
  declared_status      text,
  resolved_status      text,
  bucket               text,
  legacy_source        text,
  wall                 text,
  rationale            text
) LANGUAGE plpgsql STABLE AS $fn$
DECLARE r record; v_has boolean; v_card text; v_decl text; v_bucket text; v_src text; v_wall text; v_rat text;
BEGIN
  FOR r IN
    SELECT c.relname AS tname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sys' AND c.relkind = 'r'
      AND c.relname <> 'sys_reconciliation_registry'  -- the registry is metadata, not a reconciliation target
    ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM sys.%I LIMIT 1)', r.tname) INTO v_has;
    SELECT tm.table_mapping_classification INTO v_card
    FROM brownfield.table_mappings tm
    WHERE tm.table_mapping_target_schema = 'sys' AND tm.table_mapping_target_table = r.tname
    ORDER BY CASE tm.table_mapping_classification
               WHEN 'IMPORT' THEN 1 WHEN 'EXCLUDE' THEN 2 WHEN 'REFERENCE_ONLY' THEN 3 ELSE 4 END
    LIMIT 1;
    SELECT rr.reconciliation_registry_declared_status, rr.reconciliation_registry_bucket,
           rr.reconciliation_registry_legacy_source, rr.reconciliation_registry_wall,
           rr.reconciliation_registry_rationale
      INTO v_decl, v_bucket, v_src, v_wall, v_rat
    FROM sys.sys_reconciliation_registry rr
    WHERE rr.reconciliation_registry_table_name = r.tname;
    table_name := r.tname; has_rows := v_has; card_classification := v_card;
    declared_status := v_decl; bucket := v_bucket; legacy_source := v_src; wall := v_wall; rationale := v_rat;
    resolved_status := CASE
      WHEN v_has THEN 'POPULATED'
      WHEN v_card IS NOT NULL THEN v_card
      WHEN v_decl IS NOT NULL THEN v_decl
      ELSE 'UNCLASSIFIED' END;
    RETURN NEXT;
  END LOOP;
END $fn$;

CREATE OR REPLACE VIEW sys.v_reconciliation_status AS
  SELECT * FROM sys.fn_reconciliation_status();

DO $$
DECLARE v_total int; v_unclassified int; v_registry int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE resolved_status='UNCLASSIFIED')
    INTO v_total, v_unclassified FROM sys.v_reconciliation_status;
  SELECT count(*) INTO v_registry FROM sys.sys_reconciliation_registry;
  RAISE NOTICE '000058: % sys tables, % registry rows, % UNCLASSIFIED (0 after seed 04 loads the 65 rows)',
    v_total, v_registry, v_unclassified;
END $$;
