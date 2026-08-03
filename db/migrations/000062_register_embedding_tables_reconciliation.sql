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
--
-- [S982 amendment] + sys_auth_mfa_factors (bucket D / EXCLUDE): the table (mig
-- 000005) PREDATES the registry and was never registered — it resolved
-- POPULATED via test-leftover rows, masking the gap, until the strict S982
-- test cleanup emptied it and THIS migration's 0-UNCLASSIFIED assert tripped
-- on the full-chain re-run. The row must live HERE (not in a later migration):
-- on a fresh rebuild the table exists and is empty when this assert runs.

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
   '[sign-off: EXCLUDE — app-generated AI infra (D7-P0, mig 000060). Mean-pooled vector(1024) per user derived from skill-evidence (never a Voyage call); not a legacy-reconciliation target.]'),
  ('sys_auth_mfa_factors', 'D', 'EXCLUDE', NULL,
   '[S982] App-generated auth data: user-enrolled MFA factors (TOTP/WEBAUTHN/EMAIL_OTP/SMS_OTP secrets+metadata). No legacy source (legacy heuresys-evo has no MFA). Registered late via S982 amendment: the table (mig 000005) predates the registry and resolved POPULATED via test-leftover rows until the strict S982 cleanup exposed the missing row.'),
  ('sys_user_timeline_events', 'A', 'IMPORT', 'employee_timeline',
   '[S1041] D5 (#49) — consultive person history imported from legacy employee_timeline (wave-2). Registered here, in the same amendment pattern as sys_auth_mfa_factors above, because the table classification was originally written ONLY by db/scripts/import-d5-timeline.sh into brownfield.table_mappings. That script runs where the legacy data lives; on the CI clone the table exists (mig 000222) but stays EMPTY and unmapped, so this very DO block raised "expected 0 UNCLASSIFIED, found 1" and reddened Test (api integration) from e4acd6d7 onward. A structural classification must not depend on an import having run. Amending 000062 rather than adding a later migration is required: this check runs before any higher-numbered file could register the table.'),
  ('sys_advisor_suggestions', 'D', 'EXCLUDE', NULL,
   '[S1041] F4 (#58) — traccia di audit delle raccomandazioni prescrittive, derivate dalle scorecard F1/F2/F3 da un motore a regole. Dato generato dall''applicazione, nessuna sorgente legacy. Registrata QUI e non dopo la mig 000228 che crea la tabella, per la stessa ragione di sys_user_timeline_events sopra: il controllo gira in questo file, e sul clone di CI la tabella nasce VUOTA (nessuno chiama l''advisor durante le migration) — senza questa riga risolveva UNCLASSIFIED e arrossava Test (api integration). Una classificazione strutturale non deve dipendere dal fatto che qualcuno abbia usato la funzione.')
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
