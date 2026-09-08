-- 000382 — Una famiglia di fascicoli non deve poter contenere persone.
--
-- #214 F6 — UNDICESIMO perimetro in sola lettura per l'agente: `blueprint-families`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-08 sull'atlante fresco: 105 moduli · 10 aperti · 39 in coda
-- (20 neutri). La testa della coda dei neutri e' ancora un PARI a cinque, tutti a 2 letture
-- e 2 pagine: `blueprint-families`, `enterprise-typing-profiles`, `job-roles`,
-- `operating-models`, `skill-categories`.
--
-- ⚠ `approvals` e' piu' ampio (2 letture · 3 pagine) ma NON e' in gara: dichiara ACTIVITY,
-- non «nessun dato di persona», e la sua apertura andra' motivata su quella classe. E' la
-- stessa esclusione gia' scritta nella 000378.
--
-- L'ordine fra i cinque e' quello che la 000378 ha stabilito e la 000381 ha applicato, e non
-- si rinegozia ogni volta: il RISCHIO CRESCENTE.
--   · `job-roles` e `skill-categories` restano i piu' VICINI a una persona — un ruolo e' cio'
--     che una persona ricopre, una categoria di competenza cio' che possiede: sono i
--     vocabolari con cui si descrivono le persone, non le imprese;
--   · `enterprise-typing-profiles` e' stato SCARTATO IERI con una ragione misurata, e quella
--     ragione vale ancora: la sua unica porta, il JSONB `enterprise_typing_metadata`, e' GIA'
--     OCCUPATA — la chiave `decided_by` porta un NOME PROPRIO IN CHIARO su entrambe le righe.
--     Aprirlo significherebbe dichiarare neutra una porta che sappiamo occupata, e installarvi
--     una guardia che nasce CIECA sull'unico caso che quel perimetro contiene davvero;
--   · restano `blueprint-families` e `operating-models`, che descrivono COME e' fatta
--     un'organizzazione.
--
-- ⭐ E FRA QUESTI DUE DECIDE LA MISURA, come ieri. Misurato in produzione il 2026-09-08,
-- prima di scegliere:
--
--   candidato            porte                    occupate oggi
--   blueprint-families   description + metadata   1 riga: descrizione «Retail and commercial
--                                                 banking blueprint family.», metadata `{}`
--   operating-models     description + metadata   6 righe
--
-- `blueprint-families` ha UNA riga contro sei, e nessuna delle due porte contiene una persona.
-- Ma la ragione che scioglie davvero il pari non e' il conteggio: e' che `blueprint-families`
-- e' il GENITORE DIRETTO di `blueprint-variants`, aperto ieri con la 000381 e presidiato dalla
-- sentinella gemella di questa. Aprire il genitore subito dopo il figlio chiude la coppia,
-- invece di lasciare meta' famiglia presidiata e meta' no — che e' la condizione in cui un
-- dato scivola nel ramo non guardato senza che nessuno strumento lo veda.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le sette colonne di
-- `sys_blueprint_families` sono: blueprint_family_id · _code · _name · _description ·
-- _metadata · created_at · updated_at. Nessuna e' il SOGGETTO di un dato di persona, e — come
-- per `enterprise-size-bands` e `blueprint-variants` — non c'e' nemmeno un ATTORE: non esiste
-- un created_by, quindi qui non serve la distinzione «chi esamina non e' chi e' esaminato».
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370, della 000378 e della 000381:
--   ① `blueprint_family_metadata` e' JSONB — oggi vale `{}`, cioe' e' VUOTO ma non assente:
--      e' una porta aperta su una stanza vuota, non una porta murata;
--   ② `blueprint_family_description` e' TESTO LIBERO, ed e' POPOLATO. Una persona vi entra
--      scrivendola, senza bisogno di una chiave che la annunci.
--
-- La neutralita' e' dunque vera OGGI, non per costruzione. Misurato in produzione prima di
-- aprire (2026-09-08): 1 famiglia · 1 con descrizione · metadata `{}` · 0 indirizzi di posta
-- in nessuna delle due porte. Un perimetro neutro oggi non e' un perimetro neutro domani:
-- e' esattamente per questo che la guardia si mette PRIMA che il buco si apra.
--
-- ⭐ E QUI LA PROVA E' PIU' SEVERA CHE NELLA 000381, per una differenza di fatto: li' la
-- descrizione era vuota, qui e' PIENA. Una prova che appende e poi toglie puo' restituire un
-- testo *diverso* da quello di partenza senza che nessun conteggio se ne accorga — le righe
-- sarebbero sempre una. Quindi la post-condizione non guarda solo QUANTE righe ci sono: guarda
-- che il TESTO sia tornato identico, per impronta, insieme al metadata.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_famiglia_di_fascicoli_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367, 000370, 000378 e 000381:
--    se cambia li', cambia qui.
SELECT f.blueprint_family_id                 AS famiglia_id,
       'metadata'::text                      AS porta,
       kv.key                                AS dove,
       left(kv.value #>> '{}', 80)           AS valore
  FROM sys.sys_blueprint_families f
  CROSS JOIN LATERAL jsonb_each(coalesce(f.blueprint_family_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT f.blueprint_family_id                  AS famiglia_id,
       'descrizione'::text                    AS porta,
       'blueprint_family_description'::text   AS dove,
       left(f.blueprint_family_description, 80) AS valore
  FROM sys.sys_blueprint_families f
 WHERE f.blueprint_family_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_famiglia_di_fascicoli_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-08). Zero righe attese. Il perimetro `blueprint-families` '
  'e'' aperto all''agente perche'' `sys_blueprint_families` non ha colonne che siano il '
  'SOGGETTO di un dato di persona — e nemmeno un ATTORE: non esiste un created_by. Ma porta '
  'DUE vie d''ingresso: `blueprint_family_metadata` e'' JSONB e '
  '`blueprint_family_description` e'' testo libero, e quest''ultima e'' POPOLATA. Una riga '
  'qui significa che il perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone   int;
  n_famiglie  int;
  n_dopo      int;
  f_id        uuid;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_famiglia_di_fascicoli_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000382: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_famiglie FROM sys.sys_blueprint_families;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa. Qui la
  -- descrizione e' piena: se la prova la restituisse alterata, nessun conteggio se ne
  -- accorgerebbe — le righe resterebbero una.
  SELECT md5(string_agg(
           coalesce(blueprint_family_description, '<null>') || '|' ||
           coalesce(blueprint_family_metadata::text, '<null>'),
           E'\n' ORDER BY blueprint_family_id))
    INTO impronta_pre
    FROM sys.sys_blueprint_families;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su ENTRAMBE le porte: una sentinella provata su
  --    una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa transazione:
  --    le righe di prova non esistono prima e non esistono dopo.
  IF n_famiglie = 0 THEN
    RAISE NOTICE
      '000382: `sys_blueprint_families` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. '
      'Dove la tabella e'' popolata, la prova gira.';
  ELSE
    SELECT blueprint_family_id INTO f_id
      FROM sys.sys_blueprint_families ORDER BY blueprint_family_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_blueprint_families
       SET blueprint_family_description =
             coalesce(blueprint_family_description, '') || ' __PROVA_000382__ mario.rossi@example.org'
     WHERE blueprint_family_id = f_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_famiglia_di_fascicoli_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000382: la sentinella NON vede un indirizzo di posta iniettato in '
        '`blueprint_family_description` — e'' cieca sul testo libero, e una guardia cieca '
        'e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_blueprint_families
       SET blueprint_family_description =
             nullif(replace(blueprint_family_description,
                            ' __PROVA_000382__ mario.rossi@example.org', ''), '')
     WHERE blueprint_family_description LIKE '%__PROVA_000382__%';

    -- ① poi il JSONB
    UPDATE sys.sys_blueprint_families
       SET blueprint_family_metadata =
             coalesce(blueprint_family_metadata, '{}'::jsonb)
             || '{"__prova_000382_referente": "mario.rossi@example.org"}'::jsonb
     WHERE blueprint_family_id = f_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_famiglia_di_fascicoli_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000382: la sentinella NON vede un referente iniettato in '
        '`blueprint_family_metadata` — e'' cieca sul JSONB, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    UPDATE sys.sys_blueprint_families
       SET blueprint_family_metadata = blueprint_family_metadata - '__prova_000382_referente'
     WHERE blueprint_family_metadata ? '__prova_000382_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_famiglia_di_fascicoli_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000382: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — in due modi, perche' uno solo non
  --    basta: il conteggio vede una riga sparita, l'impronta vede una riga ALTERATA.
  SELECT count(*) INTO n_dopo FROM sys.sys_blueprint_families;
  IF n_dopo <> n_famiglie THEN
    RAISE EXCEPTION '000382: le famiglie sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_famiglie;
  END IF;

  SELECT md5(string_agg(
           coalesce(blueprint_family_description, '<null>') || '|' ||
           coalesce(blueprint_family_metadata::text, '<null>'),
           E'\n' ORDER BY blueprint_family_id))
    INTO impronta_post
    FROM sys.sys_blueprint_families;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000382: le due porte NON sono tornate come prima (impronta % contro %): la prova ha '
      'alterato un contenuto vero invece di disfarsi', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000382: sentinella installata e provata su entrambe le porte · % famiglie invariate, '
    'contenuto identico per impronta.', n_famiglie;
END $$;

COMMIT;
