-- 000062_register_embedding_tables_reconciliation.sql
-- Restore the reconciliation-registry invariant "0 UNCLASSIFIED" after D7-P0 (mig 000060)
-- added 4 new sys.* tables. The pgvector embedding sidecar tables are APP-GENERATED AI
-- infrastructure (populated by the Voyage P1 backfill pipeline, gated on VOYAGE_API_KEY) —
-- NOT a legacy-reconciliation target. They are classified EXCLUDE / bucket D, mirroring the
-- existing sys_inbox_notifications EXCLUDE row (runtime/app-generated, not imported).
--
-- The view sys.v_reconciliation_status marks any sys.* table absent from this registry as
-- UNCLASSIFIED; registering these 4 rows flips them to EXCLUDE and re-establishes 0 UNCLASSIFIED.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (table_name) DO NOTHING. Second run inserts 0.
-- Applied by migrate.{sh,ps1} under psql -1 -f (no inner BEGIN/COMMIT).

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name,
   reconciliation_registry_bucket,
   reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_skill_embeddings', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated AI infra (D7-P0 pgvector substrate, mig 000060). One vector(1024) per sys_skills row, populated by the Voyage P1 backfill (gated VOYAGE_API_KEY); not a legacy-reconciliation target.]'),
  ('sys_esco_occupation_embeddings', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated AI infra (D7-P0, mig 000060). One vector(1024) per distinct ESCO occupation URI, embedded by the Voyage P1 pipeline; not a legacy-reconciliation target.]'),
  ('sys_job_role_embeddings', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated AI infra (D7-P0, mig 000060). One vector(1024) per sys_job_roles row, populated by the Voyage P1 backfill; not a legacy-reconciliation target.]'),
  ('sys_user_profile_embeddings', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated AI infra (D7-P0, mig 000060). Mean-pooled vector(1024) per user derived from skill-evidence (never a Voyage call); not a legacy-reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified
  FROM sys.v_reconciliation_status
  WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000062: expected 0 UNCLASSIFIED after registering embedding tables, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000062: 4 embedding tables registered EXCLUDE; reconciliation registry 0 UNCLASSIFIED restored.';
END $$;
