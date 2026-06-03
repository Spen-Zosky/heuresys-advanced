"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard } from "@heuresys/ui";
import { Building2, TrendingUp, Users } from "lucide-react";
import type { WorkforceAnalyticsResponse, WorkforceByDimensionRow } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Brand palette colors as raw HSL CSS-var references so the echarts canvas
 *  (which is outside Tailwind's reach) still follows the active theme tokens. */
const COLOR_PALETTE_1 = "hsl(var(--palette-1))";
const COLOR_PALETTE_2 = "hsl(var(--palette-2))";
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Horizontal bar option: dimension (OU) → headcount, sorted ascending so the
 *  largest bar sits on top (echarts yAxis category renders bottom-up). */
function horizontalBarOption(rows: WorkforceByDimensionRow[]) {
  const sorted = [...rows].sort((a, b) => a.headcount - b.headcount);
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
      data: sorted.map((r) => r.dimension),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((r) => r.headcount),
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 28,
      },
    ],
  };
}

/** Vertical bar option: dimension (job role) → headcount, sorted descending. */
function verticalBarOption(rows: WorkforceByDimensionRow[]) {
  const sorted = [...rows].sort((a, b) => b.headcount - a.headcount);
  return {
    grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    xAxis: {
      type: "category" as const,
      data: sorted.map((r) => r.dimension),
      axisLabel: { color: AXIS_COLOR, interval: 0, rotate: sorted.length > 6 ? 30 : 0 },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((r) => r.headcount),
        itemStyle: { color: COLOR_PALETTE_2, borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  };
}

export default function WorkforceAnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics", "workforce"],
    queryFn: () => apiFetch<WorkforceAnalyticsResponse>("/v1/analytics/workforce"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-workforce-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-workforce-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Impossibile caricare le analisi.</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.byOrgUnit.length > 0;

  return (
    <main data-testid="analytics-workforce-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-workforce-title"
        title="Analisi Forza Lavoro"
        description="Distribuzione dell'headcount per unità organizzativa e ruolo nel tuo ambito."
        badges={
          <Badge variant="secondary" data-testid="analytics-workforce-scope">
            Ambito {d.scope.kind}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="workforce-total">
          <StatsCard
            label="Headcount totale"
            value={d.totalHeadcount}
            icon={<Users className="h-4 w-4 text-palette-2" />}
            description="Persone nel tuo ambito"
          />
        </div>
        <StatsCard
          label="Unità organizzative"
          value={d.byOrgUnit.length}
          icon={<Building2 className="h-4 w-4 text-palette-1" />}
          description="OU con headcount"
        />
        <StatsCard
          label="Ruoli"
          value={d.byJobRole.length}
          icon={<TrendingUp className="h-4 w-4 text-palette-3" />}
          description="Ruoli distinti coperti"
        />
      </section>

      {hasData ? (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Headcount per unità organizzativa
            </h2>
            <div data-testid="analytics-org-chart" className="rounded-card border border-border bg-card p-4">
              <EChartsCard
                option={horizontalBarOption(d.byOrgUnit)}
                height={Math.max(240, d.byOrgUnit.length * 34)}
                ariaLabel="Headcount per unità organizzativa"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Headcount per ruolo
            </h2>
            {d.byJobRole.length > 0 ? (
              <div data-testid="analytics-role-chart" className="rounded-card border border-border bg-card p-4">
                <EChartsCard
                  option={verticalBarOption(d.byJobRole)}
                  height={320}
                  ariaLabel="Headcount per ruolo"
                />
              </div>
            ) : (
              <EmptyState
                data-testid="analytics-role-empty"
                icon={<TrendingUp className="h-6 w-6" />}
                title="Nessun dato sui ruoli"
                description="Non ci sono ruoli con headcount nel tuo ambito."
              />
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-workforce-empty"
          icon={<Users className="h-6 w-6" />}
          title="Nessun dato"
          description="Non ci sono dati sulla forza lavoro nel tuo ambito al momento."
        />
      )}
    </main>
  );
}
