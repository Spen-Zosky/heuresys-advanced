-- ═══════════════════════════════════════════════════════════════════════════════
-- 000294_reference_sync_gets_its_own_schema.sql
--
-- #164 FASE 4 — LO SCHEMA `brownfield` SPARISCE; LA SINCRONIZZAZIONE HA CASA PROPRIA.
--
-- LA DECISIONE (Enzo, 2026-08-07): «la tracciabilità di reference-sync trasloca in uno
-- schema suo». Era la domanda che bloccava F4: tre delle otto tabelle `brownfield.*`
-- non erano residuo, erano la casa di una funzionalità **viva** — il modulo
-- `reference-sync` (ISTAT/ATECO/ESCO), le cui rotte rispondono **401** in produzione,
-- cioè sono registrate e servono.
--
-- LA MISURA CHE RENDE OVVIO IL TRASLOCO. Il registro delle corse d'import è già suo:
--   ESCO **433** · ESCO_SKILL_HIERARCHY **337** · ATECO_2025 **307** = **1.077 su 1.194
--   (90%)**; all'ETL ritirato ne appartengono **117** (`db-export-2026-05-15` 115, più 2
--   senza export). Le due esportazioni `legacy-live-wave2-D/E` non hanno **nessuna**
--   corsa. Non si sta spostando la casa di qualcun altro: si sta togliendo l'insegna
--   sbagliata da una casa già abitata.
--
-- SI SPOSTANO **INTERE**, con le 117 righe storiche dentro. Dividere il registro per
-- provenienza vorrebbe dire decidere con un'euristica sui nomi quali corse sono «di
-- riferimento» e quali «legacy», e spezzare un libro mastro a metà per un nome. Le
-- righe storiche viaggiano con esso; la **provenienza dei dati** non dipende comunque da
-- qui — vive in `sys.sys_source_lineage_records` (70.959 righe, in chiaro sul 100%),
-- resa indipendente dalla `000281` proprio in vista di questo passo.
--
-- COSA SE NE VA PER SEMPRE
--   · le **5** tabelle `brownfield.*` di sola mappatura ETL — `source_tables`,
--     `source_columns`, `table_mappings`, `column_mappings`, `tenant_id_mappings`:
--     **zero** riferimenti nel codice vivo (misurato file per file);
--   · le **4** tabelle `audit.import_*` — approvazioni, log di corsa, esiti e codici di
--     validazione: anch'esse **zero** riferimenti nel codice vivo;
--   · lo schema `brownfield` stesso, che a quel punto è vuoto.
--
-- ⚠️ NON È REVERSIBILE. Le tabelle rimosse contengono righe (1.225 + 1.174 + 106 + 109 +
-- 2 e 1.589 + 3.128 + 4 + 13): sono i metadati di ESECUZIONE dell'ingestione, non la sua
-- provenienza. La rete è l'istantanea `pg_dump` pre-deploy. Va detto invece di lasciar
-- intendere che ci sia un rimedio a portata di mano.
--
-- ORDINE OBBLIGATO: prima si rimuovono le 5 (che hanno chiavi esterne verso le 3), poi
-- si trasloca, poi si lascia cadere lo schema. Invertendo, le chiavi esterne bloccano.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $mig$
DECLARE
  c_etl constant text[] := ARRAY['column_mappings','source_columns','table_mappings',
                                 'source_tables','tenant_id_mappings'];
  c_aud constant text[] := ARRAY['import_approval_decisions','import_run_logs',
                                 'import_validation_results','import_validation_rule_codes'];
  c_mov constant text[] := ARRAY['source_exports','import_runs','source_watermarks'];
  v_t     text;
  v_corse bigint := 0;
  v_lin   bigint;
  v_res   bigint;
