-- ============================================================================
-- 000345 — #222 F3 (rilievo F6-01): le denominazioni inglesi delle attivita'
--          economiche escono dai metadati ed entrano dove il prodotto le legge.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   sys_activity_classifications, scheme ATECO_2025: 3.257 righe, e TUTTE hanno
--   `title_en` e `title_de` valorizzati dentro `activity_classification_metadata`.
--   In `sys_reference_translations`, alla voce `sys_activity_classifications`:
--   ZERO righe.
--   Le traduzioni erano gia' in casa da mesi, in un posto da cui nessuna API le
--   legge — costo di acquisizione zero, valore zero.
--
-- ⚠ IL TEDESCO NON VIENE TRAVASATO, ed e' una scelta dichiarata, non una
-- dimenticanza. Il `CHECK` su `sys_reference_translations.locale` ammette `en` e
-- `it`: il prodotto ha due lingue. Portare dentro il tedesco vorrebbe dire
-- allargare quel vincolo e poi sostenere una terza lingua in tutto il frontend,
-- che e' un lavoro di prodotto, non una bonifica di dati. Le 3.257 stringhe
-- tedesche restano dove sono, intatte e disponibili il giorno in cui quella
-- decisione venga presa. Toglierle sarebbe distruggere un patrimonio gia'
-- pagato; travasarle di nascosto sarebbe far credere che il tedesco esista.
--
-- CANONICO `it`, come tutte le altre voci del registro: il nome della riga e'
-- italiano (viene da ISTAT) e l'inglese e' la sua traduzione.
--
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo`, e la ragione e' che
-- questa migrazione non modifica nulla — AGGIUNGE righe in una tabella e una
-- voce in un registro, senza toccare la fonte. L'inversa e'
-- `DELETE FROM sys.sys_reference_translations WHERE entity_table =
-- 'sys_activity_classifications' AND source = 'HARVEST'`, e il contenuto si
-- ricostruisce rieseguendo questo file: la fonte resta al suo posto.
--
-- IDEMPOTENTE: `ON CONFLICT DO NOTHING` su entrambe le scritture.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Il registro dei campi traducibili — senza questa voce, il travaso sarebbe
--    un mucchio di righe che nessuno sa come usare.
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_translatable_field
       (entity_table, entity_pk_column, field, entity_field_column, canonical_locale, note)
VALUES ('sys_activity_classifications', 'activity_classification_id', 'name',
        'activity_classification_name', 'it',
        'Denominazioni ATECO 2025. Il canonico e'' italiano (ISTAT); l''inglese arriva da activity_classification_metadata->>title_en (#222 F3). Il tedesco esiste nei metadati ma non e'' travasato: il prodotto ha due lingue.')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Il travaso dell'inglese.
--
-- `source = 'HARVEST'`: il valore non e' stato tradotto qui ne' generato da un
-- modello — e' stato raccolto da un campo che gia' lo conteneva. Dichiararlo
-- `MANUAL` o `LLM` direbbe il falso sulla provenienza, ed e' proprio la
-- provenienza che rende questa riga affidabile.
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_reference_translations
       (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_activity_classifications',
       a.activity_classification_id,
       'name',
       'en',
       btrim(a.activity_classification_metadata->>'title_en'),
       'HARVEST'
  FROM sys.sys_activity_classifications a
 WHERE coalesce(btrim(a.activity_classification_metadata->>'title_en'), '') <> ''
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. POST-CONDIZIONE
--
-- Il controllo (c) protegge cio' che NON doveva cambiare: la fonte. Una
-- migrazione che «sposta» dei dati e' sospetta finche' non si e' dimostrato che
-- l'originale e' ancora li' — qui non si sposta, si copia, e va provato.
-- ---------------------------------------------------------------------------
DO $$
DECLARE travasate int; attese int; tedesche int; senza_soggetto int; voce int;
BEGIN
  SELECT count(*) INTO attese FROM sys.sys_activity_classifications
   WHERE coalesce(btrim(activity_classification_metadata->>'title_en'), '') <> '';

  SELECT count(*) INTO travasate FROM sys.sys_reference_translations
   WHERE entity_table = 'sys_activity_classifications' AND locale = 'en';

  IF travasate <> attese THEN
    RAISE EXCEPTION '000345: % traduzioni inglesi attese, % presenti', attese, travasate;
  END IF;

  -- (b) la voce di registro c'e', o le righe sono illeggibili per il prodotto
  SELECT count(*) INTO voce FROM sys.sys_translatable_field
   WHERE entity_table = 'sys_activity_classifications' AND field = 'name';
  IF voce <> 1 THEN
    RAISE EXCEPTION '000345: la voce del registro dei campi traducibili manca o e'' doppia (%)', voce;
  END IF;

  -- (c) LA FONTE E' INTATTA: il tedesco non e' stato toccato ne' cancellato
  SELECT count(*) INTO tedesche FROM sys.sys_activity_classifications
   WHERE coalesce(btrim(activity_classification_metadata->>'title_de'), '') <> '';
  IF tedesche <> attese THEN
    RAISE EXCEPTION '000345: le stringhe tedesche erano % come le inglesi, ora sono % — la fonte e'' stata toccata',
                    attese, tedesche;
  END IF;

  -- (d) la sentinella di 000343 deve restare a zero: ogni riga nuova ha un soggetto
  SELECT count(*) INTO senza_soggetto FROM sys.v_reference_translations_senza_soggetto;
  IF senza_soggetto > 0 THEN
    RAISE EXCEPTION '000345: % traduzioni senza soggetto dopo il travaso', senza_soggetto;
  END IF;

  RAISE NOTICE '000345 ok — % denominazioni inglesi ora leggibili dal prodotto · % tedesche intatte nei metadati',
               travasate, tedesche;
END $$;
