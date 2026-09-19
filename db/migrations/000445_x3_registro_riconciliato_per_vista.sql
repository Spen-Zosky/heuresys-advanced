-- 000445_x3_registro_riconciliato_per_vista.sql
-- Mandato K, X-3, passo 63 — il registro di provenienza si riconcilia PER VISTA, non per
-- riscrittura.
--
-- PERCHE'. `sys.sys_source_lineage_records` usa DUE grafie per il nome della tabella
-- bersaglio (misurato I-D, 2026-09-15): 64.577 righe senza prefisso `sys.` (29 tabelle) e
-- 6.382 CON prefisso (7 tabelle: sys_attendance, sys_time_off_balances, sys_overtime,
-- sys_users, sys_time_off_requests, sys_leave_balance_transactions,
-- sys_leave_accrual_rules) — nessuna tabella nelle due grafie insieme, 36 tabelle
-- normalizzate in tutto. Le 6.382 righe con prefisso sono storia (V5, il rubinetto del
-- brownfield e' chiuso: ADR-0038, oggi NON esiste un "prossimo scrittore" del registro) e
-- NON si riscrivono. La riconciliazione e' una vista che normalizza il nome, non una
-- migrazione che tocca le righe.
--
-- Vista v_source_lineage_normalizzata: tutte le colonne di sys_source_lineage_records piu'
-- tabella_norm = replace(target_table_name,'sys.',''). I quattro consumatori che oggi
-- leggono target_table_name grezzo (I-D §1) passano a leggere da qui in un commit separato,
-- uno per file:
--   apps/api/src/modules/provenance/repository.ts:53, :95, :105
--   apps/api/src/modules/evidence/repository.ts:189
--
-- Sentinella v_registro_provenienza_prefisso_nuovo: righe CON prefisso scritte DOPO questa
-- migrazione. Nasce a 0 (nessuno scrittore vivo oggi) e deve restarci: un valore positivo
-- vorrebbe dire che e' rinato un produttore del registro che usa ancora la grafia vecchia,
-- il gesto che questa sentinella esiste per intercettare.
--
-- Idempotente: CREATE OR REPLACE VIEW. Rollback dichiarato: DROP VIEW (nessuna riga tocca
-- lo schema o i dati sottostanti, solo le due viste).

BEGIN;

CREATE OR REPLACE VIEW sys.v_source_lineage_normalizzata AS
SELECT
  source_lineage_record_id,
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_source_content_hash,
  source_lineage_import_run_id,
  source_lineage_table_mapping_id,
  source_lineage_target_table_name,
  replace(source_lineage_target_table_name, 'sys.', '') AS tabella_norm,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata,
  created_at,
  source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id,
  source_lineage_sdbi_human_approver
FROM sys.sys_source_lineage_records;

COMMENT ON VIEW sys.v_source_lineage_normalizzata IS
  'X-3 (mandato K, mig 000445): il registro di provenienza con tabella_norm = replace(target_table_name,''sys.'','''') — le due grafie storiche (36 tabelle, nessuna in entrambe) riconciliate senza riscrivere le 6.382 righe con prefisso (V5, storia). I consumatori del registro leggono da qui, non dalla tabella grezza.';

CREATE OR REPLACE VIEW sys.v_registro_provenienza_prefisso_nuovo AS
SELECT source_lineage_record_id, source_lineage_target_table_name, created_at
  FROM sys.sys_source_lineage_records
 WHERE source_lineage_target_table_name LIKE 'sys.%'
   AND created_at > (
     SELECT applied_at FROM sys.sys_schema_migrations
      WHERE file_name LIKE '000445_%' ORDER BY applied_at DESC LIMIT 1
   );

COMMENT ON VIEW sys.v_registro_provenienza_prefisso_nuovo IS
  'X-3 (mandato K, mig 000445): righe del registro CON prefisso scritte DOPO l''applicazione di questa migrazione (cutoff letto da sys_schema_migrations, non un timestamp indovinato). Deve restare a ZERO — oggi non esiste alcuno scrittore vivo del registro (ADR-0038); una riga qui vorrebbe dire che un nuovo scrittore usa ancora la grafia vecchia.';

-- Post-condizione: la vista conta le stesse 36 tabelle normalizzate misurate da I-D, e
-- nessuna tabella compare due volte (una con prefisso, una senza, sotto lo stesso nome
-- normalizzato — sarebbe un doppio conteggio che la normalizzazione dovrebbe impedire).
DO $$
DECLARE
  v_tabelle integer;
  v_doppie  integer;
BEGIN
  SELECT count(DISTINCT tabella_norm) INTO v_tabelle FROM sys.v_source_lineage_normalizzata;
  IF v_tabelle <> 36 THEN
    RAISE EXCEPTION '000445: % tabelle normalizzate nel registro, attese 36 (misura I-D 2026-09-15)', v_tabelle;
  END IF;

  SELECT count(*) INTO v_doppie FROM (
    SELECT tabella_norm
      FROM sys.v_source_lineage_normalizzata
     GROUP BY tabella_norm
    HAVING count(DISTINCT source_lineage_target_table_name) > 1
  ) x;
  IF v_doppie <> 0 THEN
    RAISE EXCEPTION '000445: % tabelle normalizzate compaiono in ENTRAMBE le grafie (con e senza prefisso): I-D dichiarava 0', v_doppie;
  END IF;

  RAISE NOTICE '000445 OK — 36 tabelle normalizzate, nessuna in doppia grafia, sentinella prefisso-nuovo pronta';
END $$;

COMMIT;
-- FINE 000445
