-- 000381 — Una variante di fascicolo non deve poter contenere persone.
--
-- #214 F6 — DECIMO perimetro in sola lettura per l'agente: `blueprint-variants`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Il criterio meccanico di
-- `check_concetti_agente.py`, ri-derivato il 2026-09-08 sull'atlante fresco:
-- 105 moduli · 9 aperti · 40 in coda (21 neutri). La testa della coda dei neutri e' di nuovo
-- un PARI — sei moduli a 2 letture e 2 pagine: `blueprint-families`, `blueprint-variants`,
-- `enterprise-typing-profiles`, `job-roles`, `operating-models`, `skill-categories`.
--
-- La 000378 aveva gia' ordinato quei sei per RISCHIO CRESCENTE, e quell'ordine resta:
--   · `job-roles` e `skill-categories` sono i piu' VICINI a una persona — un ruolo e' cio'
--     che una persona ricopre, una categoria di competenza cio' che possiede;
--   · gli altri quattro descrivono COME e' fatta un'organizzazione.
-- Ma dentro quei quattro la 000378 non aveva stabilito un ordine, e stavolta serve.
--
-- ⭐ L'ORDINE INTERNO LO DA' LA MISURA DELLE PORTE, non i nomi. Misurato in produzione
-- il 2026-09-08, prima di scegliere:
--
--   candidato                      porte                    occupate oggi
--   blueprint-variants             description + metadata   0 e 0  — ENTRAMBE VUOTE
--   blueprint-families             description + metadata   1 descrizione ("Retail and
--                                                           commercial banking blueprint
--                                                           family."), 0 metadata
--   operating-models               description + metadata   6 righe
--   enterprise-typing-profiles     metadata                 2 righe su 2 con un NOME
--                                                           PROPRIO IN CHIARO
--
-- ⚠⚠ IL REPERTO CHE HA CAMBIATO LA SCELTA. `enterprise-typing-profiles` sembrava il
-- candidato naturale — e' la sorella diretta della banda dimensionale aperta ieri, classifica
-- l'impresa e non le persone, e le sue quindici colonne non contengono un solo SOGGETTO di
-- dato di persona (misurato su information_schema). Ma la sua unica porta, il JSONB
-- `enterprise_typing_metadata`, e' GIA' OCCUPATA: la chiave `decided_by` vale
-- «Enzo 2026-06-15» su entrambe le righe. E' un ATTORE, non un soggetto — la stessa
-- distinzione gia' fatta per `link_created_by` — ma a differenza di un `created_by` uuid,
-- che e' opaco, qui c'e' un NOME PROPRIO IN CHIARO che l'agente leggerebbe.
--
-- Il criterio dichiarato da tutte le sentinelle di questa famiglia e' l'indirizzo di posta,
-- «e non un nome di persona: quello e' indecidibile, e una guardia che pretende di
-- riconoscerlo mente». Quel criterio resta giusto — ma qui produrrebbe una guardia che nasce
-- CIECA sull'unico caso che quel perimetro contiene davvero. Aprirlo oggi significherebbe
-- dichiarare neutra una porta che sappiamo occupata.
--
-- Non e' un divieto e non e' una voce nuova: e' la regola del rischio crescente applicata a
-- un DATO invece che a un nome. `enterprise-typing-profiles` resta in coda, piu' indietro di
-- quanto sembrasse, e la ragione e' scritta qui perche' chi lo riprendera' non la ri-deduca.
--
-- LA NEUTRALITA' di `blueprint-variants`, misurata su information_schema e non dedotta dai
-- nomi. Le nove colonne di `sys_blueprint_variants` sono: blueprint_variant_id · _family_id ·
-- _code · _name · _description · _size_band_id · _metadata · created_at · updated_at. Nessuna
-- e' il SOGGETTO di un dato di persona, e — come per `enterprise-size-bands` — non c'e'
-- nemmeno un ATTORE: non esiste un created_by, quindi non serve la distinzione «chi esamina
-- non e' chi e' esaminato» servita altrove. Una variante e' l'oggetto piu' DERIVATO dei
-- quattro: e' una configurazione di una famiglia di configurazioni, agganciata a una banda
-- dimensionale — cioe' a un altro perimetro gia' aperto e gia' presidiato (000378).
--
-- ⚠ MA RESTANO DUE PORTE, le stesse della 000370 e della 000378:
--   ① `blueprint_variant_metadata` e' JSONB
--   ② `blueprint_variant_description` e' TESTO LIBERO — una persona vi entra scrivendola,
--      senza bisogno di una chiave che la annunci
--
-- La neutralita' e' dunque vera OGGI, non per costruzione. Misurato in produzione prima di
-- aprire (2026-09-08): 1 variante · 0 con descrizione · 0 con metadata · 0 indirizzi di posta
-- in nessuna delle due porte. Un perimetro vuoto oggi non e' un perimetro chiuso domani:
-- e' esattamente per questo che la guardia si mette PRIMA che il buco si apra.
--
-- Sul testo libero il criterio resta l'indirizzo di posta e non «un nome di persona»:
-- quello e' indecidibile, e una guardia che pretende di riconoscerlo mente.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_variante_di_fascicolo_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367, 000370 e 000378: se
--    cambia li', cambia qui.
SELECT v.blueprint_variant_id                AS variante_id,
       'metadata'::text                      AS porta,
       kv.key                                AS dove,
       left(kv.value #>> '{}', 80)           AS valore
  FROM sys.sys_blueprint_variants v
  CROSS JOIN LATERAL jsonb_each(coalesce(v.blueprint_variant_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT v.blueprint_variant_id                AS variante_id,
       'descrizione'::text                   AS porta,
       'blueprint_variant_description'::text AS dove,
       left(v.blueprint_variant_description, 80) AS valore
  FROM sys.sys_blueprint_variants v
 WHERE v.blueprint_variant_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_variante_di_fascicolo_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-08). Zero righe attese. Il perimetro `blueprint-variants` '
  'e'' aperto all''agente perche'' `sys_blueprint_variants` non ha colonne che siano il '
  'SOGGETTO di un dato di persona — e nemmeno un ATTORE: non esiste un created_by. Ma porta '
  'DUE vie d''ingresso: `blueprint_variant_metadata` e'' JSONB e '
  '`blueprint_variant_description` e'' testo libero. Una riga qui significa che il perimetro '
  'non e'' piu'' neutro: o si toglie quel dato, o si chiude il perimetro. NON si allarga il '
  'pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone  int;
  n_varianti int;
  n_dopo     int;
  v_id       uuid;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_variante_di_fascicolo_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000381: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_varianti FROM sys.sys_blueprint_variants;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, e va fatta su ENTRAMBE le porte: una sentinella
  --    provata su una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa
  --    transazione: le righe di prova non esistono prima e non esistono dopo.
  IF n_varianti = 0 THEN
    RAISE NOTICE
      '000381: `sys_blueprint_variants` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. '
      'Dove la tabella e'' popolata, la prova gira.';
  ELSE
    SELECT blueprint_variant_id INTO v_id
      FROM sys.sys_blueprint_variants ORDER BY blueprint_variant_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_blueprint_variants
       SET blueprint_variant_description =
             coalesce(blueprint_variant_description, '') || ' __PROVA_000381__ mario.rossi@example.org'
     WHERE blueprint_variant_id = v_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_variante_di_fascicolo_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000381: la sentinella NON vede un indirizzo di posta iniettato in '
        '`blueprint_variant_description` — e'' cieca sul testo libero, e una guardia cieca '
        'e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_blueprint_variants
       SET blueprint_variant_description =
             nullif(replace(blueprint_variant_description,
                            ' __PROVA_000381__ mario.rossi@example.org', ''), '')
     WHERE blueprint_variant_description LIKE '%__PROVA_000381__%';

    -- ① poi il JSONB
    UPDATE sys.sys_blueprint_variants
       SET blueprint_variant_metadata =
             coalesce(blueprint_variant_metadata, '{}'::jsonb)
             || '{"__prova_000381_referente": "mario.rossi@example.org"}'::jsonb
     WHERE blueprint_variant_id = v_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_variante_di_fascicolo_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000381: la sentinella NON vede un referente iniettato in '
        '`blueprint_variant_metadata` — e'' cieca sul JSONB, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    UPDATE sys.sys_blueprint_variants
       SET blueprint_variant_metadata = blueprint_variant_metadata - '__prova_000381_referente'
     WHERE blueprint_variant_metadata ? '__prova_000381_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_variante_di_fascicolo_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000381: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE. Una prova che si porta via una riga
  --    di produzione sarebbe un danno molto peggiore del difetto che previene.
  SELECT count(*) INTO n_dopo FROM sys.sys_blueprint_variants;
  IF n_dopo <> n_varianti THEN
    RAISE EXCEPTION '000381: le varianti sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_varianti;
  END IF;

  RAISE NOTICE '000381: sentinella installata e provata su entrambe le porte · % varianti invariate.', n_varianti;
END $$;

COMMIT;
