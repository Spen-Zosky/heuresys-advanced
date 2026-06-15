"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, EChartsCard, EmptyState, PageHeader, StatsCard, echartsPresets } from "@heuresys/ui";
import { Boxes, Layers, PieChart } from "lucide-react";
import type { SkillsGroupShareAnalyticsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

export default function SkillsGroupShareAnalyticsPage() {
  const { t } = useTranslation("analytics");
  const q = useQuery({
    queryKey: ["analytics", "skills-group-share"],
    queryFn: () => apiFetch<SkillsGroupShareAnalyticsResponse>("/v1/analytics/skills-group-share"),
  });

  if (q.isLoading) {
    return (
      <main data-testid="analytics-skills-group-share-loading" className="mx-auto max-w-7xl px-6 py-8">
        <span className="text-sm text-muted-foreground">{t("common:loading")}</span>
      </main>
    );
  }
  if (q.isError) {
    return (
      <main data-testid="analytics-skills-group-share-error" className="mx-auto max-w-7xl px-6 py-8">
        <p className="text-sm text-danger">{t("error")}</p>
      </main>
    );
  }

  const d = q.data!;
  const hasData = d.groups.length > 0;

  // Bar: the top-N ESCO groups by skill count, with the remaining groups folded
  // into a single "other" bar so the chart reconciles to the grouped total.
  const barX = [
    ...d.groups.map((g) => g.groupCode),
    ...(d.otherGroupsCount > 0 ? [t("skillsGroupShare.otherLabel", { count: d.otherGroupsCount })] : []),
  ];
  const barValues = [
    ...d.groups.map((g) => g.skillCount),
    ...(d.otherGroupsCount > 0 ? [d.otherSkillCount] : []),
  ];
  const barOption = echartsPresets.bar({
    x: barX,
    series: [{ name: t("skillsGroupShare.seriesSkills"), values: barValues }],
  });

  return (
    <main data-testid="analytics-skills-group-share-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader
        data-testid="analytics-skills-group-share-title"
        title={t("skillsGroupShare.title")}
        description={t("skillsGroupShare.description")}
        badges={
          <Badge variant="secondary" data-testid="analytics-skills-group-share-scope">
            {t("scope", { kind: d.scope.kind })}
          </Badge>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div data-testid="skills-group-share-total-grouped">
          <StatsCard
            label={t("skillsGroupShare.stats.groupedLabel")}
            value={d.totalGrouped}
            icon={<Layers className="h-4 w-4 text-palette-1" />}
            description={t("skillsGroupShare.stats.groupedDesc")}
          />
        </div>
        <div data-testid="skills-group-share-distinct-groups">
          <StatsCard
            label={t("skillsGroupShare.stats.groupsLabel")}
            value={d.distinctGroups}
            icon={<Boxes className="h-4 w-4 text-palette-2" />}
            description={t("skillsGroupShare.stats.groupsDesc")}
          />
        </div>
        <div data-testid="skills-group-share-ungrouped">
          <StatsCard
            label={t("skillsGroupShare.stats.ungroupedLabel")}
            value={d.ungroupedSkills}
            icon={<PieChart className="h-4 w-4 text-palette-3" />}
            description={t("skillsGroupShare.stats.ungroupedDesc")}
          />
        </div>
      </section>

      {hasData ? (
        <section className="space-y-8">
          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skillsGroupShare.chartTitle", { n: d.groups.length })}
            </h2>
            <div
              data-testid="analytics-skills-group-share-chart"
              className="rounded-card border border-border bg-card p-4"
            >
              <EChartsCard
                option={barOption}
                height={Math.max(360, barX.length * 16)}
                ariaLabel={t("skillsGroupShare.chartAria")}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("skillsGroupShare.chartNote", { n: d.groups.length, total: d.distinctGroups })}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("skillsGroupShare.tableTitle")}
            </h2>
            <div
              data-testid="analytics-skills-group-share-table"
              className="overflow-hidden rounded-card border border-border bg-card"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2 font-medium">{t("skillsGroupShare.colGroup")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("skillsGroupShare.colCount")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("skillsGroupShare.colShare")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.groups.map((g) => (
                    <tr key={g.groupUri} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-foreground">{g.groupCode}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-foreground">{g.skillCount}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {g.sharePct.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <EmptyState
          data-testid="analytics-skills-group-share-empty"
          icon={<PieChart className="h-6 w-6" />}
          title={t("empty.title")}
          description={t("skillsGroupShare.emptyDesc")}
        />
      )}
    </main>
  );
}
