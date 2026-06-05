# Visualization renderers (MVP-3 "tappa B") — CLOSURE DOC

> **Ruolo**: chiusura terminale dell'item "visualization renderers / tappa B". Documenta che il **subsystem renderer è completo** e porta ogni `graph_type` dello spec a uno **stato terminale esplicito** (bucket-map, modello reconciliation registry). Solleva il brand-gate (stale: brand v1 shipped).
> **Creato**: 2026-06-05 (S968), evidence-based (codice + query live `sys.sys_visualization_graphs` + lib `@heuresys/ui` source).
> **SoT**: stato vivo → `docs/kb/SOT_STATE.md` §6. Backlog → `SOT_BACKLOG.md`. Spec → `docs/source_bundle/.../GRAPH_VISUALIZATION_MODEL_SPEC.md`.

## TL;DR — verdetto di chiusura

Il framing storico ("tappa B gated, da costruire, in attesa del brand") è **superato**. Il subsystem di rendering grafo è **già shipped e live in produzione** (~70% al reality-check, ora classificato completo). Chiusura:

- **Renderer = COMPLETI**: 3 renderer live nell'app + 3 primitive nella lib, tutti `graph_type`-agnostici.
- **9 `graph_type` = ognuno a stato terminale** (bucket-map sotto): 1 RENDERED+SEEDED, 6 RENDERER-READY/seed-deferred, 2 TERMINALI (no-source / ridondante).
- **Brand-gate = SOLLEVATO** (brand v1 shipped su GitHub Pages); la memoria `feedback_brand_before_graph_renderers` è marcata risolta.
- **`reactflow` dead-weight** identificato nella lib (dichiarato, 0 import) → rimozione = micro-task cross-repo + npm publish (azione outward, gated su ok Enzo).
- **`analytics/org-network` NON viene trasformato in node-graph**: è analytics-aggregato (distribuzioni depth/span/reach) complementare a `org-chart` (force-graph topologico). Convertirlo duplicherebbe org-chart e perderebbe le distribuzioni → rifiutato (decisione tecnica S968).

## Renderer shipped (live, verificati)

| Renderer | Dove | Tecnologia | Fonte dati |
|---|---|---|---|
| Diagramma generico (flowchart) | `apps/web/.../visualizations/[graphId]/page.tsx` | `MermaidDiagram` (@heuresys/ui) | `/v1/visualization-graphs/:id/render` (nodes+edges), `graph_type`-agnostico |
| Org-chart node-graph | `apps/web/.../organization/org-chart/page.tsx` | ECharts `series type:'graph' layout:'force'` (roam/drag) | `/v1/visualization-graphs/:id/render` (filtra `?type=ORG_CHART`) |
| Org-network analytics | `apps/web/.../analytics/org-network/page.tsx` | ECharts **bars** (distribuzioni) | `/v1/analytics/org-network` (metriche aggregate — **non** topologia) |

**Primitive lib** (@heuresys/ui@0.1.3, sorgente `D:\ux-design-shared`): `MermaidDiagram` (Tier 10, SVG hardened), `NetworkGraph` (Cytoscape force/drag), `KGGraphCanvas` (adjacency). Tutte `graph_type`-agnostiche. **Regola architetturale rispettata**: `apps/web` dichiara solo `@heuresys/ui` per la viz (nessuna dep diretta reactflow/mermaid/echarts/cytoscape).

## Bucket-map terminale dei 9 `graph_type`

Stato live `sys.sys_visualization_graphs`: solo `ORG_CHART`=1 (158 nodi / 157 edge); gli altri 8 = 0 righe. **Regola dello spec**: la viz è una **proiezione**, mai source-of-truth → ogni `graph_type` diventa renderabile **nel momento** in cui si aggiunge un seed derive-from-canonical (pattern `db/seeds/org_chart_rtl_demo.sql`), **zero nuovo codice page/lib/endpoint** (i renderer sono agnostici).

| `graph_type` | Stato terminale | Sorgente canonica (live) | Rationale |
|---|---|---|---|
| **ORG_CHART** | ✅ RENDERED + SEEDED | positions 162, reports_to | live in org-chart + visualizations |
| **PROCESS_FLOW** | 🟡 RENDERER-READY / seed-deferred | `blueprint_process_registry`=23 | renderer pronto (Mermaid agnostico); manca solo seed-projection |
| **CAREER_PATH** | 🟡 RENDERER-READY / seed-deferred | career_paths=28 / steps=35 | idem |
| **LEARNING_PATH** | 🟡 RENDERER-READY / seed-deferred | learning_paths=4667 / steps=124 | idem |
| **SKILL_GAP_MAP** | 🟡 RENDERER-READY / seed-deferred | skills=21939 / taxonomy=11965 / gaps=270 | idem |
| **KPI_CASCADE** | 🟡 RENDERER-READY / seed-deferred | kpi_definitions=243 / targets=248 | idem |
| **ENTERPRISE_BLUEPRINT_MAP** | 🟡 RENDERER-READY / seed-deferred | blueprint_families=1 | idem |
| **SUCCESSION_MAP** | ⚪ TERMINALE no-source | succession_pools=**0** (scores 90) | senza pool non c'è topologia da proiettare → unsourced, non "promesso-non-reso" |
| **POSITION_INTELLIGENCE_MAP** | ⚪ TERMINALE ridondante | positions 162 (PIP = VIEW, I9/ADR-0008) | la proiezione grafo del PIP è la stessa topologia reports_to già resa da ORG_CHART → nessuna capability viz nuova |

I 6 "RENDERER-READY / seed-deferred" **non sono un gap di renderer**: sono **data-seeding** (≈1 file SQL idempotente per tipo, pattern `org_chart_rtl_demo.sql`). Popolarli è una capability selezionabile dal menu session-start, non lavoro di rendering. Stato terminale esplicito = "renderer completo, proiezione non ancora seedata".

## Decisioni tecniche (S968)

- **org-network resta analytics-bars**: complementare a org-chart, non duplicato. Rifiutata la conversione a node-graph (perdita distribuzioni + duplicazione).
- **NO nuovo renderer React Flow**: lo stack ECharts force-graph + Mermaid + Cytoscape NetworkGraph copre già force-layout + drag interattivo + diagrammi. Un 4° renderer React Flow aggiungerebbe superficie di manutenzione senza capability nuova → rifiutato (manufacturing work).
- **`reactflow` dead-weight**: dichiarato in `D:\ux-design-shared\ui\package.json` ma **0 import** in `ui/src`. Rimozione = mossa zero-residuo, ma cross-repo + **npm publish** 0.1.3→0.1.4 + bump qui (azione outward-facing/irreversibile) → **gated su ok Enzo** (vedi nota in `SOT_BACKLOG.md`).

## Brand-gate

**SOLLEVATO** (S968). Il gate originale ("tappa B deferita finché brand identity v1 non è definita", memoria `feedback_brand_before_graph_renderers`, 2026-05-17) è superato: brand v1 è shipped (apps/showcase, GitHub Pages). Memoria marcata risolta; `SOT_BACKLOG.md` (Candidati MVP-4) aggiornato.

## Cross-ref

`SOT_STATE.md` §6 · `SOT_BACKLOG.md` (viz renderers) · spec `GRAPH_VISUALIZATION_MODEL_SPEC.md` · renderer pages + `/v1/visualization-graphs` · lib `@heuresys/ui` (NetworkGraph/MermaidDiagram/KGGraphCanvas) · seed pattern `db/seeds/org_chart_rtl_demo.sql`.
