"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, echartsPresets } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatsCard } from "@/components/indicatori-leggibili";
import { Building2, GraduationCap, Users } from "lucide-react";
import { EChartsCard } from "../../_charts-client";
import type { SkillsCoverageAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { grigliaCompleta } from "@/lib/celle-tabella";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Coverage heatmap: OU (rows) × proficiency (cols) → evidence count. Sparse by
 *  design — the API emits no zero triples; grigliaCompleta fills them with 0 (K17). */
function coverageHeatmapOption(d: SkillsCoverageAnalyticsResponse, etichetta: (p: string) => string) {
  const x = d.proficiencyLevels;
  const y = d.orgUnits;
  // K17: ogni coppia ha la sua cella; quella senza evidenze vale 0 e lo scrive
  const values = grigliaCompleta(x.length, y.length, d.cells.map((c) => [x.indexOf(c.proficiency), y.indexOf(c.orgUnit), c.evidenceCount] as const));
  const maxV = values.reduce((m, v) => Math.max(m, v[2] ?? 0), 0);
  return {
    grid: { left: 8, right: 16, top: 12, bottom: 64, containLabel: true },
    tooltip: { position: "top" as const },
    xAxis: {
      type: "category" as const,
      data: x.map(etichetta),
      axisLabel: { color: AXIS_COLOR },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    yAxis: {
      type: "category" as const,
      data: y,
      axisLabel: { color: AXIS_COLOR, width: 160, overflow: "break" as const },
      axisLine: { lineStyle: { color: GRID_COLOR } },
    },
    visualMap: {
      min: 0,
      max: Math.max(maxV, 1),
      calculable: false,
      orient: "horizontal" as const,
      left: "center",
      bottom: 8,
      inRange: { color: ["color-mix(in oklab, var(--palette-1) 12%, transparent)", "var(--palette-1)"] },
      textStyle: { color: AXIS_COLOR },
    },
    series: [
      {
        type: "heatmap" as const,
        data: values,
        // il valore scritto in ogni cella: il colore da solo non dice «quanto»
        label: { show: true, color: AXIS_COLOR, fontSize: 12 },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.2)" } },
      },
    ],
  };
}

export default function SkillsCoverageAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["analytics", "skills"],
    queryFn: () => apiFetch<SkillsCoverageAnalyticsResponse>("/v1/analytics/skills"),
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 pb-8">
        <StatoCaricamento testId="analytics-skills-loading" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="mx-auto max-w-7xl px-6 pb-8">
        <StatoErrore errore={q.error} titolo={t("error")} testId="analytics-skills-error" onRiprova={() => void q.refetch()} />
      </div>
    );
  }

  const d = q.data!;
  const hasData = d.cells.length > 0;
  const proficiencyBarOption = echartsPresets.bar({
    x: d.proficiencyLevels.map((p) => enumLabel("proficiency", p)),
    series: [
      {
        name: t("skills.seriesEvidence"),
        values: d.proficiencyLevels.map(
          (p) => d.byProficiency.find((b) => b.proficiency === p)?.evidenceCount ?? 0,
        ),
      },
    ],
  });

  return (
    <div data-testid="analytics-skills-page" className="mx-auto max-w-7xl space-y-8 px-6 pb-8">
      <PageHeader
        data-testid="analytics-skills-title"
        title={t("skills.title")}
        description={t("skills.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-skills-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="skills-total-evidence">
          <StatsCard
            label={t("skills.stats.evidenceLabel")}
            value={d.totalEvidence}
            icon={<GraduationCap className="h-4 w-4 text-palette-1" />}
            description={t("skills.stats.evidenceDesc")}
          />
        </div>
        <div data-testid="skills-distinct-users">
          <StatsCard
            label={t("skills.stats.usersLabel")}
            value={d.distinctUsers}
            icon={<Users className="h-4 w-4 text-palette-2" />}
            description={t("skills.stats.usersDesc")}
          />
        </div>
        <div data-testid="skills-distinct-ou">
          <StatsCard
            label={t("skills.stats.ouLabel")}
            value={d.distinctOrgUnits}
            icon={<Building2 className="h-4 w-4 text-palette-3" />}
            description={t("skills.stats.ouDesc")}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skills.heatmapTitle")}
            </h2>
            <div
              data-testid="analytics-skills-heatmap"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={coverageHeatmapOption(d, (p) => enumLabel("proficiency", p))}
                height={360}
                ariaLabel={t("skills.heatmapAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("skills.heatmapNote")}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skills.proficiencyTitle")}
            </h2>
            <div
              data-testid="analytics-skills-proficiency-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={proficiencyBarOption}
                height={320}
                ariaLabel={t("skills.proficiencyTitle")}
              />
            </div>
          </div>
        </section>
      ) : (
        <StatoVuoto
          testId="analytics-skills-empty"
          icona={<GraduationCap className="h-6 w-6" />}
          titolo={t("empty.title")}
          motivo={t("skills.emptyDesc")}
        />
      )}
    </div>
  );
}
