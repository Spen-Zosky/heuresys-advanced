"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Badge, Card, CardContent, CardHeader, CardTitle, KPIStrip, PageHeader, type KpiCardData,
} from "@heuresys/ui";
import type {
  NineBoxRow, TalentBand, FitScore, ReadinessScore, SuccessionScore,
  CriticalPosition, CriticalCoverage,
} from "@heuresys/shared";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";

/**
 * A/L3 (#29) — Talent review admin page. Live over /v1/talent-review/*:
 * a board-ready 3×3 9-box grid (potential × performance, EVALUATION org-gated),
 * plus position-fit / readiness / succession score panels (org-gated) and the
 * critical-positions / critical-role-coverage catalog panels (tenant-scoped).
 * READ-only consultation. Sidebar row gated on talent:read (no self-view).
 */

// grid axes: potential HIGH→LOW top-to-bottom (rows); performance LOW→HIGH left-to-right (cols)
const POTENTIAL_ROWS: TalentBand[] = ["HIGH", "MEDIUM", "LOW"];
const PERFORMANCE_COLS: TalentBand[] = ["LOW", "MEDIUM", "HIGH"];

function cellKey(pot: TalentBand, perf: TalentBand): string {
  return `${pot}|${perf}`;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function buildFitColumns(t: TFunction): DataColumn<FitScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("talentReview.cols.position"), cell: (r) => <span className="font-mono text-xs">{shortId(r.positionId)}</span> },
    { header: t("talentReview.cols.dimension"), cell: (r) => <span className="text-xs text-muted-foreground">{r.dimension}</span> },
    { header: t("talentReview.cols.score"), align: "right", cell: (r) => <span className="tabular-nums">{r.score}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{r.computedAt.slice(0, 10)}</span> },
  ];
}

function buildReadinessColumns(t: TFunction, enumLabel: EnumLabelFn): DataColumn<ReadinessScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("talentReview.cols.position"), cell: (r) => <span className="font-mono text-xs">{shortId(r.positionId)}</span> },
    { header: t("talentReview.cols.horizon"), cell: (r) => <span className="text-xs text-muted-foreground">{enumLabel("horizon", r.horizon)}</span> },
    { header: t("talentReview.cols.value"), align: "right", cell: (r) => <span className="tabular-nums">{r.value ?? "—"}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{r.computedAt.slice(0, 10)}</span> },
  ];
}

function buildSuccessionColumns(t: TFunction, enumLabel: EnumLabelFn): DataColumn<SuccessionScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("talentReview.cols.position"), cell: (r) => <span className="font-mono text-xs">{shortId(r.positionId)}</span> },
    { header: t("talentReview.cols.value"), align: "right", cell: (r) => <span className="tabular-nums">{r.value ?? "—"}</span> },
    { header: t("talentReview.cols.horizon"), cell: (r) => <span className="text-xs text-muted-foreground">{enumLabel("horizon", r.horizon)}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{r.computedAt.slice(0, 10)}</span> },
  ];
}

function buildCriticalPositionColumns(t: TFunction): DataColumn<CriticalPosition>[] {
  return [
    { header: t("talentReview.cols.position"), cell: (r) => <span className="font-mono text-xs">{shortId(r.positionId)}</span> },
    { header: t("talentReview.cols.rationale"), cell: (r) => <span className="text-xs text-muted-foreground">{r.rationale ?? "—"}</span> },
    { header: t("talentReview.cols.businessImpact"), align: "right", cell: (r) => <span className="tabular-nums">{r.businessImpactScore ?? "—"}</span> },
    { header: t("talentReview.cols.flaggedAt"), cell: (r) => <span className="tabular-nums text-xs">{r.flaggedAt.slice(0, 10)}</span> },
  ];
}

function buildCoverageColumns(t: TFunction): DataColumn<CriticalCoverage>[] {
  return [
    { header: t("talentReview.cols.position"), cell: (r) => <span className="font-mono text-xs">{shortId(r.positionId)}</span> },
    { header: t("talentReview.cols.readyNow"), align: "right", cell: (r) => <span className="tabular-nums">{r.readyNowCount}</span> },
    { header: t("talentReview.cols.ready6mo"), align: "right", cell: (r) => <span className="tabular-nums">{r.ready6moCount}</span> },
    { header: t("talentReview.cols.ready1y"), align: "right", cell: (r) => <span className="tabular-nums">{r.ready1yCount}</span> },
    { header: t("talentReview.cols.coverage"), align: "right", cell: (r) => <span className="tabular-nums">{r.overallScore ?? "—"}</span> },
  ];
}

