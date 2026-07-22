"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { KpiDefinition } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { KpiMetrologyPanel } from "@/components/kpi-metrology-panel";

function buildColumns(t: TFunction, enumLabel: EnumLabelFn): DataColumn<KpiDefinition>[] {
  return [
    { header: t("shared.code"), cell: (k) => <span className="font-mono text-xs">{k.code}</span> },
    { header: t("shared.name"), cell: (k) => <span className="font-medium text-foreground">{k.name}</span> },
    { header: t("kpis.cols.unit"), cell: (k) => <span className="text-xs text-muted-foreground">{k.unit ?? "—"}</span> },
    { header: t("kpis.cols.polarity"), cell: (k) => <span className="text-xs text-muted-foreground">{enumLabel("kpiPolarity", k.polarity)}</span> },
    {
      header: t("shared.scope"),
      cell: (k) => (
        <StatusPill tone={k.isGlobal ? "info" : "neutral"}>
          {k.isGlobal ? t("shared.global") : t("shared.tenant")}
        </StatusPill>
      ),
    },
  ];
}

export default function KpisCataloguePage() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const columns = useMemo(() => buildColumns(t, enumLabel), [t, enumLabel]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const kpis = usePaginatedList<KpiDefinition>({
    queryKey: ["kpi-definitions", "list"],
    path: "/v1/kpi-definitions",
  });

  return (
    <DataTablePanel<KpiDefinition>
      pageTestId="kpis-page"
      titleTestId="kpis-title"
      countTestId="kpis-count"
      title={t("kpis.title")}
      description={t("kpis.description")}
      count={kpis.query.data ? t("kpis.count", { count: kpis.total }) : undefined}
      isLoading={kpis.query.isLoading}
      isError={kpis.query.isError}
      errorMessage={t("kpis.errorMessage")}
      rows={kpis.rows}
      server={kpis.server}
      rowKey={(k) => k.kpiDefinitionId}
      rowTestId="kpis-row"
      columns={columns}
      emptyTestId="kpis-empty"
      emptyTitle={t("kpis.emptyTitle")}
      emptyDescription={t("kpis.emptyDescription")}
      caption={t("kpis.caption")}
    >
      {/* #31 (S1018): metrology — assessment methods + weighting rules catalogs */}
      <KpiMetrologyPanel />
    </DataTablePanel>
  );
}
