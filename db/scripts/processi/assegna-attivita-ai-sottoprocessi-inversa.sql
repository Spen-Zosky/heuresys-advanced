-- Inversa di assegna-attivita-ai-sottoprocessi.sql: rimette processo e ordinale di prima dal giornale
-- staging.attivita_sottoprocessi_undo, solo per le attivita' ancora sul processo scritto dalla corsa.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE rimesse ON COMMIT DROP AS
WITH r AS (
  UPDATE sys.sys_tenant_process_steps st
     SET tenant_process_step_process_id = u.processo_prima, tenant_process_step_ordinal = u.ordinale_prima
    FROM staging.attivita_sottoprocessi_undo u
   WHERE st.tenant_process_step_id = u.attivita_id AND st.tenant_process_step_process_id = u.processo_dopo
  RETURNING st.tenant_process_step_id
) SELECT tenant_process_step_id FROM r;

DELETE FROM staging.attivita_sottoprocessi_undo u USING rimesse r WHERE u.attivita_id = r.tenant_process_step_id;

DO $$
DECLARE n int; resto int;
BEGIN
  SELECT count(*) INTO n FROM rimesse;
  SELECT count(*) INTO resto FROM staging.attivita_sottoprocessi_undo;
  RAISE NOTICE 'inversa: % attivita'' rimesse sul loro processo, % righe di giornale non rimesse', n, resto;
END $$;

COMMIT;
