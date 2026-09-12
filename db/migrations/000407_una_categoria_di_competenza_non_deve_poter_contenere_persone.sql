-- 000407 — Una categoria di competenza non deve poter contenere persone.
--
-- #214 F6 — TREDICESIMO perimetro in sola lettura per l'agente: `skill-categories`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-12 sull'atlante fresco (da 344cd461): 108 moduli · 12 aperti · 45 in
-- coda (19 neutri). La testa della coda dei neutri e' un PARI a tre, tutti a 2 letture e
-- 2 pagine: `enterprise-typing-profiles`, `job-roles`, `skill-categories`.
--
-- ⚠ `approvals` e' piu' ampio (2 letture · 3 pagine) ma NON e' in gara: dichiara ACTIVITY,
-- non «nessun dato di persona» — la stessa esclusione della 000378, 000382 e 000405.
--
-- Chiusa la terna degli «intermedi» (000381 varianti, 000382 famiglie, 000405 modelli
-- operativi), restano i tre che le migrazioni precedenti avevano lasciato in coda per RISCHIO
-- CRESCENTE, e per la prima volta la scelta cade fra i «vocabolari delle persone». Il piano
-- di #214 lo prevedeva: «si apriranno con una motivazione su quella vicinanza, non per
-- ampiezza». Eccola.
--   · `enterprise-typing-profiles` resta SCARTATO per la ragione misurata il 2026-09-08, che
--     vale ancora: la sua unica porta, il JSONB `enterprise_typing_metadata`, e' GIA' OCCUPATA
--     dalla chiave `decided_by` con un NOME PROPRIO IN CHIARO;
--   · fra `job-roles` e `skill-categories` la distanza da una persona NON e' la stessa, anche
--     se la 000378 le aveva messe nella stessa riga. Un RUOLO e' cio' che una persona RICOPRE:
--     e' l'etichetta di un posto, e da un ruolo si risale a chi lo occupa. Una CATEGORIA DI
--     COMPETENZA e' cio' che RAGGRUPPA le competenze — Cognitive, Technical, Leadership… —
--     cioe' un livello della tassonomia. Una persona possiede COMPETENZE (`sys_user_skills`,
--     che e' SKILL e resta chiusa), non categorie: nessuna riga di questa tabella si lega a
--     una persona, nemmeno per due passaggi. E' una CLASSIFICAZIONE, del genere che I21 tiene
--     aperta a ogni settore, e `data-classes.ts` la dichiara «catalogo globale» con parole
--     proprie. Quindi prima le categorie, poi i ruoli.
--
-- COSA E'. `sys_skill_categories` e' il livello intermedio della tassonomia delle competenze:
-- 7 righe in produzione (Cognitive · External · Interpersonal · Leadership · Performance ·
-- Personal · Technical), agganciate a una famiglia (`skill_category_family_id`) e referenziate
-- dalle competenze. Non ha `tenant_id`: e' il vocabolario con cui si descrivono le competenze,
-- non contenuto di un cliente.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le otto colonne
-- sono: skill_category_id · _family_id · _code · _name · _description · _metadata ·
-- created_at · updated_at. Nessuna e' il SOGGETTO di un dato di persona, e — come per
-- `operating-models` — non c'e' nemmeno un ATTORE: non esiste un created_by.
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370, 000378, 000381, 000382 e 000405:
--   ① `skill_category_metadata` e' JSONB — e qui NON e' vuoto: 6 righe su 7 portano sette
--      chiavi ereditate dal legacy (`weight`, `is_active`, `tenant_id`, `deleted_at`,
--      `sort_order`, `framework_id`, `behavioral_indicators`), TUTTE a `null`. Nessuna nomina
--      una persona, e nessun valore e' un indirizzo di posta: e' residuo, non sapere. La
--      sentinella lo guarda con lo stesso pattern delle sorelle, e oggi dice zero;
--   ② `skill_category_description` e' TESTO LIBERO — POPOLATO su 6 righe su 7 (frasi come
--      «Genera idee creative e implementa miglioramenti»). Una persona vi entra scrivendola.
--
-- Misurato in produzione prima di aprire (2026-09-12): 7 categorie · 6 con descrizione ·
-- 6 con metadata non vuoto · 0 indirizzi di posta in nessuna delle due porte. Un perimetro
-- neutro oggi non e' un perimetro neutro domani: la guardia si mette PRIMA che il buco si apra.
--
-- La prova a esiti opposti e' quella della 000382/000405: entrambe le porte iniettate e
-- disfatte, e la post-condizione non guarda solo QUANTE righe restano ma che il CONTENUTO sia
-- tornato identico per impronta — e qui conta doppio, perche' descrizione e metadata sono
-- PIENI: un ripristino che rimettesse `{}` al posto delle sette chiavi a null passerebbe un
-- conteggio e fallirebbe l'impronta.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_categoria_di_competenza_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367 … 000405: se cambia li',
--    cambia qui.
SELECT c.skill_category_id                  AS categoria_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_skill_categories c
  CROSS JOIN LATERAL jsonb_each(coalesce(c.skill_category_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT c.skill_category_id                   AS categoria_id,
       'descrizione'::text                   AS porta,
       'skill_category_description'::text    AS dove,
       left(c.skill_category_description, 80) AS valore
  FROM sys.sys_skill_categories c
 WHERE c.skill_category_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_categoria_di_competenza_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-12). Zero righe attese. Il perimetro `skill-categories` e'' '
  'aperto all''agente perche'' `sys_skill_categories` e'' un livello della tassonomia delle '
  'competenze senza colonne che siano il SOGGETTO di un dato di persona — e nemmeno un ATTORE. '
  'Ma porta DUE vie d''ingresso: `skill_category_metadata` e'' JSONB (con chiavi ereditate dal '
  'legacy, tutte a null) e `skill_category_description` e'' testo libero popolato. Una riga qui '
  'significa che il perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone     int;
  n_categorie   int;
  n_dopo        int;
  c_id          uuid;
  descr_pre     text;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_categoria_di_competenza_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000407: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_categorie FROM sys.sys_skill_categories;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa.
  SELECT md5(string_agg(
           coalesce(skill_category_description, '<null>') || '|' ||
           coalesce(skill_category_metadata::text, '<null>'),
           E'\n' ORDER BY skill_category_id))
    INTO impronta_pre
    FROM sys.sys_skill_categories;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su ENTRAMBE le porte: una sentinella provata su
  --    una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa transazione:
  --    le righe di prova non esistono prima e non esistono dopo.
  IF n_categorie = 0 THEN
    RAISE NOTICE
      '000407: `sys_skill_categories` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. '
      'Dove la tabella e'' popolata, la prova gira.';
  ELSE
    SELECT skill_category_id, skill_category_description INTO c_id, descr_pre
      FROM sys.sys_skill_categories ORDER BY skill_category_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_skill_categories
       SET skill_category_description =
             coalesce(skill_category_description, '') || ' __PROVA_000407__ mario.rossi@example.org'
     WHERE skill_category_id = c_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_categoria_di_competenza_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000407: la sentinella NON vede un indirizzo di posta iniettato in '
        '`skill_category_description` — e'' cieca sul testo libero, e una guardia cieca '
        'e'' peggio di nessuna guardia';
    END IF;
    -- il ripristino rimette il valore SALVATO, non uno ricostruito: '' e NULL sono due
    -- valori diversi e un `nullif` li confonderebbe — l'impronta al passo 4 lo vedrebbe.
    UPDATE sys.sys_skill_categories
       SET skill_category_description = descr_pre
     WHERE skill_category_id = c_id;

    -- ① poi il JSONB — per AGGIUNTA di una chiave, cosi' le sette chiavi ereditate restano
    --    dove sono e il ripristino le lascia intatte (l'impronta lo verifica).
    UPDATE sys.sys_skill_categories
       SET skill_category_metadata =
             coalesce(skill_category_metadata, '{}'::jsonb)
             || '{"__prova_000407_referente": "mario.rossi@example.org"}'::jsonb
     WHERE skill_category_id = c_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_categoria_di_competenza_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000407: la sentinella NON vede un referente iniettato in '
        '`skill_category_metadata` — e'' cieca sul JSONB, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    UPDATE sys.sys_skill_categories
       SET skill_category_metadata = skill_category_metadata - '__prova_000407_referente'
     WHERE skill_category_metadata ? '__prova_000407_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_categoria_di_competenza_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000407: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — in due modi, perche' uno solo non
  --    basta: il conteggio vede una riga sparita, l'impronta vede una riga ALTERATA.
  SELECT count(*) INTO n_dopo FROM sys.sys_skill_categories;
  IF n_dopo <> n_categorie THEN
    RAISE EXCEPTION '000407: le categorie sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_categorie;
  END IF;

  SELECT md5(string_agg(
           coalesce(skill_category_description, '<null>') || '|' ||
           coalesce(skill_category_metadata::text, '<null>'),
           E'\n' ORDER BY skill_category_id))
    INTO impronta_post
    FROM sys.sys_skill_categories;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000407: le due porte NON sono tornate come prima (impronta % contro %): la prova ha '
      'alterato un contenuto vero invece di disfarsi', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000407: sentinella installata e provata su entrambe le porte · % categorie invariate, '
    'contenuto identico per impronta.', n_categorie;
END $$;

COMMIT;
