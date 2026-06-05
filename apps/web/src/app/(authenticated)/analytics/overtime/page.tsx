"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard, formatCurrency } from "@heuresys/ui";
import { ClipboardList, Clock, Euro } from "lucide-react";
import type {
  OvertimeAnalyticsResponse,
  OvertimeByOrgUnitRow,
  OvertimeByStatusRow,
  OvertimeByTypeRow,
  OvertimeMonthlyRow,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

/** Brand palette as raw HSL CSS-var refs so the echarts canvas (outside Tailwind's
 *  reach) follows the active theme tokens — same pattern as attendance/page.tsx. */
const COLOR_PALETTE_1 = "hsl(var(--palette-1))";
const COLOR_SERIES = [
  "hsl(var(--palette-1))",
  "hsl(var(--palette-2))",
  "hsl(var(--palette-3))",
  "hsl(var(--palette-4))",
];
const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Donut of request counts by status. `data` carries already-translated names. */
function statusDonutOption(data: Array<{ name: string; value: number }>) {
  return {
    color: COLOR_SERIES,
    tooltip: { trigger: "item" as const },
    legend: { bottom: 0, textStyle: { color: AXIS_COLOR } },
    series: [
      {
        type: "pie" as const,
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: GRID_COLOR, borderWidth: 1 },
        label: { color: AXIS_COLOR },
        data,
      },
    ],
  };
}

/** Horizontal bar of request counts by type, ascending so the largest sits on top.
 *  `data` carries already-translated names. */
function typeBarOption(data: Array<{ name: string; value: number }>) {
  const sorted = [...data].sort((a, b) => a.value - b.value);
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
      data: sorted.map((r) => r.name),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        type: "bar" as const,
        data: sorted.map((r) => r.value),
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

/** Monthly requested-hours time-series with a soft area fill. */
function monthlyLineOption(rows: OvertimeMonthlyRow[], label: string) {
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
        name: label,
        type: "line" as const,
        smooth: false,
        data: rows.map((r) => r.hours),
        itemStyle: { color: COLOR_PALETTE_1 },
        areaStyle: { color: COLOR_PALETTE_1, opacity: 0.12 },
      },
    ],
  };
}

/** Horizontal bar: OU → requested hours, ascending so the largest sits on top. */
function ouBarOption(rows: OvertimeByOrgUnitRow[]) {
  const sorted = [...rows].sort((a, b) => a.hours - b.hours);
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
        data: sorted.map((r) => r.hours),
        itemStyle: { color: COLOR_PALETTE_1, borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 22,
      },
    ],
  };
}

export default function OvertimeAnalyticsPage() {
  const { t, i18n } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "overtime"],
    queryFn: () => apiFetch<OvertimeAnalyticsResponse>("/v1/analytics/overtime"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-overtime-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-overtime-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">{t("error")}</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.totalRequests > 0;
  const locale = i18n.language === "it" ? "it-IT" : "en-US";

  // Translate enum labels at render time (i18n is a hook) before handing them to ECharts.
  const statusName = (r: OvertimeByStatusRow) => t(`overtime.status.${r.status}`);
  const typeName = (r: OvertimeByTypeRow) => t(`overtime.types.${r.type}`);

  return (
    <main data-testid="analytics-overtime-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-overtime-title"
        title={t("overtime.title")}
        description={t("overtime.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-overtime-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="overtime-total-requests">
          <StatsCard
            label={t("overtime.stats.requestsLabel")}
            value={d.totalRequests}
            icon={<ClipboardList className="h-4 w-4 text-palette-1" />}
            description={t("overtime.stats.requestsDesc")}
          />
        </div>
        <div data-testid="overtime-total-hours">
          <StatsCard
            label={t("overtime.stats.hoursLabel")}
            value={Math.round(d.totalHours)}
            unit="h"
            icon={<Clock className="h-4 w-4 text-palette-2" />}
            description={t("overtime.stats.hoursDesc")}
          />
        </div>
        <div data-testid="overtime-total-comp">
          <StatsCard
            label={t("overtime.stats.compLabel")}
            value={formatCurrency(d.totalCompensationEur ?? 0, "EUR", locale)}
            icon={<Euro className="h-4 w-4 text-palette-3" />}
            description={t("overtime.stats.compDesc")}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {t("overtime.statusTitle")}
              </h2>
              <div
                data-testid="analytics-overtime-status-chart"
                className="rounded-card border border-border bg-card p-4"
              >
                <EChartsCard
                  option={statusDonutOption(
                    d.byStatus.map((r) => ({ name: statusName(r), value: r.count })),
                  )}
                  height={320}
                  ariaLabel={t("overtime.statusAria")}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {t("overtime.typeTitle")}
              </h2>
              <div
                data-testid="analytics-overtime-type-chart"
                className="rounded-card border border-border bg-card p-4"
              >
                <EChartsCard
                  option={typeBarOption(
                    d.byType.map((r) => ({ name: typeName(r), value: r.count })),
                  )}
                  height={320}
                  ariaLabel={t("overtime.typeAria")}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("overtime.monthlyTitle")}
            </h2>
            <div
              data-testid="analytics-overtime-monthly-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={monthlyLineOption(d.monthly, t("overtime.seriesHours"))}
                height={320}
                ariaLabel={t("overtime.monthlyAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("overtime.monthlyNote")}</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("overtime.ouTitle")}
            </h2>
            {d.byOrgUnit.length > 0 ? (
              <div
                data-testid="analytics-overtime-ou-chart"
                className="rounded-card border border-border bg-card p-4"
              >
                <EChartsCard
                  option={ouBarOption(d.byOrgUnit)}
                  height={Math.max(280, d.byOrgUnit.length * 26)}
                  ariaLabel={t("overtime.ouAria")}
                />
              </div>
            ) : (
              <EmptyState
                data-testid="analytics-overtime-ou-empty"
                icon={<Clock className="h-6 w-6" />}
                title={t("overtime.ouEmptyTitle")}
                description={t("overtime.ouEmptyDesc")}
              />
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-overtime-empty"
          icon={<ClipboardList className="h-6 w-6" />}
          title={t("empty.title")}
          description={t("overtime.emptyDesc")}
        />
      )}
    </main>
  );
}
