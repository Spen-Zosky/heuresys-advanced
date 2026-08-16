-- =============================================================================
-- 000320_sorgente_di_costruzione_della_variante.sql
-- Tenant Builder P3 · T1 (seconda parte) — da quale sorgente si costruisce
-- -----------------------------------------------------------------------------
-- Una versione di variante dice COM'E' fatto il modello. Non dice da quale
-- sorgente parametrica la costruzione debba partire per realizzarlo. Finche' la
-- sorgente e' una sola, l'informazione sta nel codice e nessuno se ne accorge; alla
-- seconda, il codice deve indovinare.
--
-- `build_source_key` e' quella dichiarazione, sulla versione e non sulla variante:
-- una variante evolve, e la versione 2 potrebbe costruirsi diversamente dalla 1.
--
-- Nullable per progetto: le versioni che nessuno costruisce (modelli descrittivi)
-- non devono inventarsi una sorgente. Un NOT NULL con un default costringerebbe a
-- dichiarare il falso.
--
-- RD-08: varchar, mai un ENUM PostgreSQL.
-- Idempotente: ADD COLUMN IF NOT EXISTS + backfill condizionato.
-- =============================================================================

ALTER TABLE sys.sys_blueprint_variant_versions
    ADD COLUMN IF NOT EXISTS blueprint_variant_version_build_source_key varchar(64) NULL;

COMMENT ON COLUMN sys.sys_blueprint_variant_versions.blueprint_variant_version_build_source_key IS
  'Tenant Builder P3 — la sorgente parametrica da cui la costruzione realizza QUESTA versione del '
  'modello. NULL = versione descrittiva, che nessuno costruisce: e'' un caso legittimo, non un dato '
  'mancante.';

-- Backfill idempotente: la versione 1 di REGIONAL_RETAIL_BANK_MEDIUM si costruisce
-- da RETAIL_BANK_REFERENCE. Ristretto per codice e numero, mai un carattere jolly.
UPDATE sys.sys_blueprint_variant_versions vv
   SET blueprint_variant_version_build_source_key = 'RETAIL_BANK_REFERENCE'
  FROM sys.sys_blueprint_variants v
 WHERE v.blueprint_variant_id = vv.blueprint_variant_version_variant_id
   AND v.blueprint_variant_code = 'REGIONAL_RETAIL_BANK_MEDIUM'
   AND vv.blueprint_variant_version_number = 1
   AND vv.blueprint_variant_version_build_source_key IS NULL;

-- -----------------------------------------------------------------------------
-- POST-CONDIZIONI. La prima e' quella che il piano chiede: un backfill senza
-- riscontro RIESCE senza fare niente, ed e' il modo piu' comune in cui una
-- migrazione mente. La seconda protegge cio' che NON doveva cambiare.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    n_marcate bigint;
    n_altre   bigint;
BEGIN
    SELECT count(*) INTO n_marcate
      FROM sys.sys_blueprint_variant_versions
     WHERE blueprint_variant_version_build_source_key = 'RETAIL_BANK_REFERENCE';

    IF n_marcate <> 1 THEN
        RAISE EXCEPTION '000320: attesa 1 versione con build_source_key = RETAIL_BANK_REFERENCE, trovate %. Il backfill non ha trovato il suo bersaglio (o ne ha trovati troppi)', n_marcate;
    END IF;

    -- Cio' che non doveva cambiare: nessun'altra versione ha preso una sorgente.
    SELECT count(*) INTO n_altre
      FROM sys.sys_blueprint_variant_versions
     WHERE blueprint_variant_version_build_source_key IS NOT NULL
       AND blueprint_variant_version_build_source_key <> 'RETAIL_BANK_REFERENCE';

    IF n_altre <> 0 THEN
        RAISE EXCEPTION '000320: % versioni portano una sorgente che questa migrazione non ha scritto', n_altre;
    END IF;

    RAISE NOTICE '000320: 1 versione marcata RETAIL_BANK_REFERENCE, nessun''altra toccata';
END $$;
