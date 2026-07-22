"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Badge, PageHeader } from "@heuresys/ui";
import type { VizGraph, VizGraphTypeDistributionItem } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
import { useEnumLabel } from "@/lib/enum-labels";
import { EChartsCard } from "../_charts-client";

type TypeDistItem = VizGraphTypeDistributionItem;

/** Donut option: type distribution. The series name is passed in already
 *  translated (i18n is a render-time hook), never resolved at module scope. */
function typeChartOption(items: TypeDistItem[], labels: { series: string }) {
  return {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c} ({d}%)" },
    legend: { type: "scroll" as const, bottom: 0, textStyle: { color: "hsl(var(--muted-foreground))", fontSize: 11 } },
    series: [
      {
        name: labels.series,
        type: "pie" as const,
        radius: ["45%", "72%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "transparent", borderWidth: 2 },
        label: { show: false },
        data: items.map((i) => ({ name: i.type.replace(/_/g, " "), value: i.count })),
      },
    ],
  };
}

export default function VisualizationsPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  // C4 (#42): server-side pagination (was `?limit=200`). The donut is fed by the
  // separate server-side GROUP BY aggregate below, so paging the table never
  // narrows the distribution.
  const graphs = usePaginatedList<VizGraph>({
    queryKey: ["visualization-graphs"],
    path: "/v1/visualization-graphs",
  });
  // Type distribution — server-side GROUP BY aggregate (API-first, F4.3).
  const summary = useQuery({
    queryKey: ["visualization-graphs", "summary"],
    queryFn: () => apiFetch<{ items: TypeDistItem[]; total: number }>("/v1/visualization-graphs/summary"),
  });

  const columns = useMemo<DataColumn<VizGraph>[]>(
    () => [
      { header: t("visualizations.columns.code"), cell: (g) => <span className="font-mono text-xs">{g.code}</span> },
      {
        header: t("visualizations.columns.name"),
        cell: (g) => (
          <Link
            href={`/visualizations/${g.graphId}`}
            data-testid="visualization-link"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {g.name}
          </Link>
        ),
      },
      { header: t("visualizations.columns.type"), cell: (g) => <span className="text-xs uppercase text-muted-foreground">{enumLabel("vizGraphType", g.type)}</span> },
      { header: t("visualizations.columns.status"), cell: (g) => <StatusBadge value={g.isActive ? "ACTIVE" : "INACTIVE"} /> },
    ],
    [t, enumLabel],
  );

  return (
    <main data-testid="visualizations-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="visualizations-title"
        title={t("visualizations.title")}
        description={t("visualizations.description")}
        badges={
          <Badge variant="secondary" data-testid="visualizations-count">
            {graphs.query.data ? t("visualizations.count", { count: graphs.total }) : t("visualizations.countLoading")}
          </Badge>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <EntityTable<VizGraph>
          isLoading={graphs.query.isLoading}
          isError={graphs.query.isError}
          errorMessage={t("visualizations.errorMessage")}
          rows={graphs.rows}
          server={graphs.server}
          rowKey={(g) => g.graphId}
          rowTestId="visualizations-row"
          columns={columns}
          emptyTestId="visualizations-empty"
          emptyTitle={t("visualizations.emptyTitle")}
          emptyDescription={t("visualizations.emptyDescription")}
          caption={t("visualizations.caption")}
        />
        <div
          data-testid="visualizations-type-chart"
          className="rounded-card border border-border bg-card p-4 shadow-card"
        >
          <h2 className="mb-2 text-sm font-medium text-foreground">{t("visualizations.distributionTitle")}</h2>
          {summary.data && summary.data.total > 0 ? (
            <EChartsCard option={typeChartOption(summary.data.items, { series: t("visualizations.chartSeries") })} height={260} ariaLabel={t("visualizations.chartAria")} />
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {summary.isLoading ? t("common:loading") : t("visualizations.noData")}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
