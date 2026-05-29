"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "../../../lib/api/fetch";
import { DataTablePanel, type DataColumn } from "../../../components/data-table-panel";
import { StatusBadge, StatusPill } from "../../../components/status-pill";

interface Position {
  positionId: string;
  code: string;
  title: string;
  tenantId: string;
  organizationUnitId: string | null;
  jobRoleId: string | null;
  reportsToPositionId: string | null;
  ownerUserId: string | null;
  criticality: string | null;
  isActive: boolean;
}
interface PositionsList {
  items: Position[];
  total: number;
}

const COLUMNS: DataColumn<Position>[] = [
  { header: "Codice", cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
  {
    header: "Titolo",
    cell: (p) => (
      <Link href={`/positions/${p.positionId}`} data-testid="position-link" className="font-medium text-foreground underline-offset-2 hover:underline">
        {p.title}
      </Link>
    ),
  },
  { header: "Criticità", cell: (p) => <StatusBadge value={p.criticality} /> },
  {
    header: "Attiva",
    cell: (p) => (
      <StatusPill tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Attiva" : "Inattiva"}</StatusPill>
    ),
  },
];

export default function PositionsListPage() {
  const positions = useQuery({
    queryKey: ["positions", "list"],
    queryFn: () => apiFetch<PositionsList>("/v1/positions"),
  });

  return (
    <DataTablePanel<Position>
      pageTestId="positions-page"
      titleTestId="positions-title"
      countTestId="positions-count"
      title="Posizioni"
      description="Posizioni del tenant con criticità e stato."
      count={positions.data ? `${positions.data.total} totali` : undefined}
      isLoading={positions.isLoading}
      isError={positions.isError}
      errorTestId="positions-error"
      errorMessage="Impossibile caricare le posizioni."
      rows={positions.data?.items ?? []}
      rowKey={(p) => p.positionId}
      rowTestId="positions-row"
      columns={COLUMNS}
      emptyTestId="positions-empty"
      emptyTitle="Nessuna posizione"
      emptyDescription="Non ci sono posizioni nel tenant."
      caption="Elenco posizioni"
    />
  );
}
