"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface BlueprintProcess {
  blueprintProcessId: string;
  variantId: string;
  code: string;
  name: string;
  ordinal: number;
  description: string | null;
  isOptional: boolean;
}

interface BlueprintProcessesList {
  items: BlueprintProcess[];
  total: number;
}

const COLUMNS: DataColumn<BlueprintProcess>[] = [
  { header: "#", cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
  { header: "Codice", cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
  { header: "Nome", cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
  {
    header: "Opzionale",
    cell: (p) => <StatusPill tone={p.isOptional ? "warning" : "neutral"}>{p.isOptional ? "sì" : "no"}</StatusPill>,
  },
];

export default function ProcessesPage() {
  const processes = useQuery({
    queryKey: ["blueprint-processes", "list"],
    queryFn: () => apiFetch<BlueprintProcessesList>("/v1/blueprint-processes?limit=200"),
  });

  return (
    <DataTablePanel<BlueprintProcess>
      pageTestId="processes-page"
      titleTestId="processes-title"
      countTestId="processes-count"
      title="Processi BPM"
      description="Catalogo processi blueprint-anchored."
      count={processes.data ? `${processes.data.total} processi` : undefined}
      isLoading={processes.isLoading}
      isError={processes.isError}
      errorMessage="Impossibile caricare i processi."
      rows={processes.data?.items ?? []}
      rowKey={(p) => p.blueprintProcessId}
      rowTestId="processes-row"
      columns={COLUMNS}
      emptyTestId="processes-empty"
      emptyTitle="Nessun processo"
      emptyDescription="Non ci sono processi."
      caption="Catalogo processi (blueprint-anchored)"
    />
  );
}
