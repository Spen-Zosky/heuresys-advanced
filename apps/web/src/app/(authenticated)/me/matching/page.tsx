"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { OccupationMatch } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";

/**
 * Mirrors OccupationMatchListResponseSchema in @heuresys/shared. The schema's
 * inferred type is not re-exported there (only the `OccupationMatch` row type is),
 * so we declare the response envelope locally — same convention as other /me pages.
 */
interface OccupationMatchListResponse {
  items: OccupationMatch[];
  total: number;
  evidenceCount: number;
}

/** Last path segment of an ESCO URI, used as a human-ish fallback when label is null. */
function escoUriTail(uri: string): string {
  const trimmed = uri.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

export default function MeMatchingPage() {
  const { t } = useTranslation("ess");
  const matching = useQuery({
    queryKey: ["me", "matching", "occupations"],
    queryFn: () => apiFetch<OccupationMatchListResponse>("/v1/matching/me/occupations"),
  });

  const columns = useMemo<DataColumn<OccupationMatch>[]>(
    () => [
      {
        header: t("matching.colOccupation"),
        cell: (m) => (
          <span className="font-medium text-foreground">{m.label ?? escoUriTail(m.escoUri)}</span>
        ),
      },
      {
        header: t("matching.colIsco"),
        cell: (m) => <span className="text-xs text-muted-foreground">{m.iscoCode ?? "—"}</span>,
      },
      {
        header: t("matching.colScore"),
        align: "right",
        cell: (m) => (
          <span className="font-medium tabular-nums text-foreground">{`${(m.score * 100).toFixed(0)}%`}</span>
        ),
      },
    ],
    [t],
  );

  const noEvidence = matching.data?.evidenceCount === 0;

  return (
    <DataTablePanel<OccupationMatch>
      pageTestId="me-matching-page"
      titleTestId="me-matching-title"
      countTestId="me-matching-count"
      title={t("matching.title")}
      description={t("matching.description")}
      count={matching.data ? t("matching.count", { count: matching.data.total }) : undefined}
      isLoading={matching.isLoading}
      isError={matching.isError}
      errorMessage={t("matching.errorMessage")}
      rows={matching.data?.items ?? []}
      rowKey={(m) => m.escoUri}
      rowTestId="me-match-row"
      columns={columns}
      emptyTestId="me-matching-empty"
      emptyTitle={noEvidence ? t("matching.emptyEvidenceTitle") : t("matching.emptyTitle")}
      emptyDescription={noEvidence ? t("matching.emptyEvidenceDesc") : t("matching.emptyDesc")}
      caption={t("matching.caption")}
    />
  );
}
