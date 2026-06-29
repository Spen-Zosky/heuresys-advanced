"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EChartsCard } from "../../_charts-client";

interface VizGraph { graphId: string; name: string; type: string; isActive: boolean }
interface RenderNode { nodeId: string; label: string }
interface RenderEdge { sourceNodeId: string; targetNodeId: string }
interface RenderPayload { graph: { graphId: string; name: string }; nodes: RenderNode[]; edges: RenderEdge[] }
interface MePositions { items: Array<{ positionId: string; isPrimary: boolean }>; total: number }

/** Organigramma personale (S1011 F5.2) — reuses the live ORG_CHART graph, highlights the caller's own node. */
export default function MeOrgChartPage() {
  const { t } = useTranslation("ess");
  const graphs = useQuery({
    queryKey: ["me-org-chart", "graphs"],
    queryFn: () => apiFetch<{ items: VizGraph[]; total: number }>("/v1/visualization-graphs?type=ORG_CHART&limit=10"),
  });
  const graphId = graphs.data?.items[0]?.graphId ?? null;
  const render = useQuery({
    queryKey: ["me-org-chart", "render", graphId],
    queryFn: () => apiFetch<RenderPayload>(`/v1/visualization-graphs/${graphId}/render`),
    enabled: !!graphId,
  });
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<MePositions>("/v1/me/positions"),
  });

  const ownPositionId =
    positions.data?.items.find((p) => p.isPrimary)?.positionId ?? positions.data?.items[0]?.positionId ?? null;
  const nodes = render.data?.nodes ?? [];

  const option = {
    tooltip: { trigger: "item" as const },
    series: [
      {
        type: "graph" as const,
        layout: "force" as const,
        roam: true,
        label: { show: true, position: "right" as const, fontSize: 11, color: "#e2e8f0" },
        force: { repulsion: 60, edgeLength: 80, gravity: 0.08 },
        data: nodes.map((n) => {
          const mine = n.nodeId === ownPositionId;
          return {
            id: n.nodeId, name: n.label,
            symbolSize: mine ? 30 : 14,
            itemStyle: { color: mine ? "#f59e0b" : "#6366f1", borderColor: mine ? "#fbbf24" : undefined, borderWidth: mine ? 3 : 0 },
          };
        }),
        links: (render.data?.edges ?? []).map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId })),
        lineStyle: { color: "#6366f1", opacity: 0.6, curveness: 0.1 },
        emphasis: { focus: "adjacency" as const },
      },
    ],
  };

  return (
    <main data-testid="me-org-chart-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        title={t("orgChart.title")}
        description={t("orgChart.description")}
        badges={
          <span data-testid="me-org-chart-badge" className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t("orgChart.personalView")}
          </span>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>{render.data ? t("orgChart.nodeCount", { count: nodes.length }) : t("orgChart.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {graphs.isLoading || (graphId && render.isLoading) ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common:loading")}</p>
          ) : !graphId ? (
            <p className="p-4 text-sm text-muted-foreground" data-testid="me-org-chart-empty">{t("orgChart.empty")}</p>
          ) : render.isError ? (
            <p className="p-4 text-sm text-danger" data-testid="me-org-chart-error">{t("orgChart.error")}</p>
          ) : nodes.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground" data-testid="me-org-chart-nodes-empty">{t("orgChart.noNodes")}</p>
          ) : (
            <div data-testid="me-org-chart-graph">
              <EChartsCard option={option} height={520} ariaLabel={t("orgChart.graphAria")} />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