BEGIN
  -- Quante corse stiamo portando con noi: si misura PRIMA, altrimenti dopo il traslocco
  -- il numero non è più confrontabile con nulla.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='brownfield' AND tablename='import_runs') THEN
    EXECUTE 'SELECT count(*) FROM brownfield.import_runs' INTO v_corse;
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='reference_sync' AND tablename='import_runs') THEN
    EXECUTE 'SELECT count(*) FROM reference_sync.import_runs' INTO v_corse;
  END IF;

  -- ── §1. le 5 di sola mappatura, per elenco esplicito ────────────────────────
  FOREACH v_t IN ARRAY c_etl LOOP
    EXECUTE format('DROP TABLE IF EXISTS brownfield.%I CASCADE', v_t);
  END LOOP;

  -- ── §2. le 4 di audit dell'ingestione ───────────────────────────────────────
  FOREACH v_t IN ARRAY c_aud LOOP
    EXECUTE format('DROP TABLE IF EXISTS audit.%I CASCADE', v_t);
  END LOOP;

  -- ── §2-bis. le 4 funzioni di validazione dell'ETL ───────────────────────────
  -- `validate_lookup_fk_*`: erano i trigger che controllavano i payload delle mappature
  -- di colonna, cioe' di tabelle che non esistono piu'. Zero riferimenti nel codice vivo.
  -- Senza questa parte lo schema non puo' cadere, e la guardia piu' sotto lo dice invece
  -- di lasciarlo intuire: la prima stesura si e' fermata esattamente qui.
  FOR v_t IN SELECT p.oid::regprocedure::text FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'brownfield'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', v_t);
  END LOOP;

  -- ── §3. la casa nuova, e il trasloco ────────────────────────────────────────
  -- `SET SCHEMA` sposta la tabella con dati, indici, vincoli e sequenze: non copia e
  -- non riscrive nulla. E' istantaneo e non puo' perdere righe per costruzione.
  CREATE SCHEMA IF NOT EXISTS reference_sync;
  COMMENT ON SCHEMA reference_sync IS
    '#164 F4 — tracciabilita delle sincronizzazioni di dati di riferimento (ISTAT/ATECO/ESCO): '
    'esportazioni, corse e filigrane. Eredita il registro dallo schema brownfield, ritirato, '
    'di cui il 90% delle corse era gia sua.';

  FOREACH v_t IN ARRAY c_mov LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='brownfield' AND tablename=v_t) THEN
      EXECUTE format('ALTER TABLE brownfield.%I SET SCHEMA reference_sync', v_t);
    END IF;
  END LOOP;

  EXECUTE format('GRANT USAGE ON SCHEMA reference_sync TO %I', current_user);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA reference_sync TO %I', current_user);

  -- ── §4. lo schema vuoto se ne va ────────────────────────────────────────────
  -- RESTRICT e non CASCADE: se fosse rimasto dentro qualcosa che non abbiamo previsto,
  -- si deve fermare, non travolgerlo. Un `DROP ... CASCADE` qui sarebbe una scommessa.
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='brownfield') THEN
    -- Si contano TUTTI gli oggetti, non solo le tabelle: la prima stesura guardava
    -- `relkind IN ('r','v','m','S')` e non vedeva le funzioni, quindi dichiarava lo
    -- schema vuoto mentre non lo era. Una guardia che guarda meta' degli oggetti da'
    -- una risposta sbagliata con la faccia di una giusta.
    SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
             WHERE n.nspname='brownfield' AND c.relkind IN ('r','v','m','S','p','f'))
         + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='brownfield')
      INTO v_res;
    IF v_res > 0 THEN
      RAISE EXCEPTION '000294: lo schema brownfield contiene ancora % oggetti — non lo lascio cadere alla cieca', v_res;
    END IF;
    DROP SCHEMA brownfield RESTRICT;
  END IF;

  -- ── POST-CONDIZIONI ─────────────────────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='brownfield') THEN
    RAISE EXCEPTION '000294: lo schema brownfield esiste ancora';
  END IF;

  FOREACH v_t IN ARRAY c_mov LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='reference_sync' AND tablename=v_t) THEN
      RAISE EXCEPTION '000294: % non e arrivata in reference_sync', v_t;
    END IF;
  END LOOP;

  -- Il trasloco non deve aver perso corse: e' la verifica che `SET SCHEMA` ha spostato
  -- e non ricreato.
  EXECUTE 'SELECT count(*) FROM reference_sync.import_runs' INTO v_res;
  IF v_res <> v_corse THEN
    RAISE EXCEPTION '000294: le corse erano % e ora sono % — il trasloco ha perso righe', v_corse, v_res;
  END IF;

  -- E soprattutto: la PROVENIENZA dei dati non e' stata toccata. E' la domanda a cui
  -- tutto questo schema serviva a non rispondere da solo.
  SELECT count(*) INTO v_lin FROM sys.sys_source_lineage_records;
  IF v_lin < 70000 THEN
    RAISE EXCEPTION '000294: la tracciabilita e scesa a % righe', v_lin;
  END IF;

  RAISE NOTICE '000294 done: schema brownfield RITIRATO; % corse traslocate in reference_sync; provenienza intatta (% righe)',
    v_res, v_lin;
END $mig$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — parziale e va detto. Il trasloco si annulla:
--     ALTER TABLE reference_sync.<t> SET SCHEMA brownfield;   (per le 3)
-- Le 9 tabelle rimosse NO: contenevano righe e non c'e' giornale. La rete e'
-- l'istantanea pg_dump pre-deploy in pg_dump_snapshots/pre-deploy/.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- ⚠️ QUESTO FILE È FUORI DA `db/migrations/` DI PROPOSITO — NON È APPLICATO.
--
-- Stesso schema di `#160` (S1048): in catena verrebbe eseguito al primo deploy, e da
-- solo NON basta. La prova generale (due passate) lo ha dimostrato: il ritiro riesce,
-- ma alla passata successiva le migrazioni che creano e usano lo schema `brownfield`
-- lo ripopolano o falliscono. È ADR-0035 applicato a un intero schema.
--
-- COSA MANCA, MISURATO (S1049) — non da ri-scoprire:
--   · **6 file dedicati** creano gli oggetti e vanno marcati `-- @migrate: once`:
--     000024, 000025, 000029, 000033, 000043, 000095. **Già provato: funziona.**
--   · **restano da classificare 12 file** che USANO le tabelle e cadrebbero:
--     000026 (il primo a cadere nella prova), 000030, 000034, 000039, 000044, 000047,
--     000052, 000056, 000109, 000110, 000124, 000215.
--   · **ATTENZIONE, due NON vanno marcati**: `000058_reconciliation_registry.sql` e
--     `000062_register_embedding_tables_reconciliation.sql` portano guardie VIVE che
--     devono continuare a rigirare a ogni deploy. Vanno **emendati**, non spenti.
--   · il codice va ripuntato: 9 riferimenti in
--     `apps/api/src/modules/reference-sync/repository.ts` e 2 in
--     `packages/shared/src/schemas/reference-sync.ts` (`brownfield.` → `reference_sync.`).
--     Provato: typecheck verde su 5 workspace.
--   · `CLAUDE.md` invariante **I3/I4** elenca gli schemi ausiliari: `brownfield` esce,
--     `reference_sync` entra.
--
-- STATO DELLA PRODUZIONE AL PARCHEGGIO: intatta e verificata — schema `brownfield`
-- presente, 8 tabelle, 1.194 corse, nessuno schema `reference_sync`. Nulla applicato.
-- ═══════════════════════════════════════════════════════════════════════════════
