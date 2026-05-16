-- =============================================================================
-- 000022_visualization_graph_model.sql
-- Heuresys Advanced — visualization graph model (7 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §11 + ADR-0009.
-- Semantic graph (nodes, edges) is CANONICAL. Layout coordinates are
-- separated into sys_visualization_node_layouts (per-layout/version).
-- Layout edits NEVER mutate semantic hierarchy (invariant I10).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_visualization_graphs (
  graph_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  graph_code          varchar(128) NOT NULL,
  graph_type          varchar(64)  NOT NULL,
  graph_name          varchar(255) NOT NULL,
  graph_description   text,
  graph_source_query  text,
  graph_version       integer      NOT NULL DEFAULT 1,
  graph_is_active     boolean      NOT NULL DEFAULT true,
  graph_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  created_by          uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  updated_by          uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_visualization_graphs
  DROP CONSTRAINT IF EXISTS sys_viz_graph_type_check;
ALTER TABLE sys.sys_visualization_graphs
  ADD CONSTRAINT sys_viz_graph_type_check
  CHECK (graph_type IN ('ORG_CHART', 'PROCESS_FLOW', 'CAREER_PATH', 'LEARNING_PATH', 'SKILL_GAP_MAP', 'SUCCESSION_MAP', 'KPI_CASCADE', 'POSITION_INTELLIGENCE_MAP', 'ENTERPRISE_BLUEPRINT_MAP'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_viz_graphs_tenant_code_version_uq
  ON sys.sys_visualization_graphs (graph_tenant_id, graph_code, graph_version);

CREATE INDEX IF NOT EXISTS sys_viz_graphs_tenant_type_active_idx
  ON sys.sys_visualization_graphs (graph_tenant_id, graph_type, graph_is_active);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_viz_graphs_set_updated_at' AND tgrelid = 'sys.sys_visualization_graphs'::regclass) THEN
    CREATE TRIGGER sys_viz_graphs_set_updated_at BEFORE UPDATE ON sys.sys_visualization_graphs FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_visualization_nodes (
  node_id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  node_graph_id            uuid         NOT NULL REFERENCES sys.sys_visualization_graphs(graph_id) ON DELETE CASCADE,
  node_source_entity_type  varchar(64)  NOT NULL,
  node_source_entity_id    uuid,
  node_label               varchar(255) NOT NULL,
  node_type                varchar(64),
  node_group_key           varchar(128),
  node_metadata            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_visualization_nodes
  DROP CONSTRAINT IF EXISTS sys_viz_node_source_entity_type_check;
ALTER TABLE sys.sys_visualization_nodes
  ADD CONSTRAINT sys_viz_node_source_entity_type_check
  CHECK (node_source_entity_type IN ('POSITION', 'USER', 'SKILL', 'KPI', 'PROCESS', 'UNIT', 'LEARNING_MODULE', 'CAREER_PATH', 'BLUEPRINT_VARIANT', 'SUCCESSION_POOL', 'GENERIC'));

CREATE INDEX IF NOT EXISTS sys_viz_nodes_graph_idx
  ON sys.sys_visualization_nodes (node_graph_id);

CREATE INDEX IF NOT EXISTS sys_viz_nodes_source_entity_idx
  ON sys.sys_visualization_nodes (node_source_entity_type, node_source_entity_id)
  WHERE node_source_entity_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sys.sys_visualization_edges (
  edge_id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_graph_id       uuid         NOT NULL REFERENCES sys.sys_visualization_graphs(graph_id) ON DELETE CASCADE,
  edge_source_node_id uuid         NOT NULL REFERENCES sys.sys_visualization_nodes(node_id) ON DELETE CASCADE,
  edge_target_node_id uuid         NOT NULL REFERENCES sys.sys_visualization_nodes(node_id) ON DELETE CASCADE,
  edge_type           varchar(64)  NOT NULL,
  edge_weight         numeric(8,4),
  edge_metadata       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_visualization_edges
  DROP CONSTRAINT IF EXISTS sys_viz_edge_type_check;
ALTER TABLE sys.sys_visualization_edges
  ADD CONSTRAINT sys_viz_edge_type_check
  CHECK (edge_type IN ('REPORTS_TO', 'REQUIRES_SKILL', 'NEXT_STEP', 'SUCCESSOR_OF', 'PART_OF', 'INFLUENCES', 'ESCALATES_TO', 'GENERIC'));

CREATE INDEX IF NOT EXISTS sys_viz_edges_graph_idx
  ON sys.sys_visualization_edges (edge_graph_id);

CREATE INDEX IF NOT EXISTS sys_viz_edges_source_idx
  ON sys.sys_visualization_edges (edge_source_node_id);

CREATE INDEX IF NOT EXISTS sys_viz_edges_target_idx
  ON sys.sys_visualization_edges (edge_target_node_id);

CREATE TABLE IF NOT EXISTS sys.sys_visualization_layouts (
  layout_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_graph_id  uuid         NOT NULL REFERENCES sys.sys_visualization_graphs(graph_id) ON DELETE CASCADE,
  layout_engine    varchar(64)  NOT NULL DEFAULT 'AUTO',
  layout_version   integer      NOT NULL DEFAULT 1,
  is_default       boolean      NOT NULL DEFAULT false,
  layout_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_visualization_layouts
  DROP CONSTRAINT IF EXISTS sys_viz_layout_engine_check;
ALTER TABLE sys.sys_visualization_layouts
  ADD CONSTRAINT sys_viz_layout_engine_check
  CHECK (layout_engine IN ('AUTO', 'DAGRE', 'ELK', 'HIERARCHICAL', 'TREE', 'SWIMLANE', 'TIMELINE', 'FORCE_DIRECTED', 'MANUAL'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_viz_layouts_graph_version_engine_uq
  ON sys.sys_visualization_layouts (layout_graph_id, layout_engine, layout_version);

CREATE UNIQUE INDEX IF NOT EXISTS sys_viz_layouts_one_default_per_graph
  ON sys.sys_visualization_layouts (layout_graph_id)
  WHERE is_default = true;

-- -----------------------------------------------------------------------------
-- Per-layout coordinates (ADR-0009)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_visualization_node_layouts (
  node_layout_id    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id         uuid         NOT NULL REFERENCES sys.sys_visualization_layouts(layout_id) ON DELETE CASCADE,
  node_id           uuid         NOT NULL REFERENCES sys.sys_visualization_nodes(node_id) ON DELETE CASCADE,
  x                 numeric(10,2) NOT NULL,
  y                 numeric(10,2) NOT NULL,
  z                 numeric(10,2),
  locked            boolean      NOT NULL DEFAULT false,
  node_layout_metadata jsonb     NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_viz_node_layouts_layout_node_uq
  ON sys.sys_visualization_node_layouts (layout_id, node_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_viz_node_layouts_set_updated_at' AND tgrelid = 'sys.sys_visualization_node_layouts'::regclass) THEN
    CREATE TRIGGER sys_viz_node_layouts_set_updated_at BEFORE UPDATE ON sys.sys_visualization_node_layouts FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_visualization_styles (
  style_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  style_graph_id  uuid         NOT NULL REFERENCES sys.sys_visualization_graphs(graph_id) ON DELETE CASCADE,
  style_node_type varchar(64),
  style_color     varchar(32),
  style_icon      varchar(64),
  style_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_viz_styles_graph_idx
  ON sys.sys_visualization_styles (style_graph_id);

CREATE TABLE IF NOT EXISTS sys.sys_visualization_exports (
  export_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  export_graph_id      uuid         NOT NULL REFERENCES sys.sys_visualization_graphs(graph_id) ON DELETE CASCADE,
  export_layout_id     uuid         REFERENCES sys.sys_visualization_layouts(layout_id) ON DELETE SET NULL,
  export_format        varchar(32)  NOT NULL,
  export_payload_uri   text,
  export_generated_at  timestamptz  NOT NULL DEFAULT now(),
  export_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_visualization_exports
  DROP CONSTRAINT IF EXISTS sys_viz_export_format_check;
ALTER TABLE sys.sys_visualization_exports
  ADD CONSTRAINT sys_viz_export_format_check
  CHECK (export_format IN ('SVG', 'PDF', 'PNG', 'GENERIC_JSON', 'REACT_FLOW_JSON', 'MERMAID'));

CREATE INDEX IF NOT EXISTS sys_viz_exports_graph_idx
  ON sys.sys_visualization_exports (export_graph_id, export_generated_at DESC);
