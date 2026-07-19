"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TrainingInitiative } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<TrainingInitiative>[] {
  return [
    {
      header: t("training.cols.cohort"),
      cell: (ti) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{ti.cohortName ?? t("training.cohortNd")}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{ti.code}</span>
        </div>
      ),
    },
    { header: t("training.cols.status"), cell: (ti) => <StatusBadge value={ti.status} /> },
    { header: t("training.cols.start"), cell: (ti) => <span className="text-xs text-muted-foreground">{ti.startDate ?? "—"}</span> },
    { header: t("training.cols.end"), cell: (ti) => <span className="text-xs text-muted-foreground">{ti.endDate ?? "—"}</span> },
    { header: t("training.cols.seats"), cell: (ti) => <span className="text-xs text-muted-foreground">{ti.capacity ?? "—"}</span> },
  ];
}

export default function TrainingInitiativesPage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const inits = usePaginatedList<TrainingInitiative>({
    queryKey: ["training-initiatives", "list"],
    path: "/v1/training-initiatives",
  });

  return (
    <DataTablePanel<TrainingInitiative>
      pageTestId="training-page"
      titleTestId="training-title"
      countTestId="training-count"
      title={t("training.title")}
      description={t("training.description")}
      count={inits.query.data ? t("training.count", { count: inits.total }) : undefined}
      isLoading={inits.query.isLoading}
      isError={inits.query.isError}
      errorMessage={t("training.errorMessage")}
      rows={inits.rows}
      server={inits.server}
      rowKey={(ti) => ti.trainingInitiativeId}
      rowTestId="training-row"
      columns={columns}
      emptyTestId="training-empty"
      emptyTitle={t("training.emptyTitle")}
      emptyDescription={t("training.emptyDescription")}
      caption={t("training.caption")}
    />
  );
}
