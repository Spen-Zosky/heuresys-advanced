"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

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
    <main data-testid="org-chart-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/organization" className="underline text-sm" data-testid="org-chart-back">
          ← Organization
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="org-chart-title">Org chart</h1>
        <p className="text-sm opacity-70" data-testid="org-chart-count">
          {graphs.data ? `${graphs.data.total} grafici ORG_CHART disponibili` : "Caricamento…"}
        </p>
      </header>

      <section className="flex gap-2" data-testid="org-chart-picker">
        {graphs.data?.items.map((g) => (
          <button
            key={g.visualizationGraphId}
            type="button"
            onClick={() => setActiveGraphId(g.visualizationGraphId)}
            className={`px-3 py-1 text-xs border rounded ${
              effectiveGraphId === g.visualizationGraphId ? "bg-black text-white" : ""
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
            <div className="p-6 opacity-60" data-testid="org-chart-empty">
              Nessun grafo ORG_CHART registrato per il tenant. Crearlo via
              <code className="font-mono mx-1">POST /v1/visualization-graphs</code>
              con <code className="font-mono">graphKind=ORG_CHART</code>.
            </div>
          ) : nodes.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : nodes.data && nodes.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="org-chart-nodes-empty">
              Il grafo non ha nodi.
            </div>
          ) : (
            <ul className="divide-y" data-testid="org-chart-nodes-list">
              {nodes.data!.items.map((n) => (
                <li key={n.visualizationNodeId} className="px-4 py-2 text-sm" data-testid="org-chart-node-item">
                  <span className="font-mono text-xs opacity-70">{n.nodeKind}</span>
                  <span className="ml-2">{n.label ?? n.visualizationNodeId.slice(0, 8)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs opacity-60">
        Renderer React Flow con layout Dagre/ELK è programmato in una iterazione successiva — qui mostriamo il payload live del grafo.
      </p>
    </main>
  );
}
