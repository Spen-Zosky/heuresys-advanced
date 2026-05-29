"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface SeedRun {
  seedAcquisitionRunId: string;
  tenantId: string | null;
  blueprintVariantId: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  initiatedBy: string | null;
  metadata: Record<string, unknown>;
}

interface SeedRunsList {
  items: SeedRun[];
  total: number;
}

const COLUMNS: DataColumn<SeedRun>[] = [
  {
    header: "Run ID",
    cell: (r) => <span className="font-mono text-xs">{r.seedAcquisitionRunId.slice(0, 8)}</span>,
  },
  {
    header: "Variant",
    cell: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.blueprintVariantId?.slice(0, 8) ?? "—"}</span>
    ),
  },
  { header: "Stato", cell: (r) => <StatusBadge value={r.status} /> },
  {
    header: "Inizio",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt?.slice(0, 19) ?? "—"}</span>,
  },
  {
    header: "Fine",
    cell: (r) => <span className="text-xs text-muted-foreground">{r.finishedAt?.slice(0, 19) ?? "—"}</span>,
  },
];

export default function SeedRunsPage() {
  const runs = useQuery({
    queryKey: ["seed-acquisition-runs", "list"],
    queryFn: () => apiFetch<SeedRunsList>("/v1/seed-acquisition-runs?limit=200"),
  });

  return (
    <DataTablePanel<SeedRun>
      pageTestId="seed-runs-page"
      titleTestId="seed-runs-title"
      countTestId="seed-runs-count"
      title="Seed acquisition — Runs"
      description="Run della pipeline di acquisizione seed."
      count={runs.data ? `${runs.data.total} run` : undefined}
      isLoading={runs.isLoading}
      isError={runs.isError}
      errorMessage="Impossibile caricare i run."
      rows={runs.data?.items ?? []}
      rowKey={(r) => r.seedAcquisitionRunId}
      rowTestId="seed-runs-row"
      columns={COLUMNS}
      emptyTestId="seed-runs-empty"
      emptyTitle="Nessun run"
      emptyDescription="Nessun run di acquisizione registrato."
      caption="Pipeline runs"
    />
  );
}
