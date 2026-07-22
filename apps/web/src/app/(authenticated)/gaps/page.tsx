"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import type { LearningGap, LearningGapSummaryResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { GapClosurePanel } from "@/components/gap-closure-panel";

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const SEV_TONE: Record<(typeof SEVERITIES)[number], KpiCardData["iconTone"]> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "palette-4",
  LOW: "info",
};

export default function AdminGapsPage() {
  const { t } = useTranslation("hr");

  // C4 (#42): the table is one SERVER page…
  const gaps = usePaginatedList<LearningGap>({
    queryKey: ["learning-gaps", "list"],
    path: "/v1/learning-gaps",
  });

  // …and the severity strip comes from a SERVER-side aggregate over the whole
  // visible set. Previously both were derived from a single `?limit=200` fetch:
  // the badge showed the real total while the strip counted at most 200 gaps, so
  // the two numbers on this screen disagreed by construction whenever a tenant
  // had more than 200 gaps. Same ADR-0027 scope on both endpoints.
  const summary = useQuery({
    queryKey: ["learning-gaps", "summary"],
    queryFn: () => apiFetch<LearningGapSummaryResponse>("/v1/learning-gaps/summary"),
  });

  const sevItems: KpiCardData[] = SEVERITIES.map((s) => ({
    label: s,
    value: (
      <span data-testid={`gaps-severity-${s}`}>
        {summary.data?.items.find((i) => i.severity === s)?.count ?? 0}
      </span>
    ),
    iconTone: SEV_TONE[s],
  }));

  const columns = useMemo<DataColumn<LearningGap>[]>(
    () => [
      {
        header: t("gaps.cols.user"),
        cell: (g) => <span className="text-xs text-foreground">{g.userName ?? g.userId.slice(0, 8)}</span>,
      },
      {
        header: t("gaps.cols.position"),
        cell: (g) => (
          <span className="text-xs text-muted-foreground">
            {g.positionTitle ?? (g.positionId ? g.positionId.slice(0, 8) : "—")}
          </span>
        ),
      },
      {
        header: t("gaps.cols.skill"),
        cell: (g) => (
          <span className="text-xs text-muted-foreground">
            {g.skillName ?? (g.skillId ? g.skillId.slice(0, 8) : "—")}
          </span>
        ),
      },
      { header: t("gaps.cols.severity"), cell: (g) => <EnumStatusBadge domain="severity" value={g.severity} /> },
      { header: t("gaps.cols.required"), cell: (g) => <span className="text-xs">{g.requiredProficiency ?? "—"}</span> },
      { header: t("gaps.cols.current"), cell: (g) => <span className="text-xs">{g.currentProficiency ?? "—"}</span> },
    ],
    [t],
  );

  return (
    <main data-testid="gaps-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="gaps-title"
        title={t("gaps.title")}
        description={t("gaps.description")}
        badges={
          <Badge variant="secondary" data-testid="gaps-count">
            {gaps.query.data ? t("gaps.count", { count: gaps.total }) : "…"}
          </Badge>
        }
      />

      <section data-testid="gaps-summary">
        <KPIStrip items={sevItems} />
      </section>

      <div data-testid="gaps-list">
        <EntityTable<LearningGap>
          isLoading={gaps.query.isLoading}
          isError={gaps.query.isError}
          errorTestId="gaps-error"
          errorMessage={t("gaps.error")}
          rows={gaps.rows}
          server={gaps.server}
          rowKey={(g) => g.learningGapId}
          rowTestId="gaps-row"
          columns={columns}
          emptyTestId="gaps-empty"
          emptyTitle={t("gaps.emptyTitle")}
          emptyDescription={t("gaps.emptyDescription")}
          caption={t("gaps.caption")}
        />
      </div>

      {/* #30 (S1018): gap-closure layer — remediation plans + analysis results */}
      <GapClosurePanel />
    </main>
  );
}
