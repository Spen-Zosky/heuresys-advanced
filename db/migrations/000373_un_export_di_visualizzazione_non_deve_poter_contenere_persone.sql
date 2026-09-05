-- ─────────────────────────────────────────────────────────────────────────────
-- 000373 — Un export di visualizzazione non deve poter contenere persone
--
-- Guardia dell'OTTAVO perimetro dell'agente (`visualization-exports`, #214 F6).
--
-- ── PERCHE' PROPRIO QUESTO, E PROPRIO ADESSO ────────────────────────────────
-- Il criterio di `check_concetti_agente.py` lo mette in testa alla coda dei neutri
-- (3 letture · 2 pagine) senza pari — ed e' lo stesso candidato che il SETTIMO
-- perimetro aveva scartato il 2026-09-04, quando il pari con `content-blueprint-links`
-- fu sciolto dalla regola del rischio crescente: fra due pari si apre prima quello
-- piu' lontano da una persona. Ora la coda non ha piu' pari, e tocca a lui.
--
-- ── LA NEUTRALITA', MISURATA SU information_schema E NON DEDOTTA DAI NOMI ───
-- Delle undici colonne di `sys_visualization_exports` nessuna e' il SOGGETTO di un
-- dato di persona: sono il grafo di origine, il layout, il formato, il contenuto e
-- la sua misura. Non c'e' nemmeno un ATTORE, quindi qui non serve la distinzione
-- «chi esamina non e' chi e' esaminato» che e' servita altrove.
--
-- ── MA UN EXPORT E' UNA FOTOGRAFIA GIA' SCATTATA, E QUESTO CAMBIA TUTTO ─────
-- `visualization-graphs` e' aperto CON UNA GUARDIA (mig `000355`) perche' il
-- vocabolario dei nodi ammette 'USER', dove `node_label` sarebbe il nome di una
-- persona. La sua sentinella `v_grafo_con_nodo_di_persona` guarda pero' i nodi VIVI.
--
-- Un export no: e' il grafo gia' serializzato e messo via. Se un grafo con nodi di
-- persona venisse esportato e poi corretto, la sentinella del grafo tornerebbe verde
-- e l'export resterebbe li' con i nomi dentro — leggibile dall'agente, e invisibile a
-- ogni strumento esistente. Non e' un caso di scuola: `export_payload` contiene oggi
-- SVG interi da ~29 KB, cioe' le etichette dei nodi disegnate una per una.
--
-- Percio' la guardia guarda l'EXPORT, non il grafo, su tutte e quattro le vie:
--   ① `export_metadata`  JSONB      — chiave che nomina una persona, o valore che e'
--                                     un indirizzo di posta comunque si chiami la chiave
--   ② `export_payload`   TESTO      — il contenuto serializzato: si cerca cio' che si
--                                     riconosce con certezza, un indirizzo di posta
--   ③ `export_payload_uri` TESTO    — la stessa cosa, quando il contenuto sta altrove
--   ④ la DISCENDENZA               — l'export nato da un grafo che ha nodi di tipo
--                                     'USER'. E' la via che le altre tre non vedono:
--                                     un nome proprio senza chiocciola non e'
--                                     riconoscibile nel testo, ma il tipo del nodo lo
--                                     dichiara. Qui il criterio non e' indecidibile,
--                                     quindi non ci si accontenta dell'email.
--
-- Sul testo il criterio resta l'indirizzo di posta e non «un nome di persona»: quello
-- e' indecidibile, e una guardia che pretende di riconoscerlo mente.
--
-- ── MISURA PRIMA (2026-09-05, produzione) ───────────────────────────────────
-- 16 export · 13 con payload (SVG) · 3 con uri · 3 con metadata.
-- Email nel payload: 0 · nell'uri: 0 · nel metadata: 0 · export da grafi con nodi
-- 'USER': 0. Il perimetro e' neutro oggi; la guardia serve perche' resti dimostrabile.
--
-- Zero righe attese. Una riga qui significa che il perimetro NON e' piu' neutro: o si
-- toglie quel dato, o si chiude il perimetro. NON si allarga il pattern per far tacere
-- la vista.

-- @migrate: once

BEGIN;

CREATE OR REPLACE VIEW sys.v_export_di_visualizzazione_con_dato_di_persona AS
-- ① la porta JSONB. Stesso pattern di 000367 e 000370: se cambia li', cambia qui.
SELECT e.export_id,
       'metadata'::text                 AS porta,
       kv.key                           AS dove,
       left(kv.value #>> '{}', 80)      AS valore
  FROM sys.sys_visualization_exports e
  CROSS JOIN LATERAL jsonb_each(coalesce(e.export_metadata, '{}'::jsonb)) AS kv
 WHERE kv.key ~* '(^|_)(user|users|person|persona|employee|dipendente|contact|contatto|referente|owner|manager|responsabile)(_|$)'
    OR kv.key ~* 'email|_user_id$'
    OR kv.value #>> '{}' ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ② il CONTENUTO serializzato: e' la porta piu' grande, perche' porta le etichette
--    dei nodi gia' disegnate.
SELECT e.export_id,
       'payload'::text                  AS porta,
       'export_payload'::text           AS dove,
       left(e.export_payload, 80)       AS valore
  FROM sys.sys_visualization_exports e
 WHERE e.export_payload ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ③ la stessa cosa quando il contenuto sta altrove e resta solo il suo indirizzo.
SELECT e.export_id,
       'uri'::text                      AS porta,
       'export_payload_uri'::text       AS dove,
       left(e.export_payload_uri, 80)   AS valore
  FROM sys.sys_visualization_exports e
 WHERE e.export_payload_uri ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
UNION ALL
-- ④ la DISCENDENZA: un nome proprio senza chiocciola non e' riconoscibile nel testo,
--    ma il TIPO del nodo di origine lo dichiara. E' la via cieca alle altre tre, ed e'
--    la ragione per cui questa vista non poteva essere una copia della 000370.
SELECT DISTINCT
       e.export_id,
       'discendenza'::text              AS porta,
       'node_type=USER'::text           AS dove,
       left(n.node_label, 80)           AS valore
  FROM sys.sys_visualization_exports e
  JOIN sys.sys_visualization_nodes n ON n.node_graph_id = e.export_graph_id
 WHERE n.node_type = 'USER';

COMMENT ON VIEW sys.v_export_di_visualizzazione_con_dato_di_persona IS
  'SENTINELLA (attesa: 0 righe). Guardia dell''ottavo perimetro dell''agente '
  '(visualization-exports, #214 F6). Un export e'' una fotografia gia'' scattata del '
  'grafo: la sentinella del grafo (000355) guarda i nodi VIVI e non vedrebbe un export '
  'prodotto prima di una correzione. Quattro porte: metadata JSONB, payload, uri e la '
  'DISCENDENZA da un grafo con nodi di tipo USER. Una riga = il perimetro non e'' piu'' '
  'neutro: si toglie il dato o si chiude il perimetro, NON si allarga il pattern.';

DO $$
DECLARE
  n_persone   int;
  n_export    int;
  n_export_0  int;
  v_id        uuid;
  v_graph     uuid;
BEGIN
  -- 1. la misura di partenza: la sentinella dev'essere a zero PRIMA di provarla
  SELECT count(*) INTO n_persone FROM sys.v_export_di_visualizzazione_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      '000373: la sentinella nasce con % righe: un export porta gia'' un dato di persona', n_persone;
  END IF;
  SELECT count(*) INTO n_export_0 FROM sys.sys_visualization_exports;

  -- 2. LA PROVA CHE LA GUARDIA PUO' FALLIRE, su TUTTE E QUATTRO le porte.
  --    Una sentinella provata su una porta sola e' verde anche essendo cieca sulle altre —
  --    ed e' esattamente l'errore che la 000370 aveva gia' evitato con due porte.
  SELECT export_id, export_graph_id INTO v_id, v_graph
    FROM sys.sys_visualization_exports
   WHERE export_payload IS NOT NULL
   ORDER BY export_id LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION '000373: nessun export con contenuto: la prova non potrebbe fallire, e un verde nato dal vuoto non vale';
  END IF;

  -- ① metadata
  UPDATE sys.sys_visualization_exports
     SET export_metadata = coalesce(export_metadata, '{}'::jsonb)
                           || jsonb_build_object('referente', 'mario.rossi@example.org')
   WHERE export_id = v_id;
  IF NOT EXISTS (SELECT 1 FROM sys.v_export_di_visualizzazione_con_dato_di_persona
                  WHERE export_id = v_id AND porta = 'metadata') THEN
    RAISE EXCEPTION '000373: la sentinella e'' CIECA sulla porta metadata';
  END IF;
  UPDATE sys.sys_visualization_exports
     SET export_metadata = export_metadata - 'referente'
   WHERE export_id = v_id;

  -- ② payload
  UPDATE sys.sys_visualization_exports
     SET export_payload = coalesce(export_payload, '') || ' __PROVA_000373__ mario.rossi@example.org'
   WHERE export_id = v_id;
  IF NOT EXISTS (SELECT 1 FROM sys.v_export_di_visualizzazione_con_dato_di_persona
                  WHERE export_id = v_id AND porta = 'payload') THEN
    RAISE EXCEPTION '000373: la sentinella e'' CIECA sulla porta payload';
  END IF;
  UPDATE sys.sys_visualization_exports
     SET export_payload = replace(export_payload, ' __PROVA_000373__ mario.rossi@example.org', '')
   WHERE export_id = v_id;

  -- ③ uri
  UPDATE sys.sys_visualization_exports
     SET export_payload_uri = coalesce(export_payload_uri, '') || 'mario.rossi@example.org'
   WHERE export_id = v_id;
  IF NOT EXISTS (SELECT 1 FROM sys.v_export_di_visualizzazione_con_dato_di_persona
                  WHERE export_id = v_id AND porta = 'uri') THEN
    RAISE EXCEPTION '000373: la sentinella e'' CIECA sulla porta uri';
  END IF;
  UPDATE sys.sys_visualization_exports
     SET export_payload_uri = nullif(replace(export_payload_uri, 'mario.rossi@example.org', ''), '')
   WHERE export_id = v_id;

  -- ④ discendenza — la via che le altre tre non vedono
  INSERT INTO sys.sys_visualization_nodes
    (node_graph_id, node_source_entity_type, node_source_entity_id, node_label, node_type)
  VALUES (v_graph, 'USER', gen_random_uuid(), 'Mario Rossi', 'USER');
  IF NOT EXISTS (SELECT 1 FROM sys.v_export_di_visualizzazione_con_dato_di_persona
                  WHERE export_id = v_id AND porta = 'discendenza') THEN
    RAISE EXCEPTION '000373: la sentinella e'' CIECA sulla porta discendenza — quella che nessun pattern di testo puo'' vedere';
  END IF;
  DELETE FROM sys.sys_visualization_nodes
   WHERE node_graph_id = v_graph AND node_type = 'USER' AND node_label = 'Mario Rossi';

  -- 3. le iniezioni sono state disfatte, tutte
  SELECT count(*) INTO n_persone FROM sys.v_export_di_visualizzazione_con_dato_di_persona;
  IF n_persone <> 0 THEN
    RAISE EXCEPTION '000373: le prove hanno lasciato % righe: le iniezioni non sono state disfatte', n_persone;
  END IF;

  -- 4. cio' che NON doveva cambiare: nessun export creato o perso
  SELECT count(*) INTO n_export FROM sys.sys_visualization_exports;
  IF n_export <> n_export_0 THEN
    RAISE EXCEPTION '000373: gli export sono % invece di %: la prova ha toccato le righe vere',
      n_export, n_export_0;
  END IF;

  RAISE NOTICE '000373 OK: sentinella a zero, provata ROSSA su tutte e quattro le porte, % export intatti', n_export;
END $$;

COMMIT;
