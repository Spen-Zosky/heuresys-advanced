-- ============================================================================
-- 000331 — La ragione di un riferimento senza referente sta ACCANTO alla colonna.  (#218 F3)
--
-- Enzo, 2026-08-19: «i residui del legacy senza referente vanno RISOLTI, uno per uno — per
-- ognuno: eliminare (preferito) o creare il referente locale.»
--
-- IL CENSIMENTO DI F1 HA TROVATO SEI COLONNE che dichiarano un riferimento e non lo
-- agganciano. F2 le ha decise una per una, e la decisione **non e' stata quella che sembrava**:
-- cinque su sei una ragione ce l'hanno gia', ed e' buona. Il difetto vero e' che quella ragione
-- **non sta nel database** — vive dentro un file di migrazione, che chi interroga il database
-- non ha davanti. Misurato: delle sei, **una sola** porta un commento di colonna.
--
-- ⚠ DUE DECISIONI SU SEI ERANO SBAGLIATE, e le ha corrette il file che crea l'oggetto.
-- Avevo deciso di *aggiungere* la FK su `source_lineage_import_run_id` (44.744 valori che
-- puntano a righe esistenti in `reference_sync.import_runs`: zero orfani) e di *eliminare*
-- `source_lineage_table_mapping_id` (57.053 valori verso una tabella che non esiste piu').
-- Poi ho letto la mig. `000281`, che quelle due FK le ha **sciolte di proposito**:
--   «sono metadati di ESECUZIONE (quale corsa d'import, quale mappatura), parziali per
--    costruzione: non sono la provenienza, e scioglierli non toglie nulla alla risposta.»
-- Rimetterne una contraddirebbe una decisione presa e motivata; togliere l'altra butterebbe il
-- metadato che quella decisione aveva scelto di conservare. La misura era vera, la conclusione
-- che ne traevo no.
--
-- COSA FA QUESTA MIGRAZIONE: scrive la ragione dove serve, cioe' nel commento della colonna.
-- Non e' documentazione ornamentale — e' il dato su cui `#218` F4 costruisce il cancello:
-- il censimento legge i commenti, e una colonna con una ragione dichiarata esce dall'elenco
-- di cio' che va guardato. Cosi' lo strumento smette di essere una fotografia: chi aggiunge
-- domani una colonna che promette un referente senza mantenerlo la vede comparire da sola,
-- perche' non avra' nessuna ragione scritta.
--
-- NON DISTRUTTIVA: `COMMENT ON` non tocca dati ne' struttura. Nessun rollback necessario —
-- ed e' la ragione dichiarata per cui non c'e' un giornale `staging.*_undo` (metodo di
-- bonifica, punto ④d: o il giornale, o la ragione scritta per cui non serve).
-- IDEMPOTENTE: `COMMENT ON` sovrascrive.
-- ============================================================================
BEGIN;

-- ── ① la guardia: le sei colonne esistono ancora, tutte e sei ─────────────────
-- Ri-verificata ADESSO e non ereditata dal censimento: se una fosse stata rimossa nel
-- frattempo, un `COMMENT ON` su una colonna assente fallirebbe con un errore di Postgres che
-- non dice quale delle sei — meglio fermarsi qui, dicendo il nome.
DO $$
DECLARE v_mancanti text;
BEGIN
  SELECT string_agg(a.tab || '.' || a.col, ', ') INTO v_mancanti
    FROM (VALUES
      ('sys_source_lineage_records', 'source_lineage_import_run_id'),
      ('sys_source_lineage_records', 'source_lineage_table_mapping_id'),
      ('sys_source_lineage_records', 'source_lineage_sdbi_mapping_card_id'),
      ('sys_organization_unit_templates', 'organization_unit_template_blueprint_id'),
      ('sys_generated_record_origins', 'generated_record_origin_superseded_by_run_id'),
      ('sys_advisor_suggestions', 'advisor_suggestion_rule_id')
    ) AS a(tab, col)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema = 'sys' AND c.table_name = a.tab AND c.column_name = a.col);
  IF v_mancanti IS NOT NULL THEN
    RAISE EXCEPTION '000331: queste colonne non esistono piu'', il censimento e'' stantio: %', v_mancanti;
  END IF;
END $$;

-- ── ② le sei ragioni ──────────────────────────────────────────────────────────
-- Ognuna dice TRE cose, ed e' il minimo perche' chi la legge non debba indagare da capo:
-- che cosa contiene la colonna, perche' non ha un vincolo, e dove sta la decisione.

COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_import_run_id IS
  'Metadato di ESECUZIONE: quale corsa di importazione ha prodotto questa riga. '
  'Senza FK per DECISIONE della mig. 000281, che l''ha sciolta per rendere il lineage '
  'indipendente dallo schema brownfield poi ritirato (#164 F4). I valori restano validi e '
  'oggi combaciano con reference_sync.import_runs, ma il legame non va ripristinato: e'' un '
  'metadato parziale per costruzione (44.744 righe su 70.959), non la provenienza. '
  'Censito e deciso in #218 F2.';

COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_table_mapping_id IS
  'Metadato di ESECUZIONE: quale mappatura di tabella ha prodotto questa riga. Senza FK per '
  'DECISIONE della mig. 000281, stessa ragione di source_lineage_import_run_id. La tabella '
  'bersaglio non esiste piu'' (viveva nello schema brownfield, ritirato): resta il FATTO che '
  'quella mappatura fu usata, ed e'' cio'' che si conserva. Censito e deciso in #218 F2.';

COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_mapping_card_id IS
  'SDBI-path only: the mapping_card id that authored this row (NULL on brownfield-path rows). '
  'ADR-0014 §3.4. Identificativo di un sistema ESTERNO: non esiste un referente locale da '
  'agganciare, e il modulo `provenance` lo espone cosi'' com''e''. Censito e confermato in #218 F2.';

COMMENT ON COLUMN sys.sys_organization_unit_templates.organization_unit_template_blueprint_id IS
  '⚠ IL NOME MENTE SUL CONTENUTO: non e'' un blueprint di questo sistema. La mig. 000064 lo '
  'dichiara — «legacy template_id group (the 9)» — cioe'' e'' il RAGGRUPPAMENTO ereditato dal '
  'database di provenienza: 225 righe su 9 valori distinti. Non e'' un riferimento orfano, '
  'perche'' non ha mai avuto un referente locale. Indagato in #132 F1, censito in #218 F2.';

COMMENT ON COLUMN sys.sys_generated_record_origins.generated_record_origin_superseded_by_run_id IS
  'La corsa di importazione che ha sostituito questa riga generata (Tenant Builder P4, #206); '
  'nullo finche'' non accade, e oggi lo e'' su tutte le righe. Senza FK perche'' la tabella '
  'bersaglio NON ESISTE ANCORA: agganciarla vorrebbe dire inventare oggi la forma che P4 '
  'decidera''. Censito e deciso in #218 F2 — da riprendere quando P4 arriva.';

COMMENT ON COLUMN sys.sys_advisor_suggestions.advisor_suggestion_rule_id IS
  'Il CODICE di una regola scritta in codice, non l''identificativo di una riga: il catalogo '
  'delle regole vive nell''applicazione per scelta, e il CHECK sulla colonna e'' gia'' il suo '
  'vincolo. Nessuna FK possibile senza mettere in tabella un catalogo che non ci deve stare. '
  'Censito e deciso in #218 F2.';

-- ── ③ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE v_senza text; n int;
BEGIN
  -- 1. Tutte e sei portano una ragione, e non una qualunque: quella che rimanda alla
  --    decisione. Un commento che non nomina ne'' #218 ne'' la migrazione che ha deciso
  --    lascerebbe chi legge senza il filo per risalire, ed e'' meta' del punto.
  SELECT string_agg(a.tab || '.' || a.col, ', ') INTO v_senza
    FROM (VALUES
      ('sys_source_lineage_records', 'source_lineage_import_run_id'),
      ('sys_source_lineage_records', 'source_lineage_table_mapping_id'),
      ('sys_source_lineage_records', 'source_lineage_sdbi_mapping_card_id'),
      ('sys_organization_unit_templates', 'organization_unit_template_blueprint_id'),
      ('sys_generated_record_origins', 'generated_record_origin_superseded_by_run_id'),
      ('sys_advisor_suggestions', 'advisor_suggestion_rule_id')
    ) AS a(tab, col)
   WHERE coalesce(col_description(('sys.' || a.tab)::regclass,
                                  (SELECT c.ordinal_position FROM information_schema.columns c
                                    WHERE c.table_schema = 'sys' AND c.table_name = a.tab
                                      AND c.column_name = a.col)), '') NOT LIKE '%#218%';
  IF v_senza IS NOT NULL THEN
    RAISE EXCEPTION '000331: queste colonne non portano una ragione che rimandi a #218: %', v_senza;
  END IF;

  -- 2. CIO' CHE NON DOVEVA CAMBIARE, ed e' tutto: questa migrazione scrive solo commenti.
  --    I dati restano al loro posto, e il conteggio lo dimostra invece di prometterlo.
  SELECT count(*) INTO n FROM sys.sys_source_lineage_records;
  IF n = 0 THEN
    RAISE EXCEPTION '000331: sys_source_lineage_records e'' vuota — un COMMENT ON non puo'' aver fatto questo';
  END IF;
  SELECT count(*) INTO n FROM sys.sys_organization_unit_templates;
  IF n <> 225 THEN
    RAISE EXCEPTION '000331: le 225 strutture ereditate sono diventate % — nessun commento le tocca', n;
  END IF;

  -- 3. Nessuna FK e'' nata per distrazione: la `000281` le ha sciolte di proposito, e questa
  --    migrazione non doveva rimetterle. Verificarlo qui costa una riga e intercetta il modo
  --    piu' probabile in cui questo file potrebbe essere riscritto male in futuro.
  -- ⚠⚠ E LA PRIMA STESURA DI QUESTO CONTROLLO ERA TROPPO LARGA: contava TUTTE le chiavi
  --    esterne della tabella, e la prova generale l'ha fatta rossa nominando
  --    `..._tenant_id_fkey` — una FK legittima, che non ha niente a che vedere con quelle
  --    sciolte dalla `000281`. Il difetto era nel controllo, non nel database. Ora guarda le
  --    DUE COLONNE che riguarda, che e' cio' che si voleva dire fin dall'inizio.
  --    ⚠ Ha pero' rivelato una cosa vera e fuori da questa voce: il clone di CI ha quella FK
  --      su `tenant_id` e la produzione NO. Registrato nel piano di `#218` come scoperta.
  SELECT count(*), string_agg(pc.conname || ' → ' || pg_get_constraintdef(pc.oid), ' · ')
    INTO n, v_senza
    FROM pg_constraint pc
    JOIN unnest(pc.conkey) AS k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = pc.conrelid AND a.attnum = k.attnum
   WHERE pc.conrelid = 'sys.sys_source_lineage_records'::regclass
     AND pc.contype = 'f'
     AND a.attname IN ('source_lineage_import_run_id', 'source_lineage_table_mapping_id');
  IF n <> 0 THEN
    -- ⚠ L'ERRORE DEVE DIRE QUALE, non solo quante. La prima stesura contava e basta, ed e'
    --   diventata rossa sul clone di CI (1 FK contro le 0 della produzione) senza dire quale
    --   fosse: un errore che non nomina il colpevole costringe a una seconda indagine, e su
    --   una macchina remota quella indagine costa piu' della migrazione.
    RAISE EXCEPTION '000331: sys_source_lineage_records ha % chiavi esterne (la 000281 le aveva sciolte apposta): %', n, v_senza;
  END IF;

  RAISE NOTICE '000331 ok — le sei colonne senza referente portano la loro ragione, leggibile dal database';
END $$;

COMMIT;
