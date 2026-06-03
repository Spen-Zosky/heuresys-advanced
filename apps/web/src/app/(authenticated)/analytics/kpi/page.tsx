"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  EChartsCard,
  EmptyState,
  PageHeader,
  RadialGauge,
  StatsCard,
  echartsPresets,
} from "@heuresys/ui";
import { Gauge, Target } from "lucide-react";
import type { KpiAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

const ICON_CLS = "h-4 w-4";

export default function AnalyticsKpiPage() {
  const q = useQuery({
    queryKey: ["analytics", "kpi"],
    queryFn: () => apiFetch<KpiAnalyticsResponse>("/v1/analytics/kpi"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-kpi-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-kpi-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Impossibile caricare le analisi.</p>
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
    series: [{ name: "Raggiungimento medio %", values: d.byKpi.map((k) => k.avgAchievementPct ?? 0) }],
  });

  const nullCount = d.byKpi.length - scored.length;

  return (
    <main data-testid="analytics-kpi-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        title="Analisi KPI"
        description="Raggiungimento medio dei target KPI nel tuo ambito."
        badges={
          <Badge variant="secondary" data-testid="analytics-kpi-scope">
            Ambito {d.scope.kind}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="kpi-total-targets">
          <StatsCard
            label="Target totali"
            value={d.totalTargets}
            icon={<Target className={`${ICON_CLS} text-palette-1`} />}
          />
        </div>
        <div data-testid="kpi-distinct-kpis">
          <StatsCard
            label="KPI distinti"
            value={d.distinctKpis}
            icon={<Gauge className={`${ICON_CLS} text-palette-2`} />}
          />
        </div>
        <div
          data-testid="analytics-kpi-overall-gauge"
          className="flex items-center justify-center rounded-card border border-border bg-card p-4"
        >
          <RadialGauge
            value={overallAvg ?? 0}
            max={100}
            unit="%"
            label="Raggiungimento medio"
            tone={overallTone}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Raggiungimento medio per KPI
        </h2>
        {d.byKpi.length === 0 ? (
          <EmptyState
            data-testid="analytics-kpi-empty"
            icon={<Gauge className="h-6 w-6" />}
            title="Nessun dato"
            description="Non ci sono target KPI nel tuo ambito al momento."
          />
        ) : (
          <>
            <div data-testid="analytics-kpi-chart">
              <EChartsCard option={barOption} height={360} ariaLabel="Raggiungimento medio per KPI" />
            </div>
            {nullCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {nullCount} KPI senza valore consuntivo mostrati a 0% (n/d).
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
