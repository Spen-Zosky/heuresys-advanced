"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeLearningAssignment, MeLearningResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";

export default function MeLearningPage() {
  const { t } = useTranslation("ess");
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<MeLearningResponse>("/v1/me/learning"),
  });

  const columns = useMemo<DataColumn<MeLearningAssignment>[]>(
    () => [
      {
        header: t("learning.colTitle"),
        cell: (l) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{l.title ?? "—"}</span>
            {l.kind === "INITIATIVE" && l.initiativeCode ? (
              <span className="text-xs text-muted-foreground">{l.initiativeCode}</span>
            ) : null}
          </div>
        ),
      },
      { header: t("learning.colStatus"), cell: (l) => <EnumStatusBadge domain="learningAssignStatus" value={l.status} /> },
      {
        header: t("learning.colMandatory"),
        cell: (l) => (
          <StatusPill tone={l.isMandatory ? "info" : "neutral"}>
            {l.isMandatory ? t("learning.mandatoryYes") : t("learning.mandatoryNo")}
          </StatusPill>
        ),
      },
      {
        header: t("learning.colEnrolled"),
        cell: (l) => <span className="text-xs text-muted-foreground">{l.enrolledAt?.slice(0, 10) ?? "—"}</span>,
      },
      {
        header: t("learning.colDeadline"),
        cell: (l) => <span className="text-xs text-muted-foreground">{l.deadline ?? "—"}</span>,
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
      rowKey={(l) => l.userLearningAssignmentId}
      rowTestId="me-learning-row"
      columns={columns}
      emptyTestId="me-learning-empty"
      emptyTitle={t("learning.emptyTitle")}
      emptyDescription={t("learning.emptyDesc")}
      caption={t("learning.caption")}
    />
  );
}
