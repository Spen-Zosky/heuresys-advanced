"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

export default function MeGapsPage() {
  const { t } = useTranslation("ess");
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGapsList>("/v1/me/gaps"),
  });

  const columns = useMemo<DataColumn<MeGap>[]>(
    () => [
      { header: t("gaps.colSkill"), cell: (g) => <span className="font-medium text-foreground">{g.skillName ?? t("gaps.skillFallback")}</span> },
      { header: t("gaps.colSeverity"), cell: (g) => <StatusBadge value={g.severity} /> },
      {
        header: t("gaps.colRequired"),
        cell: (g) => <span className="text-xs text-muted-foreground">{g.requiredProficiency ?? "—"}</span>,
      },
      {
        header: t("gaps.colCurrent"),
        cell: (g) => <span className="text-xs text-muted-foreground">{g.currentProficiency ?? "—"}</span>,
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
