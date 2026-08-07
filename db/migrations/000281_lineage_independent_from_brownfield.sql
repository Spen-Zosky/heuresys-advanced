-- ═══════════════════════════════════════════════════════════════════════════════
-- 000281_lineage_independent_from_brownfield.sql
--
-- #164 FASE 2 — LA TRACCIABILITA' SMETTE DI DIPENDERE DALL'ADATTAMENTO BROWNFIELD.
--
-- LA DOMANDA CHE LA TRACCIABILITA' DEVE SAPER RISPONDERE e' «questo dato da dove
-- viene?». Misurato il 2026-08-07 su `sys.sys_source_lineage_records`:
--   · 70.959 righe in totale;
--   · 70.959 — cioe' TUTTE — portano in chiaro sistema, tabella e identificativo
--     di origine (79 tabelle legacy distinte verso 36 tabelle `sys.*`);
--   · solo 44.744 hanno `source_lineage_import_run_id` e 57.053
--     `source_lineage_table_mapping_id`.
-- I due riferimenti sono quindi metadati di ESECUZIONE (quale corsa d'import,
-- quale mappatura), parziali per costruzione: non sono la provenienza, e
-- scioglierli non toglie nulla alla risposta.
--
-- PERCHE' ADESSO, E PERCHE' E' URGENTE PIU' DI QUANTO SEMBRI. I due vincoli sono
-- dichiarati `ON DELETE SET NULL`. Cioe' oggi, nel momento in cui la fase 4 di
-- #164 rimuovesse le tabelle `brownfield`, PostgreSQL non si limiterebbe a
-- lasciar cadere il vincolo: **azzererebbe 44.744 e 57.053 valori storici**,
-- silenziosamente e senza che nessuno lo chieda. La fase 2 esiste per impedirlo,
-- ed e' per questo che il piano la mette obbligatoriamente prima della fase 4.
--
-- COSA FA. Scioglie i due vincoli e CONSERVA le colonne con i loro valori: da
-- riferimenti vivi diventano valori storici, che continuano a dire «questa riga
-- e' arrivata con la corsa X, secondo la mappatura Y» anche quando la corsa e la
-- mappatura non esistono piu' come righe. E' esattamente cio' che si vuole da un
-- archivio: sopravvivere alla sorgente.
--
-- COSA NON FA. Non tocca una sola riga di dati, non rimuove colonne, non tocca
-- lo schema `brownfield`. La rimozione delle tabelle e' la fase 4, e ha come
-- precondizione la fase 3 (il ritiro della funzionalita': 14 endpoint, una
-- pagina attiva, 3 permessi RBAC).
--
-- Idempotente: `DROP CONSTRAINT IF EXISTS`. Rieseguirla non fa nulla.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE sys.sys_source_lineage_records
  DROP CONSTRAINT IF EXISTS sys_source_lineage_records_source_lineage_import_run_id_fkey,
  DROP CONSTRAINT IF EXISTS sys_source_lineage_records_source_lineage_table_mapping_id_fkey;

DO $mig$
DECLARE
  v_fk    bigint;
  v_tot   bigint;
  v_chiar bigint;
  v_run   bigint;
  v_map   bigint;
BEGIN
  -- POST-CONDIZIONE 1 — nessun vincolo residuo da questa tabella verso brownfield.
  SELECT count(*) INTO v_fk
    FROM pg_constraint c
    JOIN pg_class t  ON t.oid  = c.conrelid  JOIN pg_namespace n  ON n.oid  = t.relnamespace
    JOIN pg_class ft ON ft.oid = c.confrelid JOIN pg_namespace fn ON fn.oid = ft.relnamespace
   WHERE c.contype = 'f' AND n.nspname = 'sys'
     AND t.relname = 'sys_source_lineage_records' AND fn.nspname = 'brownfield';
  IF v_fk > 0 THEN
    RAISE EXCEPTION '000281: restano % vincoli dalla tracciabilita verso brownfield', v_fk;
  END IF;

  -- POST-CONDIZIONE 2 — i valori NON sono stati persi, e la provenienza in chiaro
  -- resta totale. E' il punto: sciogliere un vincolo non deve svuotare una colonna.
  SELECT count(*),
         count(*) FILTER (WHERE source_lineage_source_system   IS NOT NULL
                            AND source_lineage_source_table    IS NOT NULL
                            AND source_lineage_source_record_id IS NOT NULL),
         count(source_lineage_import_run_id),
         count(source_lineage_table_mapping_id)
    INTO v_tot, v_chiar, v_run, v_map
    FROM sys.sys_source_lineage_records;

  IF v_tot > 0 AND v_chiar <> v_tot THEN
    RAISE EXCEPTION '000281: la provenienza in chiaro non e piu totale: % su %', v_chiar, v_tot;
  END IF;
  -- La soglia non e' un numero scritto a mano: si pretende solo che le colonne non
  -- siano state AZZERATE. Su un clone di CI i conteggi sono diversi da quelli di
  -- produzione, e un valore atteso fisso renderebbe questa migrazione una
  -- fotografia — cioe' rossa altrove per ragioni che non sono difetti.
  IF v_tot > 0 AND v_run = 0 AND v_map = 0 THEN
    RAISE EXCEPTION '000281: entrambe le colonne di esecuzione sono vuote su % righe: lo scioglimento le ha azzerate', v_tot;
  END IF;

  RAISE NOTICE '000281 done: tracciabilita indipendente — % righe, % con provenienza in chiaro, % con corsa d''import, % con mappatura (ora valori storici)',
    v_tot, v_chiar, v_run, v_map;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — solo finche' le tabelle brownfield esistono ancora (fase 4 non fatta)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEGIN;
--   ALTER TABLE sys.sys_source_lineage_records
--     ADD CONSTRAINT sys_source_lineage_records_source_lineage_import_run_id_fkey
--       FOREIGN KEY (source_lineage_import_run_id)
--       REFERENCES brownfield.import_runs(import_run_id) ON DELETE SET NULL,
--     ADD CONSTRAINT sys_source_lineage_records_source_lineage_table_mapping_id_fkey
--       FOREIGN KEY (source_lineage_table_mapping_id)
--       REFERENCES brownfield.table_mappings(table_mapping_id) ON DELETE SET NULL;
-- COMMIT;
