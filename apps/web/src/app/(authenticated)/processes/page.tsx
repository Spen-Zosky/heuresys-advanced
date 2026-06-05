"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface BlueprintProcess {
  blueprintProcessId: string;
  variantId: string;
  code: string;
  name: string;
  ordinal: number;
  description: string | null;
  isOptional: boolean;
}

interface BlueprintProcessesList {
  items: BlueprintProcess[];
  total: number;
}

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
  const processes = useQuery({
    queryKey: ["blueprint-processes", "list"],
    queryFn: () => apiFetch<BlueprintProcessesList>("/v1/blueprint-processes?limit=200"),
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<BlueprintProcess>
      pageTestId="processes-page"
      titleTestId="processes-title"
      countTestId="processes-count"
      title={t("processes.title")}
      description={t("processes.description")}
      count={processes.data ? t("processes.count", { count: processes.data.total }) : undefined}
      isLoading={processes.isLoading}
      isError={processes.isError}
      errorMessage={t("processes.error")}
      rows={processes.data?.items ?? []}
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
