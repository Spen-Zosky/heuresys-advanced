-- ============================================================================
-- 000335 — I processi hanno una casa sola, ed e' quella dove abitano gia'. (#132 F5)
--
-- LA DOMANDA, E LA MISURA CHE LA CHIUDE. Dal 2026-08-19 il dominio «processi» aveva **due**
-- case: `sys_blueprint_process_registry` (mig. `000008`) e `sys_blueprint_content_processes`,
-- creata dalla `000327` per simmetria con gli altri quattro domini di contenuto. Misurato:
--
--   registry            23 righe su UNA versione di variante · **5** tabelle la referenziano
--                       · **111** righe vive vi puntano · i moduli del fascicolo la usano
--   content_processes    0 righe · **0** referenze · **nessun file di codice** la nomina
--
-- IL REPERTO CHE DECIDE: fra le cinque referenze c'e' `sys_tenant_blueprint_process_decisions`
-- — le decisioni del consulente sui processi del fascicolo, 7 righe vive da `#131` P1.
-- Scegliere la casa nuova vorrebbe dire che le decisioni gia' prese non hanno piu' a cosa
-- agganciarsi. Le altre quattro: `sys_blueprint_overrides` (7), `sys_process_kpi_templates` (0),
-- `sys_content_blueprint_links` (1), `sys_organization_unit_processes` (96).
--
-- E LA CONTRAPPOSIZIONE «POSIZIONE CONTRO UNITA'» NON REGGE ALLA MISURA. Le 96 righe di
-- `sys_organization_unit_processes` portano `org_unit_process_tenant_id` e sono una matrice
-- RACI del **cliente** (OWNER 23 · CONSULTED 22 · INFORMED 23 · CONTRIBUTOR 28), non contenuto
-- di modello. `owner_position_code` e' invece **contenuto**: chi presidia quel processo nel
-- modello. Due strati, non due modi di dire la stessa cosa — e infatti si tengono entrambi.
--
-- COSA FA:
--   ② la casa vecchia prende le due colonne che la nuova aveva e lei no: il **nome inglese**
--      (E16, «ogni proposta nasce bilingue» — misurato: **0 su 23** processi ne ha uno oggi) e
--      il **presidio per codice di posizione**;
--   ③ la casa nuova si ritira: 0 righe, 0 referenze, 0 file di codice.
--
-- ADR-0035 — SENZA L'EMENDAMENTO QUESTO RITIRO NON ESISTE. La catena si ri-applica per intero
-- a ogni deploy: un `DROP` qui e un `CREATE TABLE IF NOT EXISTS` nella `000327` farebbero
-- rinascere la tabella al giro dopo, e il registro oscillerebbe fra due stati. Percio' la
-- `000327` e' stata emendata alla fonte — via il blocco ⑤ **e** la sua riga nel registro di
-- riconciliazione — e questo file toglie l'esemplare esistente.
--
-- IDEMPOTENTE: `ADD COLUMN IF NOT EXISTS`, `DROP TABLE IF EXISTS`, `DELETE` ristretta.
-- ROLLBACK: le due colonne si tolgono con `DROP COLUMN`; la tabella ritirata si ricostruisce
-- dal blocco ⑤ della `000327` com'era al commit `97eb1072`. Nessun dato da rimettere: era
-- vuota, e la misura qui sotto lo ri-verifica al momento dell'esecuzione invece di ereditarlo.
-- ============================================================================
BEGIN;

-- ── ① la misura PRIMA, e la guardia ri-verificata adesso ─────────────────────
DO $$
DECLARE n_registry int; n_content int; n_ref int;
BEGIN
  SELECT count(*) INTO n_registry FROM sys.sys_blueprint_process_registry;

  IF to_regclass('sys.sys_blueprint_content_processes') IS NULL THEN
    RAISE NOTICE '000335: la casa nuova non esiste (gia'' ritirata, o database creato dopo l''emendamento)';
  ELSE
    EXECUTE 'SELECT count(*) FROM sys.sys_blueprint_content_processes' INTO n_content;
    -- ⚠ LA GUARDIA NON SI EREDITA. «Era vuota» e' una misura di ieri: se qualcuno vi avesse
    -- scritto nel frattempo, questo DROP porterebbe via del contenuto senza dirlo.
    IF n_content <> 0 THEN
      RAISE EXCEPTION '000335: la tabella da ritirare contiene % righe. Non si ritira niente che abbia dentro qualcosa: vanno guardate una per una.', n_content;
    END IF;

    SELECT count(*) INTO n_ref
      FROM pg_constraint con
      JOIN pg_class tgt ON tgt.oid = con.confrelid
     WHERE con.contype = 'f' AND tgt.relname = 'sys_blueprint_content_processes';
    IF n_ref <> 0 THEN
      RAISE EXCEPTION '000335: % chiavi esterne puntano ancora alla tabella da ritirare', n_ref;
    END IF;
  END IF;

  RAISE NOTICE '000335: processi nella casa vecchia: % · casa nuova: vuota e senza referenti', n_registry;
END $$;

-- ── ② la casa vecchia prende cio' che le mancava ─────────────────────────────
ALTER TABLE sys.sys_blueprint_process_registry
  ADD COLUMN IF NOT EXISTS blueprint_process_name_en varchar(255);
ALTER TABLE sys.sys_blueprint_process_registry
  ADD COLUMN IF NOT EXISTS blueprint_process_owner_position_code varchar(64);

COMMENT ON COLUMN sys.sys_blueprint_process_registry.blueprint_process_name_en IS
  'Il nome del processo in inglese (#132 F5, decisione E16: ogni proposta nasce bilingue, e la '
  'traduzione fa parte della proposta — non di un passaggio successivo che nessuno guarda). '
  'NULLO per i processi nati prima della ricerca: misurati 23 su 23 il 2026-08-19.';
COMMENT ON COLUMN sys.sys_blueprint_process_registry.blueprint_process_owner_position_code IS
  'Chi presidia il processo NEL MODELLO, per codice di posizione (#132 F5). Non e'' la matrice '
  'RACI del cliente — quella vive in `sys_organization_unit_processes` e lega il processo alle '
  'UNITA'' di un tenant: sono due strati, e si tengono entrambi.';

-- ── ③ il ritiro della casa nuova ─────────────────────────────────────────────
DROP TABLE IF EXISTS sys.sys_blueprint_content_processes;

-- La riga nel registro di riconciliazione descriveva una tabella che non c'e' piu'.
-- Elenco esplicito, mai un carattere jolly.
DELETE FROM sys.sys_reconciliation_registry
 WHERE reconciliation_registry_table_name = 'sys_blueprint_content_processes';

-- ── ④ le post-condizioni ─────────────────────────────────────────────────────
DO $$
DECLARE n int; v_col int;
BEGIN
  -- 1. CIO' CHE NON DOVEVA CAMBIARE, ed e' la parte che conta: i 23 processi e le 111 righe
  --    che vi puntano sono ancora tutti li'. Un ritiro che porta via un referente e' il
  --    difetto peggiore possibile qui, perche' si vede solo quando qualcuno apre il fascicolo.
  SELECT count(*) INTO n FROM sys.sys_blueprint_process_registry;
  IF n = 0 THEN
    RAISE EXCEPTION '000335: la casa vecchia e'' vuota: il ritiro ha portato via i processi';
  END IF;
  RAISE NOTICE '000335: processi ancora presenti: %', n;

  SELECT count(*) INTO n FROM sys.sys_tenant_blueprint_process_decisions d
    JOIN sys.sys_blueprint_process_registry p
      ON p.blueprint_process_id = d.tenant_blueprint_process_decision_process_id;
  RAISE NOTICE '000335: decisioni di fascicolo ancora agganciate a un processo esistente: %', n;

  SELECT count(*) INTO n FROM sys.sys_organization_unit_processes o
    LEFT JOIN sys.sys_blueprint_process_registry p
      ON p.blueprint_process_id = o.org_unit_process_blueprint_process_id
   WHERE p.blueprint_process_id IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION '000335: % assegnazioni processo→unita'' hanno perso il proprio processo', n;
  END IF;

  -- 2. CIO' CHE DOVEVA CAMBIARE: le due colonne ci sono, e la tabella ritirata non c'e' piu'.
  SELECT count(*) INTO v_col FROM information_schema.columns
   WHERE table_schema='sys' AND table_name='sys_blueprint_process_registry'
     AND column_name IN ('blueprint_process_name_en','blueprint_process_owner_position_code');
  IF v_col <> 2 THEN
    RAISE EXCEPTION '000335: la casa vecchia ha % delle 2 colonne nuove', v_col;
  END IF;

  IF to_regclass('sys.sys_blueprint_content_processes') IS NOT NULL THEN
    RAISE EXCEPTION '000335: la tabella ritirata esiste ancora';
  END IF;

  SELECT count(*) INTO n FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_table_name = 'sys_blueprint_content_processes';
  IF n <> 0 THEN
    RAISE EXCEPTION '000335: il registro di riconciliazione nomina ancora la tabella ritirata';
  END IF;

  -- 3. Le ALTRE quattro tabelle di contenuto della `000327` non sono state toccate: si
  --    ritira UNA casa, non il lavoro di F1.
  FOR v_col IN
    SELECT 1 FROM unnest(ARRAY['sys_blueprint_content_units','sys_blueprint_content_positions',
                               'sys_blueprint_content_skills','sys_blueprint_content_kpis']) AS x(t)
     WHERE to_regclass('sys.' || x.t) IS NULL
  LOOP
    RAISE EXCEPTION '000335: una delle altre quattro tabelle di contenuto e'' sparita';
  END LOOP;

  RAISE NOTICE '000335 ok — una casa sola per i processi, e le altre quattro intatte';
END $$;

COMMIT;
