-- ============================================================================
-- 000462, INVERSA (fuori catena): toglie T1, T2, le regole e il legame del lavoro (ADR-0049). NON e' una
-- migrazione: non gira al deploy.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/onda2/000462-inversa.sql
--
-- GUARDIA (C11). Si rifiuta se una delle tre tabelle ha righe o una delle quattro colonne nuove ha un
-- valore: prima si lancia l'inversa del riempimento (db/scripts/attivita/riempi-attivita-dei-processi-inversa.sql),
-- e tornare indietro con dati dentro e' una decisione dell'Amministratore di Sistema.
-- Vale insieme al ritiro del file 000462 (ADR-0035): con il file nella catena, il deploy dopo lo rimette.
-- Idempotente: cio' che non c'e' piu' non da' errore.
-- ============================================================================
BEGIN;
DO $$
DECLARE n bigint; problemi text := '';
BEGIN
  IF to_regclass('sys.sys_tenant_processes') IS NOT NULL THEN
    SELECT count(*) INTO n FROM sys.sys_tenant_processes; IF n <> 0 THEN problemi := problemi || format(' sys_tenant_processes=%s', n); END IF;
    SELECT count(*) INTO n FROM sys.sys_tenant_process_steps; IF n <> 0 THEN problemi := problemi || format(' sys_tenant_process_steps=%s', n); END IF;
    SELECT count(*) INTO n FROM sys.sys_tenant_process_activity_rules; IF n <> 0 THEN problemi := problemi || format(' regole=%s', n); END IF;
    SELECT count(*) INTO n FROM sys.sys_approval_requests WHERE approval_request_tenant_process_id IS NOT NULL OR approval_request_tenant_process_step_id IS NOT NULL;
    IF n <> 0 THEN problemi := problemi || format(' richieste collegate=%s', n); END IF;
    SELECT count(*) INTO n FROM sys.sys_projects WHERE project_tenant_process_id IS NOT NULL; IF n <> 0 THEN problemi := problemi || format(' progetti collegati=%s', n); END IF;
    SELECT count(*) INTO n FROM sys.sys_organization_unit_processes WHERE org_unit_process_tenant_process_id IS NOT NULL;
    IF n <> 0 THEN problemi := problemi || format(' unita'' di processo collegate=%s', n); END IF;
  END IF;
  IF problemi <> '' THEN RAISE EXCEPTION '000462-inversa: ci sono dati, non si toglie niente:%', problemi; END IF;
END $$;

DROP VIEW IF EXISTS sys.v_projects_process_cross_tenant;
DROP VIEW IF EXISTS sys.v_approval_requests_process_cross_tenant;
DROP VIEW IF EXISTS sys.v_tenant_process_activity_rules_cross_tenant;
DROP VIEW IF EXISTS sys.v_tenant_process_steps_cross_tenant;
DROP VIEW IF EXISTS sys.v_tenant_processes_cross_tenant;
DROP TRIGGER IF EXISTS sys_approval_requests_process_from_rule ON sys.sys_approval_requests;
DROP FUNCTION IF EXISTS sys.fn_approval_request_process_from_rule();
ALTER TABLE sys.sys_projects DROP COLUMN IF EXISTS project_tenant_process_id;
ALTER TABLE sys.sys_approval_requests DROP CONSTRAINT IF EXISTS sys_approval_requests_step_needs_process_ck;
ALTER TABLE sys.sys_approval_requests DROP COLUMN IF EXISTS approval_request_tenant_process_step_id;
ALTER TABLE sys.sys_approval_requests DROP COLUMN IF EXISTS approval_request_tenant_process_id;
DROP TABLE IF EXISTS sys.sys_tenant_process_activity_rules;
DROP TABLE IF EXISTS sys.sys_tenant_process_steps;
ALTER TABLE sys.sys_organization_unit_processes DROP COLUMN IF EXISTS org_unit_process_tenant_process_id;
DROP TABLE IF EXISTS sys.sys_tenant_processes;
COMMIT;
