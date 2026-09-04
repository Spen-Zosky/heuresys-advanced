-- 000370 — Il collegamento fra contenuto e fascicolo non deve poter contenere persone.
--
-- #214 F6 — SETTIMO perimetro in sola lettura per l'agente: `content-blueprint-links`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Il criterio meccanico di
-- `check_concetti_agente.py` dice: primo della coda dei neutri per ampiezza di lettura.
-- Oggi la testa della coda e' un PARI — `content-blueprint-links` e `visualization-exports`,
-- 3 letture e 2 pagine entrambi — e il pari lo scioglie la regola dell'ordine, che e' il
-- RISCHIO CRESCENTE: `visualization-exports` eredita la superficie di `visualization-graphs`,
-- che nel 2026-08-26 fu aperto CON UNA GUARDIA perche' il vocabolario dei nodi ammette 'USER'.
-- Fra due candidati pari, si apre prima quello piu' lontano da una persona.
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le dieci colonne di
-- `sys_content_blueprint_links` sono: link_id · link_tenant_id · link_document_id ·
-- link_blueprint_process_id · link_role · link_note · link_metadata · link_created_by ·
-- created_at · updated_at. Nessuna e' il SOGGETTO di un dato di persona: `link_created_by` e'
-- l'ATTORE che ha creato il collegamento, la stessa distinzione gia' fatta per
-- `feedback_reviewed_by_user_id` in #214 F6 — chi esamina non e' chi e' esaminato.
--
-- ⚠ MA RESTANO DUE PORTE, e sono una in piu' del precedente:
--   ① `link_metadata` e' JSONB — la stessa porta di `tenant_metadata` (mig. 000367)
--   ② `link_note` e' TESTO LIBERO — questa e' nuova: una persona vi entra scrivendola, senza
--      bisogno di una chiave che la annunci
--
-- Quindi la sentinella ne guarda DUE, e sul testo libero l'unico criterio meccanico onesto e'
-- l'indirizzo di posta: cercare «un nome di persona» dentro una nota e' indecidibile, e una
-- guardia che pretende di farlo mente. Un indirizzo di posta invece si riconosce, ed e' la
-- forma in cui una persona finisce davvero in una nota («chiedere a mario.rossi@…»).
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_content_blueprint_link_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern di 000367: se cambia li', cambia qui.
SELECT l.link_id,
       'metadata'::text                 AS porta,
       kv.key                           AS dove,
       left(kv.value #>> '{}', 80)      AS valore
  FROM sys.sys_content_blueprint_links l
  CROSS JOIN LATERAL jsonb_each(coalesce(l.link_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: qui non esiste una chiave da interrogare, esiste solo il testo.
--    Si cerca cio' che si puo' riconoscere con certezza — un indirizzo di posta — e non si
--    finge di saper riconoscere un nome proprio.
SELECT l.link_id,
       'note'::text                     AS porta,
       'link_note'::text                AS dove,
       left(l.link_note, 80)            AS valore
  FROM sys.sys_content_blueprint_links l
 WHERE l.link_note ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_content_blueprint_link_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-04). Zero righe attese. Il perimetro `content-blueprint-links` '
  'e'' aperto all''agente perche'' `sys_content_blueprint_links` non ha colonne che siano il '
  'SOGGETTO di un dato di persona (`link_created_by` e'' l''attore, non l''interessato) — ma '
  'porta DUE vie d''ingresso: `link_metadata` e'' JSONB e `link_note` e'' testo libero. Una riga '
  'qui significa che il perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone   int;
  n_link      int;
  n_link_dopo int;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_content_blueprint_link_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000370: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_link FROM sys.sys_content_blueprint_links;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, e va fatta su ENTRAMBE le porte: una sentinella
  --    provata su una sola sarebbe verde anche essendo cieca sull'altra. Tutto dentro questa
  --    transazione: le righe di prova non esistono prima e non esistono dopo.
  --
  --    ⚠ `link_document_id` e `link_blueprint_process_id` hanno una FK: non si possono
  --    inventare. Si riusa una riga vera se c'e'; se la tabella e' vuota — ed e' il caso del
  --    database di CI, dove questi collegamenti nascono dall'applicazione e non dalla catena
  --    (memoria `ci_clone_lacks_script_imported_data`) — la prova si salta DICENDOLO, invece
  --    di fingere un verde.
  IF n_link = 0 THEN
    RAISE NOTICE
      '000370: `sys_content_blueprint_links` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile senza inventare due chiavi esterne. NON e'' un verde: e'' un NON MISURATO, e '
      'la sentinella resta installata. Dove la tabella e'' popolata, la prova gira.';
  ELSE
    -- ② prima il testo libero, che e' la porta nuova
    UPDATE sys.sys_content_blueprint_links
       SET link_note = coalesce(link_note, '') || ' __PROVA_000370__ mario.rossi@example.org'
     WHERE link_id = (SELECT link_id FROM sys.sys_content_blueprint_links ORDER BY link_id LIMIT 1);
    SELECT count(*) INTO n_persone
      FROM sys.v_content_blueprint_link_con_dato_di_persona WHERE porta = 'note';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000370: la sentinella NON vede un indirizzo di posta iniettato in `link_note` — e'' '
        'cieca sul testo libero, e una guardia cieca e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_content_blueprint_links
       SET link_note = nullif(replace(link_note, ' __PROVA_000370__ mario.rossi@example.org', ''), '')
     WHERE link_note LIKE '%__PROVA_000370__%';

    -- ① poi il JSONB
    UPDATE sys.sys_content_blueprint_links
       SET link_metadata = coalesce(link_metadata, '{}'::jsonb)
                        || '{"__prova_000370_referente": "mario.rossi@example.org"}'::jsonb
     WHERE link_id = (SELECT link_id FROM sys.sys_content_blueprint_links ORDER BY link_id LIMIT 1);
    SELECT count(*) INTO n_persone
      FROM sys.v_content_blueprint_link_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000370: la sentinella NON vede un referente iniettato in `link_metadata` — e'' cieca '
        'sul JSONB, e una guardia cieca e'' peggio di nessuna guardia';
    END IF;
    UPDATE sys.sys_content_blueprint_links
       SET link_metadata = link_metadata - '__prova_000370_referente'
     WHERE link_metadata ? '__prova_000370_referente';

    -- 3. …e dopo le due prove la sentinella e' tornata a zero: le iniezioni sono disfatte.
    SELECT count(*) INTO n_persone FROM sys.v_content_blueprint_link_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000370: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE. Una prova che si porta via una riga
  --    di produzione sarebbe un danno molto peggiore del difetto che previene.
  SELECT count(*) INTO n_link_dopo FROM sys.sys_content_blueprint_links;
  IF n_link_dopo <> n_link THEN
    RAISE EXCEPTION '000370: i collegamenti sono % invece di %: la prova ha toccato le righe vere',
      n_link_dopo, n_link;
  END IF;

  RAISE NOTICE '000370: sentinella installata e provata su entrambe le porte · % collegamenti invariati.', n_link;
END $$;

COMMIT;
