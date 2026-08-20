-- ============================================================================
-- 000346 — #222 F4 (rilievo F6-03): i 70 URI che sembrano ESCO e non lo sono
--          passano al namespace `CUSTOM::`.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20:
--   · 61 competenze con `http://data.europa.eu/esco/skill/heuresys_...` — il
--     dominio e' quello vero, l'identificativo e' nostro;
--   · 9 con `http://esco.eu/skill/...` — dominio **inventato**: ESCO vive su
--     `data.europa.eu/esco`, `esco.eu` non e' ESCO.
--   Totale 70, che e' il numero del rilievo.
--
-- PERCHE' CONTA. Un URI ESCO e' una promessa: «questa competenza e' quella che
-- il vocabolario europeo identifica cosi'». Chi la legge puo' risolverla,
-- confrontarla con un altro sistema, allinearla. Un identificativo locale
-- travestito da ESCO rompe la promessa in silenzio: la risoluzione fallisce, il
-- confronto con un sistema esterno non trova nulla, e nessuno sa perche'.
-- `CUSTOM::` dice quel che e' — e non finge di essere un indirizzo risolvibile,
-- che e' precisamente il punto.
--
-- CHI LI REFERENZIA, misurato PRIMA di rinominare (il piano lo impone, e a
-- ragione):
--   · sys_esco_occupation_mappings: 0 riferimenti per URI;
--   · sys_skill_embeddings: 61 righe, ma agganciate per `skill_id`, non per URI
--     — e la loro impronta si calcola su nome+descrizione, quindi rinominare
--     l'URI non le invalida (verificabile dalla sentinella di 000342);
--   · **i seed**: `db/seeds/reconciliation/45_mentorship.sql` ne nomina 8, e
--     `39_skill_learning_mappings.sql` ne cita uno in un commento. Emendati
--     insieme a questa migrazione — senza, il giro dopo li rimetterebbero
--     com'erano (ADR-0035).
--
-- ROLLBACK: giornale `staging.mig346_esco_uri_undo` + la funzione che lo applica.
--
-- IDEMPOTENTE: la `WHERE` seleziona solo le forme ancora da convertire.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

CREATE TABLE IF NOT EXISTS staging.mig346_esco_uri_undo (
  skill_id      uuid PRIMARY KEY,
  valore_prima  text NOT NULL,
  annotato_il   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig346_esco_uri_undo (skill_id, valore_prima)
SELECT skill_id, skill_esco_uri
  FROM sys.sys_skills
 WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/heuresys%'
    OR skill_esco_uri LIKE 'http://esco.eu/skill/%'
ON CONFLICT (skill_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig346_annulla() RETURNS int
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE sys.sys_skills s SET skill_esco_uri = u.valore_prima
    FROM staging.mig346_esco_uri_undo u WHERE u.skill_id = s.skill_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- ---------------------------------------------------------------------------
-- GUARDIA — al momento dell'esecuzione, mai ereditata.
-- ---------------------------------------------------------------------------
DO $$
DECLARE da_fare int; autentici_prima int;
BEGIN
  SELECT count(*) INTO da_fare FROM sys.sys_skills
   WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/heuresys%'
      OR skill_esco_uri LIKE 'http://esco.eu/skill/%';

  SELECT count(*) INTO autentici_prima FROM sys.sys_skills
   WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/%'
     AND skill_esco_uri NOT LIKE 'http://data.europa.eu/esco/skill/heuresys%';

  PERFORM set_config('heuresys.mig346_da_fare', da_fare::text, false);
  PERFORM set_config('heuresys.mig346_autentici', autentici_prima::text, false);
END $$;

-- ---------------------------------------------------------------------------
-- La conversione. Due forme, due regole, ENTRAMBE ESPLICITE — niente jolly che
-- possa prendere anche un URI autentico.
-- ---------------------------------------------------------------------------
UPDATE sys.sys_skills
   SET skill_esco_uri = 'CUSTOM::' || substring(skill_esco_uri from length('http://data.europa.eu/esco/skill/') + 1)
 WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/heuresys%';

UPDATE sys.sys_skills
   SET skill_esco_uri = 'CUSTOM::' || substring(skill_esco_uri from length('http://esco.eu/skill/') + 1)
 WHERE skill_esco_uri LIKE 'http://esco.eu/skill/%';

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Il controllo (b) e' quello che protegge cio' che NON doveva
-- cambiare: i 13.933 URI ESCO autentici. Contare i convertiti non
-- distinguerebbe «ho convertito i falsi» da «ho convertito mezzo catalogo».
-- ---------------------------------------------------------------------------
DO $$
DECLARE finti int; autentici_dopo int; autentici_prima int; convertiti int; vuoti int;
BEGIN
  autentici_prima := current_setting('heuresys.mig346_autentici', true)::int;

  SELECT count(*) INTO finti FROM sys.sys_skills
   WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/heuresys%'
      OR skill_esco_uri LIKE 'http://esco.eu/skill/%';
  IF finti > 0 THEN
    RAISE EXCEPTION '000346: % URI contraffatti ancora sotto un dominio ESCO', finti;
  END IF;

  SELECT count(*) INTO autentici_dopo FROM sys.sys_skills
   WHERE skill_esco_uri LIKE 'http://data.europa.eu/esco/skill/%';
  IF autentici_dopo <> autentici_prima THEN
    RAISE EXCEPTION '000346: gli URI ESCO autentici erano %, ora sono % — la conversione ha preso di piu'' del dovuto',
                    autentici_prima, autentici_dopo;
  END IF;

  -- nessun `CUSTOM::` vuoto: sarebbe un identificativo perso
  SELECT count(*) INTO vuoti FROM sys.sys_skills WHERE skill_esco_uri = 'CUSTOM::';
  IF vuoti > 0 THEN
    RAISE EXCEPTION '000346: % URI convertiti hanno perso l''identificativo', vuoti;
  END IF;

  SELECT count(*) INTO convertiti FROM sys.sys_skills WHERE skill_esco_uri LIKE 'CUSTOM::%';
  RAISE NOTICE '000346 ok — % URI sotto CUSTOM:: · % ESCO autentici intatti', convertiti, autentici_dopo;
END $$;
