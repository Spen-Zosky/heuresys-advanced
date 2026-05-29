"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface VisualizationGraph {
  visualizationGraphId: string;
  tenantId: string | null;
  code: string;
  name: string;
  graphKind: string;
  status: string;
  createdAt: string;
}

interface VisualizationGraphsList {
  items: VisualizationGraph[];
  total: number;
}

const COLUMNS: DataColumn<VisualizationGraph>[] = [
  { header: "Codice", cell: (g) => <span className="font-mono text-xs">{g.code}</span> },
  {
    header: "Nome",
    cell: (g) => (
      <Link
        href={`/visualizations/${g.visualizationGraphId}`}
        data-testid="visualization-link"
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {g.name}
      </Link>
    ),
  },
  { header: "Tipo", cell: (g) => <span className="text-xs uppercase text-muted-foreground">{g.graphKind}</span> },
  { header: "Stato", cell: (g) => <StatusBadge value={g.status} /> },
];

export default function VisualizationsPage() {
  const graphs = useQuery({
    queryKey: ["visualization-graphs"],
    queryFn: () => apiFetch<VisualizationGraphsList>("/v1/visualization-graphs?limit=200"),
  });

  return (
    <DataTablePanel<VisualizationGraph>
      pageTestId="visualizations-page"
      titleTestId="visualizations-title"
      countTestId="visualizations-count"
      title="Visualizations"
      description="Grafici registrati con tipo e stato."
      count={graphs.data ? `${graphs.data.total} grafici` : undefined}
      isLoading={graphs.isLoading}
      isError={graphs.isError}
      errorMessage="Impossibile caricare i grafici."
      rows={graphs.data?.items ?? []}
      rowKey={(g) => g.visualizationGraphId}
      rowTestId="visualizations-row"
      columns={COLUMNS}
      emptyTestId="visualizations-empty"
      emptyTitle="Nessun grafico"
      emptyDescription="Nessun grafico registrato."
      caption="Browser grafici"
    />
  );
}
