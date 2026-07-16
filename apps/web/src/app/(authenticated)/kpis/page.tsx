"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { KpiMetrologyPanel } from "@/components/kpi-metrology-panel";

interface KpiDef {
  kpiDefinitionId: string;
  code: string;
  name: string;
  unit: string | null;
  polarity: string;
  isGlobal: boolean;
}

interface KpiList {
  items: KpiDef[];
  total: number;
}

function buildColumns(t: TFunction): DataColumn<KpiDef>[] {
  return [
    { header: t("shared.code"), cell: (k) => <span className="font-mono text-xs">{k.code}</span> },
    { header: t("shared.name"), cell: (k) => <span className="font-medium text-foreground">{k.name}</span> },
    { header: t("kpis.cols.unit"), cell: (k) => <span className="text-xs text-muted-foreground">{k.unit ?? "—"}</span> },
    { header: t("kpis.cols.polarity"), cell: (k) => <span className="text-xs text-muted-foreground">{k.polarity}</span> },
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
  const columns = useMemo(() => buildColumns(t), [t]);
  const kpis = useQuery({
    queryKey: ["kpi-definitions", "list"],
    queryFn: () => apiFetch<KpiList>("/v1/kpi-definitions?limit=200"),
  });

  return (
    <DataTablePanel<KpiDef>
      pageTestId="kpis-page"
      titleTestId="kpis-title"
      countTestId="kpis-count"
      title={t("kpis.title")}
      description={t("kpis.description")}
      count={kpis.data ? t("kpis.count", { count: kpis.data.total }) : undefined}
      isLoading={kpis.isLoading}
      isError={kpis.isError}
      errorMessage={t("kpis.errorMessage")}
      rows={kpis.data?.items ?? []}
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
