-- 000412 — Un processo di modello (registro dei processi del blueprint) non deve poter contenere persone.
--
-- #214 F6 — SEDICESIMO perimetro in sola lettura per l'agente: `blueprint-processes`.
--
-- PERCHE' PROPRIO QUESTO, e non a intuito. Criterio meccanico di `check_concetti_agente.py`,
-- ri-derivato il 2026-09-13 (S1099) sull'atlante fresco (da af8f8f7e): 109 moduli · 15 aperti ·
-- 37 in coda (18 neutri). La testa dei neutri: `approvals` e `projects` dichiarano ACTIVITY (non
-- in gara, come nella 000378/000382/000405/000411); `enterprise-typing-profiles` resta SCARTATO
-- per la ragione misurata il 2026-09-08 e ancora vera (porta JSONB occupata da `decided_by` con
-- un nome proprio in chiaro). Sotto, un PARI a TREDICI, tutti a 2 letture e 1 pagina.
--
-- Il pari lo scioglie il RISCHIO CRESCENTE: fra pari si apre prima quello piu' LONTANO da una
-- persona. I tredici, per distanza decrescente: `blueprint-processes` e `organization-unit-processes`
-- descrivono COSA FA un'organizzazione (i processi); `blueprint-activations` quale modello un
-- tenant ha acceso (porta un `created_by`); `generated-origins` la provenienza di righe generate;
-- `job-families`, `skill-families`, `skill-aliases`, `skill-taxonomy-edges` sono vocabolari con
-- cui si descrivono le PERSONE (una famiglia professionale e' cio' che una persona esercita, una
-- competenza cio' che possiede) — piu' vicini; `job-postings` e `job-requisitions` descrivono il
-- POSTO ma condividono il permesso `job-requisition:read` con tre moduli gia' esclusi (S1097,
-- S1098): si aprono dopo, quando `#54` avra' separato il permesso; `visualization-edges` e
-- `visualization-nodes` ereditano la superficie di `visualization-graphs`, aperto con guardia
-- perche' il vocabolario dei nodi ammette 'USER'; `advisor` sono suggerimenti, cioe' l'ESITO di
-- una lettura di dati, non una struttura. Fra i due processi, il REGISTRO viene prima del
-- LEGAME: `sys_blueprint_process_registry` non ha tenant_id ed e' il genitore diretto di
-- `sys_organization_unit_processes`, che porta tenant e unita'. Aprire il genitore CHIUDE LA
-- FAMIGLIA del blueprint — famiglie (000382), varianti (000381), modelli operativi (000405) e
-- ora i processi — invece di lasciarne meta' presidiata.
--
-- COSA E'. `sys_blueprint_process_registry` (#132 F5, mig 000335): 23 righe, i processi di
-- una banca retail (strategia, KYC/AML, credito, tesoreria, compliance, audit…), ciascuno
-- agganciato a una variante di modello, con codice, nome, nome inglese, ordinale, facoltativita'.
-- Nessun tenant_id: e' il contenuto del MODELLO, non di un cliente (ADR-0039 lo dichiara sulla
-- rotta: «struttura, aperta a ogni settore (I21)»).
--
-- LA NEUTRALITA', misurata su information_schema e non dedotta dai nomi. Le tredici colonne
-- sono: blueprint_process_id · _variant_id · _code · _name · _ordinal · _description ·
-- _is_optional · _metadata · created_at · updated_at · _variant_version_id · _name_en ·
-- _owner_position_code. Nessuna e' il SOGGETTO di un dato di persona, e non c'e' nemmeno un
-- ATTORE: non esiste un created_by. `blueprint_process_owner_position_code` e' il CODICE di
-- una POSIZIONE (un posto, I1: owner ≠ incumbent), non una persona — e la 000335 lo dichiara.
--
-- ⚠ MA RESTANO TRE PORTE, due della famiglia 000370/…/000411 e una in piu':
--   ① `blueprint_process_metadata` e' JSONB — oggi `{}` su tutte le 23 righe (NOT NULL);
--   ② `blueprint_process_description` e' TESTO LIBERO — oggi NULL su tutte;
--   ③ `blueprint_process_owner_position_code` e' varchar(64) senza CHECK: un codice per
--      dichiarazione, ma un indirizzo di posta ci sta. Oggi NULL su tutte.
--
-- Misurato in produzione prima di aprire (2026-09-13): 23 processi · 0 con descrizione ·
-- 0 con metadata non vuoto · 0 con codice di posizione · 0 indirizzi di posta in nessuna delle
-- tre porte. Un perimetro vuoto oggi non e' un perimetro chiuso domani: la guardia si mette
-- PRIMA che il buco si apra.
--
-- La prova a esiti opposti e' quella della 000405/000411: TUTTE E TRE le porte iniettate e
-- disfatte — una sentinella provata su una porta sola sarebbe verde anche essendo cieca sulle
-- altre — con la post-condizione per IMPRONTA md5, e il ripristino rimette il valore SALVATO
-- perche' '' e NULL sono due valori diversi.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si toglie
-- quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_processo_di_modello_con_dato_di_persona AS
-- ① la porta JSONB: una chiave che nomina una persona, o un valore che e' un indirizzo di
--    posta comunque si chiami la chiave. Stesso pattern delle sorelle: se cambia li', cambia qui.
SELECT p.blueprint_process_id               AS processo_id,
       'metadata'::text                     AS porta,
       kv.key                               AS dove,
       left(kv.value #>> '{}', 80)          AS valore
  FROM sys.sys_blueprint_process_registry p
  CROSS JOIN LATERAL jsonb_each(coalesce(p.blueprint_process_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② la porta del TESTO LIBERO: si cerca cio' che si puo' riconoscere con certezza — un
--    indirizzo di posta — e non si finge di saper riconoscere un nome proprio.
SELECT p.blueprint_process_id                          AS processo_id,
       'descrizione'::text                             AS porta,
       'blueprint_process_description'::text           AS dove,
       left(p.blueprint_process_description, 80)       AS valore
  FROM sys.sys_blueprint_process_registry p
 WHERE p.blueprint_process_description ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ③ il codice della posizione proprietaria: e' un CODICE per dichiarazione (000335), ma la
--    colonna non ha un CHECK e un indirizzo di posta ci sta in 64 caratteri.
SELECT p.blueprint_process_id                          AS processo_id,
       'proprietario'::text                            AS porta,
       'blueprint_process_owner_position_code'::text   AS dove,
       left(p.blueprint_process_owner_position_code, 80) AS valore
  FROM sys.sys_blueprint_process_registry p
 WHERE p.blueprint_process_owner_position_code ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';

COMMENT ON VIEW sys.v_processo_di_modello_con_dato_di_persona IS
  'SENTINELLA (#214 F6, 2026-09-13). Zero righe attese. Il perimetro `blueprint-processes` e'' '
  'aperto all''agente perche'' `sys_blueprint_process_registry` e'' il registro dei processi del '
  'MODELLO: nessuna colonna e'' il SOGGETTO di un dato di persona, e nemmeno un ATTORE. Ma porta '
  'TRE vie d''ingresso: `blueprint_process_metadata` (JSONB), `blueprint_process_description` '
  '(testo libero) e `blueprint_process_owner_position_code` (un codice senza CHECK). Una riga '
  'qui significa che il perimetro non e'' piu'' neutro: o si toglie quel dato, o si chiude il '
  'perimetro. NON si allarga il pattern per far tacere la vista.';

DO $$
DECLARE
  n_persone     int;
  n_righe       int;
  n_dopo        int;
  p_id          uuid;
  descr_pre     text;
  owner_pre     text;
  impronta_pre  text;
  impronta_post text;
BEGIN
  -- 1. LO STATO DI PARTENZA: la sentinella dev'essere gia' a zero, o il perimetro non si apre.
  SELECT count(*) INTO n_persone FROM sys.v_processo_di_modello_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000412: la sentinella vede gia'' % righe con un dato di persona. Il perimetro NON si '
      'apre: prima si toglie quel dato.', n_persone;
  END IF;
  SELECT count(*) INTO n_righe FROM sys.sys_blueprint_process_registry;

  -- L'IMPRONTA DI CIO' CHE NON DEVE CAMBIARE, presa PRIMA di toccare qualsiasi cosa.
  SELECT md5(string_agg(
           coalesce(blueprint_process_description, '<null>') || '|' ||
           coalesce(blueprint_process_metadata::text, '<null>') || '|' ||
           coalesce(blueprint_process_owner_position_code, '<null>'),
           E'\n' ORDER BY blueprint_process_id))
    INTO impronta_pre
    FROM sys.sys_blueprint_process_registry;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su TUTTE E TRE le porte.
  IF n_righe = 0 THEN
    RAISE NOTICE
      '000412: `sys_blueprint_process_registry` e'' vuota qui: la prova a esiti opposti non e'' '
      'eseguibile. NON e'' un verde: e'' un NON MISURATO, e la sentinella resta installata.';
  ELSE
    SELECT blueprint_process_id, blueprint_process_description, blueprint_process_owner_position_code
      INTO p_id, descr_pre, owner_pre
      FROM sys.sys_blueprint_process_registry ORDER BY blueprint_process_id LIMIT 1;

    -- ② prima il testo libero
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_description =
             coalesce(blueprint_process_description, '') || ' __PROVA_000412__ mario.rossi@example.org'
     WHERE blueprint_process_id = p_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_processo_di_modello_con_dato_di_persona WHERE porta = 'descrizione';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000412: la sentinella NON vede un indirizzo di posta iniettato in '
        '`blueprint_process_description` — e'' cieca sul testo libero';
    END IF;
    -- il ripristino rimette il valore SALVATO: '' e NULL sono due valori diversi.
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_description = descr_pre
     WHERE blueprint_process_id = p_id;

    -- ① poi il JSONB
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_metadata =
             coalesce(blueprint_process_metadata, '{}'::jsonb)
             || '{"__prova_000412_referente": "mario.rossi@example.org"}'::jsonb
     WHERE blueprint_process_id = p_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_processo_di_modello_con_dato_di_persona WHERE porta = 'metadata';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000412: la sentinella NON vede un referente iniettato in '
        '`blueprint_process_metadata` — e'' cieca sul JSONB';
    END IF;
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_metadata = blueprint_process_metadata - '__prova_000412_referente'
     WHERE blueprint_process_metadata ? '__prova_000412_referente';

    -- ③ infine il codice della posizione proprietaria
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_owner_position_code = 'mario.rossi@example.org'
     WHERE blueprint_process_id = p_id;
    SELECT count(*) INTO n_persone
      FROM sys.v_processo_di_modello_con_dato_di_persona WHERE porta = 'proprietario';
    IF n_persone = 0 THEN
      RAISE EXCEPTION
        '000412: la sentinella NON vede un indirizzo di posta iniettato in '
        '`blueprint_process_owner_position_code` — e'' cieca sul codice della posizione';
    END IF;
    UPDATE sys.sys_blueprint_process_registry
       SET blueprint_process_owner_position_code = owner_pre
     WHERE blueprint_process_id = p_id;

    -- 3. …e dopo le tre prove la sentinella e' tornata a zero.
    SELECT count(*) INTO n_persone FROM sys.v_processo_di_modello_con_dato_di_persona;
    IF n_persone <> 0 THEN
      RAISE EXCEPTION '000412: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
    END IF;
  END IF;

  -- 4. POST-CONDIZIONE SU CIO' CHE NON DOVEVA CAMBIARE — conteggio E impronta.
  SELECT count(*) INTO n_dopo FROM sys.sys_blueprint_process_registry;
  IF n_dopo <> n_righe THEN
    RAISE EXCEPTION '000412: i processi sono % invece di %: la prova ha toccato le righe vere',
      n_dopo, n_righe;
  END IF;

  SELECT md5(string_agg(
           coalesce(blueprint_process_description, '<null>') || '|' ||
           coalesce(blueprint_process_metadata::text, '<null>') || '|' ||
           coalesce(blueprint_process_owner_position_code, '<null>'),
           E'\n' ORDER BY blueprint_process_id))
    INTO impronta_post
    FROM sys.sys_blueprint_process_registry;
  IF impronta_post IS DISTINCT FROM impronta_pre THEN
    RAISE EXCEPTION
      '000412: le tre porte NON sono tornate come prima (impronta % contro %)', impronta_post, impronta_pre;
  END IF;

  RAISE NOTICE
    '000412: sentinella installata e provata su tutte e tre le porte · % processi invariati, '
    'contenuto identico per impronta.', n_righe;
END $$;

COMMIT;
