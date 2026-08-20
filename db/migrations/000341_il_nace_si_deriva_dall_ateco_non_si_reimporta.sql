-- ============================================================================
-- 000341 — #221 F1+F2 (rilievi F7-04, F7-01): lo scheme NACE Rev. 2.1 e il
--          crosswalk ATECO↔NACE, DERIVATI dai dati che il database gia' ha.
--
-- ⛔ QUESTO FILE NON IMPORTA NIENTE. Nessuna riga viene da un CSV, da un dump o
-- dal database legacy. Tutto si costruisce da `sys.sys_activity_classifications`
-- con una SELECT — che e' cio' che I12 impone («cio' che manca si costruisce o
-- si deriva da sys.*»), e qui e' anche la strada migliore.
--
-- PERCHE' SI PUO' DERIVARE. Lo dichiara 000211, con evidenza Eurostat
-- KS-GQ-24-007 / EUR-Lex NACE Rev 2.1 / ISTAT ATECO 2025: ATECO_2025 e'
-- conforme a NACE Rev 2.1 e **identico fino al 4° digit PER COSTRUZIONE**.
-- Il codice NACE di una riga ATECO_2025 e' quindi il suo stesso codice
-- troncato — non una corrispondenza da cercare, una proprieta' della struttura.
--
-- PERCHE' NON SI REIMPORTA L'IBRIDO. Lo scheme `NACE` legacy, cancellato da
-- 000211, portava la divisione 45 (abolita in 2.1), 18 gruppi Rev-2 che in 2.1
-- non esistono, e la sezione extraterritoriale duplicata su U e V. Derivando da
-- ATECO_2025 quelle voci **non possono entrare**: non ci sono nella fonte.
-- Decisione di Enzo, 2026-08-20, presa dopo aver visto l'evidenza di 000211.
--
-- PERCHE' 000211 NON VA TOCCATA. Quella migrazione cancella gli scheme 'NACE' e
-- 'ATECO' e la sua post-condizione conta quelli. Questo file usa
-- **`NACE_REV_2_1`** — nome gia' ammesso dal CHECK della tabella, e diverso da
-- entrambi. 000211 non lo vede, non lo cancella, non fallisce. Nessun file da
-- emendare, nessuna oscillazione a ogni deploy.
--
-- MISURE PRIMA (2026-08-20, sul vivo):
--   sys_activity_classifications: 3.257 righe, UN SOLO scheme (ATECO_2025)
--     L1 22 · L2 87 · L3 287 · L4 651 · L5 920 · L6 1290
--   sys_activity_classification_mappings: 0 righe; le 4 FK sono RESTRICT (#220 F1)
--   forma dei codici: 01.1 -> 01.11 -> 01.11.0 -> 01.11.00
--
-- ID DETERMINISTICI: `uuid_generate_v5` su un namespace fisso, mai `md5()::uuid`
-- (che produce UUID non conformi a RFC-4122). Rieseguendo, gli stessi codici
-- producono gli stessi id: e' cio' che rende questo file idempotente sul serio,
-- e non solo grazie a `ON CONFLICT`.
--
-- ROLLBACK DICHIARATO: nessun giornale `staging.*_undo`, e la ragione e' che il
-- rollback qui non ha bisogno di conservare nulla — le righe non vengono da
-- nessuna parte se non da una SELECT su dati che restano al loro posto.
-- L'inversa e' `DELETE FROM sys.sys_activity_classification_mappings` (via il
-- suo scheme) piu' `DELETE ... WHERE scheme='NACE_REV_2_1'`, e il contenuto si
-- ricostruisce rieseguendo questo file.
--
-- IDEMPOTENTE: `ON CONFLICT DO NOTHING` su chiavi deterministiche.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- GUARDIA — ri-verificata AL MOMENTO dell'esecuzione, mai ereditata.
-- Se ATECO_2025 non ci fosse (o fosse stato ridotto), derivare produrrebbe uno
-- scheme NACE monco, e un catalogo monco e' peggio di uno assente perche'
-- sembra completo. Si ferma invece di scrivere.
-- ---------------------------------------------------------------------------
DO $$
DECLARE l4 int; tot int;
BEGIN
  SELECT count(*) FILTER (WHERE activity_classification_level = 4), count(*)
    INTO l4, tot
    FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme = 'ATECO_2025';

  IF tot = 0 THEN
    RAISE EXCEPTION '000341: ATECO_2025 e'' vuoto — non c''e'' niente da cui derivare';
  END IF;
  IF l4 < 600 THEN
    RAISE EXCEPTION '000341: solo % classi di livello 4 in ATECO_2025 (attese ~651) — fonte sospetta, non derivo', l4;
  END IF;

  -- Il conteggio della FONTE si deposita ORA, per essere riconfrontato dopo la
  -- scrittura. Cablare il numero nella post-condizione sarebbe cristallizzare
  -- una misura variabile: il giorno in cui ATECO_2025 cresce legittimamente, la
  -- migrazione fallirebbe su un cambiamento voluto. Qui invece la domanda resta
  -- quella giusta — «e' cambiato DURANTE questa esecuzione?» — e la risposta
  -- vale a qualunque valore parta.
  PERFORM set_config('heuresys.ateco_prima', tot::text, false);
END $$;

-- ---------------------------------------------------------------------------
-- 1. Lo scheme NACE_REV_2_1 — la proiezione europea del catalogo italiano.
--
-- Solo i livelli 1-4: sezione, divisione, gruppo, classe. I livelli 5 e 6 sono
-- estensioni NAZIONALI italiane e in NACE non esistono — includerle sarebbe
-- inventare codici europei che nessun ente ha mai pubblicato.
--
-- Il nome resta quello italiano di ATECO_2025. E' una scelta, e va detta: la
-- denominazione ufficiale NACE in inglese non e' nel database, e tradurla a
-- mano sarebbe inventarla. Il campo `activity_classification_metadata` dichiara
-- la derivazione, cosi' chi legge sa che il nome e' preso in prestito e da dove.
-- (Le denominazioni ufficiali sono materia di #222 F3, che tratta le traduzioni.)
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_activity_classifications (
  activity_classification_id,
  activity_classification_scheme,
  activity_classification_code,
  activity_classification_parent_code,
  activity_classification_name,
  activity_classification_description,
  activity_classification_level,
  activity_classification_metadata
)
SELECT
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                   'NACE_REV_2_1::' || a.activity_classification_code),
  'NACE_REV_2_1',
  a.activity_classification_code,
  a.activity_classification_parent_code,
  a.activity_classification_name,
  a.activity_classification_description,
  a.activity_classification_level,
  jsonb_build_object(
    'derivato_da',      'ATECO_2025',
    'derivato_come',    'identita_fino_al_4_digit',
    'fonte_evidenza',   'mig 000211 (Eurostat KS-GQ-24-007 / EUR-Lex NACE Rev 2.1 / ISTAT ATECO 2025)',
    'nome_preso_da',    'ATECO_2025 (denominazione italiana; le ufficiali NACE non sono nel database)',
    'mai_importato',    true
  )
  FROM sys.sys_activity_classifications a
 WHERE a.activity_classification_scheme = 'ATECO_2025'
   AND a.activity_classification_level BETWEEN 1 AND 4
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Il crosswalk, per troncamento.
--
--   · livelli 1-4 -> corrispondenza IDENTITARIA (stesso codice).
--     Si scrive lo stesso, e non e' ridondanza inutile: chi chiede «qual e' il
--     NACE di questo codice» deve avere risposta per QUALUNQUE codice. Un
--     crosswalk che risponde solo per meta' del catalogo costringe chi lo usa a
--     conoscere la regola di troncamento — cioe' a rifare a mano il lavoro che
--     il crosswalk esiste per evitare.
--   · livelli 5-6 -> corrispondenza al PADRE di livello 4, che e' dove il
--     crosswalk aggiunge informazione vera: 2.210 codici italiani che in NACE
--     non hanno un corrispondente proprio.
--
-- Il troncamento si fa risalendo i `parent_code`, non tagliando la stringa: la
-- gerarchia e' il dato, la forma del codice e' solo il suo aspetto. Tagliare
-- `01.13.11` a `01.13` funziona finche' qualcuno non introduce un codice di
-- forma diversa, e allora sbaglia in silenzio.
-- ---------------------------------------------------------------------------
INSERT INTO sys.sys_activity_classification_mappings (
  activity_class_mapping_id,
  activity_class_mapping_source_id,
  activity_class_mapping_target_id,
  activity_class_mapping_kind,
  activity_class_mapping_confidence,
  activity_class_mapping_metadata
)
SELECT
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid,
                   'XWALK::ATECO_2025::' || a.activity_classification_code || '::NACE_REV_2_1'),
  a.activity_classification_id,
  n.activity_classification_id,
  -- `BROADER`: la NACE di livello 4 e' PIU' AMPIA del codice nazionale L5/L6 che
  -- vi ricade. Il verso conta — dirlo `NARROWER` invertirebbe il significato di
  -- ogni corrispondenza nazionale, e nessun conteggio se ne accorgerebbe.
  CASE WHEN a.activity_classification_level <= 4 THEN 'EXACT' ELSE 'BROADER' END,
  -- La fiducia e' piena in entrambi i casi, e non e' ottimismo: per i livelli
  -- 1-4 l'identita' e' una proprieta' della struttura (000211), per i livelli
  -- 5-6 il padre e' letto dalla gerarchia, non stimato.
  1.0,
  jsonb_build_object(
    'derivato',        true,
    'regola',          CASE WHEN a.activity_classification_level <= 4
                            THEN 'stesso codice (identita per costruzione)'
                            ELSE 'risalita ai parent_code fino al livello 4' END,
    'mai_importato',   true
  )
  FROM sys.sys_activity_classifications a
  -- la classe di livello 4 che governa la riga: se stessa, o l'antenato
  JOIN LATERAL (
    WITH RECURSIVE risalita AS (
      SELECT x.activity_classification_code, x.activity_classification_parent_code,
             x.activity_classification_level
        FROM sys.sys_activity_classifications x
       WHERE x.activity_classification_scheme = 'ATECO_2025'
         AND x.activity_classification_code = a.activity_classification_code
      UNION ALL
      SELECT p.activity_classification_code, p.activity_classification_parent_code,
             p.activity_classification_level
        FROM sys.sys_activity_classifications p
        JOIN risalita r ON r.activity_classification_parent_code = p.activity_classification_code
       WHERE p.activity_classification_scheme = 'ATECO_2025'
         AND r.activity_classification_level > 4
    )
    -- Il livello PIU' BASSO raggiunto dalla risalita, che e' la risposta giusta
    -- per ogni caso:
    --   · da L5/L6 la risalita si ferma a L4  -> minimo = 4  (il padre)
    --   · da L1/L2/L3 non risale affatto      -> minimo = se' stessa
    --
    -- La prima stesura chiedeva `WHERE level = 4` e ha fatto ROSSA la prova
    -- generale: 396 righe senza corrispondenza — esattamente 22+87+287, cioe'
    -- sezioni, divisioni e gruppi. Sopra una sezione non c'e' nessuna classe di
    -- livello 4: e' un ANTENATO del livello 4, non un suo discendente, e la sua
    -- corrispondenza NACE e' se stessa. L'errore era mio, e il conteggio lo ha
    -- detto con precisione prima che arrivasse in produzione.
    SELECT activity_classification_code AS codice_l4
      FROM risalita
     ORDER BY activity_classification_level ASC
     LIMIT 1
  ) t ON true
  JOIN sys.sys_activity_classifications n
    ON n.activity_classification_scheme = 'NACE_REV_2_1'
   AND n.activity_classification_code = t.codice_l4
 WHERE a.activity_classification_scheme = 'ATECO_2025'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. POST-CONDIZIONE
