# ADR‑0009 — Visualization: Dedicated `sys_visualization_node_layouts` Table

- **Status:** Accepted
- **Date:** 2026‑05‑16

## Context

`GRAPH_VISUALIZATION_MODEL_SPEC.md` mandates that the visualization layer is a **renderer‑neutral projection** and that **layout edits never mutate semantic hierarchy**.

The first iteration of the spec stored node coordinates directly on `sys_visualization_nodes`. That allowed only one layout per graph. We need:

1. **Multiple coexisting layouts per graph** (e.g. tree, dagre, force‑directed) without overwriting each other.
2. **Versioned layouts** (`auto‑generated v1`, `manual v2`, `dagre v3`) for undo / preview.
3. **Locked positions** (a user can pin a node so an auto‑layout rerun does not move it).
4. **Decoupling**: changing a semantic node label, type or grouping does not invalidate stored coordinates.

## Decision

Introduce a dedicated table `sys.sys_visualization_node_layouts(layout_id, node_id, x, y, z, locked, updated_at)`, with FK to `sys_visualization_layouts.layout_id` and `sys_visualization_nodes.node_id`. Coordinates live **only** here, never on `sys_visualization_nodes`.

The final visualization schema is therefore:

- `sys.sys_visualization_graphs(graph_id, tenant_id, graph_type, source_query, version, created_at)` — graph metadata.
- `sys.sys_visualization_nodes(node_id, graph_id, source_entity_type, source_entity_id, label, node_type, group_key, metadata)` — semantic identity.
- `sys.sys_visualization_edges(edge_id, graph_id, source_node_id, target_node_id, edge_type, weight, metadata)` — semantic relations.
- `sys.sys_visualization_layouts(layout_id, graph_id, layout_engine, version, created_at, is_default)` — layout config / version.
- `sys.sys_visualization_node_layouts(layout_id, node_id, x, y, z, locked, updated_at)` — **per‑layout coordinates**.
- `sys.sys_visualization_styles(style_id, graph_id, node_type, color, icon, ...)` — style hints.
- `sys.sys_visualization_exports(export_id, graph_id, layout_id, format, generated_at, payload_uri)` — export artifacts.

API contract:

- `GET /visualizations/{graphId}/layouts/{layoutId}` returns nodes + edges + node‑layout coordinates merged.
- `PATCH /visualizations/{graphId}/layouts/{layoutId}/nodes/{nodeId}` updates only the row in `sys_visualization_node_layouts`. It never touches `sys_visualization_nodes` (semantic) or any canonical business table.

## Alternatives Considered

| Option | Pros | Cons | Why rejected |
|--------|------|------|--------------|
| **Coordinates on `sys_visualization_nodes`** | One table fewer | Only one layout per graph; overwriting on auto‑layout rerun; no version history | Violates multi‑renderer requirement |
| **Coordinates inside `sys_visualization_layouts` JSONB** | One row per layout | Cannot index/query by node; harder to update single‑node positions | Loses relational benefits |
| **Coordinates in separate per‑engine tables** | Specialization | Combinatorial table explosion | Over‑engineering |

## Consequences

**Positive:**

- Multiple layouts coexist per graph; switching renderer is a SELECT join.
- `locked` flag protects user‑pinned nodes from auto‑layout reruns.
- Versioning enables "undo" and "preview proposed layout" flows.
- Semantic hierarchy is fully decoupled from rendering.

**Negative:**

- One extra table (8th in the visualization subschema).
- `PATCH` operations require resolving `(layoutId, nodeId)` instead of just `nodeId`.

**Neutral:**

- Default visualization renderer is React Flow (ADR‑0007); the same layout records feed Mermaid, D3, BPMN exports.

## References

- Consumed by: `TARGET_SCHEMA_DESIGN.md`, `MIGRATION_IMPLEMENTATION_PLAN.md`, `API_IMPLEMENTATION_PLAN.md` (visualizations module), `FRONTEND_IMPLEMENTATION_PLAN.md`.
- See also: ADR‑0008 (PIP relational design).
