"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Input } from "@heuresys/ui";
import type { ContentDocument } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

/**
 * ESS knowledge base — "Manuale del dipendente" (cap④ CMS P2, ADR-0011).
 * Read-only list of the tenant's PUBLISHED content via GET /v1/me/content
 * (published-only + effective-window enforced server-side). Live data, no mock.
 */
export default function MeHandbookPage() {
  const { t } = useTranslation("ess");
  const [q, setQ] = useState("");

  // C4 (#42): server-side pagination (was `?limit=200`).
  const docs = usePaginatedList<ContentDocument>({
    queryKey: ["me", "handbook", "list"],
    path: "/v1/me/content",
    params: { q },
  });

  const columns: DataColumn<ContentDocument>[] = useMemo(
    () => [
      {
        header: t("handbook.colTitle"),
        cell: (d) => (
          <Link href={`/me/handbook/${d.documentId}`} data-testid="handbook-row-link" className="font-medium text-foreground hover:underline">
            {d.title}
          </Link>
        ),
      },
      { header: t("handbook.colKind"), cell: (d) => <span className="text-muted-foreground">{t(`handbook.kind.${d.kind}`)}</span> },
      { header: t("handbook.colUpdated"), cell: (d) => <span className="text-xs text-muted-foreground">{(d.publishedAt ?? d.updatedAt).slice(0, 10)}</span> },
    ],
    [t],
  );

  return (
    <DataTablePanel<ContentDocument>
      pageTestId="handbook-page"
      titleTestId="handbook-title"
      countTestId="handbook-count"
      title={t("handbook.title")}
      description={t("handbook.description")}
      count={docs.query.data ? t("handbook.count", { count: docs.total }) : t("common:loading")}
      actions={
        <Input
          data-testid="handbook-search"
          placeholder={t("handbook.searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64"
        />
      }
      isLoading={docs.query.isLoading}
      isError={docs.query.isError}
      errorMessage={t("handbook.errorMessage")}
      rows={docs.rows}
      server={docs.server}
      rowKey={(d) => d.documentId}
      rowTestId="handbook-row"
      columns={columns}
      emptyTestId="handbook-empty"
      emptyTitle={t("handbook.emptyTitle")}
      emptyDescription={t("handbook.emptyDescription")}
      caption={t("handbook.caption")}
    />
  );
}
