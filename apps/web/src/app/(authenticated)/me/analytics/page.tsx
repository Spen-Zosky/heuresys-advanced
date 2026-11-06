"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { MeAnalyticsResponse, MeDevelopmentResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EChartsCard } from "../../_charts-client";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

/** Le mie analisi (S1011 F5.1) — own attendance trend + summary KPIs.
 *  #59 F/F5 (ADR-0031): + "Il mio sviluppo" — own computed scores with
 *  evidence, coach framing (supersedes D-6). */
export default function MeAnalyticsPage() {
  const { t, i18n } = useTranslation("ess");
  const fmt = useFormat();
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
    grid: { left: 64, right: 16, top: 32, bottom: 48 },
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
    { key: "performance", value: s?.latestPerformanceRating != null ? fmt.numeroFisso(s.latestPerformanceRating, 1) : "—" },
    { key: "leave", value: s?.leaveBalanceDays != null ? s.leaveBalanceDays.toString() : "—" },
  ];

  return (
    <main data-testid="me-analytics-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader title={t("analytics.title")} description={t("analytics.description")} />

      {q.isLoading ? (
        <StatoCaricamento />
      ) : q.isError || !q.data ? (
        <StatoErrore errore={q.error} titolo={t("analytics.error")} testId="me-analytics-error" onRiprova={() => void q.refetch()} />
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
                  <EChartsCard
                    option={trendOption}
                    height={360}
                    ariaLabel={t("analytics.trendAria")}
                    assi={{ x: t("analytics.axisMonth"), y: t("analytics.axisHours") }}
                    lingua={i18n.language}
                    tabella={{
                      titolo: t("analytics.tableTitle"),
                      colonne: [t("analytics.axisMonth"), t("analytics.regular"), t("analytics.overtime")],
                      righe: trend.map((m) => [m.month, m.regularHours, m.overtimeHours]),
                    }}
                  />
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
              <StatoCaricamento />
            ) : !dev.data || (!dev.data.flightRisk && !dev.data.capability) ? (
              <StatoVuoto titolo={t("analytics.development.empty")} testId="me-development-empty" />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {dev.data.capability && (
                  <Card data-testid="me-development-capability">
                    <CardHeader><CardTitle>{t("analytics.development.capabilityTitle")}</CardTitle></CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="text-3xl font-semibold tabular-nums">
                        {fmt.numeroFisso(dev.data.capability.value, 1)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dev.data.capability.coverage != null &&
                          `${fmt.percento(dev.data.capability.coverage, "0-1", 0)} ${t("analytics.development.capabilityCoverage")} · `}
                        {t("analytics.development.computedAt")}{" "}
                        {fmt.data(dev.data.capability.computedAt)}
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
                          {fmt.numeroFisso(dev.data.flightRisk.value, 1)}
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
                                <td className="py-1.5 tabular-nums">{fmt.percento(f.weight, "0-1", 0)}</td>
                                <td className="py-1.5 tabular-nums">{f.normalized ?? "—"}</td>
                                <td className="py-1.5 tabular-nums">{fmt.numeroFisso(f.contribution, 1)}</td>
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
