"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface LearningModule {
  learningModuleId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  durationMinutes: number | null;
}

interface LearningModulesList {
  items: LearningModule[];
  total: number;
}

const COLUMNS: DataColumn<LearningModule>[] = [
  { header: "Codice", cell: (m) => <span className="font-mono text-xs">{m.code}</span> },
  { header: "Nome", cell: (m) => <span className="font-medium text-foreground">{m.name}</span> },
  {
    header: "Durata (min)",
    cell: (m) => <span className="text-xs text-muted-foreground">{m.durationMinutes ?? "—"}</span>,
  },
  {
    header: "Scope",
    cell: (m) => (
      <StatusPill tone={m.isGlobal ? "info" : "neutral"}>{m.isGlobal ? "global" : "tenant"}</StatusPill>
    ),
  },
];

export default function LearningCataloguePage() {
  const modules = useQuery({
    queryKey: ["learning-modules", "list"],
    queryFn: () => apiFetch<LearningModulesList>("/v1/learning-modules?limit=200"),
  });

  return (
    <DataTablePanel<LearningModule>
      pageTestId="learning-page"
      titleTestId="learning-title"
      countTestId="learning-count"
      title="Catalogo moduli"
      description="Moduli formativi disponibili, globali e di tenant."
      count={modules.data ? `${modules.data.total} moduli` : undefined}
      isLoading={modules.isLoading}
      isError={modules.isError}
      errorMessage="Impossibile caricare i moduli."
      rows={modules.data?.items ?? []}
      rowKey={(m) => m.learningModuleId}
      rowTestId="learning-row"
      columns={COLUMNS}
      emptyTestId="learning-empty"
      emptyTitle="Nessun modulo"
      emptyDescription="Non ci sono moduli formativi."
      caption="Elenco moduli formativi"
    />
  );
}
