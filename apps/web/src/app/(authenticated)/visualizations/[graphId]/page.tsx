"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";

interface Graph {
  visualizationGraphId: string;
  code: string;
  name: string;
  graphKind: string;
  description: string | null;
  metadata: Record<string, unknown>;
}
interface GraphNode {
  visualizationNodeId: string;
  nodeKey: string;
  nodeKind: string;
  label: string | null;
}
interface GraphEdge {
  visualizationEdgeId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeKind: string;
}

export default function VisualizationDetailPage() {
  const params = useParams<{ graphId: string }>();
  const graphId = params.graphId;
  const graph = useQuery({
    queryKey: ["visualization-graphs", graphId],
    queryFn: () => apiFetch<Graph>(`/v1/visualization-graphs/${graphId}`),
    enabled: !!graphId,
  });
  const nodes = useQuery({
    queryKey: ["visualization-nodes", graphId],
    queryFn: () =>
      apiFetch<{ items: GraphNode[]; total: number }>(
        `/v1/visualization-nodes?graphId=${graphId}&limit=500`,
      ),
    enabled: !!graphId,
  });
  const edges = useQuery({
    queryKey: ["visualization-edges", graphId],
    queryFn: () =>
      apiFetch<{ items: GraphEdge[]; total: number }>(
        `/v1/visualization-edges?graphId=${graphId}&limit=500`,
      ),
    enabled: !!graphId,
  });

  if (graph.isLoading) {
    return <main className="max-w-5xl mx-auto px-6 py-8 opacity-60">Caricamento…</main>;
  }
  if (graph.isError) {
    const status = isApiError(graph.error) ? graph.error.status : 0;
    return (
      <main className="max-w-5xl mx-auto px-6 py-8" data-testid="visualization-error">
        <Link href="/visualizations" className="underline text-sm">← Visualizations</Link>
        <p className="text-red-600 mt-4">
          {status === 404 ? "Grafico non trovato." : "Errore."}
        </p>
      </main>
    );
  }
  const g = graph.data!;
  return (
    <main data-testid="visualization-detail-page" className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/visualizations" className="underline text-sm" data-testid="visualization-back">
          ← Visualizations
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="visualization-name">{g.name}</h1>
        <p className="text-sm opacity-70 font-mono" data-testid="visualization-code">{g.code}</p>
        <p className="text-xs uppercase opacity-70 mt-1">{g.graphKind}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="visualization-nodes-card">
          <CardHeader>
            <CardTitle>Nodi ({nodes.data?.total ?? "—"})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {nodes.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : nodes.data && nodes.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="visualization-nodes-empty">
                Nessun nodo.
              </div>
            ) : (
              <ul className="divide-y" data-testid="visualization-nodes-list">
                {nodes.data!.items.slice(0, 20).map((n) => (
                  <li key={n.visualizationNodeId} className="px-4 py-2 text-sm" data-testid="visualization-node-item">
                    <span className="font-mono text-xs opacity-70">{n.nodeKind}</span>
                    <span className="ml-2">{n.label ?? n.nodeKey}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card data-testid="visualization-edges-card">
          <CardHeader>
            <CardTitle>Edge ({edges.data?.total ?? "—"})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {edges.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : edges.data && edges.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="visualization-edges-empty">
                Nessun edge.
              </div>
            ) : (
              <ul className="divide-y" data-testid="visualization-edges-list">
                {edges.data!.items.slice(0, 20).map((e) => (
                  <li key={e.visualizationEdgeId} className="px-4 py-2 text-xs font-mono" data-testid="visualization-edge-item">
                    {e.fromNodeId.slice(0, 6)} → {e.toNodeId.slice(0, 6)}
                    <span className="ml-2 uppercase opacity-70">{e.edgeKind}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs opacity-60">
        Renderer React Flow / Mermaid posticipato a una iterazione successiva — qui sono visibili la lista nodi e edge live dalla DB.
      </p>
    </main>
  );
}
