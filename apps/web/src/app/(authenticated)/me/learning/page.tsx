"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";

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

export default function MeLearningPage() {
  const { t } = useTranslation("ess");
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<MeLearningList>("/v1/me/learning"),
  });

  const columns = useMemo<DataColumn<MeLearningAssignment>[]>(
    () => [
      { header: t("learning.colPath"), cell: (l) => <span className="font-medium text-foreground">{l.learningPathName}</span> },
      { header: t("learning.colStatus"), cell: (l) => <EnumStatusBadge domain="learningAssignStatus" value={l.status} /> },
      {
        header: t("learning.colMandatory"),
        cell: (l) => (
          <StatusPill tone={l.mandatory ? "info" : "neutral"}>{l.mandatory ? t("learning.mandatoryYes") : t("learning.mandatoryNo")}</StatusPill>
        ),
      },
      {
        header: t("learning.colEnrolled"),
        cell: (l) => <span className="text-xs text-muted-foreground">{l.enrolledAt?.slice(0, 10) ?? "—"}</span>,
      },
      {
        header: t("learning.colCompleted"),
        cell: (l) => <span className="text-xs text-muted-foreground">{l.completedAt?.slice(0, 10) ?? "—"}</span>,
      },
    ],
    [t],
  );

  return (
    <DataTablePanel<MeLearningAssignment>
      pageTestId="me-learning-page"
      titleTestId="me-learning-title"
      countTestId="me-learning-count"
      title={t("learning.title")}
      description={t("learning.description")}
      count={learning.data ? t("learning.count", { count: learning.data.total }) : undefined}
      isLoading={learning.isLoading}
      isError={learning.isError}
      errorMessage={t("learning.errorMessage")}
      rows={learning.data?.items ?? []}
      rowKey={(l) => l.learningPathId}
      rowTestId="me-learning-row"
      columns={columns}
      emptyTestId="me-learning-empty"
      emptyTitle={t("learning.emptyTitle")}
      emptyDescription={t("learning.emptyDesc")}
      caption={t("learning.caption")}
    />
  );
}
