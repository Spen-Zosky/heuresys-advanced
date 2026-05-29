"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";

interface MePositionAssignment {
  userPositionAssignmentId: string;
  positionId: string;
  positionCode: string;
  positionTitle: string;
  isPrimary: boolean;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface MePositionsList {
  items: MePositionAssignment[];
  total: number;
}

const COLUMNS: DataColumn<MePositionAssignment>[] = [
  { header: "Codice", cell: (p) => <span className="font-mono text-xs">{p.positionCode}</span> },
  { header: "Titolo", cell: (p) => <span className="font-medium text-foreground">{p.positionTitle}</span> },
  {
    header: "Tipo",
    cell: (p) => (
      <StatusPill tone={p.isPrimary ? "info" : "neutral"}>{p.isPrimary ? "PRIMARY" : "ALT"}</StatusPill>
    ),
  },
  { header: "Stato", cell: (p) => <StatusBadge value={p.status} /> },
  { header: "Inizio", cell: (p) => <span className="text-xs text-muted-foreground">{p.startDate ?? "—"}</span> },
  { header: "Fine", cell: (p) => <span className="text-xs text-muted-foreground">{p.endDate ?? "—"}</span> },
];

export default function MePositionsPage() {
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<MePositionsList>("/v1/me/positions"),
  });

  return (
    <DataTablePanel<MePositionAssignment>
      pageTestId="me-positions-page"
      titleTestId="me-positions-title"
      countTestId="me-positions-count"
      title="Le mie posizioni"
      description="Storico delle tue assegnazioni di posizione."
      count={positions.data ? `${positions.data.total} assegnazioni` : undefined}
      isLoading={positions.isLoading}
      isError={positions.isError}
      errorMessage="Impossibile caricare le posizioni."
      rows={positions.data?.items ?? []}
      rowKey={(p) => p.userPositionAssignmentId}
      rowTestId="me-position-row"
      columns={COLUMNS}
      emptyTestId="me-positions-empty"
      emptyTitle="Nessuna assegnazione"
      emptyDescription="Non hai assegnazioni di posizione."
      caption="Storico assegnazioni"
    />
  );
}
