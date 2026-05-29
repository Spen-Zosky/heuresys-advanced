"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";

interface VisualizationGraph {
  visualizationGraphId: string;
  name: string;
  graphKind: string;
  status: string;
}
interface GraphNode {
  visualizationNodeId: string;
  nodeKind: string;
  label: string | null;
}

export default function OrgChartPage() {
  const graphs = useQuery({
    queryKey: ["visualization-graphs", "ORG_CHART"],
    queryFn: () =>
      apiFetch<{ items: VisualizationGraph[]; total: number }>(
        "/v1/visualization-graphs?graphKind=ORG_CHART&limit=10",
      ),
  });

  const [activeGraphId, setActiveGraphId] = useState<string | null>(null);
  const effectiveGraphId = activeGraphId ?? graphs.data?.items[0]?.visualizationGraphId ?? null;

  const nodes = useQuery({
    queryKey: ["visualization-nodes", effectiveGraphId],
    queryFn: () =>
      apiFetch<{ items: GraphNode[]; total: number }>(
        `/v1/visualization-nodes?graphId=${effectiveGraphId}&limit=500`,
      ),
    enabled: !!effectiveGraphId,
  });

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

      <section className="flex gap-2" data-testid="org-chart-picker">
        {graphs.data?.items.map((g) => (
          <button
            key={g.visualizationGraphId}
            type="button"
            onClick={() => setActiveGraphId(g.visualizationGraphId)}
            className={`rounded-card border px-3 py-1 text-xs transition-colors ${
              effectiveGraphId === g.visualizationGraphId
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            data-testid="org-chart-picker-btn"
          >
            {g.name}
          </button>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nodi del grafo ({nodes.data?.total ?? "—"})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!effectiveGraphId ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-empty">
              Nessun grafo ORG_CHART registrato per il tenant. Crearlo via
              <code className="mx-1 font-mono">POST /v1/visualization-graphs</code>
              con <code className="font-mono">graphKind=ORG_CHART</code>.
            </div>
          ) : nodes.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>
          ) : nodes.data && nodes.data.items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-nodes-empty">
              Il grafo non ha nodi.
            </div>
          ) : (
            <ul className="divide-y divide-border" data-testid="org-chart-nodes-list">
              {nodes.data!.items.map((n) => (
                <li key={n.visualizationNodeId} className="px-4 py-2 text-sm text-foreground" data-testid="org-chart-node-item">
                  <span className="font-mono text-xs text-muted-foreground">{n.nodeKind}</span>
                  <span className="ml-2">{n.label ?? n.visualizationNodeId.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Renderer React Flow con layout Dagre/ELK è programmato in una iterazione successiva — qui mostriamo il payload live del grafo.
      </p>
    </main>
  );
}
