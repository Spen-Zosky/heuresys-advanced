"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { MeAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EChartsCard } from "../../_charts-client";

/** Le mie analisi (S1011 F5.1) — own attendance trend + summary KPIs. */
export default function MeAnalyticsPage() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "analytics"],
    queryFn: () => apiFetch<MeAnalyticsResponse>("/v1/me/analytics"),
  });

  const trend = q.data?.attendanceTrend ?? [];
  const trendOption = {
    tooltip: { trigger: "axis" as const },
    legend: { data: [t("analytics.regular"), t("analytics.overtime")], textStyle: { color: "#94a3b8" } },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: "category" as const, data: trend.map((m) => m.month), axisLabel: { color: "#94a3b8" } },
    yAxis: { type: "value" as const, axisLabel: { color: "#94a3b8" } },
    series: [
      { name: t("analytics.regular"), type: "bar" as const, stack: "h", data: trend.map((m) => m.regularHours), itemStyle: { color: "#6366f1" } },
      { name: t("analytics.overtime"), type: "bar" as const, stack: "h", data: trend.map((m) => m.overtimeHours), itemStyle: { color: "#f59e0b" } },
    ],
  };

  const s = q.data?.summary;
  const kpis = [
    { key: "goals", value: s?.goalsCount },
    { key: "skills", value: s?.skillsCount },
    { key: "performance", value: s?.latestPerformanceRating != null ? s.latestPerformanceRating.toFixed(1) : "—" },
    { key: "leave", value: s?.leaveBalanceDays != null ? s.leaveBalanceDays.toString() : "—" },
  ];

  return (
    <main data-testid="me-analytics-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader title={t("analytics.title")} description={t("analytics.description")} />

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
      ) : q.isError || !q.data ? (
        <p className="text-sm text-danger" data-testid="me-analytics-error">{t("analytics.error")}</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="analytics-summary">
            {kpis.map((k) => (
              <Card key={k.key} data-testid={`analytics-kpi-${k.key}`}>
                <CardContent className="p-5">
                  <div className="text-2xl font-semibold tabular-nums">{k.value ?? "—"}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t(`analytics.kpi.${k.key}`)}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader><CardTitle>{t("analytics.trendTitle")}</CardTitle></CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground" data-testid="analytics-trend-empty">{t("analytics.trendEmpty")}</p>
              ) : (
                <div data-testid="analytics-trend">
                  <EChartsCard option={trendOption} height={360} ariaLabel={t("analytics.trendAria")} />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
