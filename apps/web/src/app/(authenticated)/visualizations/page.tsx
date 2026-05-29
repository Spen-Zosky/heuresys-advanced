"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
import { EChartsCard } from "../_charts-client";

// Fields match the real VizGraph schema (graphId/type/isActive), not the stale
// visualizationGraphId/graphKind/status that this page used before F4.3.
interface VisualizationGraph {
  graphId: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}
interface TypeDistItem {
  type: string;
  count: number;
}

const COLUMNS: DataColumn<VisualizationGraph>[] = [
  { header: "Codice", cell: (g) => <span className="font-mono text-xs">{g.code}</span> },
  {
    header: "Nome",
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
  { header: "Tipo", cell: (g) => <span className="text-xs uppercase text-muted-foreground">{g.type.replace(/_/g, " ")}</span> },
  { header: "Stato", cell: (g) => <StatusBadge value={g.isActive ? "ACTIVE" : "INACTIVE"} /> },
];

export default function VisualizationsPage() {
  const graphs = useQuery({
    queryKey: ["visualization-graphs"],
    queryFn: () => apiFetch<{ items: VisualizationGraph[]; total: number }>("/v1/visualization-graphs?limit=200"),
  });
  // Type distribution — server-side GROUP BY aggregate (API-first, F4.3).
  const summary = useQuery({
    queryKey: ["visualization-graphs", "summary"],
    queryFn: () => apiFetch<{ items: TypeDistItem[]; total: number }>("/v1/visualization-graphs/summary"),
  });

  const chartOption = {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c} ({d}%)" },
    legend: { type: "scroll" as const, bottom: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    series: [
      {
        name: "Grafici",
        type: "pie" as const,
        radius: ["45%", "72%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "transparent", borderWidth: 2 },
        label: { show: false },
        data: (summary.data?.items ?? []).map((i) => ({ name: i.type.replace(/_/g, " "), value: i.count })),
      },
    ],
  };

  return (
    <main data-testid="visualizations-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="visualizations-title"
        title="Visualizations"
        description="Grafici registrati con tipo e stato."
        badges={
          <Badge variant="secondary" data-testid="visualizations-count">
            {graphs.data ? `${graphs.data.total} grafici` : "…"}
          </Badge>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <EntityTable<VisualizationGraph>
          isLoading={graphs.isLoading}
          isError={graphs.isError}
          errorMessage="Impossibile caricare i grafici."
          rows={graphs.data?.items ?? []}
          rowKey={(g) => g.graphId}
          rowTestId="visualizations-row"
          columns={COLUMNS}
          emptyTestId="visualizations-empty"
          emptyTitle="Nessun grafico"
          emptyDescription="Nessun grafico registrato."
          caption="Browser grafici"
        />
        <div
          data-testid="visualizations-type-chart"
          className="rounded-card border border-border bg-card p-4 shadow-card"
        >
          <h2 className="mb-2 text-sm font-medium text-foreground">Distribuzione per tipo</h2>
          {summary.data && summary.data.total > 0 ? (
            <EChartsCard option={chartOption} height={260} ariaLabel="Distribuzione grafici per tipo" />
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {summary.isLoading ? "Caricamento…" : "Nessun dato."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
