"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge, StatusPill } from "@/components/status-pill";

interface MeLearningAssignment {
  learningPathId: string;
  learningPathName: string;
  status: string;
  mandatory: boolean;
  enrolledAt: string | null;
  completedAt: string | null;
}

interface MeLearningList {
  items: MeLearningAssignment[];
  total: number;
}

const COLUMNS: DataColumn<MeLearningAssignment>[] = [
  { header: "Percorso", cell: (l) => <span className="font-medium text-foreground">{l.learningPathName}</span> },
  { header: "Stato", cell: (l) => <StatusBadge value={l.status} /> },
  {
    header: "Obbligatorio",
    cell: (l) => (
      <StatusPill tone={l.mandatory ? "info" : "neutral"}>{l.mandatory ? "SÌ" : "NO"}</StatusPill>
    ),
  },
  {
    header: "Iscrizione",
    cell: (l) => <span className="text-xs text-muted-foreground">{l.enrolledAt?.slice(0, 10) ?? "—"}</span>,
  },
  {
    header: "Completato",
    cell: (l) => <span className="text-xs text-muted-foreground">{l.completedAt?.slice(0, 10) ?? "—"}</span>,
  },
];

export default function MeLearningPage() {
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<MeLearningList>("/v1/me/learning"),
  });

  return (
    <DataTablePanel<MeLearningAssignment>
      pageTestId="me-learning-page"
      titleTestId="me-learning-title"
      countTestId="me-learning-count"
      title="I miei percorsi"
      description="I percorsi formativi a te assegnati."
      count={learning.data ? `${learning.data.total} percorsi` : undefined}
      isLoading={learning.isLoading}
      isError={learning.isError}
      errorMessage="Impossibile caricare i percorsi."
      rows={learning.data?.items ?? []}
      rowKey={(l) => l.learningPathId}
      rowTestId="me-learning-row"
      columns={COLUMNS}
      emptyTestId="me-learning-empty"
      emptyTitle="Nessun percorso assegnato"
      emptyDescription="Non hai percorsi formativi assegnati."
      caption="Percorsi assegnati"
    />
  );
}
