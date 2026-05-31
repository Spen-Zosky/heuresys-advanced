"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EChartsCard } from "../../_charts-client";

// Real schema fields (graphId/type/isActive), not the stale visualizationGraphId/
// graphKind this page used before F4.4. The list query also now filters by ?type=
// (the previous ?graphKind= was silently ignored → it returned every graph).
interface VizGraph {
  graphId: string;
  name: string;
  type: string;
  isActive: boolean;
}
interface RenderNode {
  nodeId: string;
  label: string;
}
interface RenderEdge {
  sourceNodeId: string;
  targetNodeId: string;
}
interface RenderPayload {
  graph: { graphId: string; name: string };
  nodes: RenderNode[];
  edges: RenderEdge[];
}

export default function OrgChartPage() {
  const graphs = useQuery({
    queryKey: ["visualization-graphs", "ORG_CHART"],
    queryFn: () =>
      apiFetch<{ items: VizGraph[]; total: number }>(
        "/v1/visualization-graphs?type=ORG_CHART&limit=10",
      ),
  });

  const [activeGraphId, setActiveGraphId] = useState<string | null>(null);
  const effectiveGraphId = activeGraphId ?? graphs.data?.items[0]?.graphId ?? null;

  // Composite render payload (graph + nodes + edges) in one call (F4.4).
  const render = useQuery({
    queryKey: ["visualization-render", effectiveGraphId],
    queryFn: () => apiFetch<RenderPayload>(`/v1/visualization-graphs/${effectiveGraphId}/render`),
    enabled: !!effectiveGraphId,
  });

  const nodeCount = render.data?.nodes.length ?? 0;
  const graphOption = {
    tooltip: { trigger: "item" as const },
    series: [
      {
        type: "graph" as const,
        layout: "force" as const,
        roam: true,
        label: { show: false },
        force: { repulsion: 60, edgeLength: 80, gravity: 0.08 },
        data: (render.data?.nodes ?? []).map((n) => ({ id: n.nodeId, name: n.label })),
        links: (render.data?.edges ?? []).map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId })),
        lineStyle: { color: "#6366f1", opacity: 0.6, curveness: 0.1 },
        itemStyle: { color: "#6366f1" },
        emphasis: { focus: "adjacency" as const },
      },
    ],
  };

  return (
    <main data-testid="org-chart-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="org-chart-title"
        title="Org chart"
        breadcrumbs={
          <Link
            href="/organization"
            data-testid="org-chart-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Organization
          </Link>
        }
        badges={
          <span data-testid="org-chart-count" className="text-sm text-muted-foreground">
            {graphs.data ? `${graphs.data.total} grafici ORG_CHART disponibili` : "Caricamento…"}
          </span>
        }
      />

      <section className="flex flex-wrap gap-2" data-testid="org-chart-picker">
        {graphs.data?.items.map((g) => (
          <button
            key={g.graphId}
            type="button"
            onClick={() => setActiveGraphId(g.graphId)}
            className={`rounded-card border px-3 py-1 text-xs transition-colors ${
              effectiveGraphId === g.graphId
                ? "border-transparent bg-primary text-white"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
            data-testid="org-chart-picker-btn"
          >
            {g.name}
          </button>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Organigramma ({render.data ? `${nodeCount} posizioni` : "—"})</CardTitle>
        </CardHeader>
        <CardContent>
          {!effectiveGraphId ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-empty">
              Nessun grafo ORG_CHART registrato per il tenant. Generarlo con
              <code className="mx-1 font-mono">db/seeds/org_chart_rtl_demo.sql</code>.
            </div>
          ) : render.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>
          ) : nodeCount === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-nodes-empty">
              Il grafo non ha nodi.
            </div>
          ) : (
            <div data-testid="org-chart-graph">
              <EChartsCard
                option={graphOption}
                height={520}
                ariaLabel="Organigramma interattivo delle posizioni"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Grafo a forza interattivo (zoom/pan). I nodi sono le posizioni attive del tenant; gli archi le relazioni reports-to.
      </p>
    </main>
  );
}
