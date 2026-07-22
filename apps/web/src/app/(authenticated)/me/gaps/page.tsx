"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";

import type { MeGap, MeGapsResponse } from "@heuresys/shared";

export default function MeGapsPage() {
  const { t } = useTranslation("ess");
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGapsResponse>("/v1/me/gaps"),
  });

  // Columns mirror the real MeGapSchema contract (census F4 S1026: the page
  // used to render 3 phantom fields and dropped the real `score`).
  const columns = useMemo<DataColumn<MeGap>[]>(
    () => [
      { header: t("gaps.colSkill"), cell: (g) => <span className="font-medium text-foreground">{g.skillId ? g.skillId.slice(0, 8) : t("gaps.skillFallback")}</span> },
      { header: t("gaps.colSeverity"), cell: (g) => <EnumStatusBadge domain="severity" value={g.severity} /> },
      {
        header: t("gaps.colScore"),
        cell: (g) => <span className="text-xs text-muted-foreground">{g.score !== null ? g.score.toFixed(1) : "—"}</span>,
      },
      { header: t("gaps.colDetected"), cell: (g) => <span className="text-xs text-muted-foreground">{g.detectedAt.slice(0, 10)}</span> },
    ],
    [t],
  );

  return (
    <DataTablePanel<MeGap>
      pageTestId="me-gaps-page"
      titleTestId="me-gaps-title"
      countTestId="me-gaps-count"
      title={t("gaps.title")}
      description={t("gaps.description")}
      count={gaps.data ? t("gaps.count", { count: gaps.data.total }) : undefined}
      isLoading={gaps.isLoading}
      isError={gaps.isError}
      errorMessage={t("gaps.errorMessage")}
      rows={gaps.data?.items ?? []}
      rowKey={(g) => g.learningGapId}
      rowTestId="me-gap-row"
      columns={columns}
      emptyTestId="me-gaps-empty"
      emptyTitle={t("gaps.emptyTitle")}
      emptyDescription={t("gaps.emptyDesc")}
      caption={t("gaps.caption")}
    />
  );
}
