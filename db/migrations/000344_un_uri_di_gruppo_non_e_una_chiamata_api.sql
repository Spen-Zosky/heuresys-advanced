-- ============================================================================
-- 000344 — #222 F2 (rilievi F1-03, F2-05): `skill_group_uri` nei metadati
--          smette di essere un URL di chiamata e torna a essere un URI.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   12.887 competenze portano in `skill_metadata->>'skill_group_uri'` una cosa
--   come
--     https://ec.europa.eu/esco/api/resource/concept?uri=http://data.europa.eu/esco/skill/S1.6.1&language=en
--   cioe' **l'indirizzo con cui si interroga il servizio ESCO**, con dentro
--   l'URI vero come parametro e perfino la lingua della risposta. Il campo
--   canonico della stessa riga (`skill_esco_uri`) usa invece la forma giusta:
--     http://data.europa.eu/esco/skill/<id>
--
-- PERCHE' CONTA. Un URI identifica una cosa; un URL di chiamata identifica un
-- modo di chiederla a un server, in una lingua, tramite una certa versione di
-- una certa API. Confrontare due gruppi per uguaglianza di stringa funziona
-- finche' tutti passano dallo stesso endpoint con gli stessi parametri —
-- e smette di funzionare senza avvisare il giorno in cui uno cambia `language`.
-- 291 righe hanno il campo vuoto: restano vuote, un vuoto e' un vuoto.
--
-- LA TRASFORMAZIONE non usa espressioni regolari ma `split_part`: prende cio'
-- che sta fra `uri=` e `&`. Piu' semplice da leggere, e senza il rischio delle
-- sequenze di escape.
--
-- MISURE PRIMA: 12.887 valori non vuoti · 12.887 contengono `uri=http` (quindi
-- estraibili al 100%) · 0 con percent-encoding · 400 gruppi distinti.
-- Dopo la trasformazione i gruppi distinti devono restare **400**: se
-- diventassero meno, forme diverse sarebbero collassate in una — cioe' avremmo
-- perso una distinzione invece di normalizzare una forma.
--
-- ROLLBACK: giornale `staging.mig344_skill_group_uri_undo`, popolato PRIMA
-- della scrittura, piu' la funzione che lo applica. E' la scrittura di massa
-- piu' grossa dell'onda: qui il giornale non e' una formalita'.
--
-- IDEMPOTENTE: la `WHERE` seleziona solo i valori ancora in forma di chiamata.
-- Rieseguito, non trova nulla da fare.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

