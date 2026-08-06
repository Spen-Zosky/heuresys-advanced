-- ============================================================================
-- Migration 000276 — #153: ridà gli stili alle versioni di grafo che li hanno persi
-- ----------------------------------------------------------------------------
-- Conseguenza di un difetto di codice, corretto nello stesso ciclo: fino a oggi
-- `visualization-graphs/service.ts::createVersion` copiava nodi, archi e
-- disposizioni ma **non gli stili**. Chi creava una versione otteneva un grafo
-- con tutti i suoi nodi e nessuna regola per disegnarli.
--
-- Caso reale che ha fatto scattare tutto: `federica.marchetti@rtl-bank.org` ha
-- creato la **v2** di `RTL_ORG_CHART` il 2026-08-02 — 158 nodi
-- (130 CONTRIBUTOR + 27 MANAGER + 1 ROOT), **zero stili**. Il check C11a(iv)
-- della custodia storia36 lo ha visto il 2026-08-03 e da allora il timer
-- settimanale fallisce, in silenzio, da tre esecuzioni.
--
-- **La v2 NON si cancella**: è il lavoro di una persona, non un residuo. Si
-- ripara dandole ciò che la copia avrebbe dovuto portarle.
--
-- Regola applicata: una versione priva di stili eredita quelli della versione
-- **più bassa dello stesso `graph_code` e tenant** che ne possiede — cioè
-- l'originale, non un'altra copia a sua volta incompleta.
--
-- Idempotente **per costruzione, non per convenzione**: `sys_visualization_styles`
-- non ha un vincolo unico su (grafo, tipo) — un `ON CONFLICT` qui non avrebbe
-- appiglio e la seconda esecuzione duplicherebbe ogni riga. La guardia è quindi
-- un `NOT EXISTS` esplicito sulla coppia. Ri-eseguibile: la seconda corsa scrive
-- 0 righe (twice-run 0, come pretende la dottrina storia36).
--
-- Non distruttiva: sola INSERT, nessuna riga toccata o rimossa. 2026-08-06.
-- ============================================================================

DO $backfill$
DECLARE
  v_inserite integer;
BEGIN
  INSERT INTO sys.sys_visualization_styles (
    style_graph_id, style_node_type, style_color, style_icon, style_metadata)
  SELECT orfano.graph_id, s.style_node_type, s.style_color, s.style_icon, s.style_metadata
    FROM (
      -- i grafi che hanno nodi ma nessuno stile
      SELECT g.graph_id, g.graph_tenant_id, g.graph_code, g.graph_version
        FROM sys.sys_visualization_graphs g
       WHERE EXISTS (SELECT 1 FROM sys.sys_visualization_nodes n
                      WHERE n.node_graph_id = g.graph_id)
         AND NOT EXISTS (SELECT 1 FROM sys.sys_visualization_styles s2
                          WHERE s2.style_graph_id = g.graph_id)
    ) orfano
    -- la versione più bassa, dello stesso codice e tenant, che gli stili ce li ha
    JOIN LATERAL (
      SELECT g2.graph_id
        FROM sys.sys_visualization_graphs g2
       WHERE g2.graph_tenant_id = orfano.graph_tenant_id
         AND g2.graph_code      = orfano.graph_code
         AND g2.graph_id       <> orfano.graph_id
         AND EXISTS (SELECT 1 FROM sys.sys_visualization_styles s3
                      WHERE s3.style_graph_id = g2.graph_id)
       ORDER BY g2.graph_version
       LIMIT 1
    ) donatore ON true
    JOIN sys.sys_visualization_styles s ON s.style_graph_id = donatore.graph_id
   -- la guardia di idempotenza: la coppia (grafo, tipo) non deve già esserci
   WHERE NOT EXISTS (
     SELECT 1 FROM sys.sys_visualization_styles dup
      WHERE dup.style_graph_id = orfano.graph_id
        AND dup.style_node_type IS NOT DISTINCT FROM s.style_node_type
   );

  GET DIAGNOSTICS v_inserite = ROW_COUNT;
  RAISE NOTICE '000276: % stili ripristinati su versioni che ne erano prive (attesi 3 alla prima corsa, 0 alle successive).', v_inserite;
END
$backfill$;
