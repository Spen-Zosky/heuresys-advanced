-- 000460 — Il ricevimento di un pacchetto del datastore ha un registro, e un pacchetto ha un'identità (consolidamento C3).
--
-- PERCHE' ESISTE. ADR-0047: il datastore consegna un file con un manifesto (`heuresys.fascicolo.consegna/1`) che porta
-- l'identità dell'istanza — prototipo e numero del pacchetto nel datastore — e l'impronta del contenuto. Advanced finora non
-- conservava né l'una né l'altra: `sys_blueprint_content_packages` sapeva il prototipo ma non quale pacchetto, e nessuna
-- tabella diceva chi aveva caricato che cosa, quando, e con quale esito. Senza identità il secondo caricamento dello stesso
-- pacchetto non si riconosce (decisione 2 e 4 dell'architettura); senza registro un caricamento in produzione non lascia
-- traccia (decisione 7).
--
-- FA TRE COSE:
--   ① due colonne su `sys_blueprint_content_packages`: il numero del pacchetto nel datastore e la sua impronta
--     (sha256-json-canonico), nulle per i pacchetti caricati senza manifesto sulle copie di prova;
--   ② l'unicità di (prototipo, numero del pacchetto) dove il numero c'è: lo stesso pacchetto non entra due volte;
--   ③ la tabella `sys_blueprint_content_receipts`, una riga per ogni ricevimento con un manifesto verificato:
--     CARICATO, GIA_PRESENTE (stessa identità, stessa impronta: zero righe nuove) o RIFIUTATO (stessa identità, impronta
--     diversa: il datastore ha cambiato un pacchetto già consegnato, e advanced non lo sovrascrive).
--     Un manifesto che non si verifica NON lascia righe: il rifiuto avviene prima di toccare il database.
--
-- CHI SCRIVE: solo il caricatore (`db/scripts/pacchetto/accogli-pacchetto.mjs ricevi`). Nessuna rotta API.
-- CLASSIFICAZIONE E REGISTRO: la tabella nuova è classificata in 000429 e registrata in 000062, file di numero minore:
--   registrarla solo qui sarebbe verde alla prima passata e rosso alla seconda (lo stesso schema della 000462).
-- IDEMPOTENTE: IF NOT EXISTS ovunque. NESSUNA CANCELLAZIONE, nessun dato scritto.
-- INVERSA, FUORI CATENA: db/scripts/pacchetto/inversa-000460.sql (si rifiuta se il registro ha righe).
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ── ① l'identità del pacchetto ─────────────────────────────────────────────────────────
ALTER TABLE sys.sys_blueprint_content_packages
  ADD COLUMN IF NOT EXISTS blueprint_content_package_package_version integer;
ALTER TABLE sys.sys_blueprint_content_packages
  ADD COLUMN IF NOT EXISTS blueprint_content_package_hash varchar(64);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_packages_package_version_ck') THEN
    ALTER TABLE sys.sys_blueprint_content_packages ADD CONSTRAINT sys_blueprint_content_packages_package_version_ck
      CHECK (blueprint_content_package_package_version IS NULL OR blueprint_content_package_package_version >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_content_packages_hash_ck') THEN
    ALTER TABLE sys.sys_blueprint_content_packages ADD CONSTRAINT sys_blueprint_content_packages_hash_ck
      CHECK (blueprint_content_package_hash IS NULL OR blueprint_content_package_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

-- ── ② lo stesso pacchetto non entra due volte ──────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_content_packages_identity_uq
  ON sys.sys_blueprint_content_packages (blueprint_content_package_prototype_ref, blueprint_content_package_package_version)
  WHERE blueprint_content_package_package_version IS NOT NULL;

-- ── ③ il registro dei ricevimenti ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_content_receipts (
  blueprint_content_receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_content_receipt_prototype_ref varchar(64) NOT NULL,
  blueprint_content_receipt_package_version integer NOT NULL,
  blueprint_content_receipt_hash varchar(64) NOT NULL,
  blueprint_content_receipt_schema_version varchar(48) NOT NULL,
  blueprint_content_receipt_variant_version_id uuid
    REFERENCES sys.sys_blueprint_variant_versions(blueprint_variant_version_id) ON DELETE SET NULL,
  blueprint_content_receipt_outcome varchar(16) NOT NULL,
  blueprint_content_receipt_reason text,
  blueprint_content_receipt_correlation uuid,
  blueprint_content_receipt_delivered_at timestamptz,
  blueprint_content_receipt_delivered_by varchar(120),
  blueprint_content_receipt_received_by varchar(80) NOT NULL DEFAULT current_user,
  blueprint_content_receipt_received_at timestamptz NOT NULL DEFAULT now(),
  blueprint_content_receipt_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sys_blueprint_content_receipts_outcome_ck
    CHECK (blueprint_content_receipt_outcome IN ('CARICATO', 'GIA_PRESENTE', 'RIFIUTATO')),
  CONSTRAINT sys_blueprint_content_receipts_hash_ck
    CHECK (blueprint_content_receipt_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT sys_blueprint_content_receipts_package_version_ck
    CHECK (blueprint_content_receipt_package_version >= 1),
  -- un caricamento riuscito dice sempre in quale versione del modello è finito
  CONSTRAINT sys_blueprint_content_receipts_loaded_has_version_ck
    CHECK (blueprint_content_receipt_outcome <> 'CARICATO' OR blueprint_content_receipt_variant_version_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS sys_blueprint_content_receipts_identity_idx
  ON sys.sys_blueprint_content_receipts (blueprint_content_receipt_prototype_ref, blueprint_content_receipt_package_version);
CREATE INDEX IF NOT EXISTS sys_blueprint_content_receipts_version_idx
  ON sys.sys_blueprint_content_receipts (blueprint_content_receipt_variant_version_id);

COMMENT ON TABLE sys.sys_blueprint_content_receipts IS
  '000460 (consolidamento C3, ADR-0047) — un ricevimento per riga: chi ha caricato quale pacchetto del datastore (prototipo, '
  'numero, impronta), quando, con quale correlazione, e con quale esito. Lo scrive solo il caricatore.';
COMMENT ON COLUMN sys.sys_blueprint_content_packages.blueprint_content_package_package_version IS
  '000460 (C3) — il numero del pacchetto nel datastore, dal manifesto di consegna. Nullo per un pacchetto caricato senza manifesto su una copia di prova.';
COMMENT ON COLUMN sys.sys_blueprint_content_packages.blueprint_content_package_hash IS
  '000460 (C3) — l''impronta sha256-json-canonico del pacchetto, verificata contro il manifesto al ricevimento.';

COMMIT;

-- ============================================================================================
-- POST-CONDIZIONI
-- ============================================================================================
DO $$
DECLARE n_col int; n_idx int; n_cl int; n_rr int; n_dup int;
BEGIN
  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema = 'sys' AND table_name = 'sys_blueprint_content_packages'
     AND column_name IN ('blueprint_content_package_package_version', 'blueprint_content_package_hash');
  IF n_col <> 2 THEN
    RAISE EXCEPTION '000460: sys_blueprint_content_packages ha % delle 2 colonne nuove', n_col;
  END IF;

  SELECT count(*) INTO n_idx FROM pg_indexes
   WHERE schemaname = 'sys' AND indexname = 'sys_blueprint_content_packages_identity_uq';
  IF n_idx <> 1 THEN
    RAISE EXCEPTION '000460: manca l''unicità di (prototipo, numero del pacchetto)';
  END IF;

  -- nessun pacchetto già presente viola la nuova identità (oggi le colonne nascono nulle: zero atteso)
  SELECT count(*) INTO n_dup FROM (
    SELECT 1 FROM sys.sys_blueprint_content_packages
     WHERE blueprint_content_package_package_version IS NOT NULL
     GROUP BY blueprint_content_package_prototype_ref, blueprint_content_package_package_version
    HAVING count(*) > 1) d;
  IF n_dup <> 0 THEN
    RAISE EXCEPTION '000460: % identità di pacchetto ripetute', n_dup;
  END IF;

  SELECT count(*) INTO n_cl FROM sys.sys_classificazione_direzione_dato
   WHERE tabella = 'sys_blueprint_content_receipts' AND stato = 'infrastruttura';
  SELECT count(*) INTO n_rr FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name = 'sys_blueprint_content_receipts';
  IF n_cl <> 1 OR n_rr <> 1 THEN
    RAISE EXCEPTION '000460: la tabella nuova non è classificata in 000429 (%) o non è registrata in 000062 (%)', n_cl, n_rr;
  END IF;

  RAISE NOTICE '000460 ok — identità del pacchetto (2 colonne, unicità), registro dei ricevimenti classificato e registrato.';
END $$;
