"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface SeedRun {
  seedAcquisitionRunId: string;
  tenantId: string | null;
  blueprintVariantId: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  initiatedBy: string | null;
  metadata: Record<string, unknown>;
}

interface SeedRunsList {
  items: SeedRun[];
  total: number;
}

function buildColumns(t: TFunction): DataColumn<SeedRun>[] {
  const none = t("common:value.none");
  return [
    {
      header: t("seedRuns.columns.runId"),
      cell: (r) => <span className="font-mono text-xs">{r.seedAcquisitionRunId.slice(0, 8)}</span>,
    },
    {
      header: t("seedRuns.columns.variant"),
      cell: (r) => (
        <span className="font-mono text-xs text-muted-foreground">{r.blueprintVariantId?.slice(0, 8) ?? none}</span>
      ),
    },
    { header: t("seedRuns.columns.status"), cell: (r) => <StatusBadge value={r.status} /> },
    {
      header: t("seedRuns.columns.startedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt?.slice(0, 19) ?? none}</span>,
    },
    {
      header: t("seedRuns.columns.finishedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.finishedAt?.slice(0, 19) ?? none}</span>,
    },
  ];
}

export default function SeedRunsPage() {
  const { t } = useTranslation("blueprints");
  const runs = useQuery({
    queryKey: ["seed-acquisition-runs", "list"],
    queryFn: () => apiFetch<SeedRunsList>("/v1/seed-acquisition-runs?limit=200"),
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<SeedRun>
      pageTestId="seed-runs-page"
      titleTestId="seed-runs-title"
      countTestId="seed-runs-count"
      title={t("seedRuns.title")}
      description={t("seedRuns.description")}
      count={runs.data ? t("seedRuns.count", { count: runs.data.total }) : undefined}
      isLoading={runs.isLoading}
      isError={runs.isError}
      errorMessage={t("seedRuns.error")}
      rows={runs.data?.items ?? []}
      rowKey={(r) => r.seedAcquisitionRunId}
      rowTestId="seed-runs-row"
      columns={columns}
      emptyTestId="seed-runs-empty"
      emptyTitle={t("seedRuns.emptyTitle")}
      emptyDescription={t("seedRuns.emptyDescription")}
      caption={t("seedRuns.caption")}
    />
  );
}
