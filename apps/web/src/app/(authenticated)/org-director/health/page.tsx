"use client";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, PageHeader } from "@heuresys/ui";
import type {
  OrgHealthScorecard, OrgHealthUnit, OrgHealthStatus, OrgHealthStanding, OrgHealthDimension,
} from "@heuresys/shared";
import { ORG_HEALTH_DIMENSIONS } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

// #57 F3 — organizational health index. Everything here comes from GET /v1/org-health,
// computed live over engagement, goals, flight-risk, attendance, reviews and capability
// maturity. No mock data, real empty-state.
//
// Two readings sit side by side on purpose. The BAND is absolute ("is this unit healthy?");
// the STANDING is relative ("where do I look first?"). On live data the index spans a narrow
// range and every unit reads healthy, so the band alone would say "no problem anywhere" and
// leave a reader with nothing to act on — while dropping it would let a merely last-placed
// unit be mistaken for a failing one. The observed spread is printed for the same reason:
// without it, half a point of difference looks meaningful.

const STATUS_TONE: Record<OrgHealthStatus, "info" | "success" | "warning" | "danger" | "neutral"> = {
  STRONG: "success",
  HEALTHY: "info",
  WATCH: "warning",
  CRITICAL: "danger",
  INSUFFICIENT_DATA: "neutral",
};

const STANDING_TONE: Record<OrgHealthStanding, "info" | "success" | "warning" | "danger" | "neutral"> = {
  LEADING: "success",
  MIDDLE: "neutral",
  LAGGING: "warning",
  UNRANKED: "neutral",
};

const STATUS_ORDER: OrgHealthStatus[] = ["STRONG", "HEALTHY", "WATCH", "CRITICAL", "INSUFFICIENT_DATA"];

function buildColumns(t: ReturnType<typeof useTranslation>["t"]): DataColumn<OrgHealthUnit>[] {
  const dimensionColumns: DataColumn<OrgHealthUnit>[] = ORG_HEALTH_DIMENSIONS.map((dim: OrgHealthDimension) => ({
    header: t(`orgHealth.dims.${dim}`),
    align: "right" as const,
    cell: (r: OrgHealthUnit) => {
      const d = r.dimensions.find((x) => x.dimension === dim);
      if (!d || d.score === null) {
        return <span className="text-xs text-muted-foreground" title={t("orgHealth.noData")}>—</span>;
      }
      return (
        <span className="inline-flex flex-col items-end leading-tight">
          <span className="tabular-nums text-foreground">{Math.round(d.score * 100)}</span>
          <span className="tabular-nums text-[10px] text-muted-foreground">
            {t("orgHealth.sample", { count: d.sampleSize })}
          </span>
        </span>
      );
    },
  }));

  return [
    {
      header: t("orgHealth.cols.unit"),
      cell: (r) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium text-foreground">{r.orgUnitName}</span>
          <span className="text-[10px] text-muted-foreground">
            {t("orgHealth.cols.headcount", { count: r.headcount })}
          </span>
        </span>
      ),
    },
    {
      header: t("orgHealth.cols.index"), align: "right",
      cell: (r) => (
        <span className="font-semibold tabular-nums text-foreground">
          {r.index === null ? "—" : r.index.toFixed(1)}
        </span>
      ),
    },
    {
      header: t("orgHealth.cols.status"),
      cell: (r) => (
        <span data-testid={`org-health-status-${r.status}`}>
          <StatusPill tone={STATUS_TONE[r.status]}>{t(`orgHealth.statuses.${r.status}`)}</StatusPill>
        </span>
      ),
    },
    {
      header: t("orgHealth.cols.standing"),
      cell: (r) => (
        <span data-testid={`org-health-standing-${r.standing}`}>
          <StatusPill tone={STANDING_TONE[r.standing]}>{t(`orgHealth.standings.${r.standing}`)}</StatusPill>
        </span>
      ),
    },
    {
      header: t("orgHealth.cols.coverage"), align: "right",
      cell: (r) => (
        <span className="tabular-nums text-xs text-muted-foreground">{Math.round(r.coverage * 100)}%</span>
      ),
    },
    ...dimensionColumns,
  ];
}

export default function OrgHealthPage() {
  const { t } = useTranslation("hr");

  const scorecard = useQuery({
    queryKey: ["org-health"],
    queryFn: () => apiFetch<OrgHealthScorecard>("/v1/org-health"),
  });

  const columns = useMemo(() => buildColumns(t), [t]);
  const data = scorecard.data;

  return (
    <main data-testid="org-health-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="org-health-title"
        title={t("orgHealth.title")}
        description={t("orgHealth.description")}
        badges={
          data ? (
            <Badge variant="secondary" data-testid="org-health-count">
              {t("orgHealth.count", { count: data.total })}
            </Badge>
          ) : undefined
        }
      />

      {data ? (
        <section data-testid="org-health-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-card border border-border bg-card px-4 py-3 shadow-card">
            <div data-testid="org-health-org-index" className="text-2xl font-semibold tabular-nums text-foreground">
              {data.organizationIndex === null ? "—" : data.organizationIndex.toFixed(1)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{t("orgHealth.organizationIndex")}</div>
          </div>
          {STATUS_ORDER.map((s) => (
            <div
              key={s}
              data-testid={`org-health-summary-${s}`}
              className="rounded-card border border-border bg-card px-4 py-3 shadow-card"
            >
              <div className="text-2xl font-semibold tabular-nums text-foreground">{data.summary[s]}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t(`orgHealth.statuses.${s}`)}</div>
            </div>
          ))}
        </section>
      ) : null}

      <EntityTable<OrgHealthUnit>
        isLoading={scorecard.isLoading}
        isError={scorecard.isError}
        errorMessage={t("orgHealth.errorMessage")}
        rows={data?.units ?? []}
        rowKey={(r) => r.orgUnitId}
        rowTestId="org-health-row"
        columns={columns}
        emptyTestId="org-health-empty"
        emptyTitle={t("orgHealth.emptyTitle")}
        emptyDescription={t("orgHealth.emptyDescription")}
        caption={t("orgHealth.caption")}
      />

      <p data-testid="org-health-method" className="text-xs text-muted-foreground">
        {data && data.distribution.spread !== null
          ? t("orgHealth.method", {
              min: data.distribution.min?.toFixed(1),
              median: data.distribution.median?.toFixed(1),
              max: data.distribution.max?.toFixed(1),
              spread: data.distribution.spread.toFixed(1),
            })
          : t("orgHealth.methodIdle")}
      </p>
    </main>
  );
}
