"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { MermaidDiagram } from "../../_charts-client";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { StatusPill } from "@/components/status-pill";

// Fields match the real schemas (visualization-graphs/nodes/edges): graphId/type,
// nodeId/sourceEntityType/label, edgeId/sourceNodeId/targetNodeId/type. The previous
// stale interfaces (graphKind/nodeKind/fromNodeId/edgeKind) silently dropped every
// edge from the Mermaid diagram (nodeMap.has(undefined) === false). Fixed in F4.3.
interface Graph {
  graphId: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  metadata: Record<string, unknown>;
}
interface GraphNode {
  nodeId: string;
  sourceEntityType: string;
  label: string;
  type: string | null;
}
interface GraphEdge {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
}

export default function VisualizationDetailPage() {
  const { t } = useTranslation("admin");
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
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (graph.isError) {
    const status = isApiError(graph.error) ? graph.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="visualization-error">
        <Link href="/visualizations" className="text-sm underline">{t("visualizations.detail.back")}</Link>
        <p className="mt-4 text-danger">
          {status === 404 ? t("visualizations.detail.notFound") : t("visualizations.detail.loadError")}
        </p>
      </main>
    );
  }
  const g = graph.data!;
  const nodeMap = new Map<string, GraphNode>(
    (nodes.data?.items ?? []).map((n) => [n.nodeId, n]),
  );
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
  const sanitizeLabel = (s: string) => s.replace(/["\n\r]/g, " ").slice(0, 60);
  const mermaidSource =
    nodes.data && edges.data && nodes.data.items.length > 0
      ? [
          "flowchart LR",
          ...nodes.data.items.slice(0, 50).map((n) => {
            const id = "N_" + safe(n.nodeId);
            const label = sanitizeLabel(n.label);
            return `  ${id}["${label}"]`;
          }),
          ...edges.data.items
            .slice(0, 200)
            .filter((e) => nodeMap.has(e.sourceNodeId) && nodeMap.has(e.targetNodeId))
            .map((e) => `  N_${safe(e.sourceNodeId)} --> N_${safe(e.targetNodeId)}`),
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
            {t("visualizations.detail.back")}
          </Link>
        }
        badges={
          <>
            <span data-testid="visualization-code" className="font-mono text-sm text-muted-foreground">{g.code}</span>
            <StatusPill tone="info">{g.type}</StatusPill>
          </>
        }
      />

      {mermaidSource ? (
        <Card data-testid="visualization-renderer-card">
          <CardHeader>
            <CardTitle>{t("visualizations.detail.diagramTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto" data-testid="visualization-renderer">
            <MermaidDiagram
              source={mermaidSource}
              ariaLabel={t("visualizations.detail.diagramAria", { name: g.name })}
              className="min-w-full"
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card data-testid="visualization-nodes-card">
          <CardHeader>
            <CardTitle>{t("visualizations.detail.nodesTitle", { count: nodes.data?.total ?? t("visualizations.detail.dash") })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {nodes.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
            ) : nodes.data && nodes.data.items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground" data-testid="visualization-nodes-empty">
                {t("visualizations.detail.nodesEmpty")}
              </div>
            ) : (
              <ul className="divide-y divide-border" data-testid="visualization-nodes-list">
                {nodes.data!.items.slice(0, 20).map((n) => (
                  <li key={n.nodeId} className="px-4 py-2 text-sm text-foreground" data-testid="visualization-node-item">
                    <span className="font-mono text-xs text-muted-foreground">{n.sourceEntityType}</span>
                    <span className="ml-2">{n.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card data-testid="visualization-edges-card">
          <CardHeader>
            <CardTitle>{t("visualizations.detail.edgesTitle", { count: edges.data?.total ?? t("visualizations.detail.dash") })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {edges.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
            ) : edges.data && edges.data.items.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground" data-testid="visualization-edges-empty">
                {t("visualizations.detail.edgesEmpty")}
              </div>
            ) : (
              <ul className="divide-y divide-border" data-testid="visualization-edges-list">
                {edges.data!.items.slice(0, 20).map((e) => (
                  <li key={e.edgeId} className="px-4 py-2 font-mono text-xs text-foreground" data-testid="visualization-edge-item">
                    {e.sourceNodeId.slice(0, 6)}{t("visualizations.detail.edgeArrow")}{e.targetNodeId.slice(0, 6)}
                    <span className="ml-2 uppercase text-muted-foreground">{e.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        {t("visualizations.detail.note")}
      </p>
    </main>
  );
}
