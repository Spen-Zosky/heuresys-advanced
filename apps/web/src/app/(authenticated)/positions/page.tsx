"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { Position } from "@heuresys/shared";
import { apiFetch } from "../../../lib/api/fetch";
import { DataTablePanel, type DataColumn } from "../../../components/data-table-panel";
import { StatusBadge, StatusPill } from "../../../components/status-pill";

interface PositionsList {
  items: Position[];
  total: number;
}

export default function PositionsListPage() {
  const { t } = useTranslation("admin");
  const positions = useQuery({
    queryKey: ["positions", "list"],
    queryFn: () => apiFetch<PositionsList>("/v1/positions"),
  });

  const columns = useMemo<DataColumn<Position>[]>(
    () => [
      { header: t("positions.columns.code"), cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
      {
        header: t("positions.columns.title"),
        cell: (p) => (
          <Link href={`/positions/${p.positionId}`} data-testid="position-link" className="font-medium text-foreground underline-offset-2 hover:underline">
            {p.title}
          </Link>
        ),
      },
      { header: t("positions.columns.criticality"), cell: (p) => <StatusBadge value={p.criticality} /> },
      {
        header: t("positions.columns.active"),
        cell: (p) => (
          <StatusPill tone={p.isActive ? "success" : "neutral"}>{p.isActive ? t("positions.activeOn") : t("positions.activeOff")}</StatusPill>
        ),
      },
    ],
    [t],
  );

  return (
    <DataTablePanel<Position>
      pageTestId="positions-page"
      titleTestId="positions-title"
      countTestId="positions-count"
      title={t("positions.title")}
      description={t("positions.description")}
      count={positions.data ? t("positions.count", { count: positions.data.total }) : undefined}
      isLoading={positions.isLoading}
      isError={positions.isError}
      errorTestId="positions-error"
      errorMessage={t("positions.errorMessage")}
      rows={positions.data?.items ?? []}
      rowKey={(p) => p.positionId}
      rowTestId="positions-row"
      columns={columns}
      emptyTestId="positions-empty"
      emptyTitle={t("positions.emptyTitle")}
      emptyDescription={t("positions.emptyDescription")}
      caption={t("positions.caption")}
    />
  );
}
