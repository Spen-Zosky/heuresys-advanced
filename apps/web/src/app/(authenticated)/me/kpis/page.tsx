"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { useEnumLabel } from "@/lib/enum-labels";

interface MeKpi {
  positionKpiRequirementId: string;
  kpiCode: string;
  kpiName: string;
  unit: string | null;
  polarity: string;
  weight: string;
  latestMeasuredValue: string | null;
  latestTargetValue: string | null;
  latestRecordedAt: string | null;
}

interface MeKpisList {
  items: MeKpi[];
  total: number;
}

export default function MeKpisPage() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const kpis = useQuery({
    queryKey: ["me", "kpis"],
    queryFn: () => apiFetch<MeKpisList>("/v1/me/kpis"),
  });

  const columns = useMemo<DataColumn<MeKpi>[]>(
    () => [
      { header: t("kpis.colKpi"), cell: (k) => <span className="font-medium text-foreground">{k.kpiName}</span> },
      { header: t("kpis.colCode"), cell: (k) => <span className="font-mono text-xs">{k.kpiCode}</span> },
      { header: t("kpis.colDirection"), cell: (k) => <span className="text-xs text-muted-foreground">{enumLabel("kpiPolarity", k.polarity)}</span> },
      { header: t("kpis.colWeight"), cell: (k) => <span className="text-xs text-muted-foreground">{k.weight}</span> },
      {
        header: t("kpis.colLatest"),
        cell: (k) => <span className="text-xs text-muted-foreground">{k.latestMeasuredValue ?? "—"}</span>,
      },
      {
        header: t("kpis.colTarget"),
        cell: (k) => <span className="text-xs text-muted-foreground">{k.latestTargetValue ?? "—"}</span>,
      },
      {
        header: t("kpis.colDate"),
        cell: (k) => (
          <span className="text-xs text-muted-foreground">
            {k.latestRecordedAt ? k.latestRecordedAt.slice(0, 10) : "—"}
          </span>
        ),
      },
    ],
    [t, enumLabel],
  );

  return (
    <DataTablePanel<MeKpi>
      pageTestId="me-kpis-page"
      titleTestId="me-kpis-title"
      countTestId="me-kpis-count"
      title={t("kpis.title")}
      description={t("kpis.description")}
      count={kpis.data ? t("kpis.count", { count: kpis.data.total }) : undefined}
      isLoading={kpis.isLoading}
      isError={kpis.isError}
      errorMessage={t("kpis.errorMessage")}
      rows={kpis.data?.items ?? []}
      rowKey={(k) => k.positionKpiRequirementId}
      rowTestId="me-kpi-row"
      columns={columns}
      emptyTestId="me-kpis-empty"
      emptyTitle={t("kpis.emptyTitle")}
      emptyDescription={t("kpis.emptyDesc")}
      caption={t("kpis.caption")}
    />
  );
}
