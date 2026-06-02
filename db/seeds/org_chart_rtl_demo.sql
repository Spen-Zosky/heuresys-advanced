-- db/seeds/org_chart_rtl_demo.sql
-- Idempotent demo seed: builds a live ORG_CHART visualization graph for the
-- RTL_BANK reference tenant directly from sys.sys_positions (one node per active
-- position, one REPORTS_TO edge per position.reports_to link). Feeds the
-- /organization/org-chart page (brand-fidelity F4.4). Re-runnable: the graph row
-- is created once (no unique key on code → SELECT-then-INSERT); its nodes/edges
-- are rebuilt every run so it always mirrors the current positions.
--
-- Data is real seed data (RTL_BANK_REFERENCE), not fabricated — honours the
-- LIVE DATA doctrine. Run: psql ... -f db/seeds/org_chart_rtl_demo.sql

DO $$
DECLARE
  v_tenant uuid;
  v_graph  uuid;
  v_nodes  int;
  v_edges  int;
BEGIN
  -- Canonical tenant lookup by code (the old tenant_admin_test@rtl-bank.test account was deleted
  -- in the S950 RTL rebuild — that stale email is why the org-chart graph went un-regenerated).
  SELECT tenant_id INTO v_tenant
    FROM sys.sys_tenancies
   WHERE tenant_code = 'RTL_BANK'
   LIMIT 1;
  IF v_tenant IS NULL THEN
    RAISE NOTICE 'org_chart_rtl_demo: RTL_BANK tenant not found — skipping';
    RETURN;
  END IF;

  -- Graph (idempotent: reuse the existing RTL_ORG_CHART row if present).
  SELECT graph_id INTO v_graph
    FROM sys.sys_visualization_graphs
   WHERE graph_tenant_id = v_tenant AND graph_code = 'RTL_ORG_CHART'
   LIMIT 1;
  IF v_graph IS NULL THEN
    INSERT INTO sys.sys_visualization_graphs (
      graph_tenant_id, graph_code, graph_type, graph_name, graph_description, graph_is_active
    ) VALUES (
      v_tenant, 'RTL_ORG_CHART', 'ORG_CHART', 'RTL Bank — Organigramma',
      'Org chart live derivato dalle posizioni (reports_to).', true
    ) RETURNING graph_id INTO v_graph;
  END IF;

  -- Rebuild nodes + edges for this graph (idempotent).
  DELETE FROM sys.sys_visualization_edges WHERE edge_graph_id = v_graph;
  DELETE FROM sys.sys_visualization_nodes WHERE node_graph_id = v_graph;

  INSERT INTO sys.sys_visualization_nodes (
    node_graph_id, node_source_entity_type, node_source_entity_id, node_label, node_type
  )
  SELECT v_graph, 'POSITION', p.position_id, p.position_title, NULL
    FROM sys.sys_positions p
   WHERE p.position_tenant_id = v_tenant AND p.position_is_active;

  INSERT INTO sys.sys_visualization_edges (
    edge_graph_id, edge_source_node_id, edge_target_node_id, edge_type
  )
  SELECT v_graph, child.node_id, parent.node_id, 'REPORTS_TO'
    FROM sys.sys_positions p
    JOIN sys.sys_visualization_nodes child
      ON child.node_graph_id = v_graph AND child.node_source_entity_id = p.position_id
    JOIN sys.sys_visualization_nodes parent
      ON parent.node_graph_id = v_graph AND parent.node_source_entity_id = p.position_reports_to_position_id
   WHERE p.position_tenant_id = v_tenant
     AND p.position_reports_to_position_id IS NOT NULL;

  SELECT count(*) INTO v_nodes FROM sys.sys_visualization_nodes WHERE node_graph_id = v_graph;
  SELECT count(*) INTO v_edges FROM sys.sys_visualization_edges WHERE edge_graph_id = v_graph;
  RAISE NOTICE 'org_chart_rtl_demo: graph % → % nodes, % edges', v_graph, v_nodes, v_edges;
END $$;
