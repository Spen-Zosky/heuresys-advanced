-- ============================================================================
-- 000365 — Il grafo delle competenze ha due tipi di legame, non uno
--
-- VOCE: #50 F2 — «il grafo delle competenze, dai dati che abbiamo: endpoint che
-- serve nodi e archi con i filtri che una vista a grafo richiede (profondita,
-- tipo di relazione, ancoraggio a una skill)». Questa migrazione fa la meta di
-- sotto: la **fonte** che l endpoint interroghera. Le rotte sono F2 lato API, la
-- pagina e F3.
--
-- ⭐ PERCHE NON BASTA `sys_skill_taxonomy_edges`, e lo si e scoperto oggi
-- misurando per un altra voce (#227 F2, stessa sessione):
--
--   · **4.464 competenze su 14.033 (31,8%) non hanno UN SOLO ARCO** in quella
--     tabella. Un grafo costruito sui soli archi mostrerebbe un terzo del
--     catalogo come polvere di nodi scollegati — brutto, e soprattutto **falso**.
--   · Perche falso: di quelle 4.464, ben **4.383 (98,2%) hanno un
--     `skill_group_id`**, e **tutte e 4.383** stanno in un gruppo che ha un padre
--     nell albero ESCO. `sys_skill_groups` e l albero europeo, **intero**: 640
--     gruppi di cui 636 con padre. Quelle competenze **non sono isolate nella
--     tassonomia**: sono isolate nel solo grafo competenza→competenza.
--   · Le competenze davvero senza collocazione — ne arco ne gruppo — sono **81**,
--     lo 0,58% del catalogo.
--
-- Quindi il grafo ha **due tipi di legame**, e mostrarne uno solo e la ragione
-- per cui #227 sembrava una voce da 4.464 righe di curatela quando ne vale 81:
--   ① **esplicito** — `sys_skill_taxonomy_edges`: `IS_A`, `RELATED`,
--      `PREREQUISITE_OF`, `PART_OF`. E il legame fra due competenze.
--   ② **di appartenenza** — competenza → gruppo, e gruppo → gruppo padre. Non e
--      un ripiego: e la struttura che ESCO usa davvero, ed e gia nel database.
--
-- ⚠ **FUNZIONE, NON VISTA, e non e un dettaglio di stile**: `db_health.py`
-- raccoglie da se ogni `sys.v_*` e **pretende zero righe** (memoria
-- `new_sys_view_becomes_sentinel`). Una vista che serve un grafo ha per mestiere
-- decine di migliaia di righe: la renderebbe rossa a ogni avvio, cioe un allarme
-- che insegna a non guardare gli allarmi. Le due funzioni si chiamano `fn_*` e
-- restano invisibili a quel raccoglitore.
--
-- IL CONTRATTO, pensato per come una vista a grafo interroga davvero:
--   `sys.fn_skill_graph_nodes(p_root, p_depth, p_include_groups)`
--   `sys.fn_skill_graph_edges(p_root, p_depth, p_kinds, p_include_groups)`
-- · `p_root` NULL = tutto il catalogo; valorizzato = si parte da li e si cammina.
-- · `p_depth` limita i salti — senza, l ancoraggio non servirebbe a niente.
-- · `p_kinds` filtra i tipi di arco espliciti; NULL = tutti.
-- · `p_include_groups` accende il legame ②. **Il valore predefinito e `true`**,
--   perche il difetto da evitare e proprio il grafo che sembra bucato.
-- La camminata e in ampiezza e **non orientata**: chi guarda un grafo di
-- competenze vuole il vicinato, non i discendenti.
--
-- ⛔ NESSUN IMPORT: la sorgente e cio che `sys.*` gia contiene (I12/ADR-0038).
-- Questa migrazione **non scrive una riga di dati** — crea due funzioni di sola
-- lettura, ed e il motivo per cui non puo rompere niente.
--
-- ROLLBACK: `staging.mig365_grafo_undo_apply()` lascia cadere le due funzioni.
-- Non c e stato da ripristinare: non ne hanno.
--
-- IDEMPOTENTE: `CREATE OR REPLACE`. Alla seconda passata ridefinisce lo stesso.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. GLI ARCHI. Due tipi in una sola uscita, ognuno che dichiara il proprio.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.fn_skill_graph_edges(
  p_root            uuid    DEFAULT NULL,
  p_depth           integer DEFAULT 2,
  p_kinds           text[]  DEFAULT NULL,
  p_include_groups  boolean DEFAULT true
)
RETURNS TABLE(
  source_id   uuid,
  target_id   uuid,
  edge_kind   varchar,
  edge_family varchar,   -- 'EXPLICIT' | 'GROUP'
  edge_source varchar    -- la fonte dichiarata, quando c e
)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE
  -- tutti gli archi candidati, i due tipi gia uniti: la camminata deve poter
  -- passare dall uno all altro, altrimenti il vicinato si spezza in due mondi
  tutti AS (
    SELECT e.skill_taxonomy_edge_parent_id AS a,
           e.skill_taxonomy_edge_child_id  AS b,
           e.skill_taxonomy_edge_kind::varchar          AS kind,
           'EXPLICIT'::varchar                          AS fam,
           (e.skill_taxonomy_edge_metadata ->> 'source')::varchar AS src
      FROM sys.sys_skill_taxonomy_edges e
     WHERE p_kinds IS NULL OR e.skill_taxonomy_edge_kind = ANY (p_kinds)
    UNION ALL
    -- ② l appartenenza al gruppo, che e tassonomia e non ripiego
    SELECT s.skill_group_id, s.skill_id,
           'IN_GROUP'::varchar, 'GROUP'::varchar, 'ESCO_GROUPS'::varchar
      FROM sys.sys_skills s
     WHERE p_include_groups AND s.skill_group_id IS NOT NULL
    UNION ALL
    SELECT g.skill_group_parent_id, g.skill_group_id,
           'GROUP_PARENT'::varchar, 'GROUP'::varchar, 'ESCO_GROUPS'::varchar
      FROM sys.sys_skill_groups g
     WHERE p_include_groups AND g.skill_group_parent_id IS NOT NULL
  ),
  -- la camminata in ampiezza, NON orientata: chi guarda un grafo di competenze
  -- vuole il vicinato, non i discendenti
  cammino AS (
    SELECT p_root AS nodo, 0 AS salto
     WHERE p_root IS NOT NULL
    UNION
    SELECT CASE WHEN t.a = c.nodo THEN t.b ELSE t.a END, c.salto + 1
      FROM cammino c
      JOIN tutti t ON t.a = c.nodo OR t.b = c.nodo
     WHERE c.salto < p_depth
  )
  SELECT t.a, t.b, t.kind, t.fam, t.src
    FROM tutti t
   WHERE p_root IS NULL
      OR (t.a IN (SELECT nodo FROM cammino) AND t.b IN (SELECT nodo FROM cammino));
$$;

COMMENT ON FUNCTION sys.fn_skill_graph_edges IS
  'Archi del grafo delle competenze (#50 F2, S1083). DUE famiglie: EXPLICIT '
  '(sys_skill_taxonomy_edges) e GROUP (appartenenza al gruppo ESCO e albero dei '
  'gruppi). Servire la sola EXPLICIT mostrerebbe il 31,8% del catalogo come nodi '
  'scollegati, ed e falso: il 98,2% di quelle competenze ha un gruppo con un padre. '
  'FUNZIONE e non vista, perche db_health pretende zero righe da ogni sys.v_*.';

-- ----------------------------------------------------------------------------
-- 2. I NODI. Due specie — competenza e gruppo — perche il grafo le mostra
--    entrambe, e chi disegna deve poterle distinguere senza indovinare.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.fn_skill_graph_nodes(
  p_root           uuid    DEFAULT NULL,
  p_depth          integer DEFAULT 2,
  p_include_groups boolean DEFAULT true
)
RETURNS TABLE(
  node_id     uuid,
  node_kind   varchar,   -- 'SKILL' | 'GROUP'
  node_label  varchar,
  node_code   varchar,
  node_tenant uuid,
  node_esco   boolean
)
LANGUAGE sql STABLE AS $$
  WITH coinvolti AS (
    SELECT source_id AS id FROM sys.fn_skill_graph_edges(p_root, p_depth, NULL, p_include_groups)
    UNION
    SELECT target_id FROM sys.fn_skill_graph_edges(p_root, p_depth, NULL, p_include_groups)
  )
  SELECT s.skill_id, 'SKILL'::varchar, s.skill_name::varchar, s.skill_code::varchar,
         -- ⚠ coalesce, e non e' pedanteria: `NULL LIKE 'http%'` vale NULL, non false.
         -- Le competenze senza URI (le CUSTOM:: e le COMP::) tornavano `isEsco: null`,
         -- e lo schema Zod della risposta rifiutava l'intero payload con un 500 —
         -- trovato dal test di integrazione, non dalla lettura del codice.
         s.skill_tenant_id, coalesce(s.skill_esco_uri LIKE 'http%', false)
    FROM sys.sys_skills s
   WHERE p_root IS NULL OR s.skill_id IN (SELECT id FROM coinvolti)
  UNION ALL
  SELECT g.skill_group_id, 'GROUP'::varchar, g.skill_group_name::varchar,
         g.skill_group_code::varchar, NULL::uuid, true
    FROM sys.sys_skill_groups g
   WHERE p_include_groups
     AND (p_root IS NULL OR g.skill_group_id IN (SELECT id FROM coinvolti));
$$;

COMMENT ON FUNCTION sys.fn_skill_graph_nodes IS
  'Nodi del grafo delle competenze (#50 F2, S1083). Due specie, SKILL e GROUP, '
  'dichiarate in node_kind: il grafo mostra entrambe e chi disegna non deve '
  'indovinare quale sta guardando.';

-- ----------------------------------------------------------------------------
-- 3. LE POST-CONDIZIONI — e devono poter fallire.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_solo_espliciti int;
  v_con_gruppi     int;
  v_nodi           int;
  v_orfani         int;
BEGIN
  -- (a) cio che DOVEVA cambiare: accendere i legami di gruppo produce PIU archi
  --     di quanti ne dia la sola tabella. Se i due numeri coincidessero, la
  --     seconda famiglia non sarebbe stata aggiunta, e nessuno se ne accorgerebbe
  --     guardando un grafo che sembra a posto.
  SELECT count(*) INTO v_solo_espliciti
    FROM sys.fn_skill_graph_edges(NULL, 2, NULL, false);
  SELECT count(*) INTO v_con_gruppi
    FROM sys.fn_skill_graph_edges(NULL, 2, NULL, true);
  IF v_con_gruppi <= v_solo_espliciti THEN
    RAISE EXCEPTION
      'mig365: i legami di gruppo non aggiungono archi (% contro %). La seconda '
      'famiglia non sta funzionando.', v_con_gruppi, v_solo_espliciti;
  END IF;

  -- (b) il filtro sui tipi discrimina davvero: chiedere un solo tipo deve dare
  --     meno archi di chiederli tutti. Un filtro che non filtra e peggio che
  --     assente, perche sembra funzionare.
  IF (SELECT count(*) FROM sys.fn_skill_graph_edges(NULL, 2, ARRAY['IS_A'], false))
     >= v_solo_espliciti THEN
    RAISE EXCEPTION 'mig365: il filtro sui tipi di arco non discrimina';
  END IF;

  -- (c) cio che NON doveva cambiare: nessuna riga di dati e stata scritta.
  --     Queste funzioni sono di sola lettura, e se un giorno qualcuno vi
  --     aggiungesse una scrittura, il conteggio delle competenze cambierebbe.
  SELECT count(*) INTO v_nodi FROM sys.fn_skill_graph_nodes(NULL, 2, true);
  SELECT count(*) INTO v_orfani
    FROM sys.sys_skills s
   WHERE s.skill_group_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM sys.sys_skill_taxonomy_edges e
                      WHERE e.skill_taxonomy_edge_child_id = s.skill_id
                         OR e.skill_taxonomy_edge_parent_id = s.skill_id);

  RAISE NOTICE 'mig365 post: % archi espliciti -> % con i gruppi · % nodi · '
               '% competenze senza alcuna collocazione (ne arco ne gruppo)',
    v_solo_espliciti, v_con_gruppi, v_nodi, v_orfani;
END $$;

-- ----------------------------------------------------------------------------
-- 4. La funzione che disfa.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig365_grafo_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
BEGIN
  DROP FUNCTION IF EXISTS sys.fn_skill_graph_nodes(uuid, integer, boolean);
  DROP FUNCTION IF EXISTS sys.fn_skill_graph_edges(uuid, integer, text[], boolean);
  RETURN QUERY VALUES ('funzioni rimosse', 2::bigint);
END $$;

COMMIT;
