"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TrainingInitiative } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useFormat, type Formati } from "@/lib/format";

function buildColumns(t: TFunction, fmt: Formati): DataColumn<TrainingInitiative>[] {
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
    { header: t("training.cols.status"), cell: (ti) => <EnumStatusBadge domain="trainingInitiativeStatus" value={ti.status} /> },
    { header: t("training.cols.start"), cell: (ti) => <span className="text-xs text-muted-foreground">{fmt.data(ti.startDate)}</span> },
    { header: t("training.cols.end"), cell: (ti) => <span className="text-xs text-muted-foreground">{fmt.data(ti.endDate)}</span> },
    { header: t("training.cols.seats"), cell: (ti) => <span className="text-xs text-muted-foreground">{ti.capacity ?? "—"}</span> },
  ];
}

export default function TrainingInitiativesPage() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const columns = useMemo(() => buildColumns(t, fmt), [t, fmt]);
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
      error={inits.query.error}
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
