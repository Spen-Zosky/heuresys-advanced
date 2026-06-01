"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface MeDocument {
  userDocumentId: string;
  kind: string;
  title: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

interface MeDocumentsList {
  items: MeDocument[];
  total: number;
}

const COLUMNS: DataColumn<MeDocument>[] = [
  {
    header: "Tipo",
    cell: (d) => (d.kind ? <StatusPill tone="info">{d.kind}</StatusPill> : <span className="text-muted-foreground">—</span>),
  },
  { header: "Titolo", cell: (d) => <span className="font-medium text-foreground">{d.title}</span> },
  {
    header: "URI",
    cell: (d) => <span className="font-mono text-xs break-all text-muted-foreground">{d.uri}</span>,
  },
  {
    header: "Tipo MIME",
    cell: (d) => <span className="text-xs text-muted-foreground">{d.mimeType ?? "—"}</span>,
  },
];

export default function MeDocumentsPage() {
  const docs = useQuery({
    queryKey: ["me", "documents"],
    queryFn: () => apiFetch<MeDocumentsList>("/v1/me/documents"),
  });

  return (
    <DataTablePanel<MeDocument>
      pageTestId="me-documents-page"
      titleTestId="me-documents-title"
      countTestId="me-documents-count"
      title="I miei documenti"
      description="Documenti caricati sul tuo profilo."
      count={docs.data ? `${docs.data.total} documenti` : undefined}
      isLoading={docs.isLoading}
      isError={docs.isError}
      errorMessage="Impossibile caricare i documenti."
      rows={docs.data?.items ?? []}
      rowKey={(d) => d.userDocumentId}
      rowTestId="me-document-row"
      columns={COLUMNS}
      emptyTestId="me-documents-empty"
      emptyTitle="Nessun documento"
      emptyDescription="Nessun documento caricato."
      caption="Elenco documenti"
    />
  );
}
