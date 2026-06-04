"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

/** Monthly worked-hours time-series: total + overtime, with a soft area fill.
 *  Series legend labels are passed in already-translated (i18n is a render-time hook). */
function monthlyLineOption(rows: AttendanceMonthlyRow[], labels: { total: string; overtime: string }) {
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
        name: labels.total,
        type: "line" as const,
        smooth: false,
        data: rows.map((r) => r.totalHours),
        itemStyle: { color: COLOR_PALETTE_1 },
        areaStyle: { color: COLOR_PALETTE_1, opacity: 0.12 },
      },
      {
        name: labels.overtime,
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
  const { t } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "attendance"],
    queryFn: () => apiFetch<AttendanceAnalyticsResponse>("/v1/analytics/attendance"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-attendance-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-attendance-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">{t("error")}</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.monthly.length > 0;

  return (
    <main data-testid="analytics-attendance-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-attendance-title"
        title={t("attendance.title")}
        description={t("attendance.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-attendance-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="attendance-total-hours">
          <StatsCard
            label={t("attendance.stats.totalLabel")}
            value={Math.round(d.totalHours)}
            unit="h"
            icon={<Clock className="h-4 w-4 text-palette-1" />}
            description={t("attendance.stats.totalDesc")}
          />
        </div>
        <div data-testid="attendance-total-overtime">
          <StatsCard
            label={t("attendance.stats.overtimeLabel")}
            value={Math.round(d.totalOvertimeHours)}
            unit="h"
            icon={<TrendingUp className="h-4 w-4 text-palette-2" />}
            description={t("attendance.stats.overtimeDesc")}
          />
        </div>
        <div data-testid="attendance-total-regular">
          <StatsCard
            label={t("attendance.stats.regularLabel")}
            value={Math.round(d.totalRegularHours)}
            unit="h"
            icon={<Activity className="h-4 w-4 text-palette-3" />}
            description={t("attendance.stats.regularDesc")}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">{t("attendance.monthlyTitle")}</h2>
            <div
              data-testid="analytics-attendance-monthly-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={monthlyLineOption(d.monthly, {
                  total: t("attendance.seriesTotal"),
                  overtime: t("attendance.seriesOvertime"),
                })}
                height={320}
                ariaLabel={t("attendance.monthlyAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("attendance.monthlyNote")}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("attendance.ouTitle")}
            </h2>
            {d.byOrgUnit.length > 0 ? (
              <div
                data-testid="analytics-attendance-ou-chart"
                className="rounded-card border border-border bg-card p-4"
              >
                <EChartsCard
                  option={ouBarOption(d.byOrgUnit)}
                  height={Math.max(280, d.byOrgUnit.length * 26)}
                  ariaLabel={t("attendance.ouTitle")}
                />
              </div>
            ) : (
              <EmptyState
                data-testid="analytics-attendance-ou-empty"
                icon={<Clock className="h-6 w-6" />}
                title={t("attendance.ouEmptyTitle")}
                description={t("attendance.ouEmptyDesc")}
              />
            )}
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-attendance-empty"
          icon={<Clock className="h-6 w-6" />}
          title={t("empty.title")}
          description={t("attendance.emptyDesc")}
        />
      )}
    </main>
  );
}