--
-- Quattro controlli. Il terzo e il quarto sono quelli che proteggono cio' che
-- NON doveva cambiare: contare le righe nuove non distinguerebbe «ho derivato
-- il NACE» da «ho anche rovinato ATECO_2025», che e' il guasto possibile di una
-- INSERT ... SELECT sulla stessa tabella da cui legge.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  nace int; xwalk int; ateco int; orfani int; discordi int; senza int; prima int;
BEGIN
  SELECT count(*) INTO nace FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme = 'NACE_REV_2_1';
  SELECT count(*) INTO ateco FROM sys.sys_activity_classifications
   WHERE activity_classification_scheme = 'ATECO_2025';
  SELECT count(*) INTO xwalk FROM sys.sys_activity_classification_mappings;

  -- (1) ogni riga NACE deve avere la sua gemella ATECO con lo STESSO codice.
  --     E' la prova che la derivazione ha derivato, invece di inventare.
  SELECT count(*) INTO discordi
    FROM sys.sys_activity_classifications n
   WHERE n.activity_classification_scheme = 'NACE_REV_2_1'
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_activity_classifications a
        WHERE a.activity_classification_scheme = 'ATECO_2025'
          AND a.activity_classification_code = n.activity_classification_code
          AND a.activity_classification_level = n.activity_classification_level);
  IF discordi > 0 THEN
    RAISE EXCEPTION '000341: % righe NACE non hanno la gemella ATECO — non sono derivate', discordi;
  END IF;

  -- (2) nessun orfano nel crosswalk, nei DUE versi: nessuna corrispondenza che
  --     punti nel vuoto, e nessuna riga ATECO lasciata scoperta.
  SELECT count(*) INTO orfani
    FROM sys.sys_activity_classification_mappings m
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
                      WHERE c.activity_classification_id = m.activity_class_mapping_source_id)
      OR NOT EXISTS (SELECT 1 FROM sys.sys_activity_classifications c
                      WHERE c.activity_classification_id = m.activity_class_mapping_target_id);
  IF orfani > 0 THEN
    RAISE EXCEPTION '000341: % corrispondenze orfane', orfani;
  END IF;

  SELECT count(*) INTO senza
    FROM sys.sys_activity_classifications a
   WHERE a.activity_classification_scheme = 'ATECO_2025'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_activity_classification_mappings m
                      WHERE m.activity_class_mapping_source_id = a.activity_classification_id);
  IF senza > 0 THEN
    RAISE EXCEPTION '000341: % righe ATECO_2025 senza corrispondenza NACE', senza;
  END IF;

  -- (3) ATECO_2025 non deve essere cambiato: e' la fonte, non il bersaglio.
  --     Il confronto e' con la misura presa dalla guardia POCHI ISTANTI FA,
  --     non con un numero scritto nel file mesi prima.
  prima := nullif(current_setting('heuresys.ateco_prima', true), '')::int;
  IF prima IS NULL THEN
    RAISE EXCEPTION '000341: manca la misura di partenza — la guardia non ha girato';
  END IF;
  IF ateco <> prima THEN
    RAISE EXCEPTION '000341: ATECO_2025 ha % righe, ne aveva % prima — la fonte e'' stata toccata', ateco, prima;
  END IF;

  -- (4) gli scheme legacy che 000211 ha ritirato NON devono essere tornati.
  IF EXISTS (SELECT 1 FROM sys.sys_activity_classifications
              WHERE activity_classification_scheme IN ('NACE', 'ATECO')) THEN
    RAISE EXCEPTION '000341: gli scheme legacy sono rientrati — 000211 e'' stata disfatta';
  END IF;

  RAISE NOTICE '000341 ok — NACE_REV_2_1 % righe derivate · crosswalk % · ATECO_2025 intatto (%)',
               nace, xwalk, ateco;
END $$;
