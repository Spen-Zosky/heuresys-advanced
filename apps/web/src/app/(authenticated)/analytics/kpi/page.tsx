"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, RadialGauge, echartsPresets } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatsCard } from "@/components/indicatori-leggibili";
import { Gauge, Target } from "lucide-react";
import { EChartsCard } from "../../_charts-client";
import type { KpiAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

const ICON_CLS = "h-4 w-4";

export default function AnalyticsKpiPage() {
  const { t } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "kpi"],
    queryFn: () => apiFetch<KpiAnalyticsResponse>("/v1/analytics/kpi"),
  });

  if (q.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-8">
        <StatoCaricamento testId="analytics-kpi-loading" />
      </main>
    );
  }
  if (q.isError) {
    return (
      <main className="mx-auto max-w-7xl px-6 pb-8">
        <StatoErrore errore={q.error} titolo={t("error")} testId="analytics-kpi-error" onRiprova={() => void q.refetch()} />
      </main>
    );
  }

  const d = q.data!;

  // Overall average achievement = mean of the non-null per-KPI averages (live data only).
  const scored = d.byKpi.filter((k): k is typeof k & { avgAchievementPct: number } => k.avgAchievementPct !== null);
  const overallAvg =
    scored.length > 0 ? scored.reduce((acc, k) => acc + k.avgAchievementPct, 0) / scored.length : null;
  const overallTone: "success" | "warning" | "destructive" =
    overallAvg === null ? "warning" : overallAvg >= 100 ? "success" : overallAvg >= 70 ? "warning" : "destructive";

  // Bar option: per-KPI average achievement; null achievements rendered as 0
  // (annotated by the "n/d" note below the chart), so the bar set stays complete.
  const barOption = echartsPresets.bar({
    x: d.byKpi.map((k) => k.kpiName),
    series: [{ name: t("kpi.series"), values: d.byKpi.map((k) => k.avgAchievementPct ?? 0) }],
  });

  const nullCount = d.byKpi.length - scored.length;

  return (
    <main data-testid="analytics-kpi-page" className="mx-auto max-w-7xl space-y-8 px-6 pb-8">
      <PageHeader
        title={t("kpi.title")}
        description={t("kpi.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-kpi-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="kpi-total-targets">
          <StatsCard
            label={t("kpi.stats.targetsLabel")}
            value={d.totalTargets}
            icon={<Target className={`${ICON_CLS} text-palette-1`} />}
          />
        </div>
        <div data-testid="kpi-distinct-kpis">
          <StatsCard
            label={t("kpi.stats.distinctLabel")}
            value={d.distinctKpis}
            icon={<Gauge className={`${ICON_CLS} text-palette-2`} />}
          />
        </div>
        <div
          data-testid="analytics-kpi-overall-gauge"
          className="flex items-center justify-center rounded-card border border-border bg-card p-4"
        >
          <RadialGauge
            value={overallAvg === null ? 0 : Math.round(overallAvg)}
            max={100}
            unit="%"
            label={t("kpi.gaugeLabel")}
            tone={overallTone}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {t("kpi.chartTitle")}
        </h2>
        {d.byKpi.length === 0 ? (
          <StatoVuoto
            testId="analytics-kpi-empty"
            icona={<Gauge className="h-6 w-6" />}
            titolo={t("empty.title")}
            motivo={t("kpi.emptyDesc")}
          />
        ) : (
          <>
            <div data-testid="analytics-kpi-chart">
              <EChartsCard option={barOption} height={360} ariaLabel={t("kpi.chartTitle")} />
            </div>
            {nullCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("kpi.nullNote", { count: nullCount })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
