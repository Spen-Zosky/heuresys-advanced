"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

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

const COLUMNS: DataColumn<KpiDef>[] = [
  { header: "Codice", cell: (k) => <span className="font-mono text-xs">{k.code}</span> },
  { header: "Nome", cell: (k) => <span className="font-medium text-foreground">{k.name}</span> },
  { header: "Unità", cell: (k) => <span className="text-xs text-muted-foreground">{k.unit ?? "—"}</span> },
  { header: "Polarità", cell: (k) => <span className="text-xs text-muted-foreground">{k.polarity}</span> },
  {
    header: "Scope",
    cell: (k) => (
      <StatusPill tone={k.isGlobal ? "info" : "neutral"}>{k.isGlobal ? "global" : "tenant"}</StatusPill>
    ),
  },
];

export default function KpisCataloguePage() {
  const kpis = useQuery({
    queryKey: ["kpi-definitions", "list"],
    queryFn: () => apiFetch<KpiList>("/v1/kpi-definitions?limit=200"),
  });

  return (
    <DataTablePanel<KpiDef>
      pageTestId="kpis-page"
      titleTestId="kpis-title"
      countTestId="kpis-count"
      title="Catalogo KPI"
      description="KPI definiti, con unità, polarità e scope."
      count={kpis.data ? `${kpis.data.total} KPI definiti` : undefined}
      isLoading={kpis.isLoading}
      isError={kpis.isError}
      errorMessage="Impossibile caricare i KPI."
      rows={kpis.data?.items ?? []}
      rowKey={(k) => k.kpiDefinitionId}
      rowTestId="kpis-row"
      columns={COLUMNS}
      emptyTestId="kpis-empty"
      emptyTitle="Nessun KPI"
      emptyDescription="Non ci sono KPI definiti."
      caption="Elenco KPI"
    />
  );
}
