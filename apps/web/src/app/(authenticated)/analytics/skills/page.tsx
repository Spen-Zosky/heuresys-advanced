"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard, echartsPresets } from "@heuresys/ui";
import { Building2, GraduationCap, Users } from "lucide-react";
import type { SkillsCoverageAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Coverage heatmap: OU (rows) × proficiency (cols) → evidence count. Sparse by
 *  design — missing [x,y] pairs render blank (no zero triples emitted). */
function coverageHeatmapOption(d: SkillsCoverageAnalyticsResponse) {
  const x = d.proficiencyLevels;
  const y = d.orgUnits;
  const values = d.cells.map((c) => [x.indexOf(c.proficiency), y.indexOf(c.orgUnit), c.evidenceCount]);
  const maxV = values.reduce((m, v) => Math.max(m, v[2] ?? 0), 0);
  return {
    grid: { left: 8, right: 16, top: 12, bottom: 64, containLabel: true },
    tooltip: { position: "top" as const },
    xAxis: {
      type: "category" as const,
      data: x,
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category" as const,
      data: y,
      axisLabel: { color: AXIS_COLOR, width: 160, overflow: "truncate" as const },
      axisLine: { lineStyle: { color: GRID_COLOR } },
      splitArea: { show: true },
    },
    visualMap: {
      min: 0,
      max: Math.max(maxV, 1),
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 8,
      inRange: { color: ["hsl(var(--palette-1) / 0.12)", "hsl(var(--palette-1))"] },
      textStyle: { color: AXIS_COLOR },
    },
    series: [
      {
        type: "heatmap" as const,
        data: values,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.2)" } },
      },
    ],
  };
}

export default function SkillsCoverageAnalyticsPage() {
  const q = useQuery({
    queryKey: ["analytics", "skills"],
    queryFn: () => apiFetch<SkillsCoverageAnalyticsResponse>("/v1/analytics/skills"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-skills-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-skills-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">Impossibile caricare le analisi.</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.cells.length > 0;
  const proficiencyBarOption = echartsPresets.bar({
    x: d.proficiencyLevels,
    series: [
      {
        name: "Evidenze",
        values: d.proficiencyLevels.map(
          (p) => d.byProficiency.find((b) => b.proficiency === p)?.evidenceCount ?? 0,
        ),
      },
    ],
  });

  return (
    <main data-testid="analytics-skills-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-skills-title"
        title="Copertura competenze"
        description="Distribuzione delle evidenze di competenza dichiarate per unità organizzativa e livello di padronanza nel tuo ambito."
        badges={
          <Badge variant="secondary" data-testid="analytics-skills-scope">
            Ambito {d.scope.kind}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="skills-total-evidence">
          <StatsCard
            label="Evidenze totali"
            value={d.totalEvidence}
            icon={<GraduationCap className="h-4 w-4 text-palette-1" />}
            description="Competenze dichiarate"
          />
        </div>
        <div data-testid="skills-distinct-users">
          <StatsCard
            label="Persone con evidenze"
            value={d.distinctUsers}
            icon={<Users className="h-4 w-4 text-palette-2" />}
            description="Persone con almeno un'evidenza"
          />
        </div>
        <div data-testid="skills-distinct-ou">
          <StatsCard
            label="Unità organizzative"
            value={d.distinctOrgUnits}
            icon={<Building2 className="h-4 w-4 text-palette-3" />}
            description="OU coperte da evidenze"
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Copertura per unità e livello di padronanza
            </h2>
            <div
              data-testid="analytics-skills-heatmap"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={coverageHeatmapOption(d)}
                height={Math.max(360, d.orgUnits.length * 26)}
                ariaLabel="Copertura competenze per unità organizzativa e livello di padronanza"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Copertura delle evidenze dichiarate (non un gap competenze-vs-requisiti: i requisiti
              di competenza per posizione non sono ancora popolati).
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Evidenze per livello di padronanza
            </h2>
            <div
              data-testid="analytics-skills-proficiency-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={proficiencyBarOption}
                height={320}
                ariaLabel="Evidenze per livello di padronanza"
              />
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-skills-empty"
          icon={<GraduationCap className="h-6 w-6" />}
          title="Nessun dato"
          description="Non ci sono evidenze di competenza nel tuo ambito al momento."
        />
      )}
    </main>
  );
}
