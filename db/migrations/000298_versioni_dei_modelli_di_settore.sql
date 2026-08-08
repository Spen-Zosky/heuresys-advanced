-- ============================================================================
-- 000298 — I modelli di settore acquistano una versione.
--
-- PERCHE'
--   Un fascicolo di configurazione resta ancorato al modello su cui e' stato
--   firmato, e deve poter dire «sei sulla versione 1, ne esiste una piu'
--   nuova». Oggi un modello e' una riga sola, modificabile sotto i piedi di chi
--   la sta usando: la frase non e' nemmeno scrivibile. E' la decisione E5 del
--   fascicolo Tenant Builder P1 (#131).
--
-- COSA FA
--   Aggiunge le versioni, crea la versione 1 PUBLISHED di ogni variante
--   esistente e vi aggancia i processi.
--
-- LA COLONNA `blueprint_process_variant_id` NON VIENE RIMOSSA, e la ragione
--   non e' la compatibilita' col codice: e' il bersaglio dell'`ON CONFLICT
--   (blueprint_process_variant_id, blueprint_process_code)` della
--   `000021_seed_reference_bank.sql` (riga 166), che punta all'indice unico
--   `sys_blueprint_process_registry_variant_code_uq`. Togliere la colonna
--   distruggerebbe l'indice e romperebbe quell'INSERT — e la catena si
--   ri-applica per intero a ogni deploy (ADR-0034), quindi si spaccherebbe a
--   ogni rilascio. La coerenza fra versione e variante si impone allora con una
--   chiave esterna COMPOSITA, che rende impossibile che le due dissentano.
--   E' l'unica strada additiva.
--
-- MISURATO PRIMA (2026-08-08, produzione): 1 variante
--   (`REGIONAL_RETAIL_BANK_MEDIUM`), 23 processi, nessuno senza variante,
--   tabella delle versioni inesistente.
--
-- IDEMPOTENTE + sicura due volte.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_blueprint_variant_versions (
  blueprint_variant_version_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_variant_version_variant_id   uuid NOT NULL
    REFERENCES sys.sys_blueprint_variants(blueprint_variant_id) ON DELETE CASCADE,
  blueprint_variant_version_number       int NOT NULL,
  blueprint_variant_version_status       varchar(32) NOT NULL DEFAULT 'DRAFT',
  blueprint_variant_version_published_at timestamptz,
  blueprint_variant_version_notes        text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_blueprint_variant_version_status_check
    CHECK (blueprint_variant_version_status IN ('DRAFT','PUBLISHED','RETIRED')),
  CONSTRAINT sys_blueprint_variant_versions_number_uq
    UNIQUE (blueprint_variant_version_variant_id, blueprint_variant_version_number),
  -- Esiste SOLO per fare da bersaglio alla chiave esterna composita qui sotto.
  CONSTRAINT sys_blueprint_variant_versions_id_variant_uq
    UNIQUE (blueprint_variant_version_id, blueprint_variant_version_variant_id)
);

CREATE INDEX IF NOT EXISTS sys_blueprint_variant_versions_variant_idx
  ON sys.sys_blueprint_variant_versions (blueprint_variant_version_variant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgname='sys_blueprint_variant_versions_set_updated_at'
                    AND tgrelid='sys.sys_blueprint_variant_versions'::regclass) THEN
    CREATE TRIGGER sys_blueprint_variant_versions_set_updated_at BEFORE UPDATE
      ON sys.sys_blueprint_variant_versions FOR EACH ROW
      EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- ── UNA VARIANTE NON PUO' NASCERE SENZA LA SUA VERSIONE ─────────────────────
-- Trovato dalla CI (5 file di test rossi, 2026-08-08): la prima stesura
-- riempiva la versione dei processi solo se la variante ne AVEVA una, e
-- creava le versioni solo per le varianti gia' esistenti al momento della
-- migrazione. Una variante creata DOPO — per esempio dall'API, come fanno i
-- test di `blueprint-processes` — nasceva senza versione, il riempimento non
-- trovava nulla e il primo processo su quella variante finiva in 500.
--
-- La toppa sarebbe stata allentare il vincolo. La correzione e' l'opposto:
-- rendere l'invariante VERO PER COSTRUZIONE. Cosi' la post-condizione «ogni
-- variante ha la sua versione 1» smette di essere un controllo una-tantum e
-- diventa una proprieta' che si mantiene da se'.
CREATE OR REPLACE FUNCTION sys.sys_blueprint_variant_ensure_version()
RETURNS trigger LANGUAGE plpgsql AS $ensure$
BEGIN
  INSERT INTO sys.sys_blueprint_variant_versions
    (blueprint_variant_version_variant_id, blueprint_variant_version_number,
     blueprint_variant_version_status, blueprint_variant_version_published_at,
     blueprint_variant_version_notes)
  VALUES (NEW.blueprint_variant_id, 1, 'PUBLISHED', now(),
          'Versione 1 creata alla nascita della variante.')
  ON CONFLICT (blueprint_variant_version_variant_id, blueprint_variant_version_number)
    DO NOTHING;
  RETURN NEW;
END $ensure$;

DROP TRIGGER IF EXISTS sys_blueprint_variant_ensure_version ON sys.sys_blueprint_variants;
CREATE TRIGGER sys_blueprint_variant_ensure_version
  AFTER INSERT ON sys.sys_blueprint_variants
  FOR EACH ROW EXECUTE FUNCTION sys.sys_blueprint_variant_ensure_version();

ALTER TABLE sys.sys_blueprint_process_registry
  ADD COLUMN IF NOT EXISTS blueprint_process_variant_version_id uuid;

INSERT INTO sys.sys_blueprint_variant_versions (
  blueprint_variant_version_variant_id, blueprint_variant_version_number,
  blueprint_variant_version_status, blueprint_variant_version_published_at,
  blueprint_variant_version_notes)
SELECT v.blueprint_variant_id, 1, 'PUBLISHED', v.created_at,
       'Versione 1 ricostruita dalla variante esistente al momento della migrazione.'
  FROM sys.sys_blueprint_variants v
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_blueprint_variant_versions vv
    WHERE vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
      AND vv.blueprint_variant_version_number = 1);

