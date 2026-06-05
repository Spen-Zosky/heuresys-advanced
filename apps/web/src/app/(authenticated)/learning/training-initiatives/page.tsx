"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface TrainingInitiative {
  trainingInitiativeId: string;
  tenantId: string;
  moduleId: string;
  code: string;
  cohortName: string | null;
  startDate: string | null;
  endDate: string | null;
  facilitatorUserId: string | null;
  status: string;
  capacity: number | null;
}

interface TrainingInitiativesList {
  items: TrainingInitiative[];
  total: number;
}

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
  const inits = useQuery({
    queryKey: ["training-initiatives", "list"],
    queryFn: () => apiFetch<TrainingInitiativesList>("/v1/training-initiatives?limit=200"),
  });

  return (
    <DataTablePanel<TrainingInitiative>
      pageTestId="training-page"
      titleTestId="training-title"
      countTestId="training-count"
      title={t("training.title")}
      description={t("training.description")}
      count={inits.data ? t("training.count", { count: inits.data.total }) : undefined}
      isLoading={inits.isLoading}
      isError={inits.isError}
      errorMessage={t("training.errorMessage")}
      rows={inits.data?.items ?? []}
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