-- ---------------------------------------------------------------------------
-- 1. Il giornale di annullamento, popolato PRIMA di toccare qualsiasi cosa.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig344_skill_group_uri_undo (
  skill_id        uuid PRIMARY KEY,
  valore_prima    text NOT NULL,
  annotato_il     timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig344_skill_group_uri_undo (skill_id, valore_prima)
SELECT s.skill_id, s.skill_metadata->>'skill_group_uri'
  FROM sys.sys_skills s
 WHERE s.skill_metadata->>'skill_group_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%'
ON CONFLICT (skill_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig344_annulla() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE sys.sys_skills s
     SET skill_metadata = jsonb_set(s.skill_metadata, '{skill_group_uri}',
                                    to_jsonb(u.valore_prima), true)
    FROM staging.mig344_skill_group_uri_undo u
   WHERE u.skill_id = s.skill_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION staging.mig344_annulla() IS
  'Rimette skill_group_uri come stava prima di 000344. Ritorna quante righe ha ripristinato.';

-- ---------------------------------------------------------------------------
-- 2. GUARDIA — ri-verificata al momento, mai ereditata dalla misura di prima.
-- ---------------------------------------------------------------------------
DO $$
DECLARE da_fare int; estraibili int; gruppi_prima int;
BEGIN
  SELECT count(*) INTO da_fare FROM sys.sys_skills
   WHERE skill_metadata->>'skill_group_uri' LIKE 'https://ec.europa.eu/esco/api/%';

  SELECT count(*) INTO estraibili FROM sys.sys_skills
   WHERE skill_metadata->>'skill_group_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%';

  -- Se anche una sola riga fosse in forma di chiamata ma senza `uri=` dentro,
  -- l'estrazione le lascerebbe una stringa vuota: meglio fermarsi che
  -- normalizzare 12.886 righe e rovinarne una in silenzio.
  IF da_fare <> estraibili THEN
    RAISE EXCEPTION '000344: % righe in forma di chiamata ma solo % estraibili', da_fare, estraibili;
  END IF;

  SELECT count(DISTINCT skill_metadata->>'skill_group_uri') INTO gruppi_prima
    FROM sys.sys_skills WHERE coalesce(skill_metadata->>'skill_group_uri', '') <> '';
  PERFORM set_config('heuresys.mig344_gruppi_prima', gruppi_prima::text, false);
  PERFORM set_config('heuresys.mig344_da_fare', da_fare::text, false);

  -- Quante righe HANNO il campo, comunque valorizzato. E' questo il numero che
  -- non deve cambiare: normalizzare una forma non aggiunge ne' toglie righe.
  PERFORM set_config('heuresys.mig344_con_campo_prima',
                     (SELECT count(*) FROM sys.sys_skills WHERE skill_metadata ? 'skill_group_uri')::text,
                     false);
END $$;

-- ---------------------------------------------------------------------------
-- 3. La normalizzazione.
-- ---------------------------------------------------------------------------
UPDATE sys.sys_skills s
   SET skill_metadata = jsonb_set(
         s.skill_metadata, '{skill_group_uri}',
         to_jsonb(split_part(split_part(s.skill_metadata->>'skill_group_uri', 'uri=', 2), '&', 1)),
         true)
 WHERE s.skill_metadata->>'skill_group_uri' LIKE 'https://ec.europa.eu/esco/api/%uri=http%';

-- ---------------------------------------------------------------------------
-- 4. POST-CONDIZIONE
--
-- Il controllo (c) e' quello che conta: protegge cio' che NON doveva cambiare.
-- Contare le righe normalizzate non distinguerebbe 12.887 righe corrette da
-- 12.887 righe rovinate — e nemmeno da 12.887 righe collassate su meno gruppi,
-- che sarebbe una perdita di informazione travestita da pulizia.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  residue int; gruppi_dopo int; gruppi_prima int; malformati int;
  vuoti int; totali int; da_fare int;
BEGIN
  gruppi_prima := current_setting('heuresys.mig344_gruppi_prima', true)::int;
  da_fare      := current_setting('heuresys.mig344_da_fare', true)::int;

  -- (a) nessuna forma di chiamata sopravvissuta
  SELECT count(*) INTO residue FROM sys.sys_skills
   WHERE skill_metadata->>'skill_group_uri' LIKE 'https://ec.europa.eu/esco/api/%';
  IF residue > 0 THEN
    RAISE EXCEPTION '000344: % righe ancora in forma di chiamata', residue;
  END IF;

  -- (b) nessun valore malformato prodotto dall'estrazione
  SELECT count(*) INTO malformati FROM sys.sys_skills
   WHERE coalesce(skill_metadata->>'skill_group_uri', '') <> ''
     AND skill_metadata->>'skill_group_uri' NOT LIKE 'http%';
  IF malformati > 0 THEN
    RAISE EXCEPTION '000344: % valori non sono piu'' URI', malformati;
  END IF;

  -- (c) LA DISTINZIONE E' CONSERVATA: stesso numero di gruppi distinti
  SELECT count(DISTINCT skill_metadata->>'skill_group_uri') INTO gruppi_dopo
    FROM sys.sys_skills WHERE coalesce(skill_metadata->>'skill_group_uri', '') <> '';
  IF gruppi_dopo <> gruppi_prima THEN
    RAISE EXCEPTION '000344: i gruppi distinti erano %, ora sono % — normalizzare non deve fondere gruppi diversi',
                    gruppi_prima, gruppi_dopo;
  END IF;

  -- (d) nessuna riga e' sparita o comparsa: il campo c'e' sulle stesse righe di
  --     prima. ⚠ QUESTO CONTROLLO DEVE VALERE ANCHE A LAVORO GIA' FATTO. La
  --     prima stesura confrontava con `da_fare + vuoti` ed e' andata ROSSA alla
  --     SECONDA passata della prova generale: al secondo giro `da_fare` e' 0,
  --     perche' non c'e' piu' niente da normalizzare, e 13.178 <> 0+291.
  --     Una post-condizione che passa solo la prima volta non e' una
  --     post-condizione: e' un controllo che si rompe da se' a ogni deploy.
  SELECT count(*), count(*) FILTER (WHERE coalesce(skill_metadata->>'skill_group_uri', '') = '')
    INTO totali, vuoti
    FROM sys.sys_skills WHERE skill_metadata ? 'skill_group_uri';
  IF totali <> current_setting('heuresys.mig344_con_campo_prima', true)::int THEN
    RAISE EXCEPTION '000344: % righe col campo, ne aveva % prima', totali,
                    current_setting('heuresys.mig344_con_campo_prima', true);
  END IF;

  -- (e) il giornale e' APPLICABILE: ogni riga che conserva esiste ancora, e
  --     tutto cio' che questa passata ha toccato e' dentro. Contarne le righe
  --     contro `da_fare` sarebbe di nuovo un controllo valido una volta sola —
  --     il giornale e' cumulativo, `da_fare` no.
  IF EXISTS (SELECT 1 FROM staging.mig344_skill_group_uri_undo u
              WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills s WHERE s.skill_id = u.skill_id)) THEN
    RAISE EXCEPTION '000344: il giornale conserva righe che non esistono piu'' — rollback non applicabile';
  END IF;
  IF da_fare > 0 AND (SELECT count(*) FROM staging.mig344_skill_group_uri_undo) < da_fare THEN
    RAISE EXCEPTION '000344: il giornale non copre le % righe modificate — rollback non garantito', da_fare;
  END IF;

  RAISE NOTICE '000344 ok — % normalizzate · % gruppi distinti (invariati) · % vuoti intatti · giornale completo',
               da_fare, gruppi_dopo, vuoti;
END $$;