UPDATE sys.sys_blueprint_process_registry p
   SET blueprint_process_variant_version_id = vv.blueprint_variant_version_id
  FROM sys.sys_blueprint_variant_versions vv
 WHERE vv.blueprint_variant_version_variant_id = p.blueprint_process_variant_id
   AND vv.blueprint_variant_version_number = 1
   AND p.blueprint_process_variant_version_id IS DISTINCT FROM vv.blueprint_variant_version_id;

-- ── PERCHE' SERVE UN TRIGGER PRIMA DI RENDERE LA COLONNA OBBLIGATORIA ────────
-- Trovato dalla prova generale (`ci-rehearsal.sh`, seconda passata): la
-- `000021_seed_reference_bank.sql` reinserisce i 23 processi del modello a ogni
-- giro della catena, e non conosce questa colonna. Il `NOT NULL` viene
-- verificato mentre la riga si forma, cioe' PRIMA che l'`ON CONFLICT DO NOTHING`
-- possa scartarla: la migrazione passava alla prima passata e faceva esplodere
-- il deploy alla seconda.
--
-- Emendare la `000021` non e' possibile: gira PRIMA che questa tabella esista.
-- Il valore va quindi derivato dove la riga nasce. Il trigger prende la versione
-- PUBLISHED piu' alta della variante, e in mancanza la piu' bassa esistente: per
-- una riga che verra' scartata dall'ON CONFLICT il valore e' indifferente, per
-- una riga davvero nuova e' la scelta giusta.
CREATE OR REPLACE FUNCTION sys.sys_blueprint_process_fill_version()
RETURNS trigger LANGUAGE plpgsql AS $fill$
BEGIN
  IF NEW.blueprint_process_variant_version_id IS NULL
     AND NEW.blueprint_process_variant_id IS NOT NULL THEN
    SELECT vv.blueprint_variant_version_id
      INTO NEW.blueprint_process_variant_version_id
      FROM sys.sys_blueprint_variant_versions vv
     WHERE vv.blueprint_variant_version_variant_id = NEW.blueprint_process_variant_id
     ORDER BY (vv.blueprint_variant_version_status = 'PUBLISHED') DESC,
              vv.blueprint_variant_version_number DESC
     LIMIT 1;
  END IF;
  RETURN NEW;
