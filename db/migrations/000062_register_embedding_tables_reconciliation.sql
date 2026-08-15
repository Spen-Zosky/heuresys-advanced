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

-- [S1043] Le quattro tabelle del ciclo di valutazione (mig 000256) e una lacuna
-- preesistente. Registrate QUI e non dopo la migrazione che le crea, per la stessa
-- ragione gia' scritta sopra per `sys_advisor_suggestions`: il controllo gira in
-- questo file, e su un clone di CI una tabella VUOTA risolve UNCLASSIFIED.
--
-- Tre delle quattro hanno una sorgente legacy vera e si classificano IMPORT; la
-- quarta no, ed e' una scelta dichiarata: i 17 cicli di review del legacy sono tutti
-- «Test Auth Cycle» in stato draft, cioe' artefatti di collaudo, e importarli
-- sarebbe stato portare dentro spazzatura.
--
-- Con loro si chiude anche `sys_auth_password_reset_tokens`, che UNCLASSIFIED lo era
-- gia' — su produzione e' vuota perche' nessuno ha mai chiesto un reset, e su CI
-- risolveva POPULATED grazie a residui di test. E' lo STESSO difetto documentato
-- sopra per `sys_auth_mfa_factors`: una classificazione strutturale che sopravvive
-- solo finche' qualcuno usa la funzione non e' una classificazione.
INSERT INTO sys.sys_reconciliation_registry (
  reconciliation_registry_table_name, reconciliation_registry_bucket,
  reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
  reconciliation_registry_rationale)
VALUES
  ('sys_review_cycles', 'D', 'EXCLUDE', NULL,
   '[S1043] Ciclo di valutazione (mig 000256). Modellato ex-novo: i 17 review_cycles del legacy sono tutti «Test Auth Cycle» in stato draft, artefatti di collaudo, e non sono stati importati. Nessuna sorgente legacy, quindi non e'' un bersaglio di riconciliazione.'),
  ('sys_calibration_sessions', 'A', 'IMPORT', 'calibration_sessions (86 nel legacy; 35 importate = quelle di RTL Bank, le altre 51 sono SmartFood/EcoNova/Heuresys e restano fuori per I21)',
   '[S1043] Sessioni di calibrazione, importate dal legacy dalla mig 000257 con provenienza in sys_source_lineage_records.'),
  ('sys_calibration_participants', 'A', 'IMPORT', 'calibration_participants (30 nel legacy; 20 importati = RTL Bank)',
   '[S1043] Partecipanti alle sessioni di calibrazione, importati dalla mig 000257.'),
  ('sys_user_delegations', 'D', 'EXCLUDE', NULL,
   '[S1061] #99 F6b — le deleghe (mig 000314), il quarto dominio funzionale di ADR-0036. Nessuna sorgente legacy: l''istituto non esiste nel vecchio sistema (verificato: nessuna colonna deleg/substitut/stand_in/proxy) e I12 vieta comunque di importare. Registrata QUI e non dopo la 000314 che crea la tabella, per la ragione gia'' scritta sopra: il controllo gira in QUESTO file, e la tabella nasce vuota su ogni database — la prova generale l''ha infatti fatta arrossare alla SECONDA passata, che e'' l''unica in cui il difetto si vede.'),
  ('sys_calibration_discussions', 'A', 'IMPORT', 'calibration_discussions (60 nel legacy; 40 importate = RTL Bank)',
   '[S1043] Discussioni di calibrazione con voto prima/dopo, importate dalla mig 000257.'),
  ('sys_auth_password_reset_tokens', 'D', 'EXCLUDE', NULL,
   '[S1043] Token di reimpostazione password: dato di runtime generato dall''applicazione, a vita breve, senza alcuna sorgente legacy. Era UNCLASSIFIED da sempre e non si vedeva perche'' sul clone di CI i residui dei test la lasciavano POPULATED — la stessa cecita'' descritta sopra per sys_auth_mfa_factors.'),
  ('sys_auth_mfa_exemption_eligible_users', 'D', 'EXCLUDE', NULL,
   '[S1049] Elenco nominativo degli account che possono ricevere un''esenzione MFA (mig 000284, #139). Nasce e resta VUOTO finche'' non esiste un account headless legittimo: nessuna sorgente legacy, nessun bersaglio di riconciliazione. Registrata QUI e non dopo la 000284 per la ragione gia'' scritta sopra per sys_auth_mfa_factors e sys_user_timeline_events — questo controllo gira PRIMA di qualunque file di numero superiore, quindi una tabella nuova non registrata in questo file fa fallire la catena alla PASSATA SUCCESSIVA, non alla prima. E'' esattamente cosi'' che si e'' manifestata: la prova generale su clone di CI era verde (alla sua unica passata la tabella non esisteva ancora quando la 000062 e'' stata valutata), e la catena e'' caduta al giro dopo, in produzione.'),
  -- [S1050] Le quattro tabelle del FASCICOLO di configurazione (#131 Tenant
  -- Builder P1, mig 000299). Stessa ragione di tutte le righe qui sopra: il
  -- controllo che pretende 0 UNCLASSIFIED gira in QUESTO file, quindi una
  -- tabella nuova va registrata qui e non dopo la migrazione che la crea.
  -- Intercettate dalla prova generale prima del push, non dalla CI dopo.
  ('sys_tenant_blueprints', 'D', 'EXCLUDE', NULL,
   '[S1050] Il fascicolo di configurazione di un''azienda (#131, mig 000299): identita'' del fascicolo, tenant facoltativo (un fascicolo puo'' esistere PRIMA dell''azienda, durante una trattativa). Configurazione decisa dalla piattaforma, nessuna sorgente legacy: il legacy heuresys-evo non ha alcuna nozione di fascicolo di configurazione.'),
  ('sys_tenant_blueprint_versions', 'D', 'EXCLUDE', NULL,
   '[S1050] Le versioni del fascicolo (#131, mig 000299), con la carta d''identita'' dell''azienda e il ciclo DRAFT -> IN_APPROVAL -> APPROVED -> APPLIED. Dato generato dalla piattaforma, nessuna sorgente legacy.'),
  ('sys_tenant_blueprint_process_decisions', 'D', 'EXCLUDE', NULL,
   '[S1050] Le decisioni ESPLICITE su ciascun processo del modello (#131, mig 000299): solo gli scostamenti, perche'' il silenzio significa «come dice il modello». Dato generato dalla piattaforma, nessuna sorgente legacy.'),
  ('sys_tenant_blueprint_snapshots', 'D', 'EXCLUDE', NULL,
   '[S1050] La fotografia immutabile scattata all''approvazione di una versione del fascicolo (#131, mig 000299). E'' una PROVA, protetta da un trigger che rifiuta UPDATE e DELETE. Dato generato dalla piattaforma, nessuna sorgente legacy.')
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
