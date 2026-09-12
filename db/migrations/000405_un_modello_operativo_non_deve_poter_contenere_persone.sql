-- 000405 — Un modello operativo non deve poter contenere persone.
--
-- #214 F6 — DODICESIMO perimetro in sola lettura per l'agente: `operating-models`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-12 sull'atlante fresco (da 8b81b12f): 107 moduli · 11 aperti · 39 in
-- coda (20 neutri). La testa della coda dei neutri e' un PARI a quattro, tutti a 2 letture e
-- 2 pagine: `enterprise-typing-profiles`, `job-roles`, `operating-models`, `skill-categories`.
--
-- ⚠ `approvals` e' piu' ampio (2 letture · 3 pagine) ma NON e' in gara: dichiara ACTIVITY,
-- non «nessun dato di persona» — la stessa esclusione gia' scritta nella 000378 e nella 000382.
--
-- L'ordine fra i quattro e' quello stabilito dalla 000378 e applicato dalla 000381 e dalla
-- 000382, e non si rinegozia ogni volta: il RISCHIO CRESCENTE.
--   · `job-roles` e `skill-categories` restano i piu' VICINI a una persona — un ruolo e' cio'
--     che una persona ricopre, una categoria di competenza cio' che possiede;
--   · `enterprise-typing-profiles` resta SCARTATO per la ragione misurata il 2026-09-08, che
--     vale ancora: la sua unica porta, il JSONB `enterprise_typing_metadata`, e' GIA' OCCUPATA
--     dalla chiave `decided_by` con un NOME PROPRIO IN CHIARO. Una guardia li' nascerebbe cieca
--     sull'unico caso che quel perimetro contiene davvero;
--   · resta `operating-models`, l'ultimo dei quattro «intermedi» (descrivono COME e' fatta
--     un'organizzazione) ancora in coda: la 000381 ha aperto le varianti, la 000382 le
--     famiglie, e questa chiude la terna.
--
-- COSA E'. `sys_operating_model_catalog` e' un CATALOGO di modelli operativi — B2B_SERVICES,
-- MANUFACTURING, MIXED, PUBLIC_SECTOR, RETAIL, WHOLESALE — cioe' una classificazione aperta a
-- ogni settore (I21: le tassonomie restano aperte, e' il loro mestiere). Non ha `tenant_id`:
-- non e' contenuto di un cliente, e' il vocabolario con cui un cliente si descrive.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le sette colonne
-- sono: operating_model_id · _code · _name · _description · _metadata · created_at ·
-- updated_at. Nessuna e' il SOGGETTO di un dato di persona, e — come per `enterprise-size-bands`,
-- `blueprint-variants` e `blueprint-families` — non c'e' nemmeno un ATTORE: non esiste un
-- created_by, quindi non serve la distinzione «chi esamina non e' chi e' esaminato».
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370, 000378, 000381 e 000382:
--   ① `operating_model_metadata` e' JSONB — oggi vale `{}` su tutte e sei le righe: VUOTO ma
--      non assente, una porta aperta su una stanza vuota;
--   ② `operating_model_description` e' TESTO LIBERO — oggi vuoto su tutte e sei. Una persona
--      vi entra scrivendola, senza bisogno di una chiave che la annunci.
--
-- Misurato in produzione prima di aprire (2026-09-12): 6 modelli · 0 con descrizione ·
-- metadata `{}` su tutti · 0 indirizzi di posta in nessuna delle due porte. Un perimetro vuoto
-- oggi non e' un perimetro chiuso domani: la guardia si mette PRIMA che il buco si apra.
--
-- La prova a esiti opposti e' quella della 000382: entrambe le porte iniettate e disfatte, e la
-- post-condizione non guarda solo QUANTE righe restano ma che il CONTENUTO sia tornato identico
-- per impronta — un conteggio non vede una riga alterata.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_modello_operativo_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367, 000370, 000378, 000381 e
--    000382: se cambia li', cambia qui.
SELECT m.operating_model_id                 AS modello_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_operating_model_catalog m
  CROSS JOIN LATERAL jsonb_each(coalesce(m.operating_model_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT m.operating_model_id                  AS modello_id,
       'descrizione'::text                   AS porta,
       'operating_model_description'::text   AS dove,
       left(m.operating_model_description, 80) AS valore
  FROM sys.sys_operating_model_catalog m
 WHERE m.operating_model_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_modello_operativo_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-12). Zero righe attese. Il perimetro `operating-models` e'' '
  'aperto all''agente perche'' `sys_operating_model_catalog` e'' un catalogo senza colonne che '
  'siano il SOGGETTO di un dato di persona — e nemmeno un ATTORE: non esiste un created_by. '
  'Ma porta DUE vie d''ingresso: `operating_model_metadata` e'' JSONB e '
  '`operating_model_description` e'' testo libero. Una riga qui significa che il perimetro '
  'non e'' piu'' neutro: o si toglie quel dato, o si chiude il perimetro. NON si allarga il '
  'pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone     int;
  n_modelli     int;
  n_dopo        int;
  m_id          uuid;
  descr_pre     text;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_modello_operativo_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000405: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_modelli FROM sys.sys_operating_model_catalog;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa.
  SELECT md5(string_agg(
           coalesce(operating_model_description, '<null>') || '|' ||
           coalesce(operating_model_metadata::text, '<null>'),
           E'\n' ORDER BY operating_model_id))
    INTO impronta_pre
    FROM sys.sys_operating_model_catalog;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su ENTRAMBE le porte: una sentinella provata su
  --    una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa transazione:
  --    le righe di prova non esistono prima e non esistono dopo.
  IF n_modelli = 0 THEN
    RAISE NOTICE
      '000405: `sys_operating_model_catalog` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. '
      'Dove la tabella e'' popolata, la prova gira.';
  ELSE
    SELECT operating_model_id, operating_model_description INTO m_id, descr_pre
      FROM sys.sys_operating_model_catalog ORDER BY operating_model_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_operating_model_catalog
       SET operating_model_description =
             coalesce(operating_model_description, '') || ' __PROVA_000405__ mario.rossi@example.org'
     WHERE operating_model_id = m_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_modello_operativo_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000405: la sentinella NON vede un indirizzo di posta iniettato in '
        '`operating_model_description` — e'' cieca sul testo libero, e una guardia cieca '
        'e'' peggio di nessuna guardia';
    END IF;
    -- il ripristino rimette il valore SALVATO, non uno ricostruito: '' e NULL sono due
    -- valori diversi e un `nullif` li confonderebbe — l'impronta al passo 4 lo vedrebbe.
    UPDATE sys.sys_operating_model_catalog
       SET operating_model_description = descr_pre
     WHERE operating_model_id = m_id;

    -- ① poi il JSONB
    UPDATE sys.sys_operating_model_catalog
       SET operating_model_metadata =
             coalesce(operating_model_metadata, '{}'::jsonb)
             || '{"__prova_000405_referente": "mario.rossi@example.org"}'::jsonb
     WHERE operating_model_id = m_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_modello_operativo_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000405: la sentinella NON vede un referente iniettato in '
        '`operating_model_metadata` — e'' cieca sul JSONB, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    UPDATE sys.sys_operating_model_catalog
       SET operating_model_metadata = operating_model_metadata - '__prova_000405_referente'
     WHERE operating_model_metadata ? '__prova_000405_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_modello_operativo_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000405: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — in due modi, perche' uno solo non
  --    basta: il conteggio vede una riga sparita, l'impronta vede una riga ALTERATA.
  SELECT count(*) INTO n_dopo FROM sys.sys_operating_model_catalog;
  IF n_dopo <> n_modelli THEN
    RAISE EXCEPTION '000405: i modelli sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_modelli;
  END IF;

  SELECT md5(string_agg(
           coalesce(operating_model_description, '<null>') || '|' ||
           coalesce(operating_model_metadata::text, '<null>'),
           E'\n' ORDER BY operating_model_id))
    INTO impronta_post
    FROM sys.sys_operating_model_catalog;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000405: le due porte NON sono tornate come prima (impronta % contro %): la prova ha '
      'alterato un contenuto vero invece di disfarsi', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000405: sentinella installata e provata su entrambe le porte · % modelli invariati, '
    'contenuto identico per impronta.', n_modelli;
END $$;

COMMIT;
