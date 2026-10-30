-- ============================================================================
-- 000464, INVERSA (fuori catena): toglie il registro dell'agente di consolidamento (AC-3).
-- NON e' una migrazione: non gira al deploy.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/consolidamento/inversa-000464.sql
--
-- GUARDIA. Si rifiuta se una delle sei tabelle ha righe: tornare indietro dopo un consolidamento vero
-- cancellerebbe decisioni di persone, ed e' una decisione dell'Amministratore di Sistema.
-- Vale insieme al ritiro del file 000464 e delle sue righe in 000429 e 000062 (ADR-0035).
-- Idempotente: cio' che non c'e' piu' non da' errore.
-- ============================================================================
BEGIN;
DO $$
DECLARE t text; n bigint; problemi text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['sys_tenant_consolidations', 'sys_tenant_consolidation_rounds',
    'sys_tenant_consolidation_working_items', 'sys_tenant_consolidation_proposals',
    'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences'] LOOP
    IF to_regclass('sys.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM sys.%I', t) INTO n;
      IF n <> 0 THEN problemi := problemi || format(' %s=%s', t, n); END IF;
    END IF;
  END LOOP;
  IF problemi <> '' THEN RAISE EXCEPTION '000464-inversa: ci sono dati, non si toglie niente:%', problemi; END IF;
END $$;

DROP TABLE IF EXISTS sys.sys_tenant_consolidation_decisions;
DROP TABLE IF EXISTS sys.sys_tenant_consolidation_proposals;
DROP TABLE IF EXISTS sys.sys_tenant_consolidation_working_items;
DROP TABLE IF EXISTS sys.sys_tenant_consolidation_rounds;
DROP TABLE IF EXISTS sys.sys_tenant_consolidations;
DROP TABLE IF EXISTS sys.sys_platform_vocabulary_equivalences;
DELETE FROM sys.sys_classificazione_direzione_dato WHERE tabella IN ('sys_tenant_consolidations',
  'sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_working_items', 'sys_tenant_consolidation_proposals',
  'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences');
DELETE FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name IN ('sys_tenant_consolidations',
  'sys_tenant_consolidation_rounds', 'sys_tenant_consolidation_working_items', 'sys_tenant_consolidation_proposals',
  'sys_tenant_consolidation_decisions', 'sys_platform_vocabulary_equivalences');
COMMIT;
