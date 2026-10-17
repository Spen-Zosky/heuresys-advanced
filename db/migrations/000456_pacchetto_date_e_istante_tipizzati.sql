-- ============================================================================
-- 000456 — Pacchetto del datastore: due date e un istante smettono di essere testo (RD-09, voce 263.4)
--
-- IL PROBLEMA. La 000454 ha creato tre colonne come testo per comodita' del caricatore:
--   sys.sys_blueprint_content_packages.blueprint_content_package_source_created_at   varchar(40)  -> un ISTANTE
--   sys.sys_blueprint_content_ccnl.blueprint_content_ccnl_effective                  text          -> una DATA
--   sys.sys_blueprint_content_ccnl_institutes.blueprint_content_ccnl_institute_valid_from varchar(40) -> una DATA
-- RD-09: `date` per le sole date, `timestamptz` solo dove serve l'ora. Una data come testo non si confronta, non si ordina per
-- intervallo e accetta «ieri» senza protestare.
--
-- COSA FA. Porta la prima a timestamptz e le altre due a date. NON modifica la 000454 (gia' applicata in produzione e sul gemello):
-- la catena si riapplica a ogni deploy, e su un database nuovo la 000454 crea ancora il testo che questa file poi tipizza.
--
-- IDEMPOTENTE. Ogni colonna si converte solo se e' ancora di tipo testo: alla seconda passata non fa niente.
-- GUARDIA. Prima di convertire controlla che OGNI valore non nullo abbia la forma attesa (AAAA-MM-GG; AAAA-MM-GGThh:mm:ss[.fff]Z o con
-- scostamento). Se anche uno solo non l'ha, si ferma con un errore che nomina la colonna e il primo valore: non indovina, non annulla.
-- POST-CONDIZIONE. Il numero di righe non cambia e il numero di valori non nulli non cambia (controllati dentro la stessa transazione).
-- PER TORNARE INDIETRO: db/scripts/pacchetto/inversa-000456.sql (NON sta in db/migrations: la catena lo applicherebbe). La conversione
-- e' senza perdita per i valori che la guardia ammette: l'inversa rende lo stesso testo (data AAAA-MM-GG; istante in UTC con millisecondi e «Z»).
-- Giornale `staging.*_undo`: non serve, perche' l'inversa e' esatta e provata a andata e ritorno (db/scripts/pacchetto/prova-000456.sh).
--
-- Dati contrattuali: questa migrazione non tocca `sys_user_contracts` (ADR-0045: resta «importata»).
-- ============================================================================
BEGIN;

DO $$
DECLARE
  c record;
  prima_righe bigint;
  prima_valori bigint;
  dopo_righe bigint;
  dopo_valori bigint;
  tipo text;
  male text;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('sys_blueprint_content_packages',        'blueprint_content_package_source_created_at',        'timestamptz', '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'),
      ('sys_blueprint_content_ccnl',            'blueprint_content_ccnl_effective',                   'date',        '^\d{4}-\d{2}-\d{2}$'),
      ('sys_blueprint_content_ccnl_institutes', 'blueprint_content_ccnl_institute_valid_from',        'date',        '^\d{4}-\d{2}-\d{2}$')
    ) AS v(tabella, colonna, nuovo, forma)
  LOOP
    SELECT data_type INTO tipo FROM information_schema.columns
     WHERE table_schema = 'sys' AND table_name = c.tabella AND column_name = c.colonna;
    IF tipo IS NULL THEN
      RAISE NOTICE '000456: % non esiste (database senza la 000454), niente da fare', c.colonna;
      CONTINUE;
    END IF;
    IF tipo NOT IN ('character varying', 'text') THEN
      RAISE NOTICE '000456: % e'' gia'' % , no-op', c.colonna, tipo;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*), count(%I) FROM sys.%I', c.colonna, c.tabella) INTO prima_righe, prima_valori;
    EXECUTE format('SELECT %I FROM sys.%I WHERE %I IS NOT NULL AND %I !~ %L LIMIT 1', c.colonna, c.tabella, c.colonna, c.colonna, c.forma) INTO male;
    IF male IS NOT NULL THEN
      RAISE EXCEPTION '000456: % ha un valore che non ha la forma attesa (%): non converto, lo decide una persona', c.colonna, male;
    END IF;

    EXECUTE format('ALTER TABLE sys.%I ALTER COLUMN %I TYPE %s USING %I::%s', c.tabella, c.colonna, c.nuovo, c.colonna, c.nuovo);

    EXECUTE format('SELECT count(*), count(%I) FROM sys.%I', c.colonna, c.tabella) INTO dopo_righe, dopo_valori;
    IF dopo_righe <> prima_righe OR dopo_valori <> prima_valori THEN
      RAISE EXCEPTION '000456: % post-condizione violata (righe % -> %, valori % -> %)', c.colonna, prima_righe, dopo_righe, prima_valori, dopo_valori;
    END IF;
    RAISE NOTICE '000456: % portata a % (% righe, % valori)', c.colonna, c.nuovo, dopo_righe, dopo_valori;
  END LOOP;
END $$;

COMMIT;
