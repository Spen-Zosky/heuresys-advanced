"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// Gap#1 Porta 1 — Process-Owner console. Live blueprint-process catalog
// (/v1/blueprint-processes). Graph navigation of the process layer (NOT BPM runtime,
// which is Gap #2). The RACI drill-down (/v1/organization-unit-processes/by-process/:id)
// is the next layer. No mock data: a real empty-state when the catalog is empty.
interface ProcessRow { blueprintProcessId: string; code: string; name: string; ordinal: number; isOptional: boolean }
interface ProcessList { items: ProcessRow[]; total: number }

function buildColumns(t: TFunction): DataColumn<ProcessRow>[] {
  return [
    { header: t("processOwner.cols.ordinal"), cell: (p) => <span className="text-xs text-muted-foreground">{p.ordinal}</span> },
    { header: t("processOwner.cols.code"), cell: (p) => <span className="text-xs text-muted-foreground">{p.code}</span> },
    { header: t("processOwner.cols.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    { header: t("processOwner.cols.kind"), cell: (p) => <StatusPill tone={p.isOptional ? "neutral" : "info"}>{p.isOptional ? t("processOwner.optional") : t("processOwner.core")}</StatusPill> },
  ];
}

export default function ProcessOwnerPage() {
  const { t } = useTranslation("hr");
  const columns = useMemo(() => buildColumns(t), [t]);
  const processes = useQuery({
    queryKey: ["blueprint-processes", "list"],
    queryFn: () => apiFetch<ProcessList>("/v1/blueprint-processes?limit=200"),
  });
  const rows = useMemo<ProcessRow[]>(
    () => [...(processes.data?.items ?? [])].sort((a, b) => a.ordinal - b.ordinal),
    [processes.data],
  );

  return (
    <DataTablePanel<ProcessRow>
      pageTestId="process-owner-page" titleTestId="process-owner-title" countTestId="process-owner-count"
      title={t("processOwner.title")} description={t("processOwner.description")}
      count={processes.data ? t("processOwner.count", { count: processes.data.total }) : undefined}
      isLoading={processes.isLoading} isError={processes.isError} errorMessage={t("processOwner.errorMessage")}
      rows={rows} rowKey={(p) => p.blueprintProcessId} rowTestId="process-owner-row" columns={columns}
      emptyTestId="process-owner-empty" emptyTitle={t("processOwner.emptyTitle")} emptyDescription={t("processOwner.emptyDescription")} caption={t("processOwner.caption")}
    />
  );
}
