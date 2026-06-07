-- ============================================================================
-- Migration 000086 — cap④ CMS: Content domain (3 tables)
-- ----------------------------------------------------------------------------
-- Spec: docs/superpowers/specs/2026-06-07-cms-design.md §4. Sibling template:
--   000077_engagement_surveys_schema.sql (conventions verbatim).
-- Tenant-scoped, versioned, publishable content — DISTINCT from sys_user_documents
-- (person-owned private files). New sys.sys_content_* tables (spec D-3: reuse rejected):
--   1. sys.sys_content_categories  (flat tenant taxonomy; mutable -> updated_at + trigger)
--   2. sys.sys_content_documents   (authored head; mutable -> updated_at + trigger)
--   3. sys.sys_content_versions    (immutable row-per-version history; no updated_at/trigger)
-- ----------------------------------------------------------------------------
-- Conventions mirror 000077: sys.sys_<plural>; prefix <entity>_<field>; PK uuid
--   DEFAULT gen_random_uuid(); <entity>_tenant_id NOT NULL -> sys.sys_tenancies
--   ON DELETE RESTRICT (I5, NO RLS); person FK -> sys.sys_users ON DELETE SET NULL
--   (I14); natural key + UQ(tenant_id, natural_key); jsonb metadata DEFAULT '{}';
--   CHECK (RD-08, never ENUM); date/timestamptz (RD-09); updated_at + sys_set_updated_at
--   trigger ONLY on mutable. P1: flat taxonomy (parent_id reserved, D-4); markdown body
--   (D-1); status column present but publish-workflow is P2.
-- The documents<->versions circular FK (document_current_version_id) is added by ALTER
--   AFTER both tables exist.
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT + guarded TRIGGER.
-- Authored: 2026-06-07 (S975, cap④ CMS P1).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_content_categories  (flat tenant taxonomy; mutable)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_content_categories (
  category_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_tenant_id    uuid         NOT NULL,
  category_natural_key  varchar(512) NOT NULL,
  category_name         varchar(255) NOT NULL,
  category_slug         varchar(255),
  category_description   text,
  category_parent_id    uuid,        -- reserved for a future tree (D-4: P1 ships flat)
  category_is_system    boolean      NOT NULL DEFAULT false,
  category_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at           timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ccat_tenant_fk') THEN
    ALTER TABLE sys.sys_content_categories ADD CONSTRAINT sys_ccat_tenant_fk FOREIGN KEY (category_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ccat_parent_fk') THEN
    ALTER TABLE sys.sys_content_categories ADD CONSTRAINT sys_ccat_parent_fk FOREIGN KEY (category_parent_id) REFERENCES sys.sys_content_categories(category_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ccat_updated_after') THEN
    ALTER TABLE sys.sys_content_categories ADD CONSTRAINT sys_ccat_updated_after CHECK (updated_at >= created_at);
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_ccat_natural_key_uq ON sys.sys_content_categories (category_tenant_id, category_natural_key);
CREATE INDEX IF NOT EXISTS sys_ccat_tenant_idx ON sys.sys_content_categories (category_tenant_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_content_categories_set_updated_at') THEN
    CREATE TRIGGER sys_content_categories_set_updated_at BEFORE UPDATE ON sys.sys_content_categories
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §2 — sys.sys_content_documents  (authored head; mutable)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_content_documents (
  document_id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_tenant_id          uuid         NOT NULL,
  document_natural_key        varchar(512) NOT NULL,
  document_category_id        uuid,
  document_title              varchar(255) NOT NULL,
  document_slug               varchar(255),
  document_kind               varchar(32)  NOT NULL DEFAULT 'article',
  document_status             varchar(20)  NOT NULL DEFAULT 'draft',
  document_body               text,
  document_body_format        varchar(16)  NOT NULL DEFAULT 'markdown',
  document_current_version_id uuid,        -- FK to versions added by ALTER below (circular)
  document_author_user_id     uuid,
  document_published_at        timestamptz,
  document_published_by_user_id uuid,
  document_effective_date      date,
  document_expires_date        date,
  document_metadata           jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_kind_check') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_kind_check CHECK (
      document_kind IN ('article','policy','announcement','handbook','process_doc'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_status_check') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_status_check CHECK (
      document_status IN ('draft','in_review','published','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_format_check') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_format_check CHECK (
      document_body_format IN ('markdown','html'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_updated_after') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_tenant_fk') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_tenant_fk FOREIGN KEY (document_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_category_fk') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_category_fk FOREIGN KEY (document_category_id) REFERENCES sys.sys_content_categories(category_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_author_fk') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_author_fk FOREIGN KEY (document_author_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_published_by_fk') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_published_by_fk FOREIGN KEY (document_published_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_cdoc_natural_key_uq ON sys.sys_content_documents (document_tenant_id, document_natural_key);
CREATE INDEX IF NOT EXISTS sys_cdoc_tenant_idx   ON sys.sys_content_documents (document_tenant_id);
CREATE INDEX IF NOT EXISTS sys_cdoc_status_idx   ON sys.sys_content_documents (document_tenant_id, document_status);
CREATE INDEX IF NOT EXISTS sys_cdoc_kind_idx     ON sys.sys_content_documents (document_tenant_id, document_kind);
CREATE INDEX IF NOT EXISTS sys_cdoc_category_idx ON sys.sys_content_documents (document_category_id) WHERE document_category_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_content_documents_set_updated_at') THEN
    CREATE TRIGGER sys_content_documents_set_updated_at BEFORE UPDATE ON sys.sys_content_documents
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §3 — sys.sys_content_versions  (immutable row-per-version; NO updated_at/trigger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_content_versions (
  version_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  version_tenant_id    uuid         NOT NULL,
  version_document_id  uuid         NOT NULL,
  version_number       integer      NOT NULL,
  version_title        varchar(255),
  version_body         text,
  version_body_format  varchar(16)  NOT NULL DEFAULT 'markdown',
  version_author_user_id uuid,
  version_change_note  text,
  version_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cver_format_check') THEN
    ALTER TABLE sys.sys_content_versions ADD CONSTRAINT sys_cver_format_check CHECK (
      version_body_format IN ('markdown','html'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cver_number_pos') THEN
    ALTER TABLE sys.sys_content_versions ADD CONSTRAINT sys_cver_number_pos CHECK (version_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cver_tenant_fk') THEN
    ALTER TABLE sys.sys_content_versions ADD CONSTRAINT sys_cver_tenant_fk FOREIGN KEY (version_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cver_document_fk') THEN
    ALTER TABLE sys.sys_content_versions ADD CONSTRAINT sys_cver_document_fk FOREIGN KEY (version_document_id) REFERENCES sys.sys_content_documents(document_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cver_author_fk') THEN
    ALTER TABLE sys.sys_content_versions ADD CONSTRAINT sys_cver_author_fk FOREIGN KEY (version_author_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_cver_doc_number_uq ON sys.sys_content_versions (version_document_id, version_number);
CREATE INDEX IF NOT EXISTS sys_cver_tenant_idx ON sys.sys_content_versions (version_tenant_id);
CREATE INDEX IF NOT EXISTS sys_cver_document_idx ON sys.sys_content_versions (version_document_id);

-- §3 is immutable: no updated_at, no trigger.

-- Circular FK: documents.current_version_id -> versions.version_id (added after both exist).
DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cdoc_current_version_fk') THEN
    ALTER TABLE sys.sys_content_documents ADD CONSTRAINT sys_cdoc_current_version_fk FOREIGN KEY (document_current_version_id) REFERENCES sys.sys_content_versions(version_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

-- =====================================================================
-- §4 — Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000081).
--      App-authored tenant content, NOT a legacy-import target -> EXCLUDE / bucket D.
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_content_categories', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored tenant content taxonomy (cap④ CMS, mig 000086). Created in-app via /v1/content/categories; no legacy source. Not a reconciliation target.]'),
  ('sys_content_documents', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored tenant content (cap④ CMS, mig 000086). Knowledge-base/policy/announcement authored in-app via /v1/content; no legacy source. Not a reconciliation target.]'),
  ('sys_content_versions', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored content version history (cap④ CMS, mig 000086). Append-only edit log produced in-app; no legacy source. Not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000086: expected 0 UNCLASSIFIED after registering content tables, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-conditions (idempotent): assert the 3 base tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_content_categories','sys_content_documents','sys_content_versions');
  IF n_tables <> 3 THEN
    RAISE EXCEPTION '000086: expected 3 content base tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000086: CMS content schema OK — 3/3 base tables present + registered EXCLUDE.';
END $$;