export default function TalentReviewPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();

  // C4 (#42): server-side pagination. `initialPageSize: 200` is an HONEST cap (matches
  // both the schema's max and the previous hardcoded `?limit=200`) — the 3×3 grid needs
  // the full assessed set as ONE coherent snapshot (bucketed by potential×performance),
  // not incremental pages; there is no pager UI on a grid, unlike the row-list panels below.
  const nineBox = usePaginatedList<NineBoxRow>({
    queryKey: ["talent-review", "nine-box"],
    path: "/v1/talent-review/nine-box",
    initialPageSize: 200,
  });

  const fit = usePaginatedList<FitScore>({ queryKey: ["talent-review", "fit"], path: "/v1/talent-review/fit" });
  const readiness = usePaginatedList<ReadinessScore>({ queryKey: ["talent-review", "readiness"], path: "/v1/talent-review/readiness" });
  const succession = usePaginatedList<SuccessionScore>({ queryKey: ["talent-review", "succession"], path: "/v1/talent-review/succession" });
  const criticalPositions = usePaginatedList<CriticalPosition>({ queryKey: ["talent-review", "critical-positions"], path: "/v1/talent-review/critical-positions" });
  const coverage = usePaginatedList<CriticalCoverage>({ queryKey: ["talent-review", "critical-coverage"], path: "/v1/talent-review/critical-coverage" });

  const fitColumns = useMemo(() => buildFitColumns(t), [t]);
  const readinessColumns = useMemo(() => buildReadinessColumns(t, enumLabel), [t, enumLabel]);
  const successionColumns = useMemo(() => buildSuccessionColumns(t, enumLabel), [t, enumLabel]);
  const criticalPositionColumns = useMemo(() => buildCriticalPositionColumns(t), [t]);
  const coverageColumns = useMemo(() => buildCoverageColumns(t), [t]);

  // group the 9-box rows into the 3×3 cells (potentialBand × performanceBand)
  const cells = useMemo(() => {
    const map = new Map<string, NineBoxRow[]>();
    for (const row of nineBox.rows) {
      const key = cellKey(row.potentialBand, row.performanceBand);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [nineBox.rows]);

  const kpis: KpiCardData[] = useMemo(() => [
    { label: t("talentReview.kpi.assessed"), value: nineBox.total.toLocaleString() },
    { label: t("talentReview.kpi.fit"), value: fit.total.toLocaleString() },
    { label: t("talentReview.kpi.readiness"), value: readiness.total.toLocaleString() },
    { label: t("talentReview.kpi.succession"), value: succession.total.toLocaleString() },
    { label: t("talentReview.kpi.criticalPositions"), value: criticalPositions.total.toLocaleString() },
  ], [nineBox.total, fit.total, readiness.total, succession.total, criticalPositions.total, t]);

  return (
    <main data-testid="talent-review-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="talent-review-title"
        title={t("talentReview.title")}
        description={t("talentReview.description")}
      />

      <KPIStrip items={kpis} />

      <Card>
        <CardHeader>
          <CardTitle>{t("talentReview.nineBox.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-stretch gap-3">
            {/* y-axis label */}
            <div className="flex items-center">
              <span className="rotate-180 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
                {t("talentReview.nineBox.axisPotential")}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              <div data-testid="talent-nine-box" className="grid grid-cols-3 gap-2">
                {POTENTIAL_ROWS.map((pot) =>
                  PERFORMANCE_COLS.map((perf) => {
                    const rows = cells.get(cellKey(pot, perf)) ?? [];
                    return (
                      <div
                        key={cellKey(pot, perf)}
                        data-testid="talent-nine-box-cell"
                        data-potential={pot}
                        data-performance={perf}
                        className="flex min-h-32 flex-col gap-2 rounded-card border border-border bg-card p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t(`talentReview.nineBox.band.${pot}`)} / {t(`talentReview.nineBox.band.${perf}`)}
                          </span>
                          <Badge variant="secondary">{rows.length}</Badge>
                        </div>
                        <div className="flex max-h-40 flex-wrap gap-1 overflow-auto">
                          {rows.map((r) => (
                            <span
                              key={r.talentScoreId}
                              className="rounded-control border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
                            >
                              {r.subjectUserName ?? "—"}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
              {/* x-axis label */}
              <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("talentReview.nineBox.axisPerformance")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("talentReview.sections.fit")}</h2>
        <EntityTable<FitScore>
          isLoading={fit.query.isLoading}
          isError={fit.query.isError}
          errorMessage={t("talentReview.error")}
          rows={fit.rows}
          server={fit.server}
          rowKey={(r) => r.fitScoreId}
          rowTestId="talent-fit-row"
          columns={fitColumns}
          emptyTitle={t("talentReview.empty")}
          caption={t("talentReview.sections.fit")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("talentReview.sections.readiness")}</h2>
        <EntityTable<ReadinessScore>
          isLoading={readiness.query.isLoading}
          isError={readiness.query.isError}
          errorMessage={t("talentReview.error")}
          rows={readiness.rows}
          server={readiness.server}
          rowKey={(r) => r.readinessScoreId}
          rowTestId="talent-readiness-row"
          columns={readinessColumns}
          emptyTitle={t("talentReview.empty")}
          caption={t("talentReview.sections.readiness")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("talentReview.sections.succession")}</h2>
        <EntityTable<SuccessionScore>
          isLoading={succession.query.isLoading}
          isError={succession.query.isError}
          errorMessage={t("talentReview.error")}
          rows={succession.rows}
          server={succession.server}
          rowKey={(r) => r.successionScoreId}
          rowTestId="talent-succession-row"
          columns={successionColumns}
          emptyTitle={t("talentReview.empty")}
          caption={t("talentReview.sections.succession")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("talentReview.sections.criticalPositions")}</h2>
        <EntityTable<CriticalPosition>
          isLoading={criticalPositions.query.isLoading}
          isError={criticalPositions.query.isError}
          errorMessage={t("talentReview.error")}
          rows={criticalPositions.rows}
          server={criticalPositions.server}
          rowKey={(r) => r.criticalPositionId}
          rowTestId="talent-critical-position-row"
          columns={criticalPositionColumns}
          emptyTitle={t("talentReview.empty")}
          caption={t("talentReview.sections.criticalPositions")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("talentReview.sections.criticalCoverage")}</h2>
        <EntityTable<CriticalCoverage>
          isLoading={coverage.query.isLoading}
          isError={coverage.query.isError}
          errorMessage={t("talentReview.error")}
          rows={coverage.rows}
          server={coverage.server}
          rowKey={(r) => r.criticalRoleCoverageStatusId}
          rowTestId="talent-critical-coverage-row"
          columns={coverageColumns}
          emptyTitle={t("talentReview.empty")}
          caption={t("talentReview.sections.criticalCoverage")}
        />
      </section>
    </main>
  );
}
