-- Inversa di colloca-sottoprocessi.sql: rimette livello e genitore com'erano, dal giornale
-- staging.processi_sottoprocessi_undo, solo sulle righe che la collocazione ha toccato e che nessuno ha
-- cambiato dopo (genitore e livello ancora quelli scritti). Poi svuota il giornale delle righe rimesse.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE rimesse ON COMMIT DROP AS
WITH r AS (
  UPDATE sys.sys_tenant_processes t
     SET tenant_process_parent_id = u.genitore_prima, tenant_process_level = u.livello_prima
    FROM staging.processi_sottoprocessi_undo u
   WHERE t.tenant_process_id = u.processo_id AND t.tenant_process_level = 2
  RETURNING t.tenant_process_id
) SELECT tenant_process_id FROM r;

DELETE FROM staging.processi_sottoprocessi_undo u USING rimesse r WHERE u.processo_id = r.tenant_process_id;

DO $$
DECLARE n int; resto int;
BEGIN
  SELECT count(*) INTO n FROM rimesse;
  SELECT count(*) INTO resto FROM staging.processi_sottoprocessi_undo;
  RAISE NOTICE 'inversa: % processi rimessi al loro livello, % righe di giornale non rimesse', n, resto;
END $$;

COMMIT;
