"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { MermaidDiagram } from "../../_charts-client";
import { apiFetch } from "@/lib/api/fetch";
import { apiDownload } from "@/lib/api/download";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { EnumStatusPill } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// I formati che il motore produce davvero (apps/api .../visualization-exports/render.ts).
// PNG e PDF restano fuori: richiedono un rasterizzatore che l'API non ha, e
// l'endpoint li rifiuta con EXPORT_FORMAT_NOT_RENDERABLE.
const EXPORT_FORMATS = ["SVG", "MERMAID", "GENERIC_JSON", "REACT_FLOW_JSON"] as const;
type ExportFormat = (typeof EXPORT_FORMATS)[number];

// Fields match the real schemas (visualization-graphs/nodes/edges): graphId/type,
// nodeId/sourceEntityType/label, edgeId/sourceNodeId/targetNodeId/type. The previous
// stale interfaces (graphKind/nodeKind/fromNodeId/edgeKind) silently dropped every
// edge from the Mermaid diagram (nodeMap.has(undefined) === false). Fixed in F4.3.
interface Graph {
  graphId: string;
  code: string;
  name: string;
  type: string;
  version: number;
  description: string | null;
  metadata: Record<string, unknown>;
}
interface VizExport {
  exportId: string;
  graphId: string;
  format: string;
  byteSize: number | null;
  generatedAt: string;
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
  const enumLabel = useEnumLabel();
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

  // ---- #36 (B5): versioni ed export -------------------------------------
  const router = useRouter();
  const queryClient = useQueryClient();
  const perms = useCurrentUserPermissions();
  const canCreate = perms.data?.permissions.includes("visualization:create") ?? false;
  const [format, setFormat] = useState<ExportFormat>("SVG");
  const [exportError, setExportError] = useState<string | null>(null);

  const versions = useQuery({
    queryKey: ["visualization-graph-versions", graphId],
    queryFn: () =>
      apiFetch<{ items: Graph[]; total: number }>(`/v1/visualization-graphs/${graphId}/versions`),
    enabled: !!graphId,
  });

  const graphExports = useQuery({
    queryKey: ["visualization-exports", graphId],
    queryFn: () =>
      apiFetch<{ items: VizExport[]; total: number }>(
        `/v1/visualization-exports?graphId=${graphId}&limit=50`,
      ),
    enabled: !!graphId,
  });

  const createVersion = useMutation({
    mutationFn: () =>
      apiFetch<{ graph: Graph; copiedNodes: number; copiedEdges: number }>(
        `/v1/visualization-graphs/${graphId}/versions`,
        { method: "POST", body: {} },
      ),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["visualization-graph-versions"] });
      // La nuova versione è un grafo a sé: si va a vederla.
      router.push(`/visualizations/${r.graph.graphId}`);
    },
  });

  // Genera l'export E lo scarica: due passi che per chi guarda sono un gesto solo.
  const exportNow = useMutation({
    mutationFn: async () => {
      setExportError(null);
      const created = await apiFetch<VizExport>("/v1/visualization-exports", {
        method: "POST",
        body: { graphId, format },
      });
      return apiDownload(
        `/v1/visualization-exports/${created.exportId}/download`,
        `${graph.data?.code ?? "export"}.txt`,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["visualization-exports", graphId] });
    },
    onError: (e) => setExportError(e instanceof Error ? e.message : String(e)),
  });

  const downloadExisting = useMutation({
    mutationFn: (e: VizExport) => {
      setExportError(null);
      return apiDownload(`/v1/visualization-exports/${e.exportId}/download`, `${graph.data?.code ?? "export"}.txt`);
    },
    onError: (e) => setExportError(e instanceof Error ? e.message : String(e)),
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
            <EnumStatusPill domain="vizGraphType" value={g.type} tone="info" />
            <span data-testid="visualization-version" className="text-sm text-muted-foreground">
              {t("visualizations.detail.versionBadge", { version: g.version })}
            </span>
          </>
        }
      />

      {/* #36 (B5) — versioni ed export. Prima di questa sezione il grafo era
          bloccato a v1 e gli export erano righe di registro senza documento. */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card data-testid="visualization-versions-card">
          <CardHeader>
            <CardTitle>{t("visualizations.detail.versionsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {versions.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
            ) : (
              <>
                <label htmlFor="viz-version" className="block text-sm text-muted-foreground">
                  {t("visualizations.detail.versionSelectLabel")}
                </label>
                <select
                  id="viz-version"
                  data-testid="visualization-version-select"
                  className={SELECT_CLASS}
                  value={graphId}
                  onChange={(e) => router.push(`/visualizations/${e.target.value}`)}
                >
                  {(versions.data?.items ?? []).map((v) => (
                    <option key={v.graphId} value={v.graphId}>
                      {t("visualizations.detail.versionOption", { version: v.version, name: v.name })}
                    </option>
                  ))}
                </select>
                {canCreate ? (
                  <Button
                    data-testid="visualization-create-version"
                    onClick={() => createVersion.mutate()}
                    disabled={createVersion.isPending}
                  >
                    {createVersion.isPending
                      ? t("visualizations.detail.versionCreating")
                      : t("visualizations.detail.versionCreate")}
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">{t("visualizations.detail.versionNote")}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="visualization-export-card">
          <CardHeader>
            <CardTitle>{t("visualizations.detail.exportTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label htmlFor="viz-format" className="block text-sm text-muted-foreground">
              {t("visualizations.detail.exportFormatLabel")}
            </label>
            <select
              id="viz-format"
              data-testid="visualization-export-format"
              className={SELECT_CLASS}
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            {canCreate ? (
              <Button
                data-testid="visualization-export-run"
                onClick={() => exportNow.mutate()}
                disabled={exportNow.isPending}
              >
                {exportNow.isPending
                  ? t("visualizations.detail.exportRunning")
                  : t("visualizations.detail.exportRun")}
              </Button>
            ) : null}
            {exportError ? (
              <p className="text-sm text-danger" data-testid="visualization-export-error">
                {t("visualizations.detail.exportError", { code: exportError })}
              </p>
            ) : null}

            {graphExports.data && graphExports.data.items.length > 0 ? (
              <ul className="divide-y divide-border" data-testid="visualization-export-list">
                {graphExports.data.items.map((e) => (
                  <li key={e.exportId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-mono text-xs text-muted-foreground">{e.format}</span>
                      <span className="ml-2 text-muted-foreground">
                        {e.byteSize === null
                          ? t("visualizations.detail.exportNoContent")
                          : t("visualizations.detail.exportSize", { bytes: e.byteSize })}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      data-testid="visualization-export-download"
                      disabled={e.byteSize === null || downloadExisting.isPending}
                      onClick={() => downloadExisting.mutate(e)}
                    >
                      {t("visualizations.detail.exportDownload")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="visualization-export-empty">
                {t("visualizations.detail.exportEmpty")}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

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
                    <span className="ml-2 uppercase text-muted-foreground">{enumLabel("vizEdgeType", e.type)}</span>
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
