"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

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

const COLUMNS: DataColumn<MeKpi>[] = [
  { header: "KPI", cell: (k) => <span className="font-medium text-foreground">{k.kpiName}</span> },
  { header: "Codice", cell: (k) => <span className="font-mono text-xs">{k.kpiCode}</span> },
  { header: "Direzione", cell: (k) => <span className="text-xs text-muted-foreground">{k.polarity}</span> },
  { header: "Peso", cell: (k) => <span className="text-xs text-muted-foreground">{k.weight}</span> },
  {
    header: "Ultima misura",
    cell: (k) => <span className="text-xs text-muted-foreground">{k.latestMeasuredValue ?? "—"}</span>,
  },
  {
    header: "Target",
    cell: (k) => <span className="text-xs text-muted-foreground">{k.latestTargetValue ?? "—"}</span>,
  },
  {
    header: "Data",
    cell: (k) => (
      <span className="text-xs text-muted-foreground">
        {k.latestRecordedAt ? k.latestRecordedAt.slice(0, 10) : "—"}
      </span>
    ),
  },
];

export default function MeKpisPage() {
  const kpis = useQuery({
    queryKey: ["me", "kpis"],
    queryFn: () => apiFetch<MeKpisList>("/v1/me/kpis"),
  });

  return (
    <DataTablePanel<MeKpi>
      pageTestId="me-kpis-page"
      titleTestId="me-kpis-title"
      countTestId="me-kpis-count"
      title="I miei KPI"
      description="Obiettivi KPI attivi sulle tue posizioni."
      count={kpis.data ? `${kpis.data.total} obiettivi` : undefined}
      isLoading={kpis.isLoading}
      isError={kpis.isError}
      errorMessage="Impossibile caricare i KPI."
      rows={kpis.data?.items ?? []}
      rowKey={(k) => k.positionKpiRequirementId}
      rowTestId="me-kpi-row"
      columns={COLUMNS}
      emptyTestId="me-kpis-empty"
      emptyTitle="Nessun KPI assegnato"
      emptyDescription="Non hai KPI assegnati."
      caption="Obiettivi attivi"
    />
  );
}
