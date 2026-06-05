"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard } from "@heuresys/ui";
import { Building2, Coins, Scale } from "lucide-react";
import type {
  CompensationAnalyticsResponse,
  CompensationBandingByOuRow,
  CompensationScatterPoint,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Brand palette as raw HSL CSS-var refs so the echarts canvas follows the theme. */
const COLOR_PALETTE_1 = "hsl(var(--palette-1))";
const COLOR_PALETTE_2 = "hsl(var(--palette-2))";
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";
const PALETTE = [1, 2, 3, 4, 5, 6].map((n) => `hsl(var(--palette-${n}))`);

/** Horizontal boxplot: per-OU distribution of band mid_eur (pre-computed 5-number summary). */
function bandingBoxplotOption(rows: CompensationBandingByOuRow[], midAxisLabel: string) {
  const ous = rows.map((r) => r.ou);
  const boxData = rows.map((r) => [r.min, r.q1, r.median, r.q3, r.max]);
  return {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "item" as const },
    xAxis: {
      type: "value" as const,
      name: midAxisLabel,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "category" as const,
      data: ous,
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        type: "boxplot" as const,
        data: boxData,
        itemStyle: { color: COLOR_PALETTE_1, borderColor: COLOR_PALETTE_2 },
      },
    ],
  };
}

/** Scatter: mid_eur (x) vs band spread max-min (y), one series per OU (color-coded). */
function equityScatterOption(
  points: CompensationScatterPoint[],
  axisLabels: { mid: string; spread: string },
) {
  const byOu = new Map<string, CompensationScatterPoint[]>();
  for (const p of points) {
    const arr = byOu.get(p.ou) ?? [];
    arr.push(p);
    byOu.set(p.ou, arr);
  }
  const series = [...byOu.entries()].map(([ou, pts], i) => ({
    name: ou,
    type: "scatter" as const,
    symbolSize: 10,
    itemStyle: { color: PALETTE[i % PALETTE.length] },
    data: pts.map((p) => [p.midEur, p.spreadEur]),
  }));
  return {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: "item" as const },
    legend: { type: "scroll" as const, textStyle: { color: AXIS_COLOR } },
    xAxis: {
      type: "value" as const,
      name: axisLabels.mid,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      name: axisLabels.spread,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series,
  };
}

export default function CompensationAnalyticsPage() {
  const { t, i18n } = useTranslation("analytics");
  // €-grouping follows the active UI locale (en-US vs it-IT); the currency itself stays € (data region).
  const EUR = useMemo(
    () => new Intl.NumberFormat(i18n.language === "en" ? "en-US" : "it-IT"),
    [i18n.language],
  );
  const q = useQuery({
    queryKey: ["analytics", "compensation"],
    queryFn: () => apiFetch<CompensationAnalyticsResponse>("/v1/analytics/compensation"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-compensation-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-compensation-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">{t("error")}</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.bandingByOu.length > 0;
  const rangeDesc =
    d.overallMinMidEur !== null && d.overallMaxMidEur !== null
      ? t("compensation.range", {
          min: EUR.format(d.overallMinMidEur),
          max: EUR.format(d.overallMaxMidEur),
        })
      : t("compensation.rangeEmpty");

  return (
    <main data-testid="analytics-compensation-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-compensation-title"
        title={t("compensation.title")}
        description={t("compensation.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-compensation-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="compensation-total-profiles">
          <StatsCard
            label={t("compensation.stats.profilesLabel")}
            value={d.totalProfiles}
            icon={<Coins className="h-4 w-4 text-palette-1" />}
            description={t("compensation.stats.profilesDesc")}
          />
        </div>
        <div data-testid="compensation-ou-count">
          <StatsCard
            label={t("compensation.stats.ouLabel")}
            value={d.ouCount}
            icon={<Building2 className="h-4 w-4 text-palette-2" />}
            description={t("compensation.stats.ouDesc")}
          />
        </div>
        <div data-testid="compensation-mid-range">
          <StatsCard
            label={t("compensation.stats.medianLabel")}
            value={Math.round(d.overallMedianMidEur ?? 0)}
            unit="€"
            icon={<Scale className="h-4 w-4 text-palette-3" />}
            description={rangeDesc}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("compensation.boxplotTitle")}
            </h2>
            <div
              data-testid="analytics-banding-boxplot"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={bandingBoxplotOption(d.bandingByOu, t("compensation.axisMid"))}
                height={Math.max(300, d.bandingByOu.length * 30)}
                ariaLabel={t("compensation.boxplotAria")}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("compensation.scatterTitle")}
            </h2>
            <div
              data-testid="analytics-equity-scatter"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={equityScatterOption(d.scatter, {
                  mid: t("compensation.axisMid"),
                  spread: t("compensation.axisSpread"),
                })}
                height={380}
                ariaLabel={t("compensation.scatterAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("compensation.scatterNote")}
            </p>
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-compensation-empty"
          icon={<Coins className="h-6 w-6" />}
          title={t("empty.title")}
          description={t("compensation.emptyDesc")}
        />
      )}
    </main>
  );
}
