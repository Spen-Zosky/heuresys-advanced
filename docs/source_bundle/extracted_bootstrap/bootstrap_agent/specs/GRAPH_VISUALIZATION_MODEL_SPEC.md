# Graph Visualization and Renderable Artifact Model Specification

## Purpose

This subsystem makes business artifacts renderable in multiple frontend visualization libraries without making visualization the source of truth.

## Principle

```text
Canonical semantic model
  = business data and relationships

Visualization model
  = nodes, edges, layout hints, grouping, coordinates, rendering style, export format
```

## Required Tables

```text
sys.sys_visualization_graphs
sys.sys_visualization_nodes
sys.sys_visualization_edges
sys.sys_visualization_layouts
sys.sys_visualization_styles
sys.sys_visualization_exports
```

## Graph Types

```yaml
graph_type:
  - ORG_CHART
  - PROCESS_FLOW
  - CAREER_PATH
  - LEARNING_PATH
  - SKILL_GAP_MAP
  - SUCCESSION_MAP
  - KPI_CASCADE
  - POSITION_INTELLIGENCE_MAP
  - ENTERPRISE_BLUEPRINT_MAP
```

## Layout Engines

```yaml
layout_engine:
  - AUTO
  - DAGRE
  - ELK
  - HIERARCHICAL
  - TREE
  - SWIMLANE
  - TIMELINE
  - FORCE_DIRECTED
  - MANUAL
```

## Rendering Targets

```yaml
rendering_target:
  - REACT_FLOW
  - MERMAID
  - BPMN
  - D3
  - SVG
  - HTML_CANVAS
  - PDF_EXPORT
  - GENERIC_JSON
```

## Key Rule

Do not make visualization the source of truth.

For example:

```text
sys.sys_positions.reports_to_position_id
```

is canonical.

The org chart graph is a projection derived from it.

Manual dragging updates layout coordinates only. It must not change business hierarchy unless the user executes an explicit organizational change workflow.
