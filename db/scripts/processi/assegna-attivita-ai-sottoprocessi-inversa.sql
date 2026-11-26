-- Inversa di assegna-attivita-ai-sottoprocessi.sql: rimette processo e ordinale di prima dal giornale
-- staging.attivita_sottoprocessi_undo, solo per le attivita' ancora sul processo scritto dalla corsa.
\set ON_ERROR_STOP on
BEGIN;
-- Blocco contro scritture concorrenti fra la lettura e lo spostamento.
LOCK TABLE sys.sys_tenant_process_steps IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE sys.sys_tenant_process_activity_rules, sys.sys_approval_requests IN SHARE MODE;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM staging.attivita_sottoprocessi_undo u
    JOIN sys.sys_tenant_process_steps st ON st.tenant_process_step_id = u.attivita_id AND st.tenant_process_step_process_id = u.processo_dopo
   WHERE EXISTS (SELECT 1 FROM sys.sys_tenant_process_activity_rules r WHERE r.tenant_process_activity_rule_step_id = u.attivita_id)
      OR EXISTS (SELECT 1 FROM sys.sys_approval_requests a WHERE a.approval_request_tenant_process_step_id = u.attivita_id);
  IF n <> 0 THEN RAISE EXCEPTION 'guardia: % attivita'' da rimettere sono citate da regole o richieste, niente scritto', n; END IF;
END $$;

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
DECLARE n int; resto int; dif int;
BEGIN
  SELECT count(*) INTO dif FROM (
    SELECT riga FROM sys.v_tenant_process_steps_cross_tenant
    UNION ALL SELECT riga FROM sys.v_tenant_process_activity_rules_cross_tenant
    UNION ALL SELECT riga FROM sys.v_approval_requests_process_cross_tenant) x;
  IF dif <> 0 THEN RAISE EXCEPTION 'post-condizione: % difetti nelle sentinelle di 000462', dif; END IF;
  SELECT count(*) INTO n FROM rimesse;
  SELECT count(*) INTO resto FROM staging.attivita_sottoprocessi_undo;
  RAISE NOTICE 'inversa: % attivita'' rimesse sul loro processo, % righe di giornale non rimesse', n, resto;
END $$;

COMMIT;
