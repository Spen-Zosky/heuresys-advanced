-- ============================================================================
-- Migration 000100 — cap④ CMS P3: content↔blueprint cross-link (1 table)
-- ----------------------------------------------------------------------------
-- Associates a tenant-scoped content document (sys.sys_content_documents) with a
-- GLOBAL blueprint process step (sys.sys_blueprint_process_registry — the catalog
-- is platform-level, NOT tenant-scoped). The LINK row is owned by the content
-- document's tenant (I5 = FK + API middleware filter, NEVER RLS): two tenants may
-- each independently link THEIR doc to the SAME global process; the blueprint panel
-- is therefore tenant-filtered. One symmetric row surfaces on both sides
-- (doc → its blueprints, process → its documentation). link_role describes what the
-- doc IS to the process (RD-08 varchar+CHECK, never ENUM).
-- ----------------------------------------------------------------------------
-- Conventions mirror 000086: sys.sys_<plural>; prefix <entity>_<field>; PK uuid
--   DEFAULT gen_random_uuid(); tenant_id NOT NULL -> sys.sys_tenancies ON DELETE
--   RESTRICT (I5); person FK -> sys.sys_users ON DELETE SET NULL (I14); jsonb
--   metadata DEFAULT '{}'; updated_at + sys_set_updated_at trigger (mutable).
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT + guarded
--   TRIGGER + ON CONFLICT DO NOTHING. Twice-run = empty pg_dump diff.
-- Permission gate = existing content:update (attaching documentation is an edit to
--   the content side) — no new permission, no role-map seed.
-- Authored: 2026-06-09 (S980, cap④ CMS P3 BPM cross-link).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_content_blueprint_links (
  link_id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  link_tenant_id            uuid        NOT NULL,
  link_document_id          uuid        NOT NULL,
  link_blueprint_process_id uuid        NOT NULL,
  link_role                 varchar(32) NOT NULL DEFAULT 'documentation',
  link_note                 text,
  link_metadata             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  link_created_by           uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_role_check') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_role_check CHECK (
      link_role IN ('documentation','policy','procedure','reference'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_updated_after') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_tenant_fk') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_tenant_fk FOREIGN KEY (link_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_document_fk') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_document_fk FOREIGN KEY (link_document_id) REFERENCES sys.sys_content_documents(document_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_process_fk') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_process_fk FOREIGN KEY (link_blueprint_process_id) REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cbl_created_by_fk') THEN
    ALTER TABLE sys.sys_content_blueprint_links ADD CONSTRAINT sys_cbl_created_by_fk FOREIGN KEY (link_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

-- A (document, process) pair is linked at most once (directionality-agnostic).
CREATE UNIQUE INDEX IF NOT EXISTS sys_cbl_doc_process_uq ON sys.sys_content_blueprint_links (link_document_id, link_blueprint_process_id);
CREATE INDEX IF NOT EXISTS sys_cbl_tenant_idx  ON sys.sys_content_blueprint_links (link_tenant_id);
CREATE INDEX IF NOT EXISTS sys_cbl_process_idx ON sys.sys_content_blueprint_links (link_blueprint_process_id);
CREATE INDEX IF NOT EXISTS sys_cbl_document_idx ON sys.sys_content_blueprint_links (link_document_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_content_blueprint_links_set_updated_at') THEN
    CREATE TRIGGER sys_content_blueprint_links_set_updated_at BEFORE UPDATE ON sys.sys_content_blueprint_links
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000086 §4).
-- App-authored cross-link, NOT a legacy-import target -> EXCLUDE / bucket D.
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_content_blueprint_links', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored content<->blueprint cross-link (cap④ CMS P3, mig 000100). Created in-app via /v1/content-blueprint-links; no legacy source. Not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000100: expected 0 UNCLASSIFIED after registering link table, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-condition (idempotent): assert the link table exists.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r' AND c.relname = 'sys_content_blueprint_links';
  IF n_tables <> 1 THEN
    RAISE EXCEPTION '000100: expected sys_content_blueprint_links to exist, found %', n_tables;
  END IF;
  RAISE NOTICE '000100: content<->blueprint cross-link OK — table present + registered EXCLUDE.';
END $$;
