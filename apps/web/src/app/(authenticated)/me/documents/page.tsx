"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

export default function MeDocumentsPage() {
  const { t } = useTranslation("ess");
  const docs = useQuery({
    queryKey: ["me", "documents"],
    queryFn: () => apiFetch<MeDocumentsList>("/v1/me/documents"),
  });

  const columns = useMemo<DataColumn<MeDocument>[]>(
    () => [
      {
        header: t("documents.colKind"),
        cell: (d) => (d.kind ? <StatusPill tone="info">{d.kind}</StatusPill> : <span className="text-muted-foreground">—</span>),
      },
      { header: t("documents.colTitle"), cell: (d) => <span className="font-medium text-foreground">{d.title}</span> },
      {
        header: t("documents.colUri"),
        cell: (d) => <span className="font-mono text-xs break-all text-muted-foreground">{d.uri}</span>,
      },
      {
        header: t("documents.colMime"),
        cell: (d) => <span className="text-xs text-muted-foreground">{d.mimeType ?? "—"}</span>,
      },
    ],
    [t],
  );

  return (
    <DataTablePanel<MeDocument>
      pageTestId="me-documents-page"
      titleTestId="me-documents-title"
      countTestId="me-documents-count"
      title={t("documents.title")}
      description={t("documents.description")}
      count={docs.data ? t("documents.count", { count: docs.data.total }) : undefined}
      isLoading={docs.isLoading}
      isError={docs.isError}
      errorMessage={t("documents.errorMessage")}
      rows={docs.data?.items ?? []}
      rowKey={(d) => d.userDocumentId}
      rowTestId="me-document-row"
      columns={columns}
      emptyTestId="me-documents-empty"
      emptyTitle={t("documents.emptyTitle")}
      emptyDescription={t("documents.emptyDesc")}
      caption={t("documents.caption")}
    />
  );
}
