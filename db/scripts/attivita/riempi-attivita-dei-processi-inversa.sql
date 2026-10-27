-- ============================================================================
-- Inversa di riempi-attivita-dei-processi.sql (ADR-0049). FUORI CATENA. Si lancia a mano, per una corsa:
--
--   psql -v ON_ERROR_STOP=1 -v run_id=<uuid> -f db/scripts/attivita/riempi-attivita-dei-processi-inversa.sql
--
-- Toglie il legame dalle richieste e dalle unita' di processo collegate da quella corsa, toglie le regole e
-- le attivita' che quella corsa ha creato (l'elenco e' il giornale, non una condizione), e DISATTIVA i
-- processi del tenant che ha creato: non li cancella. Marca le righe del giornale come annullate.
-- Si rifiuta se la corsa non c'e', se e' gia' annullata, o se una richiesta collegata ha nel frattempo un
-- processo diverso da quello che la corsa le aveva scritto.
-- ============================================================================
\if :{?run_id}
\else
  \echo 'serve -v run_id=<uuid>'
  \quit
\endif
BEGIN;
SELECT set_config('attivita.inversa_run', :'run_id', true);
DO $$
DECLARE v_run uuid := current_setting('attivita.inversa_run')::uuid; v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM staging.attivita_processi_undo WHERE run_id = v_run AND annullato_il IS NULL;
  IF v_n = 0 THEN RAISE EXCEPTION 'inversa: la corsa % non ha righe da annullare', v_run; END IF;

  SELECT count(*) INTO v_n FROM staging.attivita_processi_undo u JOIN sys.sys_approval_requests a ON a.approval_request_id = u.riga_id
   WHERE u.run_id = v_run AND u.tabella = 'sys_approval_requests' AND a.approval_request_tenant_process_id IS DISTINCT FROM u.valore_dopo;
  IF v_n <> 0 THEN RAISE EXCEPTION 'inversa: % richieste hanno cambiato processo dopo la corsa: non si tocca niente', v_n; END IF;

  UPDATE sys.sys_approval_requests a SET approval_request_tenant_process_id = NULL, approval_request_tenant_process_step_id = NULL
    FROM staging.attivita_processi_undo u WHERE u.run_id = v_run AND u.tabella = 'sys_approval_requests' AND u.riga_id = a.approval_request_id;
  DELETE FROM sys.sys_tenant_process_activity_rules r USING staging.attivita_processi_undo u
   WHERE u.run_id = v_run AND u.tabella = 'sys_tenant_process_activity_rules' AND u.riga_id = r.tenant_process_activity_rule_id;
  DELETE FROM sys.sys_tenant_process_steps s USING staging.attivita_processi_undo u
   WHERE u.run_id = v_run AND u.tabella = 'sys_tenant_process_steps' AND u.riga_id = s.tenant_process_step_id;
  UPDATE sys.sys_organization_unit_processes o SET org_unit_process_tenant_process_id = NULL
    FROM staging.attivita_processi_undo u WHERE u.run_id = v_run AND u.tabella = 'sys_organization_unit_processes' AND u.riga_id = o.organization_unit_process_id;
  UPDATE sys.sys_tenant_processes tp SET tenant_process_is_active = false
    FROM staging.attivita_processi_undo u WHERE u.run_id = v_run AND u.tabella = 'sys_tenant_processes' AND u.riga_id = tp.tenant_process_id;
  UPDATE staging.attivita_processi_undo SET annullato_il = clock_timestamp() WHERE run_id = v_run AND annullato_il IS NULL;
  RAISE NOTICE 'inversa: corsa % annullata', v_run;
END $$;
COMMIT;
