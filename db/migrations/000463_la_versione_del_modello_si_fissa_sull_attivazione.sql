-- ============================================================================================
-- 000463 — La versione del modello si fissa sull'attivazione, e i processi sono unici per versione
--          (consolidamento C4, ADR-0046 nella forma «versione fissata dall'attivazione»; R-58).
--
-- IL PROBLEMA. Un tenant attiva una VARIANTE, non una versione: il profilo (`lib/scope/profilo.ts`) e i
-- livelli di gerarchia (`hierarchy-levels`) leggono il contenuto di TUTTE le versioni PUBLISHED della
-- variante. Finché ogni variante ha una sola versione pubblicata non si vede; dal ricevimento (C3) una
-- variante può averne due, e pubblicarne una nuova cambierebbe tutti i tenant insieme, senza che nessuno
-- lo decida per il proprio. In più il registro dei processi è unico per (variante, codice)
-- (`sys_blueprint_process_registry_variant_code_uq`, 000008): una versione nuova dello stesso prototipo
-- non può portare i propri processi (R-58), e `ricevi` la rifiuta.
--
-- COSA FA.
--   ① `blueprint_activation_variant_version_id` su `sys_blueprint_activations`, nullable, con chiave esterna
--     COMPOSITA (versione, variante) verso `sys_blueprint_variant_versions`: la versione appartiene per
--     costruzione alla variante dell'attivazione (stesso schema della 000298 per i processi).
--   ② un innesco BEFORE INSERT/UPDATE: un'attivazione senza versione riceve la PUBLISHED più alta della sua
--     variante; una versione indicata o cambiata deve essere PUBLISHED (una bozza non si adotta, una
--     ritirata non si adotta più). Un'attivazione che conserva la versione che ha non viene ricontrollata:
--     una versione ritirata DOPO l'adozione resta in vigore per chi l'ha adottata.
--   ③ il riempimento delle attivazioni esistenti con la PUBLISHED più alta della loro variante (la stessa
--     versione che il profilo legge oggi, finché ce n'è una sola).
--   ④ l'unicità dei processi passa da (variante, codice) a (versione, codice).
--
-- PERCHÉ ④ È SICURA SULLA CATENA (ADR-0035). L'indice vecchio nasceva in 000008 ed era il bersaglio
--   dell'`ON CONFLICT` di 000021: entrambi i file sono EMENDATI in questo stesso incremento (000008 non lo
--   crea più, 000021 usa un `NOT EXISTS` per variante e codice). Senza quegli emendamenti la catena
--   riapplicata ricreerebbe l'indice vecchio, e fallirebbe appena una variante ha due versioni con processi.
--
-- MISURATO PRIMA (copia del dump notturno del 2026-10-29, cluster di prova della VM):
--   `psql -Atc "select count(*), count(*) filter (where blueprint_activation_status='ACTIVE')
--               from sys.sys_blueprint_activations"`; il valore sta nel registro V-17 del programma.
--
-- RIEMPIMENTO SENZA GIORNALE, ED È UNA SCELTA: la colonna è nuova e nulla, quindi non c'è un valore di
--   prima da conservare; tornare indietro è togliere la colonna (inversa fuori catena:
--   db/scripts/pacchetto/inversa-000463.sql). Il riempimento tocca solo le righe con la colonna nulla.
-- POST-CONDIZIONI: colonna e chiave composita presenti; nessuna attivazione senza versione se la sua
--   variante ne ha una pubblicata; l'indice vecchio assente, il nuovo presente, nessun processo ripetuto
--   nella stessa versione; righe delle attivazioni e dei processi invariate nel numero.
-- IDEMPOTENTE: IF NOT EXISTS ovunque, vincoli solo se assenti, riempimento solo sulle righe nulle.
-- Authored: 2026-10-30.
-- ============================================================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE _c4_prima ON COMMIT DROP AS
SELECT (SELECT count(*) FROM sys.sys_blueprint_activations) AS n_att,
       (SELECT count(*) FROM sys.sys_blueprint_process_registry) AS n_proc;

-- ── ① la versione sull'attivazione ───────────────────────────────────────────────────────
ALTER TABLE sys.sys_blueprint_activations
  ADD COLUMN IF NOT EXISTS blueprint_activation_variant_version_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_blueprint_activation_variant_version_fk') THEN
    ALTER TABLE sys.sys_blueprint_activations ADD CONSTRAINT sys_blueprint_activation_variant_version_fk
      FOREIGN KEY (blueprint_activation_variant_version_id, blueprint_activation_variant_id)
      REFERENCES sys.sys_blueprint_variant_versions (blueprint_variant_version_id, blueprint_variant_version_variant_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sys_blueprint_activations_variant_version_idx
  ON sys.sys_blueprint_activations (blueprint_activation_variant_version_id);

COMMENT ON COLUMN sys.sys_blueprint_activations.blueprint_activation_variant_version_id IS
  '000463 (C4) — la versione del modello in vigore per il tenant. Il profilo e i livelli di gerarchia leggono questa; '
  'nulla solo se la variante non ha ancora una versione pubblicata. Si cambia per tenant, con una versione PUBLISHED.';

-- ── ② l'innesco: riempie il vuoto, e una bozza non si adotta ─────────────────────────────
CREATE OR REPLACE FUNCTION sys.sys_blueprint_activation_pin_version()
RETURNS trigger LANGUAGE plpgsql AS $pin$
DECLARE v_stato text;
BEGIN
  IF NEW.blueprint_activation_variant_version_id IS NULL THEN
    SELECT vv.blueprint_variant_version_id INTO NEW.blueprint_activation_variant_version_id
      FROM sys.sys_blueprint_variant_versions vv
     WHERE vv.blueprint_variant_version_variant_id = NEW.blueprint_activation_variant_id
       AND vv.blueprint_variant_version_status = 'PUBLISHED'
     ORDER BY vv.blueprint_variant_version_number DESC
     LIMIT 1;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.blueprint_activation_variant_version_id IS NOT DISTINCT FROM OLD.blueprint_activation_variant_version_id THEN
    RETURN NEW;
  END IF;
  SELECT vv.blueprint_variant_version_status INTO v_stato
    FROM sys.sys_blueprint_variant_versions vv
   WHERE vv.blueprint_variant_version_id = NEW.blueprint_activation_variant_version_id;
  IF v_stato IS DISTINCT FROM 'PUBLISHED' THEN
    RAISE EXCEPTION 'la versione % non è adottabile (stato %): un tenant adotta solo una versione PUBLISHED',
      NEW.blueprint_activation_variant_version_id, coalesce(v_stato, 'inesistente')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $pin$;

DROP TRIGGER IF EXISTS sys_blueprint_activation_pin_version ON sys.sys_blueprint_activations;
CREATE TRIGGER sys_blueprint_activation_pin_version
  BEFORE INSERT OR UPDATE OF blueprint_activation_variant_version_id, blueprint_activation_variant_id
  ON sys.sys_blueprint_activations
  FOR EACH ROW EXECUTE FUNCTION sys.sys_blueprint_activation_pin_version();

-- ── ③ le attivazioni esistenti: la PUBLISHED più alta, solo dove la colonna è nulla ────────
UPDATE sys.sys_blueprint_activations a
   SET blueprint_activation_variant_version_id = (
         SELECT vv.blueprint_variant_version_id
           FROM sys.sys_blueprint_variant_versions vv
          WHERE vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id
            AND vv.blueprint_variant_version_status = 'PUBLISHED'
          ORDER BY vv.blueprint_variant_version_number DESC
          LIMIT 1)
 WHERE a.blueprint_activation_variant_version_id IS NULL
   AND EXISTS (SELECT 1 FROM sys.sys_blueprint_variant_versions vv
                WHERE vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id
                  AND vv.blueprint_variant_version_status = 'PUBLISHED');

-- ── ④ i processi sono unici per versione (R-58) ───────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_process_registry_version_code_uq
  ON sys.sys_blueprint_process_registry (blueprint_process_variant_version_id, blueprint_process_code);
DROP INDEX IF EXISTS sys.sys_blueprint_process_registry_variant_code_uq;

-- ── POST-CONDIZIONI ──────────────────────────────────────────────────────────────────────
DO $post$
DECLARE n_col int; n_fk int; n_vuote bigint; n_vecchio int; n_nuovo int; n_dup bigint; p record;
BEGIN
  SELECT count(*) INTO n_col FROM information_schema.columns
   WHERE table_schema = 'sys' AND table_name = 'sys_blueprint_activations'
     AND column_name = 'blueprint_activation_variant_version_id';
  SELECT count(*) INTO n_fk FROM pg_constraint WHERE conname = 'sys_blueprint_activation_variant_version_fk';
  IF n_col <> 1 OR n_fk <> 1 THEN
    RAISE EXCEPTION '000463: manca la colonna (%) o la chiave composita (%) della versione sull''attivazione', n_col, n_fk;
  END IF;

  SELECT count(*) INTO n_vuote FROM sys.sys_blueprint_activations a
   WHERE a.blueprint_activation_variant_version_id IS NULL
     AND EXISTS (SELECT 1 FROM sys.sys_blueprint_variant_versions vv
                  WHERE vv.blueprint_variant_version_variant_id = a.blueprint_activation_variant_id
                    AND vv.blueprint_variant_version_status = 'PUBLISHED');
  IF n_vuote <> 0 THEN
    RAISE EXCEPTION '000463: % attivazioni senza versione, e la loro variante ne ha una pubblicata', n_vuote;
  END IF;

  SELECT count(*) INTO n_vecchio FROM pg_indexes WHERE schemaname = 'sys' AND indexname = 'sys_blueprint_process_registry_variant_code_uq';
  SELECT count(*) INTO n_nuovo FROM pg_indexes WHERE schemaname = 'sys' AND indexname = 'sys_blueprint_process_registry_version_code_uq';
  IF n_vecchio <> 0 OR n_nuovo <> 1 THEN
    RAISE EXCEPTION '000463: unicità dei processi non spostata (indice per variante %, per versione %)', n_vecchio, n_nuovo;
  END IF;

  SELECT count(*) INTO n_dup FROM (
    SELECT 1 FROM sys.sys_blueprint_process_registry
     GROUP BY blueprint_process_variant_version_id, blueprint_process_code HAVING count(*) > 1) d;
  IF n_dup <> 0 THEN
    RAISE EXCEPTION '000463: % codici di processo ripetuti nella stessa versione', n_dup;
  END IF;

  SELECT * INTO p FROM _c4_prima;
  IF (SELECT count(*) FROM sys.sys_blueprint_activations) <> p.n_att
     OR (SELECT count(*) FROM sys.sys_blueprint_process_registry) <> p.n_proc THEN
    RAISE EXCEPTION '000463: il numero delle attivazioni o dei processi è cambiato (prima % e %)', p.n_att, p.n_proc;
  END IF;

  RAISE NOTICE '000463 ok — versione fissata su % attivazioni, processi unici per versione.',
    (SELECT count(*) FROM sys.sys_blueprint_activations WHERE blueprint_activation_variant_version_id IS NOT NULL);
END $post$;

COMMIT;
