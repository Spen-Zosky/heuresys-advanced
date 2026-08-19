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
  'modello. `BLUEPRINT_CONTENT` = il contenuto vive nelle tabelle sys_blueprint_content_* di '
  'questa versione (mig. 000327). NULL = versione descrittiva, che nessuno costruisce: e'' un '
  'caso legittimo, non un dato mancante.';

-- Backfill idempotente: la versione 1 di REGIONAL_RETAIL_BANK_MEDIUM dichiara da dove nasce
-- il suo contenuto. Ristretto per codice e numero, mai un carattere jolly.
-- ⚠ EMENDATO da `#132` F3 (E29): qui c'era il nome di un archetipo scritto in TypeScript, che
--   e' stato RITIRATO — «non deve rimanere traccia». Il contenuto ora vive nel database
--   (`sys.sys_blueprint_content_*`, mig. `000327`) e la chiave che lo dice e'
--   `BLUEPRINT_CONTENT`. Corretto qui per i database nuovi, e nella `000329` per quelli che
--   esistono gia' (ADR-0035).
UPDATE sys.sys_blueprint_variant_versions vv
   SET blueprint_variant_version_build_source_key = 'BLUEPRINT_CONTENT'
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
    -- ⚠ DUE VALORI AMMESSI, E NON E' UNA CONCESSIONE: e' l'ordine della catena.
    --    Su un database CREATO DA ZERO questa migrazione scrive `BLUEPRINT_CONTENT` e qui
    --    lo trova. Su un database CHE ESISTE GIA' la colonna porta ancora il nome
    --    dell'archetipo — scritto da questa stessa migrazione prima dell'emendamento di
    --    `#132` F3 — e il backfill non tocca niente, perche' e' ristretto a `IS NULL`. La
    --    `000329`, che gira NOVE numeri dopo, lo traduce. Pretendere qui il valore finale
    --    renderebbe rossa la catena su ogni database esistente: e' successo, ed e' stato
    --    intercettato dalla prova generale sul clone di CI (2026-08-19).
    --    Il difetto che questa post-condizione esiste per intercettare resta coperto: un
    --    backfill che non trova il suo bersaglio conta ZERO, non uno.
    SELECT count(*) INTO n_marcate
      FROM sys.sys_blueprint_variant_versions
     WHERE blueprint_variant_version_build_source_key IN ('BLUEPRINT_CONTENT', 'RETAIL_BANK_REFERENCE');

    IF n_marcate <> 1 THEN
        RAISE EXCEPTION '000320: attesa 1 versione con una sorgente di costruzione dichiarata, trovate %. Il backfill non ha trovato il suo bersaglio (o ne ha trovati troppi)', n_marcate;
    END IF;

    -- Cio' che non doveva cambiare: nessun'altra versione ha preso una sorgente.
    SELECT count(*) INTO n_altre
      FROM sys.sys_blueprint_variant_versions
     WHERE blueprint_variant_version_build_source_key IS NOT NULL
       AND blueprint_variant_version_build_source_key NOT IN ('BLUEPRINT_CONTENT', 'RETAIL_BANK_REFERENCE');

    IF n_altre <> 0 THEN
        RAISE EXCEPTION '000320: % versioni portano una sorgente che questa migrazione non ha scritto', n_altre;
    END IF;

    RAISE NOTICE '000320: 1 versione con la sorgente dichiarata, nessun''altra toccata';
END $$;
