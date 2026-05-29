"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, MermaidDiagram, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { StatusPill } from "@/components/status-pill";

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
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (graph.isError) {
    const status = isApiError(graph.error) ? graph.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="visualization-error">
        <Link href="/visualizations" className="text-sm underline">← Visualizations</Link>
        <p className="mt-4 text-destructive">
          {status === 404 ? "Grafico non trovato." : "Errore."}
        </p>
      </main>
    );
  }
  const g = graph.data!;
  const nodeMap = new Map<string, GraphNode>(
    (nodes.data?.items ?? []).map((n) => [n.visualizationNodeId, n]),
  );
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
  const sanitizeLabel = (s: string) => s.replace(/["\n\r]/g, " ").slice(0, 60);
  const mermaidSource =
    nodes.data && edges.data && nodes.data.items.length > 0
      ? [
          "flowchart LR",
          ...nodes.data.items.slice(0, 50).map((n) => {
            const id = "N_" + safe(n.visualizationNodeId);
            const label = sanitizeLabel(n.label ?? n.nodeKey);
            return `  ${id}["${label}"]`;
          }),
          ...edges.data.items
            .slice(0, 200)
            .filter((e) => nodeMap.has(e.fromNodeId) && nodeMap.has(e.toNodeId))
            .map(
              (e) =>
                `  N_${safe(e.fromNodeId)} --> N_${safe(e.toNodeId)}`,
            ),
        ].join("\n")
      : null;

  return (
    <main data-testid="visualization-detail-page" className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="visualization-name"
        title={g.name}
        breadcrumbs={
          <Link
            href="/visualizations"
            data-testid="visualization-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Visualizations
          </Link>
        }
        badges={
          <>
            <span data-testid="visualization-code" className="font-mono text-sm text-muted-foreground">{g.code}</span>
            <StatusPill tone="info">{g.graphKind}</StatusPill>
          </>
        }
      />

      {mermaidSource ? (
        <Card data-testid="visualization-renderer-card">
          <CardHeader>
            <CardTitle>Diagramma</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto" data-testid="visualization-renderer">
            <MermaidDiagram
              source={mermaidSource}
              ariaLabel={`Diagramma del grafo ${g.name}`}
              className="min-w-full"
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card data-testid="visualization-nodes-card">
          <CardHeader>
            <CardTitle>Nodi ({nodes.data?.total ?? "—"})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {nodes.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>
            ) : nodes.data && nodes.data.items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground" data-testid="visualization-nodes-empty">
                Nessun nodo.
              </div>
            ) : (
              <ul className="divide-y divide-border" data-testid="visualization-nodes-list">
                {nodes.data!.items.slice(0, 20).map((n) => (
                  <li key={n.visualizationNodeId} className="px-4 py-2 text-sm text-foreground" data-testid="visualization-node-item">
                    <span className="font-mono text-xs text-muted-foreground">{n.nodeKind}</span>
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
              <div className="p-6 text-sm text-muted-foreground">Caricamento…</div>
            ) : edges.data && edges.data.items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground" data-testid="visualization-edges-empty">
                Nessun edge.
              </div>
            ) : (
              <ul className="divide-y divide-border" data-testid="visualization-edges-list">
                {edges.data!.items.slice(0, 20).map((e) => (
                  <li key={e.visualizationEdgeId} className="px-4 py-2 font-mono text-xs text-foreground" data-testid="visualization-edge-item">
                    {e.fromNodeId.slice(0, 6)} → {e.toNodeId.slice(0, 6)}
                    <span className="ml-2 uppercase text-muted-foreground">{e.edgeKind}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        Renderer Mermaid attivato (max 50 nodi · 200 edge). Liste nodi/edge complete sopra (max 20 + 20 visibili).
      </p>
    </main>
  );
}
