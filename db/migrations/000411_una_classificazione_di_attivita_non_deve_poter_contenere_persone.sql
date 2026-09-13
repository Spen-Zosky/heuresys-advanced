-- 000411 — Una classificazione di attivita' (ATECO) non deve poter contenere persone.
--
-- #214 F6 — QUINDICESIMO perimetro in sola lettura per l'agente: `activity-classifications`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-13 sull'atlante fresco (da 10be43af): 109 moduli · 14 aperti · 41 in
-- coda (22 neutri). La testa dei neutri: `approvals` e `projects` dichiarano ACTIVITY (non in
-- gara, come nella 000378/000382/000405); `enterprise-typing-profiles` resta SCARTATO per la
-- ragione misurata il 2026-09-08 e ancora vera (porta JSONB occupata da `decided_by` con un
-- nome proprio in chiaro). Sotto, un PARI a DICIASSETTE, tutti a 2 letture e 1 pagina.
--
-- ⚠⚠ E DENTRO QUEL PARI C'ERANO TRE FALSI NEUTRI, la stessa forma del difetto `candidates`
-- (S1097) e `engagement` (S1083): `interviews`, `interview-feedback` e `job-offers` risultavano
-- «nessun dato di persona» perche' le loro rotte portano il permesso CONDIVISO
-- `job-requisition:read`. Misurato su information_schema (2026-09-13): `sys_interviews` ha per
-- SOGGETTO la candidatura di una persona esterna (application_id, luogo, orario);
-- `sys_interview_feedback` porta `feedback_score` e `feedback_recommendation` su quella persona
-- — una VALUTAZIONE; `sys_job_offers` porta `offer_gross_annual_salary` — una RETRIBUZIONE
-- offerta a una persona. Esclusi (V2, elenco esplicito) nello stesso commit. `job-postings` e
-- `job-requisitions` restano neutri: l'annuncio e la requisizione descrivono il POSTO.
--
-- Tolti i tre, il pari lo scioglie il RISCHIO CRESCENTE: fra pari si apre prima quello piu'
-- LONTANO da una persona. `activity-classifications` e' il piu' lontano di tutti: e' il codice
-- ATECO di un'ATTIVITA' ECONOMICA — non un posto che una persona ricopre, non una competenza che
-- possiede, non una struttura in cui lavora: e' la classificazione con cui un'IMPRESA si
-- descrive al fisco. I21 la tiene aperta a ogni settore per costruzione.
--
-- COSA E'. `sys_activity_classifications`: 4.304 righe (ATECO 2025 e schemi collegati), con
-- schema, codice, codice padre, nome, livello. Nessun tenant_id: e' il vocabolario, non il
-- contenuto di un cliente.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le dieci colonne sono:
-- activity_classification_id · _scheme · _code · _parent_code · _name · _description · _level ·
-- _metadata · created_at · updated_at. Nessuna e' il SOGGETTO di un dato di persona, e non c'e'
-- nemmeno un ATTORE: non esiste un created_by.
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370/000378/000381/000382/000405/000407/000408:
--   ① `activity_classification_metadata` e' JSONB — e stavolta e' PIENO su tutte le 4.304
--      righe: `title_en`, `title_de` (4.304), `ordine` (3.257), e su 1.047 righe le chiavi
--      della derivazione (`fonte_evidenza`, `derivato_da`, `derivato_come`, `nome_preso_da`,
--      `mai_importato`). Sono TITOLI TRADOTTI e PROVENIENZA di un codice: nessuna nomina
--      una persona;
--   ② `activity_classification_description` e' TESTO LIBERO — oggi vuoto su tutte le righe.
--
-- Misurato in produzione prima di aprire (2026-09-13): 4.304 classificazioni · 0 con
-- descrizione · 4.304 con metadata non vuoto · 0 indirizzi di posta in nessuna delle due porte
-- · 0 chiavi che nominano una persona. Un perimetro neutro oggi non e' un perimetro neutro
-- domani: la guardia si mette PRIMA che il buco si apra.
--
-- La prova a esiti opposti e' quella della 000407/000408: entrambe le porte iniettate e
-- disfatte, con la post-condizione per IMPRONTA md5 su 4.304 righe PIENE — che qui conta doppio,
-- perche' un ripristino che rimettesse `{}` al posto dei titoli tradotti passerebbe un conteggio
-- e fallirebbe l'impronta.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_classificazione_di_attivita_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern delle sorelle: se cambia li', cambia qui.
SELECT c.activity_classification_id        AS classificazione_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_activity_classifications c
  CROSS JOIN LATERAL jsonb_each(coalesce(c.activity_classification_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: si cerca cio' che si puo' riconoscere con certezza — un
--    indirizzo di posta — e non si finge di saper riconoscere un nome proprio.
SELECT c.activity_classification_id                   AS classificazione_id,
       'descrizione'::text                            AS porta,
       'activity_classification_description'::text    AS dove,
       left(c.activity_classification_description, 80) AS valore
  FROM sys.sys_activity_classifications c
 WHERE c.activity_classification_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_classificazione_di_attivita_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-13). Zero righe attese. Il perimetro `activity-classifications` '
  'e'' aperto all''agente perche'' `sys_activity_classifications` e'' la tassonomia ATECO: '
  'nessuna colonna e'' il SOGGETTO di un dato di persona, e nemmeno un ATTORE. Ma porta DUE vie '
  'd''ingresso: `activity_classification_metadata` e'' JSONB (pieno: titoli tradotti e '
  'provenienza) e `activity_classification_description` e'' testo libero. Una riga qui '
  'significa che il perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone     int;
  n_righe       int;
  n_dopo        int;
  c_id          uuid;
  descr_pre     text;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_classificazione_di_attivita_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000411: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_righe FROM sys.sys_activity_classifications;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa.
  SELECT md5(string_agg(
           coalesce(activity_classification_description, '<null>') || '|' ||
           coalesce(activity_classification_metadata::text, '<null>'),
           E'\n' ORDER BY activity_classification_id))
    INTO impronta_pre
    FROM sys.sys_activity_classifications;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su ENTRAMBE le porte.
  IF n_righe = 0 THEN
    RAISE NOTICE
      '000411: `sys_activity_classifications` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata.';
  ELSE
    SELECT activity_classification_id, activity_classification_description INTO c_id, descr_pre
      FROM sys.sys_activity_classifications ORDER BY activity_classification_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_activity_classifications
       SET activity_classification_description =
             coalesce(activity_classification_description, '') || ' __PROVA_000411__ mario.rossi@example.org'
     WHERE activity_classification_id = c_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_classificazione_di_attivita_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000411: la sentinella NON vede un indirizzo di posta iniettato in '
        '`activity_classification_description` — e'' cieca sul testo libero';
    END IF;
    -- il ripristino rimette il valore SALVATO: '' e NULL sono due valori diversi.
    UPDATE sys.sys_activity_classifications
       SET activity_classification_description = descr_pre
     WHERE activity_classification_id = c_id;

    -- ① poi il JSONB
    UPDATE sys.sys_activity_classifications
       SET activity_classification_metadata =
             coalesce(activity_classification_metadata, '{}'::jsonb)
             || '{"__prova_000411_referente": "mario.rossi@example.org"}'::jsonb
     WHERE activity_classification_id = c_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_classificazione_di_attivita_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000411: la sentinella NON vede un referente iniettato in '
        '`activity_classification_metadata` — e'' cieca sul JSONB';
    END IF;
    UPDATE sys.sys_activity_classifications
       SET activity_classification_metadata = activity_classification_metadata - '__prova_000411_referente'
     WHERE activity_classification_metadata ? '__prova_000411_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero.
    SELECT count(*) INTO n_persone FROM sys.v_classificazione_di_attivita_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000411: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — conteggio E impronta.
  SELECT count(*) INTO n_dopo FROM sys.sys_activity_classifications;
  IF n_dopo <> n_righe THEN
    RAISE EXCEPTION '000411: le classificazioni sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_righe;
  END IF;

  SELECT md5(string_agg(
           coalesce(activity_classification_description, '<null>') || '|' ||
           coalesce(activity_classification_metadata::text, '<null>'),
           E'\n' ORDER BY activity_classification_id))
    INTO impronta_post
    FROM sys.sys_activity_classifications;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000411: le due porte NON sono tornate come prima (impronta % contro %)', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000411: sentinella installata e provata su entrambe le porte · % classificazioni invariate, '
    'contenuto identico per impronta.', n_righe;
END $$;

COMMIT;