END $fill$;

DROP TRIGGER IF EXISTS sys_blueprint_process_fill_version
  ON sys.sys_blueprint_process_registry;
CREATE TRIGGER sys_blueprint_process_fill_version
  BEFORE INSERT OR UPDATE ON sys.sys_blueprint_process_registry
  FOR EACH ROW EXECUTE FUNCTION sys.sys_blueprint_process_fill_version();

ALTER TABLE sys.sys_blueprint_process_registry
  ALTER COLUMN blueprint_process_variant_version_id SET NOT NULL;

ALTER TABLE sys.sys_blueprint_process_registry
  DROP CONSTRAINT IF EXISTS sys_blueprint_process_variant_version_fk;
ALTER TABLE sys.sys_blueprint_process_registry
  ADD CONSTRAINT sys_blueprint_process_variant_version_fk
  FOREIGN KEY (blueprint_process_variant_version_id, blueprint_process_variant_id)
  REFERENCES sys.sys_blueprint_variant_versions
             (blueprint_variant_version_id, blueprint_variant_version_variant_id);

DO $$
DECLARE n_orfani int; n_versioni int; n_processi int; n_varianti int; n_senza_v1 int;
BEGIN
  SELECT count(*) INTO n_orfani FROM sys.sys_blueprint_process_registry
   WHERE blueprint_process_variant_version_id IS NULL;
  IF n_orfani <> 0 THEN
    RAISE EXCEPTION '000298: % processi senza versione del modello', n_orfani;
  END IF;

  SELECT count(*) INTO n_versioni FROM sys.sys_blueprint_variant_versions;
  SELECT count(*) INTO n_processi FROM sys.sys_blueprint_process_registry;
  SELECT count(*) INTO n_varianti  FROM sys.sys_blueprint_variants;
  IF n_versioni < 1 THEN
    RAISE EXCEPTION '000298: nessuna versione creata: le varianti esistenti sono state ignorate';
  END IF;

  -- Post-condizione che protegge cio' che NON doveva cambiare: OGNI variante
  -- deve avere la sua versione 1. Contare solo le versioni create direbbe
  -- «ne ho fatta una» anche se le varianti fossero dieci.
  SELECT count(*) INTO n_senza_v1
    FROM sys.sys_blueprint_variants v
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_blueprint_variant_versions vv
                      WHERE vv.blueprint_variant_version_variant_id = v.blueprint_variant_id
                        AND vv.blueprint_variant_version_number = 1);
  IF n_senza_v1 <> 0 THEN
    RAISE EXCEPTION '000298: % varianti sono rimaste senza versione 1', n_senza_v1;
  END IF;

  RAISE NOTICE '000298: % versioni di modello su % varianti, % processi tutti agganciati',
    n_versioni, n_varianti, n_processi;
END $$;

COMMIT;

-- Una tabella appena creata e popolata non ha statistiche, e il cruscotto di
-- salute la segnala come «popolata mai analizzata» — a ragione: senza
-- statistiche il pianificatore sceglie al buio. L'ANALYZE sta QUI e non in un
-- comando a mano, cosi' ogni host che applica la catena la analizza da se'.
-- Fuori dalla transazione: ANALYZE non si esegue dentro un blocco esplicito.
ANALYZE sys.sys_blueprint_variant_versions;
