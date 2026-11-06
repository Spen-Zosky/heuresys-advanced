-- ============================================================================
-- 000480, INVERSA (fuori catena): toglie il registro delle capacità degli agenti (ADR-0053 A1).
-- NON è una migrazione: non gira al deploy.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/agenti/inversa-000480.sql
--
-- GUARDIA. Si rifiuta se una delle tre tabelle ha righe: tornare indietro dopo che una capacità è
-- stata attivata cancellerebbe decisioni di persone, ed è una decisione dell'Amministratore di Sistema.
-- Vale insieme al ritiro del file 000480 e delle sue righe in 000429 e 000062 (ADR-0035).
-- Idempotente: ciò che non c'è più non dà errore.
-- ============================================================================
BEGIN;
DO $$
DECLARE t text; n bigint; problemi text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_agent_capabilities', 'sys_agent_capability_operations',
    'sys_agent_capability_activations'] LOOP
    IF to_regclass('sys.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM sys.%I', t) INTO n;
      IF n <> 0 THEN problemi := problemi || format(' %s=%s', t, n); END IF;
    END IF;
  END LOOP;
  IF problemi <> '' THEN RAISE EXCEPTION '000480-inversa: ci sono dati, non si toglie niente:%', problemi; END IF;
END $$;

DROP VIEW IF EXISTS sys.v_agent_capability_activations_current;
DROP TABLE IF EXISTS sys.sys_agent_capability_activations;
DROP TABLE IF EXISTS sys.sys_agent_capability_operations;
DROP TABLE IF EXISTS sys.sys_agent_capabilities;
DROP FUNCTION IF EXISTS sys.f_agent_capability_activation_ammessa();
DROP FUNCTION IF EXISTS sys.f_agent_capability_operations_in_bozza();
DROP FUNCTION IF EXISTS sys.f_agent_capability_immutabile();
DELETE FROM sys.sys_classificazione_direzione_dato WHERE tabella IN ('sys_agent_capabilities',
  'sys_agent_capability_operations', 'sys_agent_capability_activations');
DELETE FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name IN ('sys_agent_capabilities',
  'sys_agent_capability_operations', 'sys_agent_capability_activations');
COMMIT;
