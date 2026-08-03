-- 000238_purge_orphan_kpi_translations.sql
--
-- Coda della bonifica 000235: le traduzioni dei KPI rimossi erano rimaste
-- appese.
--
-- La 000235 rimuove 42 definizioni KPI blueprint di due aziende che in questo
-- prodotto non esistono, e rimuove le traduzioni delle famiglie professionali
-- — ma non quelle dei KPI. Risultato: 84 righe (42 KPI x 2 lingue) che puntano
-- a un identificativo che non risolve piu'.
--
-- Il difetto non e' stato notato leggendo il codice: e' stata la sentinella
-- `v_reference_translation_orphans` ad accendersi, passando da 0 a 84 subito
-- dopo la bonifica. E' esattamente il lavoro per cui quelle viste erano state
-- scritte, e nessuno le interrogava prima che il cruscotto le accendesse.
--
-- Il criterio qui e' la sentinella stessa, non un elenco scritto a mano: si
-- rimuove cio' che la vista dichiara orfano. Cosi' la migrazione resta corretta
-- anche se il numero cambia, e l'esito e' verificabile rileggendo la vista.
BEGIN;

DELETE FROM sys.sys_reference_translations t
 WHERE t.reference_translation_id IN (
   SELECT o.reference_translation_id FROM sys.v_reference_translation_orphans o
    WHERE o.entity_table = 'sys_kpi_definitions');

DO $$
DECLARE v_orfani int;
BEGIN
  SELECT count(*) INTO v_orfani FROM sys.v_reference_translation_orphans;
  IF v_orfani > 0 THEN
    RAISE NOTICE '000238: restano % traduzioni orfane su altre entita'' — '
                 'la sentinella le elenca per tabella.', v_orfani;
  END IF;
END $$;

COMMIT;
