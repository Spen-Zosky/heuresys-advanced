-- ============================================================================
-- Migration 000105 — cap④ CMS P3: content media attachments (object store)
-- ----------------------------------------------------------------------------
-- One row per uploaded binary attached to a content document. The BYTES live
-- OUTSIDE the DB in an object store behind a driver seam (local-disk default,
-- decided S980 — S3/MinIO becomes a config swap, no schema change): the row
-- carries the storage key + integrity metadata (sha256, size, mime).
--
--   • tenant FK RESTRICT (I5 — media is tenant-owned via its document)
--   • document FK CASCADE (deleting the doc removes the rows; the service
--     deletes the blobs first — see content/media-service.ts)
--   • uploaded_by FK SET NULL (I14 actor provenance, survives user deletion)
--   • mime/size guarded app-side (allowlist + max bytes); sha256 enables
--     integrity checks and future dedup
--
-- Permissions: NONE new — upload/delete = content:update, read = content:read
-- (media is part of the document, not a new resource).
-- Reconciliation registry: bucket D / EXCLUDE (app-uploaded binaries — no
-- legacy source) + 0-UNCLASSIFIED assertion.
-- Idempotent: twice-run = no-op. Authored: 2026-06-10 (S981, cap④ CMS P3 #9).
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_content_media (
  media_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  media_tenant_id    uuid         NOT NULL,
  media_document_id  uuid         NOT NULL,
  media_filename     varchar(255) NOT NULL,
  media_mime         varchar(127) NOT NULL,
  media_size_bytes   bigint       NOT NULL,
  media_sha256       char(64)     NOT NULL,
  -- driver-relative storage key (e.g. "<tenant>/<media_id>"); NEVER an absolute path.
  media_storage_key  text         NOT NULL,
  media_uploaded_by  uuid,
  created_at         timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_content_media_tenant_fk') THEN
    ALTER TABLE sys.sys_content_media
      ADD CONSTRAINT sys_content_media_tenant_fk
      FOREIGN KEY (media_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_content_media_document_fk') THEN
    ALTER TABLE sys.sys_content_media
      ADD CONSTRAINT sys_content_media_document_fk
      FOREIGN KEY (media_document_id) REFERENCES sys.sys_content_documents(document_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_content_media_uploader_fk') THEN
    ALTER TABLE sys.sys_content_media
      ADD CONSTRAINT sys_content_media_uploader_fk
      FOREIGN KEY (media_uploaded_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_content_media_size_check') THEN
    ALTER TABLE sys.sys_content_media
      ADD CONSTRAINT sys_content_media_size_check CHECK (media_size_bytes > 0);
  END IF;
END;
$cs$;

CREATE INDEX IF NOT EXISTS sys_content_media_document_idx
  ON sys.sys_content_media (media_document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sys_content_media_tenant_idx
  ON sys.sys_content_media (media_tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS sys_content_media_storage_key_uq
  ON sys.sys_content_media (media_storage_key);

-- Reconciliation registry (bucket D / EXCLUDE — app-uploaded binaries).
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_content_media', 'D', 'EXCLUDE',
   '[S981 cap4 CMS P3] Content media attachments — app-uploaded binaries in the object store (local-disk default, S3/MinIO config-swap); no legacy source.')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $pc$
DECLARE n int;
BEGIN
  IF to_regclass('sys.sys_content_media') IS NULL THEN
    RAISE EXCEPTION '000105: sys.sys_content_media missing';
  END IF;
  SELECT count(*) INTO n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n <> 0 THEN
    RAISE EXCEPTION '000105: % UNCLASSIFIED tables in the reconciliation view (expected 0)', n;
  END IF;
  RAISE NOTICE '000105: sys_content_media ready; registry row present.';
END;
$pc$;
