-- ============================================================================
-- 000460, INVERSA (fuori catena): toglie il registro dei ricevimenti e l'identità del pacchetto (consolidamento C3).
-- NON e' una migrazione: non gira al deploy.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pacchetto/inversa-000460.sql
--
-- GUARDIA. Si rifiuta se il registro ha righe o se un pacchetto porta gia' numero o impronta: tornare indietro
-- dopo un ricevimento vero e' una decisione dell'Amministratore di Sistema, non un gesto di routine.
-- Vale insieme al ritiro del file 000460 e delle sue righe in 000429 e 000062 (ADR-0035): con il file nella
-- catena, il deploy dopo lo rimette. Idempotente: cio' che non c'e' piu' non da' errore.
-- ============================================================================
BEGIN;
DO $$
DECLARE n bigint; problemi text := '';
BEGIN
  IF to_regclass('sys.sys_blueprint_content_receipts') IS NOT NULL THEN
    SELECT count(*) INTO n FROM sys.sys_blueprint_content_receipts;
    IF n <> 0 THEN problemi := problemi || format(' ricevimenti=%s', n); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sys'
              AND table_name = 'sys_blueprint_content_packages' AND column_name = 'blueprint_content_package_hash') THEN
    EXECUTE 'SELECT count(*) FROM sys.sys_blueprint_content_packages
              WHERE blueprint_content_package_hash IS NOT NULL OR blueprint_content_package_package_version IS NOT NULL' INTO n;
    IF n <> 0 THEN problemi := problemi || format(' pacchetti con identita''=%s', n); END IF;
  END IF;
  IF problemi <> '' THEN RAISE EXCEPTION '000460-inversa: ci sono dati, non si toglie niente:%', problemi; END IF;
END $$;

DROP TABLE IF EXISTS sys.sys_blueprint_content_receipts;
DROP INDEX IF EXISTS sys.sys_blueprint_content_packages_identity_uq;
ALTER TABLE sys.sys_blueprint_content_packages DROP CONSTRAINT IF EXISTS sys_blueprint_content_packages_hash_ck;
ALTER TABLE sys.sys_blueprint_content_packages DROP CONSTRAINT IF EXISTS sys_blueprint_content_packages_package_version_ck;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_hash;
ALTER TABLE sys.sys_blueprint_content_packages DROP COLUMN IF EXISTS blueprint_content_package_package_version;
DELETE FROM sys.sys_classificazione_direzione_dato WHERE tabella = 'sys_blueprint_content_receipts';
DELETE FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name = 'sys_blueprint_content_receipts';
COMMIT;
