"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { LearningModule } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<LearningModule>[] {
  return [
    { header: t("shared.code"), cell: (m) => <span className="font-mono text-xs">{m.code}</span> },
    { header: t("shared.name"), cell: (m) => <span className="font-medium text-foreground">{m.title}</span> },
    {
      header: t("learning.cols.duration"),
      cell: (m) => <span className="text-xs text-muted-foreground">{m.durationMinutes ?? "—"}</span>,
    },
    {
      header: t("shared.scope"),
      cell: (m) => (
        <StatusPill tone={m.isGlobal ? "info" : "neutral"}>
          {m.isGlobal ? t("shared.global") : t("shared.tenant")}
        </StatusPill>
      ),
    },
  ];
}

export default function LearningCataloguePage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  // C4 (#42): server-side pagination (was `?limit=200`).
  const modules = usePaginatedList<LearningModule>({
    queryKey: ["learning-modules", "list"],
    path: "/v1/learning-modules",
  });

  return (
    <DataTablePanel<LearningModule>
      pageTestId="learning-page"
      titleTestId="learning-title"
      countTestId="learning-count"
      title={t("learning.title")}
      description={t("learning.description")}
      count={modules.query.data ? t("learning.count", { count: modules.total }) : undefined}
      isLoading={modules.query.isLoading}
      isError={modules.query.isError}
      errorMessage={t("learning.errorMessage")}
      rows={modules.rows}
      server={modules.server}
      rowKey={(m) => m.learningModuleId}
      rowTestId="learning-row"
      columns={columns}
      emptyTestId="learning-empty"
      emptyTitle={t("learning.emptyTitle")}
      emptyDescription={t("learning.emptyDescription")}
      caption={t("learning.caption")}
    />
  );
}
