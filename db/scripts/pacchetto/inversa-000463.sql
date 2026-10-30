-- ============================================================================
-- 000463, INVERSA (fuori catena): toglie la versione fissata sull'attivazione e riporta l'unicità dei
-- processi su (variante, codice) (consolidamento C4).
-- NON e' una migrazione: non gira al deploy.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pacchetto/inversa-000463.sql
--
-- GUARDIA. Si rifiuta se una variante ha lo stesso codice di processo in due versioni (l'indice vecchio non
-- si potrebbe ricreare) o se due attivazioni della stessa variante sono su versioni diverse (tornare alla
-- regola «tutte le PUBLISHED» cambierebbe in silenzio ciò che uno dei due tenant vede). In questi casi
-- tornare indietro e' una decisione dell'Amministratore di Sistema, non un gesto di routine.
-- Vale insieme al ritiro del file 000463 e all'annullamento degli emendamenti di 000008 e 000021
-- (ADR-0035): con il file nella catena, il deploy dopo lo rimette. Idempotente.
-- ============================================================================
BEGIN;
DO $$
DECLARE n bigint; problemi text := '';
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM sys.sys_blueprint_process_registry
     GROUP BY blueprint_process_variant_id, blueprint_process_code HAVING count(*) > 1) d;
  IF n <> 0 THEN problemi := problemi || format(' codici di processo in piu'' versioni=%s', n); END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sys'
              AND table_name = 'sys_blueprint_activations' AND column_name = 'blueprint_activation_variant_version_id') THEN
    EXECUTE 'SELECT count(*) FROM (SELECT 1 FROM sys.sys_blueprint_activations
              WHERE blueprint_activation_variant_version_id IS NOT NULL
              GROUP BY blueprint_activation_variant_id HAVING count(DISTINCT blueprint_activation_variant_version_id) > 1) d' INTO n;
    IF n <> 0 THEN problemi := problemi || format(' varianti con tenant su versioni diverse=%s', n); END IF;
  END IF;
  IF problemi <> '' THEN RAISE EXCEPTION '000463-inversa: non si torna indietro senza decidere:%', problemi; END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_process_registry_variant_code_uq
  ON sys.sys_blueprint_process_registry (blueprint_process_variant_id, blueprint_process_code);
DROP INDEX IF EXISTS sys.sys_blueprint_process_registry_version_code_uq;
DROP TRIGGER IF EXISTS sys_blueprint_activation_pin_version ON sys.sys_blueprint_activations;
DROP FUNCTION IF EXISTS sys.sys_blueprint_activation_pin_version();
ALTER TABLE sys.sys_blueprint_activations DROP CONSTRAINT IF EXISTS sys_blueprint_activation_variant_version_fk;
DROP INDEX IF EXISTS sys.sys_blueprint_activations_variant_version_idx;
ALTER TABLE sys.sys_blueprint_activations DROP COLUMN IF EXISTS blueprint_activation_variant_version_id;
COMMIT;
