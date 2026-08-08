-- @migrate: once
-- #164 F4 — ripopola audit.import_validation_results. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- ============================================================================
-- 000215 — ripristino dei marker di provenance SDBI truncati dalla 000213
--
-- CONTESTO. La 000213 (#60 G/G1 retention & storage) ha fatto
--   TRUNCATE TABLE audit.import_validation_results;
-- per liberare ~536 MB di DETTAGLIO per-riga delle validazioni di import,
-- dopo averlo archiviato off-DB. La policy dichiarata dalla 000213 stessa era:
--   "il dettaglio per-riga vive nell'ARCHIVIO OFF-DB, in DB restano i SOMMARI
--    per-run (audit.import_run_logs + audit.import_approval_decisions)".
--
-- DIFETTO. Nella stessa tabella vivono anche i MARKER di consolidamento
-- (`SDBI_CONSOLIDATION_COMPLETE_V1`, migration 000063): 4 righe totali, una per
-- target table, che NON sono dettaglio per-riga ma esattamente la classe
-- "sommario per-run" che la policy voleva preservare. Il TRUNCATE, indiscriminato,
-- le ha portate via con il resto. Effetto osservato: il test
-- `sdbi-perf-feedback.integration.test.ts` ("SDBI provenance") è passato da 4 a 0
-- e la CI su main è diventata rossa (run 30021420483, 2026-07-23).
--
-- RIPRISTINO. I marker sono RI-DERIVATI dal dato reale ancora integro — i 1490
-- lineage record di sys.sys_source_lineage_records, che portano mapping card,
-- confidence e ai_model_id per ciascuno dei 4 target — e NON reinseriti da una
-- lista hardcoded. Se il lineage non c'è (DB fresco), non c'è nulla da provare e
-- la migration è un no-op: zero righe inserite, nessun errore.
--
-- IDEMPOTENTE: NOT EXISTS sul marker per (rule_code, target_table).
-- Fresh-DB safe: senza lineage il SELECT sorgente è vuoto.
-- Ordine: gira DOPO la 000213, quindi un ciclo completo di migrate.sh lascia
-- la tabella con i soli marker (il dettaglio resta archiviato off-DB).
-- ============================================================================

-- Il marker è emesso solo per i target che hanno lineage REALE, e i conteggi
-- ('rows', 'lineage_rows') sono misurati live, non trascritti.
INSERT INTO audit.import_validation_results (
  import_validation_result_run_id,
  import_validation_result_source_table_id,
  import_validation_result_rule_code,
  import_validation_result_status,
  import_validation_result_message,
  import_validation_result_payload)
SELECT
  l.run_id,
  NULL,
  'SDBI_CONSOLIDATION_COMPLETE_V1',
  'PASSED',
  'SDBI Phase 5 consolidation complete for ' || l.target_table
    || '. (marker re-derived from lineage by migration 000215 — truncated by 000213)',
  jsonb_build_object(
    'sdbi_mapping_card_id', l.card_id,
    'sdbi_ai_model_id',     l.ai_model_id,
    'target_table',         l.target_table,
    'rows',                 l.target_rows,
    'lineage_rows',         l.lineage_rows,
    'restored_by',          '000215')
FROM (
  SELECT
    r.source_lineage_target_table_name                     AS target_table,
    -- niente max(uuid) in PG: prendo il run più recente per quel target.
    -- Il tie-break su record_id è necessario, non cosmetico: le righe di uno stesso
    -- import condividono created_at al millisecondo, quindi il solo ORDER BY
    -- created_at è un pareggio totale e sceglierebbe una riga arbitraria — oggi
    -- innocuo (un solo run per target), domani no, dopo un re-import con due card.
    (array_agg(r.source_lineage_import_run_id
       ORDER BY r.created_at DESC, r.source_lineage_record_id DESC))[1] AS run_id,
    (array_agg(r.source_lineage_sdbi_mapping_card_id
       ORDER BY r.created_at DESC, r.source_lineage_record_id DESC))[1] AS card_id,
    (array_agg(r.source_lineage_sdbi_ai_model_id
       ORDER BY r.created_at DESC, r.source_lineage_record_id DESC))[1] AS ai_model_id,
    count(*)                                               AS lineage_rows,
    CASE r.source_lineage_target_table_name
      WHEN 'sys_performance_reviews'
        THEN (SELECT count(*) FROM sys.sys_performance_reviews)
      WHEN 'sys_performance_review_competency_ratings'
        THEN (SELECT count(*) FROM sys.sys_performance_review_competency_ratings)
      WHEN 'sys_feedback_360_responses'
        THEN (SELECT count(*) FROM sys.sys_feedback_360_responses)
      WHEN 'sys_continuous_feedback'
        THEN (SELECT count(*) FROM sys.sys_continuous_feedback)
    END                                                    AS target_rows
  FROM sys.sys_source_lineage_records r
  WHERE r.source_lineage_target_table_name IN (
          'sys_performance_reviews', 'sys_performance_review_competency_ratings',
          'sys_feedback_360_responses', 'sys_continuous_feedback')
    AND r.source_lineage_sdbi_mapping_card_id IS NOT NULL
  GROUP BY r.source_lineage_target_table_name
) AS l
-- il run_id ricavato dal lineage deve esistere ancora in brownfield.import_runs (FK)
WHERE EXISTS (SELECT 1 FROM brownfield.import_runs ir WHERE ir.import_run_id = l.run_id)
  AND NOT EXISTS (
    SELECT 1 FROM audit.import_validation_results v
     WHERE v.import_validation_result_rule_code = 'SDBI_CONSOLIDATION_COMPLETE_V1'
       AND v.import_validation_result_payload->>'target_table' = l.target_table);

-- Post-condition (fail-loud, solo su DB popolato)
-- La post-condition deve misurare ESATTAMENTE ciò che l'INSERT sopra può produrre:
-- i target il cui lineage ha ANCORA un import_run referenziabile. La FK
-- sys_source_lineage_records.source_lineage_import_run_id è ON DELETE SET NULL,
-- quindi una futura pulizia di brownfield.import_runs (la stessa direzione della
-- 000213) renderebbe irripristinabili dei marker: contare i target "con lineage"
-- invece che "ripristinabili" trasformerebbe quel caso legittimo in una EXCEPTION
-- che aborta migrate.sh — e con esso vm-deploy.sh e la CI.
DO $$
DECLARE
  n_restorable int;
  n_markers    int;
BEGIN
  SELECT count(DISTINCT r.source_lineage_target_table_name) INTO n_restorable
    FROM sys.sys_source_lineage_records r
   WHERE r.source_lineage_target_table_name IN (
           'sys_performance_reviews', 'sys_performance_review_competency_ratings',
           'sys_feedback_360_responses', 'sys_continuous_feedback')
     AND r.source_lineage_sdbi_mapping_card_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM brownfield.import_runs ir
                  WHERE ir.import_run_id = r.source_lineage_import_run_id);

  SELECT count(DISTINCT (import_validation_result_payload->>'target_table')) INTO n_markers
    FROM audit.import_validation_results
   WHERE import_validation_result_rule_code = 'SDBI_CONSOLIDATION_COMPLETE_V1'
     AND import_validation_result_payload->>'target_table' IN (
           'sys_performance_reviews', 'sys_performance_review_competency_ratings',
           'sys_feedback_360_responses', 'sys_continuous_feedback');

  IF n_restorable = 0 THEN
    RAISE NOTICE '000215: nessun lineage SDBI con import_run ancora presente — no-op (fresh DB o run archiviati)';
  ELSIF n_markers < n_restorable THEN
    RAISE EXCEPTION '000215: marker SDBI % su % target ripristinabili', n_markers, n_restorable;
  ELSE
    RAISE NOTICE '000215: marker SDBI ripristinati/verificati per % target', n_markers;
  END IF;
END $$;
