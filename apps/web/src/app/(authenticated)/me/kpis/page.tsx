"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { useEnumLabel } from "@/lib/enum-labels";
import { useFormat } from "@/lib/format";

interface MeKpi {
  positionKpiRequirementId: string | null;
  kpiDefinitionId: string;
  /** Bersaglio assegnato alla persona (D2-04): periodo, obiettivo, soglia minima e massima. */
  assignedTarget: {
    periodStart: string; periodEnd: string;
    targetValue: string | null; minimumValue: string | null; stretchValue: string | null; unit: string | null;
  } | null;
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
  const fmt = useFormat();
  const enumLabel = useEnumLabel();
  const kpis = useQuery({
    queryKey: ["me", "kpis"],
    queryFn: () => apiFetch<MeKpisList>("/v1/me/kpis"),
  });

  const columns = useMemo<DataColumn<MeKpi>[]>(
    () => [
      { header: t("kpis.colKpi"), cell: (k) => <span className="font-medium text-foreground">{k.kpiName}</span> },
      // R2/C1: il codice resta nel dettaglio della riga
      { header: t("kpis.colCode"), secondaria: true, cell: (k) => <span className="font-mono text-xs" data-grezzo="">{k.kpiCode}</span> },
      { header: t("kpis.colDirection"), cell: (k) => <span className="text-xs text-muted-foreground">{enumLabel("kpiPolarity", k.polarity)}</span> },
      { header: t("kpis.colWeight"), align: "right", cell: (k) => <span className="text-xs tabular-nums text-muted-foreground">{k.positionKpiRequirementId ? fmt.numero(k.weight, 2) : "—"}</span> },
      {
        header: t("kpis.colTarget"),
        cell: (k) => {
          const g = k.assignedTarget;
          if (!g || g.targetValue === null) return <span className="text-xs text-muted-foreground">—</span>;
          const u = g.unit ? ` ${g.unit}` : "";
          const soglie = [g.minimumValue, g.stretchValue].some((v) => v !== null)
            ? ` (${g.minimumValue !== null ? fmt.numero(g.minimumValue, 2) : "—"} – ${g.stretchValue !== null ? fmt.numero(g.stretchValue, 2) : "—"})`
            : "";
          return (
            <span className="text-xs text-muted-foreground">
              <span className="tabular-nums text-foreground">{fmt.numero(g.targetValue, 2)}{u}</span>
              {soglie}
              {` · ${fmt.data(g.periodStart)} – ${fmt.data(g.periodEnd)}`}
            </span>
          );
        },
      },
      // C9: misura, obiettivo e data in una cella sola; un indicatore mai misurato lo dice in parole,
      // invece di tre trattini
      {
        header: t("kpis.colLatest"),
        cell: (k) =>
          k.latestMeasuredValue === null || k.latestMeasuredValue === undefined ? (
            <span className="text-xs text-muted-foreground">{t("kpis.notMeasured")}</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              <span className="tabular-nums text-foreground">{fmt.numero(k.latestMeasuredValue, 2)}</span>
              {k.latestTargetValue !== null && k.latestTargetValue !== undefined
                ? ` · ${t("kpis.targetIs", { value: fmt.numero(k.latestTargetValue, 2) })}`
                : ""}
              {k.latestRecordedAt ? ` · ${fmt.data(k.latestRecordedAt)}` : ""}
            </span>
          ),
      },
    ],
    [t, enumLabel, fmt],
  );

  return (
    <DataTablePanel<MeKpi> originPath={"/v1/me/kpis"}
      pageTestId="me-kpis-page"
      titleTestId="me-kpis-title"
      countTestId="me-kpis-count"
      title={t("kpis.title")}
      description={t("kpis.description")}
      count={kpis.data ? t("kpis.count", { count: kpis.data.total }) : undefined}
      isLoading={kpis.isLoading}
      isError={kpis.isError}
      error={kpis.error}
      errorMessage={t("kpis.errorMessage")}
      rows={kpis.data?.items ?? []}
      rowKey={(k) => k.kpiDefinitionId}
      rowTestId="me-kpi-row"
      columns={columns}
      emptyTestId="me-kpis-empty"
      emptyTitle={t("kpis.emptyTitle")}
      emptyDescription={t("kpis.emptyDesc")}
      caption={t("kpis.caption")}
    />
  );
}
