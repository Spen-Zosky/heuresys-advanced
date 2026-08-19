-- ============================================================================
-- 000329 — La sorgente di costruzione non e' piu' un archetipo.  (#132 F3, E29)
--
-- LA DECISIONE, nelle parole di Enzo (E29, 2026-08-17): «Il fascicolo non puo' avere un
-- archetipo aprioristico, altrimenti genera sempre una banca come RTL. I dati hardcoded del
-- file di codice scritto a mano devono scomparire — non deve rimanere traccia — e
-- l'archetipo deve essere generato dalla ricerca.»
--
-- COSA RESTAVA NEL DATABASE dopo aver tolto il codice. La `000320` aveva scritto, su una
-- versione di variante, `build_source_key = 'RETAIL_BANK_REFERENCE'`: il nome dell'archetipo
-- ora ritirato. Se restasse, quella versione dichiarerebbe una sorgente che non esiste piu',
-- e chi provasse a costruirla otterrebbe «sorgente di costruzione sconosciuta» — un errore
-- corretto nel meccanismo e incomprensibile per chi lo legge, perche' nomina una cosa di cui
-- non c'e' piu' traccia da nessuna parte.
--
-- COSA FA: porta quella dichiarazione a `BLUEPRINT_CONTENT`, che vuol dire «il mio contenuto
-- sta nelle tabelle `sys.sys_blueprint_content_*`» (mig. `000327`).
--
-- ⚠ LA CONSEGUENZA E' VOLUTA E DICHIARATA IN ANTICIPO. Quelle tabelle oggi sono VUOTE,
-- quindi quella versione **non e' costruibile** — e il fascicolo `APPROVED` che la ancora
-- non si applichera' finche' il modello non avra' contenuto. Non e' un guasto introdotto qui:
-- il piano di `#132` lo scrive fra le sue premesse, «da F3 a F6 nessuna azienda e'
-- costruibile», e aggiunge il motivo — cio' che si toglie e' una capacita' MAI USATA che
-- produceva il risultato sbagliato. Il ponte che riempira' i modelli e' `F6`.
-- E il rifiuto e' esplicito, non silenzioso: `BLUEPRINT_CONTENT_EMPTY` dice che il modello
-- non ha contenuto e va prima riempito. Uno zero silenzioso — «costruito, zero righe» — era
-- il difetto peggiore possibile, e `F2` esiste per chiuderlo.
--
-- DUE FILE, NON UNO — ADR-0035, come per la coppia `000327`/`000328`. La catena si ri-applica
-- per intero a ogni deploy: la `000320` e' stata **emendata** (perche' un database creato da
-- zero non nasca gia' con la chiave ritirata) e questa migrazione corregge **l'esemplare
-- esistente**. Le due strade devono arrivare allo stesso posto, e la post-condizione lo
-- verifica leggendo il dato invece di fidarsi dell'ordine di applicazione.
--
-- IDEMPOTENTE: `UPDATE` ristretto per valore di partenza; ri-eseguirla non tocca niente.
-- ROLLBACK: `UPDATE ... SET build_source_key = 'RETAIL_BANK_REFERENCE'` sulla stessa riga —
-- ma rimetterebbe una dichiarazione che nessun codice sa piu' onorare.
-- ============================================================================
BEGIN;

-- ── ① la misura PRIMA, e la guardia ri-verificata adesso ──────────────────────
-- Non si eredita la misura fatta in sessione: questa migrazione gira anche sul clone di CI,
-- sulla VM e su un database ricreato da zero, dove il numero e' diverso.
DO $$
DECLARE n_archetipo int; n_altre int;
BEGIN
  SELECT count(*) INTO n_archetipo FROM sys.sys_blueprint_variant_versions
   WHERE blueprint_variant_version_build_source_key = 'RETAIL_BANK_REFERENCE';
  SELECT count(*) INTO n_altre FROM sys.sys_blueprint_variant_versions
   WHERE blueprint_variant_version_build_source_key IS NOT NULL
     AND blueprint_variant_version_build_source_key NOT IN ('RETAIL_BANK_REFERENCE', 'BLUEPRINT_CONTENT');
  RAISE NOTICE '000329: versioni che dichiarano l''archetipo ritirato: % · versioni con una terza chiave: %',
    n_archetipo, n_altre;

  -- Una chiave che non e' ne' quella ritirata ne' quella del contenuto e' qualcosa che
  -- nessuno ha previsto: meglio fermarsi che tradurla a indovinare.
  IF n_altre > 0 THEN
    RAISE EXCEPTION '000329: esistono % versioni con una sorgente di costruzione che questa migrazione non sa tradurre. Vanno guardate una per una.', n_altre;
  END IF;
END $$;

-- ── ② la traduzione ───────────────────────────────────────────────────────────
UPDATE sys.sys_blueprint_variant_versions
   SET blueprint_variant_version_build_source_key = 'BLUEPRINT_CONTENT'
 WHERE blueprint_variant_version_build_source_key = 'RETAIL_BANK_REFERENCE';

-- ── ③ il commento della colonna, che vive nel database e che nomina cio' che c'e' oggi ──
-- Chi interroga il database non ha il repository davanti: se il commento descrivesse ancora
-- un mondo con gli archetipi, sarebbe documentazione che mente nel posto in cui e' piu'
-- difficile accorgersene.
COMMENT ON COLUMN sys.sys_blueprint_variant_versions.blueprint_variant_version_build_source_key IS
  'Tenant Builder P3 — la sorgente parametrica da cui la costruzione realizza QUESTA versione del '
  'modello. `BLUEPRINT_CONTENT` = il contenuto vive nelle tabelle sys_blueprint_content_* di '
  'questa versione (mig. 000327). NULL = versione descrittiva, che nessuno costruisce: e'' un '
  'caso legittimo, non un dato mancante.';

-- ── ④ le post-condizioni ──────────────────────────────────────────────────────
DO $$
DECLARE n int; v_testo text;
BEGIN
  -- 1. L'archetipo non e' piu' dichiarato da nessuno. E' la traduzione in SQL di «non deve
  --    rimanere traccia»: il codice e' stato tolto, e questo verifica il database.
  SELECT count(*) INTO n FROM sys.sys_blueprint_variant_versions
   WHERE blueprint_variant_version_build_source_key = 'RETAIL_BANK_REFERENCE';
  IF n <> 0 THEN
    RAISE EXCEPTION '000329: % versioni dichiarano ancora l''archetipo ritirato', n;
  END IF;

  -- 2. CIO' CHE NON DOVEVA CAMBIARE: le versioni che non dichiaravano NIENTE restano cosi'.
  --    `NULL` e' un caso legittimo — una versione descrittiva, che nessuno costruisce — e la
  --    `000320` lo dichiara nel commento della colonna. Tradurre anche quelle avrebbe reso
  --    costruibile cio' che non deve esserlo, ed e' il tipo di danno che una migrazione fa
  --    senza che nessuno se ne accorga.
  SELECT count(*) INTO n FROM sys.sys_blueprint_variant_versions
   WHERE blueprint_variant_version_build_source_key IS NULL;
  RAISE NOTICE '000329: versioni senza sorgente dichiarata, lasciate intatte: %', n;

  -- 3. Il commento della colonna non deve piu' nominare l'archetipo: e' documentazione che
  --    vive nel database, e chi la legge non ha il repository davanti.
  SELECT col_description('sys.sys_blueprint_variant_versions'::regclass,
                         (SELECT attnum FROM pg_attribute
                           WHERE attrelid = 'sys.sys_blueprint_variant_versions'::regclass
                             AND attname = 'blueprint_variant_version_build_source_key'))
    INTO v_testo;
  IF v_testo IS NULL OR v_testo LIKE '%RETAIL_BANK_REFERENCE%' THEN
    RAISE EXCEPTION '000329: il commento della colonna nomina ancora l''archetipo ritirato, oppure e'' assente: %',
      coalesce(v_testo, 'ASSENTE');
  END IF;

  RAISE NOTICE '000329 ok — nessuna versione dichiara piu'' un archetipo; il contenuto si legge dal database';
END $$;

COMMIT;
