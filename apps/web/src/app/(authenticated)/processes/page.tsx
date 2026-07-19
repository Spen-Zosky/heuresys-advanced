"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { BlueprintProcess } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<BlueprintProcess>[] {
  return [
    { header: t("processes.columns.ordinal"), cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
    { header: t("processes.columns.code"), cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
    { header: t("processes.columns.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    {
      header: t("processes.columns.optional"),
      cell: (p) => <StatusPill tone={p.isOptional ? "warning" : "neutral"}>{p.isOptional ? t("processes.yes") : t("processes.no")}</StatusPill>,
    },
  ];
}

export default function ProcessesPage() {
  const { t } = useTranslation("blueprints");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const processes = usePaginatedList<BlueprintProcess>({
    queryKey: ["blueprint-processes", "list"],
    path: "/v1/blueprint-processes",
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<BlueprintProcess>
      pageTestId="processes-page"
      titleTestId="processes-title"
      countTestId="processes-count"
      title={t("processes.title")}
      description={t("processes.description")}
      count={processes.query.data ? t("processes.count", { count: processes.total }) : undefined}
      isLoading={processes.query.isLoading}
      isError={processes.query.isError}
      errorMessage={t("processes.error")}
      rows={processes.rows}
      server={processes.server}
      rowKey={(p) => p.blueprintProcessId}
      rowTestId="processes-row"
      columns={columns}
      emptyTestId="processes-empty"
      emptyTitle={t("processes.emptyTitle")}
      emptyDescription={t("processes.emptyDescription")}
      caption={t("processes.caption")}
    />
  );
}
