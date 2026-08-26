-- ═══════════════════════════════════════════════════════════════════════════════
-- 000355_un_grafo_puo_contenere_persone_e_il_criterio_non_lo_sapeva.sql
--
-- #214 F6 — APRIRE `visualization-graphs` ALL'AGENTE PRETENDE UNA GUARDIA, PERCHE'
-- LA SUA CLASSIFICAZIONE E' VERA OGGI E NON PER COSTRUZIONE.
--
-- IL CRITERIO, E DOVE SI ROMPE. `check_concetti_agente.py` ordina la coda di adozione
-- con tre prove meccaniche, e la seconda chiede che il perimetro non esponga dati di
-- persona. `visualization` e' dichiarata senza dati di persona in `data-classes.ts`
-- («grafici salvati»), e la misura di oggi le da' ragione: **316 nodi su 316 sono di
-- tipo POSITION**, nessuno e' una persona.
--
-- Ma il vocabolario che il modello AMMETTE e' un'altra cosa dal contenuto che oggi
-- ospita. Il `CHECK` di `sys_visualization_nodes` accetta undici tipi, e fra questi:
--
--     'USER'             -> `node_label` sarebbe il NOME DI UNA PERSONA
--     'SUCCESSION_POOL'  -> un bacino di successione: materia sensibile per natura
--
-- Il giorno in cui una pagina salvasse un organigramma per persone invece che per
-- posizioni, l'agente leggerebbe nomi propri da un perimetro che qualcuno aveva
-- dichiarato neutro, **e nessuno strumento se ne accorgerebbe**: la classificazione
-- vive in un file TypeScript e non guarda le righe. E' esattamente la forma di
-- difetto che #214 F5 ha chiuso — «assenza di misura letta come assenza di rischio» —
-- ricomparsa un piano piu' sotto, sui DATI invece che sulle CLASSI.
--
-- COSA FA. Una vista-sentinella che conta i nodi di persona dentro i grafi. Zero e'
-- l'atteso, quindi `db_health.py` la raccoglie da `pg_views` e pretende zero righe
-- (memoria `new_sys_view_becomes_sentinel`): NON va dichiarata informativa. Se domani
-- un grafo contenesse una persona, la prova generale diventa rossa **prima** che
-- l'agente possa leggerla, e la decisione torna a un umano.
--
-- Non e' un divieto: e' il modo di aprire il perimetro **potendo dimostrare** che
-- resta cio' che si e' dichiarato. La dottrina di Enzo (2026-08-16) chiede l'adozione
-- ovunque porti valore; questa vista e' cio' che la rende reversibile invece che cieca.
--
-- Additiva, idempotente, nessuna riga toccata: crea una vista e la sua riga di
-- registro. Rollback in coda. 2026-08-26 (S1081).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- §1 — la sentinella. Nomina i due tipi UNO PER UNO invece di un jolly: un elenco
--      esplicito si legge, e quando il vocabolario cresce qualcuno deve decidere se
--      il tipo nuovo e' una persona — che e' la domanda giusta da porsi a mano.
CREATE OR REPLACE VIEW sys.v_grafo_con_nodo_di_persona AS
SELECT g.graph_id                    AS grafo_id,
       g.graph_name                  AS grafo,
       g.graph_tenant_id             AS tenant_id,
       n.node_id,
       n.node_source_entity_type     AS tipo_nodo,
       n.node_label                  AS etichetta
  FROM sys.sys_visualization_nodes n
  JOIN sys.sys_visualization_graphs g ON g.graph_id = n.node_graph_id
 WHERE n.node_source_entity_type IN ('USER', 'SUCCESSION_POOL');

COMMENT ON VIEW sys.v_grafo_con_nodo_di_persona IS
  '#214 F6 — un grafo salvato che contiene una PERSONA (nodo USER) o un bacino di '
  'successione. Zero e'' l''atteso: `visualization` e'' dichiarata senza dati di persona '
  'in data-classes.ts ed e'' un perimetro APERTO all''agente in sola lettura. Se questa '
  'vista torna righe, quella dichiarazione non e'' piu'' vera e il perimetro va rivisto '
  'PRIMA che l''agente legga nomi propri. Sentinella bloccante, non informativa.';

-- §2 — auto-verifica: la vista deve essere VUOTA adesso, o il perimetro non si apre.
--      Non e' un conteggio congelato: e' la precondizione dell'apertura, verificata
--      al momento in cui l'apertura avviene.
DO $$
DECLARE n_persone int; n_nodi int;
BEGIN
  SELECT count(*) INTO n_persone FROM sys.v_grafo_con_nodo_di_persona;
  SELECT count(*) INTO n_nodi    FROM sys.sys_visualization_nodes;

  IF n_persone <> 0 THEN
    RAISE EXCEPTION
      'Un grafo salvato contiene gia % nodi di persona: `visualization` non e neutra e il perimetro dell agente NON va aperto (#214 F6)',
      n_persone;
  END IF;

  -- E la prova deve poter fallire: se non ci fosse alcun nodo, la vista sarebbe
  -- vuota per assenza di universo — un verde che non ha guardato niente.
  IF n_nodi = 0 THEN
    RAISE EXCEPTION
      'Nessun nodo di visualizzazione nel database: la sentinella sarebbe verde per vuoto, non per assenza di persone (#214 F6)';
  END IF;

  RAISE NOTICE 'OK — % nodi ispezionati, 0 di persona: `visualization` e neutra sui dati, non solo sulla dichiarazione.', n_nodi;
END $$;

-- §3 — registro di riconciliazione: una vista non e' una tabella, ma il registro
--      esiste per non lasciare oggetti UNCLASSIFIED (classe D-22, gia' vista in
--      000116 e 000319). Le viste non vi entrano: nessuna riga da aggiungere.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — DROP VIEW IF EXISTS sys.v_grafo_con_nodo_di_persona;
-- Ma toglierla significa aprire `visualization-graphs` all'agente SENZA nessuno che
-- sorvegli la dichiarazione su cui l'apertura poggia: si rilegga il §preambolo.
-- ═══════════════════════════════════════════════════════════════════════════════
