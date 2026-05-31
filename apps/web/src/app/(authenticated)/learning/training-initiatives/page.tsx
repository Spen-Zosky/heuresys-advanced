"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface TrainingInitiative {
  trainingInitiativeId: string;
  tenantId: string;
  moduleId: string;
  code: string;
  cohortName: string | null;
  startDate: string | null;
  endDate: string | null;
  facilitatorUserId: string | null;
  status: string;
  capacity: number | null;
}

interface TrainingInitiativesList {
  items: TrainingInitiative[];
  total: number;
}

const COLUMNS: DataColumn<TrainingInitiative>[] = [
  {
    header: "Coorte",
    cell: (t) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{t.cohortName ?? "ND"}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{t.code}</span>
      </div>
    ),
  },
  { header: "Stato", cell: (t) => <StatusBadge value={t.status} /> },
  { header: "Inizio", cell: (t) => <span className="text-xs text-muted-foreground">{t.startDate ?? "—"}</span> },
  { header: "Fine", cell: (t) => <span className="text-xs text-muted-foreground">{t.endDate ?? "—"}</span> },
  { header: "Posti", cell: (t) => <span className="text-xs text-muted-foreground">{t.capacity ?? "—"}</span> },
];

export default function TrainingInitiativesPage() {
  const inits = useQuery({
    queryKey: ["training-initiatives", "list"],
    queryFn: () => apiFetch<TrainingInitiativesList>("/v1/training-initiatives?limit=200"),
  });

  return (
    <DataTablePanel<TrainingInitiative>
      pageTestId="training-page"
      titleTestId="training-title"
      countTestId="training-count"
      title="Iniziative formative"
      description="Sessioni di erogazione pianificate."
      count={inits.data ? `${inits.data.total} pianificate` : undefined}
      isLoading={inits.isLoading}
      isError={inits.isError}
      errorMessage="Impossibile caricare le iniziative."
      rows={inits.data?.items ?? []}
      rowKey={(t) => t.trainingInitiativeId}
      rowTestId="training-row"
      columns={COLUMNS}
      emptyTestId="training-empty"
      emptyTitle="Nessuna iniziativa"
      emptyDescription="Nessuna iniziativa schedulata."
      caption="Sessioni di erogazione"
    />
  );
}
