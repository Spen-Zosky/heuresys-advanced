-- db/seeds/sdbi/_template/01_temp_sdbi_ddl.sql  (SDBI template — Phase 3 DDL)
-- Copy to db/seeds/brownfield/sdbi/<AREA>/01_temp_sdbi_ddl.sql and replace <…> placeholders.
-- Reference implementation: db/seeds/brownfield/sdbi/goals_pilot/01_temp_sdbi_ddl.sql
--
-- temp_sdbi.<entity> is a NO-FK mirror of the target sys.sys_<plural>. It carries:
--   _legacy_source_id        — PK, the legacy row id (idempotency anchor)
--   _legacy_source_<fk>_id   — raw legacy FK pointers, resolved in Phase 5
--   _import_run_id           — the SDBI brownfield.import_runs row
--   <entity>_id              — the NEW uuid that lands in sys.* (DEFAULT gen_random_uuid())
--   <entity>_natural_key     — '<NK_PREFIX>::' || tenant::text || '::' || legacy_id::text
-- Idempotent: CREATE TABLE IF NOT EXISTS. Seed bundles MAY wrap their own BEGIN/COMMIT
-- (they are NOT applied by the migrate runner, so the no-inner-txn rule does not apply here).

BEGIN;

CREATE TABLE IF NOT EXISTS temp_sdbi.<ENTITY> (
  _legacy_source_id            uuid          NOT NULL,
  -- _legacy_source_<fk>_id     uuid,          -- one per legacy FK; resolved in Phase 5
  _import_run_id               uuid          NOT NULL,
  <ENTITY>_id                  uuid          NOT NULL DEFAULT gen_random_uuid(),
  <ENTITY>_tenant_id           uuid          NOT NULL,
  <ENTITY>_natural_key         varchar(512)  NOT NULL,
  -- ---- business columns (mirror the sys.sys_<plural> target, NO FK) -------------------
  -- <ENTITY>_<field>          <type>        [NOT NULL],
  -- ------------------------------------------------------------------------------------
  <ENTITY>_metadata            jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz   NOT NULL,
  updated_at                   timestamptz   NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_<ENTITY>_natural_key_idx ON temp_sdbi.<ENTITY> (<ENTITY>_natural_key);
CREATE INDEX IF NOT EXISTS temp_sdbi_<ENTITY>_tenant_idx      ON temp_sdbi.<ENTITY> (<ENTITY>_tenant_id);
-- CREATE INDEX IF NOT EXISTS temp_sdbi_<ENTITY>_legacy_<fk>_idx ON temp_sdbi.<ENTITY> (_legacy_source_<fk>_id);

COMMIT;
