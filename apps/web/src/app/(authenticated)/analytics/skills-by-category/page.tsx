"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, echartsPresets } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatsCard } from "@/components/indicatori-leggibili";
import { GraduationCap, Layers, Users } from "lucide-react";
import { EChartsCard } from "../../_charts-client";
import type { SkillsByCategoryAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { grigliaCompleta } from "@/lib/celle-tabella";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

const AXIS_COLOR = "hsl(var(--muted-foreground))";
const GRID_COLOR = "hsl(var(--border))";

/** Coverage heatmap: skill_category (rows) × proficiency (cols) → evidence count.
 *  Dense by design (every evidence resolves to a category) — missing [x,y] pairs
 *  (a category with no evidence at a given level) are filled with 0 (K17). */
function categoryHeatmapOption(d: SkillsByCategoryAnalyticsResponse, etichetta: (p: string) => string) {
  const x = d.proficiencyLevels;
  const y = d.categories;
  // K17: ogni coppia ha la sua cella; quella senza evidenze vale 0 e lo scrive
  const values = grigliaCompleta(x.length, y.length, d.cells.map((c) => [x.indexOf(c.proficiency), y.indexOf(c.category), c.evidenceCount] as const));
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

export default function SkillsByCategoryAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["analytics", "skills-by-category"],
    queryFn: () => apiFetch<SkillsByCategoryAnalyticsResponse>("/v1/analytics/skills-by-category"),
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-6 pb-8">
        <PageHeader title={t("skillsByCategory.title")} description={t("skillsByCategory.description")} />
        <StatoCaricamento testId="analytics-skills-by-category-loading" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="mx-auto max-w-7xl px-6 pb-8">
        <PageHeader title={t("skillsByCategory.title")} description={t("skillsByCategory.description")} />
        <StatoErrore errore={q.error} titolo={t("error")} testId="analytics-skills-by-category-error" onRiprova={() => void q.refetch()} />
      </div>
    );
  }

  const d = q.data!;
  const hasData = d.cells.length > 0;
  const categoryBarOption = echartsPresets.bar({
    x: d.categories,
    series: [
      {
        name: t("skillsByCategory.seriesEvidence"),
        values: d.categories.map(
          (c) => d.byCategory.find((b) => b.category === c)?.evidenceCount ?? 0,
        ),
      },
    ],
  });

  return (
    <div data-testid="analytics-skills-by-category-page" className="mx-auto max-w-7xl space-y-8 px-6 pb-8">
      <PageHeader
        data-testid="analytics-skills-by-category-title"
        title={t("skillsByCategory.title")}
        description={t("skillsByCategory.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-skills-by-category-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="skills-by-category-total-evidence">
          <StatsCard
            label={t("skillsByCategory.stats.evidenceLabel")}
            value={d.totalEvidence}
            icon={<GraduationCap className="h-4 w-4 text-palette-1" />}
            description={t("skillsByCategory.stats.evidenceDesc")}
          />
        </div>
        <div data-testid="skills-by-category-distinct-users">
          <StatsCard
            label={t("skillsByCategory.stats.usersLabel")}
            value={d.distinctUsers}
            icon={<Users className="h-4 w-4 text-palette-2" />}
            description={t("skillsByCategory.stats.usersDesc")}
          />
        </div>
        <div data-testid="skills-by-category-distinct-categories">
          <StatsCard
            label={t("skillsByCategory.stats.categoriesLabel")}
            value={d.distinctCategories}
            icon={<Layers className="h-4 w-4 text-palette-3" />}
            description={t("skillsByCategory.stats.categoriesDesc")}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skillsByCategory.heatmapTitle")}
            </h2>
            <div
              data-testid="analytics-skills-by-category-heatmap"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={categoryHeatmapOption(d, (p) => enumLabel("proficiency", p))}
                height={360}
                ariaLabel={t("skillsByCategory.heatmapAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("skillsByCategory.heatmapNote")}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skillsByCategory.categoryTitle")}
            </h2>
            <div
              data-testid="analytics-skills-by-category-category-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={categoryBarOption}
                height={320}
                ariaLabel={t("skillsByCategory.categoryTitle")}
              />
            </div>
          </div>
        </section>
      ) : (
        <StatoVuoto
          testId="analytics-skills-by-category-empty"
          icona={<Layers className="h-6 w-6" />}
          titolo={t("empty.title")}
          motivo={t("skillsByCategory.emptyDesc")}
        />
      )}
    </div>
  );
}
