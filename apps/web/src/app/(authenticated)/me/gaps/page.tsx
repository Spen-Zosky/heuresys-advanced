"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface MeGap {
  learningGapId: string;
  skillId: string | null;
  skillName: string | null;
  positionId: string | null;
  severity: string;
  requiredProficiency: string | null;
  currentProficiency: string | null;
  detectedAt: string;
}

interface MeGapsList {
  items: MeGap[];
  total: number;
}

const COLUMNS: DataColumn<MeGap>[] = [
  { header: "Skill", cell: (g) => <span className="font-medium text-foreground">{g.skillName ?? "Generale"}</span> },
  { header: "Severità", cell: (g) => <StatusBadge value={g.severity} /> },
  {
    header: "Richiesto",
    cell: (g) => <span className="text-xs text-muted-foreground">{g.requiredProficiency ?? "—"}</span>,
  },
  {
    header: "Attuale",
    cell: (g) => <span className="text-xs text-muted-foreground">{g.currentProficiency ?? "—"}</span>,
  },
  { header: "Rilevato", cell: (g) => <span className="text-xs text-muted-foreground">{g.detectedAt.slice(0, 10)}</span> },
];

export default function MeGapsPage() {
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGapsList>("/v1/me/gaps"),
  });

  return (
    <DataTablePanel<MeGap>
      pageTestId="me-gaps-page"
      titleTestId="me-gaps-title"
      countTestId="me-gaps-count"
      title="I miei gap"
      description="Gap di sviluppo aperti sulle tue skill."
      count={gaps.data ? `${gaps.data.total} aperti` : undefined}
      isLoading={gaps.isLoading}
      isError={gaps.isError}
      errorMessage="Impossibile caricare i gap."
      rows={gaps.data?.items ?? []}
      rowKey={(g) => g.learningGapId}
      rowTestId="me-gap-row"
      columns={COLUMNS}
      emptyTestId="me-gaps-empty"
      emptyTitle="Nessun gap aperto"
      emptyDescription="Non hai gap di sviluppo aperti."
      caption="Gap di sviluppo"
    />
  );
}
