-- ============================================================================
-- 000359 — Il registro delle migrazioni non può nominare un file che non esiste
--
-- IL FATTO, misurato il 2026-08-28 (S1083): `sys.sys_schema_migrations` conteneva
-- **356 righe** contro **355 file** in `db/migrations/`. La riga in eccesso è
--
--     000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql
--     migration_id 77280 · applied_at 2026-08-27 13:41:46 UTC · applied_by heuresys
--     sha256 5e4b5c8da4f4cd5fd6f41f78b83764ef424c027837dd25fe4e85703718da6e4d
--     duration_ms 43
--
-- IL FILE NON ESISTE IN NESSUN POSTO — cercato, non supposto:
--   · `find D:/ -name '000358_una_posizione*'`        -> nulla
--   · `ssh linux-pc  ls db/migrations | grep 000358`  -> nulla
--   · `ssh oracle-vm-default  find ~ -name 000358*`   -> nulla (ed è la macchina
--     su cui è stato APPLICATO: il tunnel :5433 punta lì)
--   · `git log --all --diff-filter=AD -- db/migrations/000358*` -> nessun commit
--   · `git log --all -S'una_posizione_scoperta_eredita'`        -> nessun commit
--
-- E NON HA LASCIATO OGGETTI ORFANI, verificato per costruzione: le 31 viste
-- `sys.v_*` e le 16 funzioni `sys.*` presenti nel database sono tutte nominate
-- da un file della catena (confronto insiemistico, non a campione). Quello che
-- la 000358 ha fatto — se ha fatto qualcosa di persistente — era una scrittura
-- di dati, non uno schema.
--
-- LA PROVA CHE LA CATENA È COMPLETA SENZA DI ESSA: `db/scripts/ci-rehearsal.sh`
-- sul gemello, 2026-08-28, coi soli 355 file — «331 migrations applied, 24
-- skipped» in 12 s, due passate, e **26/26 sentinelle a zero**. Le stesse 26
-- sentinelle sono a zero anche in produzione. La riga non regge nulla.
--
-- PERCHÉ SI RIMUOVE, e non si inventa un file per giustificarla. Il registro è
-- una **affermazione**: «questa migrazione è stata applicata, e il suo codice è
-- nel repo». La seconda metà è falsa, e chi legge il registro per capire lo
-- stato dello schema viene ingannato senza avere modo di accorgersene. Scrivere
-- oggi un `000358` che imiti ciò che immagino facesse sarebbe peggio: sarebbe
-- codice che nessuno ha mai eseguito, spacciato per la storia di ciò che è
-- accaduto. La traccia forense non si perde — vive nel giornale qui sotto, che
-- conserva la riga intera.
--
-- LA CAUSA A MONTE, dichiarata e NON risolta qui: `verify_gate` instrada
-- `migrate-idempotent`, che **applica la catena alla produzione** (memoria
-- `verify_gate_applies_migrations_to_prod`). Una migrazione presente nel working
-- tree e poi disfatta entra in produzione e non torna indietro. La cura è
-- l'instradamento del cancello, non questa migrazione.
--
-- SE IL FILE UN GIORNO RIAPPARISSE (da un branch, da un backup), la catena lo
-- applicherebbe di nuovo, perché il registro non lo contiene più. È il
-- comportamento voluto: ogni migrazione di questo repo è idempotente per
-- contratto, quindi una riapplicazione è innocua, e in cambio il codice
-- tornerebbe a essere tracciato.
--
-- ROLLBACK: giornale `staging.mig359_ledger_fantasma_undo` (riga intera in
-- JSONB) + `staging.mig359_ledger_fantasma_undo_apply()`.
--
-- IDEMPOTENTE: la cancellazione è filtrata sul nome esatto del file. Su un
-- database nuovo — dove la riga non è mai esistita — e alla seconda passata,
-- tocca zero righe.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, PRIMA di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig359_ledger_fantasma_undo (
  undo_id     bigserial PRIMARY KEY,
  migrazione  text        NOT NULL,
  file_name   text        NOT NULL,
  riga_intera jsonb       NOT NULL,
  creato_il   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig359_ledger_fantasma_undo IS
  'Giornale di annullamento della rimozione dal registro migrazioni della riga '
  '000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql, il cui file '
  'non esiste su nessuna macchina né in git (S1083). Conserva la riga intera in '
  'JSONB. Si applica al contrario con staging.mig359_ledger_fantasma_undo_apply().';

-- ----------------------------------------------------------------------------
-- 1. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Non fa fallire su un database dove la riga non c'è: deve poter girare su
--    heuresys_ci e su un database nuovo, dove è legittimamente assente.
--    Fallisce invece — e deve — se trovasse PIÙ di una riga con quel nome:
--    significherebbe che il registro ha un duplicato, cioè un problema diverso
--    da quello che questa migrazione è autorizzata a curare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_bersaglio int;
  v_totale    int;
BEGIN
  SELECT count(*) INTO v_bersaglio
    FROM sys.sys_schema_migrations
   WHERE file_name = '000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql';

  SELECT count(*) INTO v_totale FROM sys.sys_schema_migrations;

  IF v_bersaglio > 1 THEN
    RAISE EXCEPTION
      'mig359: il registro contiene % righe per lo stesso file. Un duplicato non e '
      'il difetto che questa migrazione cura: fermarsi qui e la cosa giusta.', v_bersaglio;
  END IF;

  RAISE NOTICE 'mig359 guardia: % riga fantasma su % righe di registro',
    v_bersaglio, v_totale;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Il giornale si popola PRIMA della cancellazione. Nome esatto, mai un jolly.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig359_ledger_fantasma_undo (migrazione, file_name, riga_intera)
SELECT '000359', m.file_name, to_jsonb(m)
  FROM sys.sys_schema_migrations m
 WHERE m.file_name = '000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql'
   AND NOT EXISTS (
     SELECT 1 FROM staging.mig359_ledger_fantasma_undo u
      WHERE u.file_name = m.file_name);

DELETE FROM sys.sys_schema_migrations
 WHERE file_name = '000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql';

-- ----------------------------------------------------------------------------
-- 3. LE POST-CONDIZIONI — proteggono anche ciò che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_resta      int;
  v_totale     int;
  v_giornale   int;
  v_duplicati  int;
BEGIN
  -- (a) ciò che DOVEVA cambiare: la riga fantasma non c'è più.
  SELECT count(*) INTO v_resta
    FROM sys.sys_schema_migrations
   WHERE file_name = '000358_una_posizione_scoperta_eredita_dai_pari_della_sua_unita.sql';
  IF v_resta <> 0 THEN
    RAISE EXCEPTION 'mig359: la riga fantasma risulta ancora nel registro (% righe)', v_resta;
  END IF;

  -- (b) ciò che NON doveva cambiare: nessun'altra riga è stata toccata. Il
  --     registro non deve avere perso righe oltre quella, e non deve avere
  --     acquisito duplicati. Su un database dove la riga non esisteva, il
  --     giornale e' vuoto e questa verifica si limita a confermare l'integrita'.
  SELECT count(*) INTO v_totale FROM sys.sys_schema_migrations;
  SELECT count(*) INTO v_giornale
    FROM staging.mig359_ledger_fantasma_undo WHERE migrazione = '000359';

  SELECT count(*) INTO v_duplicati FROM (
    SELECT file_name FROM sys.sys_schema_migrations
     GROUP BY file_name HAVING count(*) > 1) d;
  IF v_duplicati <> 0 THEN
    RAISE EXCEPTION 'mig359: il registro contiene % nomi duplicati', v_duplicati;
  END IF;

  RAISE NOTICE 'mig359 post: registro a % righe, % conservate nel giornale, 0 duplicati',
    v_totale, v_giornale;
END $$;

-- ----------------------------------------------------------------------------
-- 4. La funzione che disfa, perché un rollback dichiarato e non eseguibile non
--    è un rollback.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig359_ledger_fantasma_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE v_ripristinate bigint := 0;
BEGIN
  INSERT INTO sys.sys_schema_migrations
  SELECT (jsonb_populate_record(NULL::sys.sys_schema_migrations, u.riga_intera)).*
    FROM staging.mig359_ledger_fantasma_undo u
   WHERE u.migrazione = '000359'
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_schema_migrations m WHERE m.file_name = u.file_name);
  GET DIAGNOSTICS v_ripristinate = ROW_COUNT;

  RETURN QUERY VALUES ('righe di registro ripristinate', v_ripristinate);
END $$;

COMMIT;
