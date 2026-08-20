-- ============================================================================
-- 000348 — #223 F6 (rilievo A-03): le tre sorgenti del brownfield passano ad
--          `ARCHIVED`, perche' la fase che le usava e' chiusa.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   reference_sync.source_exports contiene SEI righe (il rilievo ne contava 5).
--   Tre sono la sincronizzazione viva — ATECO_2025, ESCO, ESCO_SKILL_HIERARCHY.
--   Tre sono residui della fase brownfield, che il 2026-08-14 e' stata chiusa
--   (I12, ADR-0038: «il rubinetto e' chiuso»):
--     db-export-2026-05-15 · legacy-live-wave2-D · legacy-live-wave2-E
--   e portano ancora `INGESTED` / `AVAILABLE`, cioe' gli stati di qualcosa che
--   e' in servizio.
--
-- NON SI CANCELLANO, e questa e' la scelta. Quelle righe sono la PROVENIENZA
-- dei dati che oggi il database contiene: dicono da dove sono arrivati e quando.
-- Toglierle renderebbe l'ingestione storica non ricostruibile — e ADR-0038
-- conserva il legacy come fonte di concetti proprio per non perdere questo.
-- `ARCHIVED` esiste gia' nel CHECK della colonna: e' lo stato pensato per
-- questo, e non serve inventare nulla.
--
-- «AVAILABLE» era il piu' fuorviante dei due: dice «pronta da ingerire», cioe'
-- esattamente cio' che non deve piu' accadere.
--
-- ROLLBACK DICHIARATO: nessun giornale — il valore precedente di ognuna delle
-- tre e' scritto qui sopra e nel metadata (`stato_prima`), quindi l'inversa e'
-- leggibile dal file stesso. Nessuna riga viene cancellata.
--
-- IDEMPOTENTE: la `WHERE` prende solo le righe non ancora archiviate.
-- ============================================================================

UPDATE reference_sync.source_exports
   SET source_export_status = 'ARCHIVED',
       source_export_metadata = coalesce(source_export_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'archiviata_il',  '2026-08-20',
              'archiviata_da',  '#223 F6 (rilievo A-03)',
              'stato_prima',    source_export_status,
              'motivo',         'fase brownfield chiusa il 2026-08-14 (I12, ADR-0038): la riga resta come provenienza, non come sorgente attiva')
 WHERE source_export_name IN ('db-export-2026-05-15', 'legacy-live-wave2-D', 'legacy-live-wave2-E')
   AND source_export_status <> 'ARCHIVED';

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Il secondo controllo protegge cio' che NON doveva cambiare:
-- le tre sorgenti VIVE. Contare le archiviate non distinguerebbe «ho archiviato
-- il brownfield» da «ho archiviato la sincronizzazione», che spegnerebbe in
-- silenzio l'aggiornamento di ESCO e ATECO.
-- ---------------------------------------------------------------------------
DO $$
DECLARE archiviate int; vive int; totali int;
BEGIN
  SELECT count(*) INTO archiviate FROM reference_sync.source_exports
   WHERE source_export_name IN ('db-export-2026-05-15', 'legacy-live-wave2-D', 'legacy-live-wave2-E')
     AND source_export_status = 'ARCHIVED';
  IF archiviate <> 3 THEN
    RAISE EXCEPTION '000348: attese 3 sorgenti brownfield archiviate, trovate %', archiviate;
  END IF;

  SELECT count(*) INTO vive FROM reference_sync.source_exports
   WHERE source_export_name IN ('ATECO_2025', 'ESCO', 'ESCO_SKILL_HIERARCHY')
     AND source_export_status <> 'ARCHIVED';
  IF vive <> 3 THEN
    RAISE EXCEPTION '000348: le 3 sorgenti VIVE dovevano restare tali, ne risultano % — la sincronizzazione e'' stata spenta', vive;
  END IF;

  -- nessuna riga persa: si archivia, non si cancella
  SELECT count(*) INTO totali FROM reference_sync.source_exports;
  IF totali < 6 THEN
    RAISE EXCEPTION '000348: % righe in source_exports, ne servivano almeno 6 — una provenienza e'' sparita', totali;
  END IF;

  RAISE NOTICE '000348 ok — 3 sorgenti brownfield archiviate (provenienza conservata) · 3 vive intatte · % righe totali', totali;
END $$;
