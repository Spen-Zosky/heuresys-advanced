"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { SeedAcquisitionRun } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

function buildColumns(t: TFunction): DataColumn<SeedAcquisitionRun>[] {
  const none = t("common:value.none");
  return [
    {
      header: t("seedRuns.columns.runId"),
      cell: (r) => <span className="font-mono text-xs">{r.seedAcquisitionRunId.slice(0, 8)}</span>,
    },
    {
      // Was a `blueprintVariantId` column — a field the API never returned, so it
      // rendered the "none" dash on every row. Replaced with the run code, which
      // the contract does expose (C4 #42: local interfaces had drifted).
      header: t("seedRuns.columns.code"),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span>,
    },
    { header: t("seedRuns.columns.status"), cell: (r) => <StatusBadge value={r.status} /> },
    {
      header: t("seedRuns.columns.startedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt.slice(0, 19)}</span>,
    },
    {
      header: t("seedRuns.columns.finishedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.finishedAt?.slice(0, 19) ?? none}</span>,
    },
  ];
}

export default function SeedRunsPage() {
  const { t } = useTranslation("blueprints");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const runs = usePaginatedList<SeedAcquisitionRun>({
    queryKey: ["seed-acquisition-runs", "list"],
    path: "/v1/seed-acquisition-runs",
  });

  const columns = useMemo(() => buildColumns(t), [t]);

  return (
    <DataTablePanel<SeedAcquisitionRun>
      pageTestId="seed-runs-page"
      titleTestId="seed-runs-title"
      countTestId="seed-runs-count"
      title={t("seedRuns.title")}
      description={t("seedRuns.description")}
      count={runs.query.data ? t("seedRuns.count", { count: runs.total }) : undefined}
      isLoading={runs.query.isLoading}
      isError={runs.query.isError}
      errorMessage={t("seedRuns.error")}
      rows={runs.rows}
      server={runs.server}
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
