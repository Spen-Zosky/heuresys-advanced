"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard } from "@heuresys/ui";
import { Activity, Clock, TrendingUp } from "lucide-react";
import type {
  AttendanceAnalyticsResponse,
  AttendanceByOrgUnitRow,
  AttendanceMonthlyRow,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Brand palette as raw HSL CSS-var refs so the echarts canvas (outside Tailwind's
 *  reach) still follows the active theme tokens — same pattern as workforce/page.tsx. */
const COLOR_PALETTE_1 = "hsl(var(--palette-1))";
const COLOR_PALETTE_2 = "hsl(var(--palette-2))";
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Monthly worked-hours time-series: total + overtime, with a soft area fill. */
function monthlyLineOption(rows: AttendanceMonthlyRow[]) {
  return {
    grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" as const },
    legend: { top: 0, textStyle: { color: AXIS_COLOR } },
    xAxis: {
      type: "category" as const,
      data: rows.map((r) => r.month),
      axisLabel: { color: AXIS_COLOR, rotate: rows.length > 8 ? 30 : 0 },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: "Ore totali",
        type: "line" as const,
        smooth: false,
        data: rows.map((r) => r.totalHours),
        itemStyle: { color: COLOR_PALETTE_1 },
        areaStyle: { color: COLOR_PALETTE_1, opacity: 0.12 },
      },
      {
        name: "Straordinario",
        type: "line" as const,
        smooth: false,
        data: rows.map((r) => r.overtimeHours),
        itemStyle: { color: COLOR_PALETTE_2 },
        areaStyle: { color: COLOR_PALETTE_2, opacity: 0.12 },
      },
    ],
  };
}

/** Horizontal bar: OU → total worked hours, ascending so the largest sits on top. */
function ouBarOption(rows: AttendanceByOrgUnitRow[]) {
  const sorted = [...rows].sort((a, b) => a.totalHours - b.totalHours);
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
        data: sorted.map((r) => r.totalHours),
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

export default function AttendanceAnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics", "attendance"],
    queryFn: () => apiFetch<AttendanceAnalyticsResponse>("/v1/analytics/attendance"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-attendance-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-attendance-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Impossibile caricare le analisi.</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.monthly.length > 0;

  return (
    <main data-testid="analytics-attendance-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-attendance-title"
        title="Analisi presenze"
        description="Ore lavorate (ordinarie e straordinarie) per mese e unità organizzativa nel tuo ambito."
        badges={
          <Badge variant="secondary" data-testid="analytics-attendance-scope">
            Ambito {d.scope.kind}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="attendance-total-hours">
          <StatsCard
            label="Ore totali"
            value={Math.round(d.totalHours)}
            unit="h"
            icon={<Clock className="h-4 w-4 text-palette-1" />}
            description="Ore lavorate, incl. straordinario"
          />
        </div>
        <div data-testid="attendance-total-overtime">
          <StatsCard
            label="Straordinario"
            value={Math.round(d.totalOvertimeHours)}
            unit="h"
            icon={<TrendingUp className="h-4 w-4 text-palette-2" />}
            description="Ore di straordinario registrate"
          />
        </div>
        <div data-testid="attendance-total-regular">
          <StatsCard
            label="Ore ordinarie"
            value={Math.round(d.totalRegularHours)}
            unit="h"
            icon={<Activity className="h-4 w-4 text-palette-3" />}
            description="Ore ordinarie registrate"
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">Ore per mese</h2>
            <div
              data-testid="analytics-attendance-monthly-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={monthlyLineOption(d.monthly)}
                height={320}
                ariaLabel="Ore lavorate per mese"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Asse verticale lineare in ore; eventuali picchi mensili (import massivi) restano in scala reale.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Ore totali per unità organizzativa
            </h2>
            {d.byOrgUnit.length > 0 ? (
              <div
                data-testid="analytics-attendance-ou-chart"
                className="rounded-card border border-border bg-card p-4"
              >
                <EChartsCard
                  option={ouBarOption(d.byOrgUnit)}
                  height={Math.max(280, d.byOrgUnit.length * 26)}
                  ariaLabel="Ore totali per unità organizzativa"
                />
              </div>
            ) : (
              <EmptyState
                data-testid="analytics-attendance-ou-empty"
                icon={<Clock className="h-6 w-6" />}
                title="Nessun dato per unità"
                description="Non ci sono ore registrate per unità organizzativa nel tuo ambito."
              />
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-attendance-empty"
          icon={<Clock className="h-6 w-6" />}
          title="Nessun dato"
          description="Non ci sono presenze registrate nel tuo ambito al momento."
        />
      )}
    </main>
  );
}
