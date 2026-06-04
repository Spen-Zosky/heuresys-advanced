"use client";

import { useQuery } from "@tanstack/react-query";
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

const EUR = new Intl.NumberFormat("it-IT");

/** Horizontal boxplot: per-OU distribution of band mid_eur (pre-computed 5-number summary). */
function bandingBoxplotOption(rows: CompensationBandingByOuRow[]) {
  const ous = rows.map((r) => r.ou);
  const boxData = rows.map((r) => [r.min, r.q1, r.median, r.q3, r.max]);
  return {
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    tooltip: { trigger: "item" as const },
    xAxis: {
      type: "value" as const,
      name: "€ mid banda",
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
function equityScatterOption(points: CompensationScatterPoint[]) {
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
      name: "€ mid banda",
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "value" as const,
      name: "€ ampiezza banda",
      axisLabel: { color: AXIS_COLOR },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series,
  };
}

export default function CompensationAnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics", "compensation"],
    queryFn: () => apiFetch<CompensationAnalyticsResponse>("/v1/analytics/compensation"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-compensation-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-compensation-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Impossibile caricare le analisi.</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.bandingByOu.length > 0;
  const rangeDesc =
    d.overallMinMidEur !== null && d.overallMaxMidEur !== null
      ? `Min €${EUR.format(d.overallMinMidEur)} · Max €${EUR.format(d.overallMaxMidEur)}`
      : "Nessuna banda nell'ambito";

  return (
    <main data-testid="analytics-compensation-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-compensation-title"
        title="Analisi retributiva"
        description="Distribuzione delle bande retributive (€) per unità organizzativa ed equità delle posizioni nel tuo ambito."
        badges={
          <Badge variant="secondary" data-testid="analytics-compensation-scope">
            Ambito {d.scope.kind}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="compensation-total-profiles">
          <StatsCard
            label="Profili retributivi"
            value={d.totalProfiles}
            icon={<Coins className="h-4 w-4 text-palette-1" />}
            description="Posizioni con banda assegnata"
          />
        </div>
        <div data-testid="compensation-ou-count">
          <StatsCard
            label="Unità organizzative"
            value={d.ouCount}
            icon={<Building2 className="h-4 w-4 text-palette-2" />}
            description="OU con profili retributivi"
          />
        </div>
        <div data-testid="compensation-mid-range">
          <StatsCard
            label="Mediana banda"
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
              Distribuzione bande retributive per unità (mid €)
            </h2>
            <div
              data-testid="analytics-banding-boxplot"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={bandingBoxplotOption(d.bandingByOu)}
                height={Math.max(300, d.bandingByOu.length * 30)}
                ariaLabel="Distribuzione bande retributive per unità organizzativa"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Posizionamento: mid banda vs ampiezza banda
            </h2>
            <div
              data-testid="analytics-equity-scatter"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={equityScatterOption(d.scatter)}
                height={380}
                ariaLabel="Posizionamento retributivo: mid banda vs ampiezza banda"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Ogni punto è una posizione con banda; il colore indica l&apos;unità organizzativa.
            </p>
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-compensation-empty"
          icon={<Coins className="h-6 w-6" />}
          title="Nessun dato"
          description="Non ci sono profili retributivi con banda nel tuo ambito al momento."
        />
      )}
    </main>
  );
}
