"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { MeAnalyticsResponse, MeDevelopmentResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EChartsCard } from "../../_charts-client";

/** Le mie analisi (S1011 F5.1) — own attendance trend + summary KPIs.
 *  #59 F/F5 (ADR-0031): + "Il mio sviluppo" — own computed scores with
 *  evidence, coach framing (supersedes D-6). */
export default function MeAnalyticsPage() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "analytics"],
    queryFn: () => apiFetch<MeAnalyticsResponse>("/v1/me/analytics"),
  });
  const dev = useQuery({
    queryKey: ["me", "development"],
    queryFn: () => apiFetch<MeDevelopmentResponse>("/v1/me/development"),
  });

  const trend = q.data?.attendanceTrend ?? [];
  const trendOption = {
    tooltip: { trigger: "axis" as const },
    legend: { data: [t("analytics.regular"), t("analytics.overtime")], textStyle: { color: "hsl(var(--muted-foreground))" } },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: "category" as const, data: trend.map((m) => m.month), axisLabel: { color: "hsl(var(--muted-foreground))" } },
    yAxis: { type: "value" as const, axisLabel: { color: "hsl(var(--muted-foreground))" } },
    series: [
      { name: t("analytics.regular"), type: "bar" as const, stack: "h", data: trend.map((m) => m.regularHours), itemStyle: { color: "hsl(var(--palette-1))" } },
      { name: t("analytics.overtime"), type: "bar" as const, stack: "h", data: trend.map((m) => m.overtimeHours), itemStyle: { color: "hsl(var(--palette-4))" } },
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

          {/* #59 F/F5 (ADR-0031) — il mio sviluppo: score calcolati + evidenze */}
          <section data-testid="me-development" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t("analytics.development.title")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("analytics.development.description")}</p>
            </div>
            {dev.isLoading ? (
              <p className="text-sm text-muted-foreground">{t("common:loading")}</p>
            ) : !dev.data || (!dev.data.flightRisk && !dev.data.capability) ? (
              <p className="text-sm text-muted-foreground" data-testid="me-development-empty">
                {t("analytics.development.empty")}
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {dev.data.capability && (
                  <Card data-testid="me-development-capability">
                    <CardHeader><CardTitle>{t("analytics.development.capabilityTitle")}</CardTitle></CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="text-3xl font-semibold tabular-nums">
                        {dev.data.capability.value.toFixed(1)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dev.data.capability.coverage != null &&
                          `${(dev.data.capability.coverage * 100).toFixed(0)}% ${t("analytics.development.capabilityCoverage")} · `}
                        {t("analytics.development.computedAt")}{" "}
                        {new Date(dev.data.capability.computedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {dev.data.flightRisk && (
                  <Card data-testid="me-development-stability">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {t("analytics.development.flightTitle")}
                        <Badge variant={dev.data.flightRisk.band === "HIGH" ? "destructive" : "secondary"}>
                          {dev.data.flightRisk.value.toFixed(1)}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                      <p className="text-xs text-muted-foreground">{t("analytics.development.flightHint")}</p>
                      <div>
                        <h3 className="text-sm font-medium text-foreground">{t("analytics.development.factors")}</h3>
                        <table className="mt-2 w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground">
                              <th className="py-1 font-medium">{t("analytics.development.factorFeature")}</th>
                              <th className="py-1 font-medium">{t("analytics.development.factorWeight")}</th>
                              <th className="py-1 font-medium">{t("analytics.development.factorValue")}</th>
                              <th className="py-1 font-medium">{t("analytics.development.factorContribution")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dev.data.flightRisk.factors.map((f) => (
                              <tr key={f.feature} className="border-t border-border">
                                <td className="py-1.5">
                                  {t(`analytics.development.feature.${f.feature}`, { defaultValue: f.feature })}
                                </td>
                                <td className="py-1.5 tabular-nums">{(f.weight * 100).toFixed(0)}%</td>
                                <td className="py-1.5 tabular-nums">{f.normalized ?? "—"}</td>
                                <td className="py-1.5 tabular-nums">{f.contribution.toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
