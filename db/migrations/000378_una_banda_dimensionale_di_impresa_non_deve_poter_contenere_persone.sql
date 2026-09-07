-- 000378 — Una banda dimensionale d'impresa non deve poter contenere persone.
--
-- #214 F6 — NONO perimetro in sola lettura per l'agente: `enterprise-size-bands`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Il criterio meccanico di
-- `check_concetti_agente.py` dice: primo della coda dei neutri per ampiezza di lettura.
-- Misurato il 2026-09-07: 101 moduli · 8 aperti · 41 in coda (22 neutri). E la testa della
-- coda dei neutri oggi non e' un pari a due, e' un PARI A SETTE — `blueprint-families`,
-- `blueprint-variants`, `enterprise-size-bands`, `enterprise-typing-profiles`, `job-roles`,
-- `operating-models`, `skill-categories`, tutti a 2 letture e 2 pagine.
--
-- Il pari lo scioglie la stessa regola che ha sciolto quello del 2026-09-04, cioe' il
-- RISCHIO CRESCENTE: fra candidati pari si apre prima quello piu' lontano da una persona.
-- Applicata ai sette, la scala e' leggibile senza margini di opinione:
--   · `job-roles` e `skill-categories` sono i piu' VICINI — un ruolo e' cio' che una persona
--     ricopre, una categoria di competenza e' cio' che una persona possiede: sono i due
--     vocabolari con cui si descrivono le persone, non le imprese;
--   · `blueprint-families`, `blueprint-variants`, `operating-models`,
--     `enterprise-typing-profiles` descrivono COME e' fatta un'organizzazione;
--   · `enterprise-size-bands` e' il piu' LONTANO: e' una scala di misura dell'impresa
--     — quanti dipendenti, quanto fatturato — cioe' una soglia numerica. Non e' un oggetto
--     che una persona possa occupare, possedere o ricoprire. Non nomina nessuno per
--     costruzione, nemmeno in astratto.
--
-- ⚠ `approvals` e' piu' ampio (2 letture · 3 pagine) ma NON e' fra i neutri: dichiara
-- `ACTIVITY`, e la sua apertura andra' motivata su quella classe, non su una neutralita'
-- che non ha. Non era in gara.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le undici colonne di
-- `sys_enterprise_size_bands` sono: enterprise_size_band_id · _code · _name · _min_employees ·
-- _max_employees · _min_revenue_eur · _max_revenue_eur · _description · _metadata ·
-- created_at · updated_at. Nessuna e' il SOGGETTO di un dato di persona, e qui — a differenza
-- di `content-blueprint-links` — non c'e' nemmeno un ATTORE: non esiste un `created_by`,
-- quindi non serve la distinzione «chi esamina non e' chi e' esaminato» servita altrove.
--
-- ⚠ MA RESTANO DUE PORTE, le stesse due della 000370:
--   ① `enterprise_size_band_metadata` e' JSONB — la porta di `tenant_metadata` (mig. 000367)
--      e di `link_metadata` (mig. 000370)
--   ② `enterprise_size_band_description` e' TESTO LIBERO — una persona vi entra scrivendola,
--      senza bisogno di una chiave che la annunci
--
-- La neutralita' e' dunque vera OGGI, non per costruzione — e' lo stesso caso di
-- `visualization-graphs` (000355) e di `tenants` (000367). Misurato in produzione prima di
-- aprire (2026-09-07): 5 bande · 0 con descrizione · 0 con metadata · 0 indirizzi di posta
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

CREATE OR REPLACE VIEW sys.v_banda_dimensionale_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367 e 000370: se cambia li',
--    cambia qui.
SELECT b.enterprise_size_band_id            AS banda_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_enterprise_size_bands b
  CROSS JOIN LATERAL jsonb_each(coalesce(b.enterprise_size_band_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT b.enterprise_size_band_id            AS banda_id,
       'descrizione'::text                  AS porta,
       'enterprise_size_band_description'::text AS dove,
       left(b.enterprise_size_band_description, 80) AS valore
  FROM sys.sys_enterprise_size_bands b
 WHERE b.enterprise_size_band_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_banda_dimensionale_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-07). Zero righe attese. Il perimetro `enterprise-size-bands` '
  'e'' aperto all''agente perche'' `sys_enterprise_size_bands` non ha colonne che siano il '
  'SOGGETTO di un dato di persona — e nemmeno un ATTORE: non esiste un created_by. Ma porta '
  'DUE vie d''ingresso: `enterprise_size_band_metadata` e'' JSONB e '
  '`enterprise_size_band_description` e'' testo libero. Una riga qui significa che il '
  'perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il perimetro. NON si '
  'allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone  int;
  n_bande    int;
  n_dopo     int;
  v_id       uuid;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_banda_dimensionale_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000378: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_bande FROM sys.sys_enterprise_size_bands;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, e va fatta su ENTRAMBE le porte: una sentinella
  --    provata su una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa
  --    transazione: le righe di prova non esistono prima e non esistono dopo.
  IF n_bande = 0 THEN
    RAISE NOTICE
      '000378: `sys_enterprise_size_bands` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata. '
      'Dove la tabella e'' popolata, la prova gira.';
  ELSE
    SELECT enterprise_size_band_id INTO v_id
      FROM sys.sys_enterprise_size_bands ORDER BY enterprise_size_band_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_enterprise_size_bands
       SET enterprise_size_band_description =
             coalesce(enterprise_size_band_description, '') || ' __PROVA_000378__ mario.rossi@example.org'
     WHERE enterprise_size_band_id = v_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_banda_dimensionale_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000378: la sentinella NON vede un indirizzo di posta iniettato in '
        '`enterprise_size_band_description` — e'' cieca sul testo libero, e una guardia cieca '
        'e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_enterprise_size_bands
       SET enterprise_size_band_description =
             nullif(replace(enterprise_size_band_description,
                            ' __PROVA_000378__ mario.rossi@example.org', ''), '')
     WHERE enterprise_size_band_description LIKE '%__PROVA_000378__%';

    -- ① poi il JSONB
    UPDATE sys.sys_enterprise_size_bands
       SET enterprise_size_band_metadata =
             coalesce(enterprise_size_band_metadata, '{}'::jsonb)
             || '{"__prova_000378_referente": "mario.rossi@example.org"}'::jsonb
     WHERE enterprise_size_band_id = v_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_banda_dimensionale_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000378: la sentinella NON vede un referente iniettato in '
        '`enterprise_size_band_metadata` — e'' cieca sul JSONB, e una guardia cieca e'' peggio '
        'di nessuna guardia';
    END IF;
    UPDATE sys.sys_enterprise_size_bands
       SET enterprise_size_band_metadata = enterprise_size_band_metadata - '__prova_000378_referente'
     WHERE enterprise_size_band_metadata ? '__prova_000378_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_banda_dimensionale_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000378: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE. Una prova che si porta via una riga
  --    di produzione sarebbe un danno molto peggiore del difetto che previene.
  SELECT count(*) INTO n_dopo FROM sys.sys_enterprise_size_bands;
  IF n_dopo <> n_bande THEN
    RAISE EXCEPTION '000378: le bande sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_bande;
  END IF;

  RAISE NOTICE '000378: sentinella installata e provata su entrambe le porte · % bande invariate.', n_bande;
END $$;

COMMIT;
