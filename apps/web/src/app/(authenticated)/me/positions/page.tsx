"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";

interface MePositionAssignment {
  userPositionAssignmentId: string;
  positionId: string;
  positionCode: string;
  positionTitle: string;
  isPrimary: boolean;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface MePositionsList {
  items: MePositionAssignment[];
  total: number;
}

export default function MePositionsPage() {
  const { t } = useTranslation("ess");
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<MePositionsList>("/v1/me/positions"),
  });

  const columns = useMemo<DataColumn<MePositionAssignment>[]>(
    () => [
      { header: t("positions.colCode"), cell: (p) => <span className="font-mono text-xs">{p.positionCode}</span> },
      { header: t("positions.colTitle"), cell: (p) => <span className="font-medium text-foreground">{p.positionTitle}</span> },
      {
        header: t("positions.colType"),
        cell: (p) => (
          <StatusPill tone={p.isPrimary ? "info" : "neutral"}>{p.isPrimary ? t("positions.primary") : t("positions.alt")}</StatusPill>
        ),
      },
      { header: t("positions.colStatus"), cell: (p) => <EnumStatusBadge domain="assignmentStatus" value={p.status} /> },
      { header: t("positions.colStart"), cell: (p) => <span className="text-xs text-muted-foreground">{p.startDate ?? "—"}</span> },
      { header: t("positions.colEnd"), cell: (p) => <span className="text-xs text-muted-foreground">{p.endDate ?? "—"}</span> },
    ],
    [t],
  );

  return (
    <DataTablePanel<MePositionAssignment>
      pageTestId="me-positions-page"
      titleTestId="me-positions-title"
      countTestId="me-positions-count"
      title={t("positions.title")}
      description={t("positions.description")}
      count={positions.data ? t("positions.count", { count: positions.data.total }) : undefined}
      isLoading={positions.isLoading}
      isError={positions.isError}
      errorMessage={t("positions.errorMessage")}
      rows={positions.data?.items ?? []}
      rowKey={(p) => p.userPositionAssignmentId}
      rowTestId="me-position-row"
      columns={columns}
      emptyTestId="me-positions-empty"
      emptyTitle={t("positions.emptyTitle")}
      emptyDescription={t("positions.emptyDesc")}
      caption={t("positions.caption")}
    />
  );
}
