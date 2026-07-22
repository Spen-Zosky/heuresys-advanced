"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("admin");
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
        label: { show: true, position: "right" as const, fontSize: 11, color: "#e2e8f0" },
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
        title={t("orgChart.title")}
        breadcrumbs={
          <Link
            href="/organization"
            data-testid="org-chart-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("orgChart.back")}
          </Link>
        }
        badges={
          <span data-testid="org-chart-count" className="text-sm text-muted-foreground">
            {graphs.data ? t("orgChart.count", { count: graphs.data.total }) : t("common:loading")}
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
                ? // token, non text-white: in dark il primary è #5E9DF5 e il bianco
                  // scende a 2.75:1 (axe serious) — --color-primary-fg è l'ink
                  // per-modo già ritarato in S982 (light 5.2:1, dark 6.5:1).
                  "border-transparent bg-primary text-[color:var(--color-primary-fg)]"
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
          <CardTitle>{t("orgChart.cardTitle", { label: render.data ? t("orgChart.nodeCount", { count: nodeCount }) : t("orgChart.dash") })}</CardTitle>
        </CardHeader>
        <CardContent>
          {!effectiveGraphId ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-empty">
              {t("orgChart.emptyPrefix")}
            </div>
          ) : render.isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
          ) : render.isError ? (
            <div className="p-6 text-sm text-danger" data-testid="org-chart-error">
              {t("orgChart.error")}
            </div>
          ) : nodeCount === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="org-chart-nodes-empty">
              {t("orgChart.noNodes")}
            </div>
          ) : (
            <div data-testid="org-chart-graph">
              <EChartsCard
                option={graphOption}
                height={520}
                ariaLabel={t("orgChart.graphAria")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("orgChart.note")}
      </p>
    </main>
  );
}
