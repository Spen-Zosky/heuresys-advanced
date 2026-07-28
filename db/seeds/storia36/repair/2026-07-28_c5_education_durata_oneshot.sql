-- ============================================================================
-- storia36 C5 — riparazione one-shot: i titoli di studio non hanno una durata.
--
-- Misura: 160 record di istruzione, 159 con la data di FINE (1988-2019) e solo
-- 3 con quella di INIZIO. Un percorso di studi senza inizio non dice quanto è
-- durato, e soprattutto non permette di vincolare l'inizio della carriera
-- lavorativa — che è l'ancora di tutto il cluster C5. Rilievo registrato al C0
-- («C5: education records start 3 valori vs end 159»), triage esito (c).
--
-- La durata NON è inventata: è quella ordinamentale del titolo conseguito.
--   DIP  diploma di scuola secondaria      5 anni
--   BSC  laurea triennale                  3 anni
--   MSC  laurea magistrale                 2 anni (dopo la triennale)
--   MBA  master                            2 anni
--   PHD  dottorato                         3 anni
-- Sono le durate legali dei corrispondenti percorsi italiani; dove il titolo non
-- è riconosciuto si lascia la riga com'è (e C5e la segnalerà).
--
-- Idempotente: alla seconda corsa non trova più righe senza inizio.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint;
BEGIN
  UPDATE sys.sys_user_education_records e
     SET user_education_start_date =
           (e.user_education_end_date - (CASE upper(e.user_education_degree)
              WHEN 'DIP' THEN 5 WHEN 'BSC' THEN 3 WHEN 'MSC' THEN 2
              WHEN 'MBA' THEN 2 WHEN 'PHD' THEN 3 END * 365))::date,
         user_education_metadata = e.user_education_metadata
           || jsonb_build_object('storia36_repair', 'C5-durata-titolo')
   WHERE e.user_education_start_date IS NULL
     AND e.user_education_end_date IS NOT NULL
     AND upper(e.user_education_degree) IN ('DIP','BSC','MSC','MBA','PHD');
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C5 repair: % titoli di studio con la durata ordinamentale', v_n;

  -- coerenza elementare: nessun inizio dopo la fine
  UPDATE sys.sys_user_education_records e
     SET user_education_start_date = (e.user_education_end_date - 365)::date,
         user_education_metadata = e.user_education_metadata
           || jsonb_build_object('storia36_repair', 'C5-inizio-dopo-fine')
   WHERE e.user_education_start_date IS NOT NULL
     AND e.user_education_end_date IS NOT NULL
     AND e.user_education_start_date > e.user_education_end_date;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C5 repair: % percorsi che iniziavano dopo essere finiti', v_n;
END $$;

COMMIT;
