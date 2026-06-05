"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard } from "@heuresys/ui";
import { GitBranch, Layers, Network, Sigma, Users } from "lucide-react";
import type {
  OrgNetworkAnalyticsResponse,
  OrgNetworkDepthRow,
  OrgNetworkReachRow,
  OrgNetworkSpanRow,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Brand palette as raw HSL CSS-var refs so the echarts canvas (outside Tailwind's
 *  reach) still follows the active theme tokens — same pattern as attendance/page.tsx. */
const COLOR_PALETTE_1 = "hsl(var(--palette-1))";
const COLOR_PALETTE_2 = "hsl(var(--palette-2))";
const COLOR_PALETTE_3 = "hsl(var(--palette-3))";
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Vertical bar: hierarchy level (x) → position count (y). Depth label is passed in
 *  already-translated (i18n is a render-time hook). */
function depthBarOption(rows: OrgNetworkDepthRow[], seriesName: string) {
  return {
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => String(r.depth)),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: seriesName,
        type: "bar" as const,
        data: rows.map((r) => r.positionCount),
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  };
}

/** Horizontal bar: position title → direct reports, ascending so the largest sits on top. */
function spanBarOption(rows: OrgNetworkSpanRow[], seriesName: string) {
  const sorted = [...rows].sort((a, b) => a.directReports - b.directReports);
  return {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "value" as const,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((r) => r.positionTitle),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: seriesName,
        type: "bar" as const,
        data: sorted.map((r) => r.directReports),
        itemStyle: { color: COLOR_PALETTE_2, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

/** Horizontal bar: position title → transitive reach, ascending so the largest sits on top. */
function reachBarOption(rows: OrgNetworkReachRow[], seriesName: string) {
  const sorted = [...rows].sort((a, b) => a.reach - b.reach);
  return {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "value" as const,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "category" as const,
      data: sorted.map((r) => r.positionTitle),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: seriesName,
        type: "bar" as const,
        data: sorted.map((r) => r.reach),
        itemStyle: { color: COLOR_PALETTE_3, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

export default function OrgNetworkAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "org-network"],
    queryFn: () => apiFetch<OrgNetworkAnalyticsResponse>("/v1/analytics/org-network"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-org-network-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-org-network-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">{t("error")}</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.totalPositions > 0;

  return (
    <main data-testid="analytics-org-network-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-org-network-title"
        title={t("orgNetwork.title")}
        description={t("orgNetwork.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-org-network-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="org-network-total-positions">
          <StatsCard
            label={t("orgNetwork.stats.positionsLabel")}
            value={d.totalPositions}
            icon={<Network className="h-4 w-4 text-palette-1" />}
            description={t("orgNetwork.stats.positionsDesc")}
          />
        </div>
        <StatsCard
          label={t("orgNetwork.stats.rootsLabel")}
          value={d.rootPositions}
          icon={<GitBranch className="h-4 w-4 text-palette-2" />}
          description={t("orgNetwork.stats.rootsDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.managersLabel")}
          value={d.managersCount}
          icon={<Users className="h-4 w-4 text-palette-3" />}
          description={t("orgNetwork.stats.managersDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.spanLabel")}
          value={d.avgSpanOfControl ?? 0}
          icon={<Sigma className="h-4 w-4 text-palette-1" />}
          description={t("orgNetwork.stats.spanDesc")}
        />
        <StatsCard
          label={t("orgNetwork.stats.depthLabel")}
          value={d.maxDepth}
          icon={<Layers className="h-4 w-4 text-palette-2" />}
          description={t("orgNetwork.stats.depthDesc")}
        />
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("orgNetwork.depthTitle")}
            </h2>
            <div
              data-testid="analytics-org-network-depth-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={depthBarOption(d.byDepth, t("orgNetwork.stats.positionsLabel"))}
                height={320}
                ariaLabel={t("orgNetwork.depthAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("orgNetwork.depthNote")}</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {t("orgNetwork.spanTitle")}
              </h2>
              {d.topSpan.length > 0 ? (
                <div
                  data-testid="analytics-org-network-span-chart"
                  className="rounded-card border border-border bg-card p-4"
                >
                  <EChartsCard
                    option={spanBarOption(d.topSpan, t("orgNetwork.seriesDirectReports"))}
                    height={Math.max(280, d.topSpan.length * 26)}
                    ariaLabel={t("orgNetwork.spanAria")}
                  />
                </div>
              ) : (
                <EmptyState
                  data-testid="analytics-org-network-span-empty"
                  icon={<Users className="h-6 w-6" />}
                  title={t("orgNetwork.spanEmptyTitle")}
                  description={t("orgNetwork.spanEmptyDesc")}
                />
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {t("orgNetwork.reachTitle")}
              </h2>
              {d.topReach.length > 0 ? (
                <div
                  data-testid="analytics-org-network-reach-chart"
                  className="rounded-card border border-border bg-card p-4"
                >
                  <EChartsCard
                    option={reachBarOption(d.topReach, t("orgNetwork.seriesReach"))}
                    height={Math.max(280, d.topReach.length * 26)}
                    ariaLabel={t("orgNetwork.reachAria")}
                  />
                </div>
              ) : (
                <EmptyState
                  data-testid="analytics-org-network-reach-empty"
                  icon={<Network className="h-6 w-6" />}
                  title={t("orgNetwork.spanEmptyTitle")}
                  description={t("orgNetwork.spanEmptyDesc")}
                />
              )}
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-org-network-empty"
          icon={<Network className="h-6 w-6" />}
          title={t("empty.title")}
          description={t("orgNetwork.emptyDesc")}
        />
      )}
    </main>
  );
}
