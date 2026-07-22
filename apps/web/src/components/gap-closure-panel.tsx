"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { GapClosurePlan, GapAnalysisResult } from "@heuresys/shared";
import { Badge } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusPill } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";

/**
 * GapClosurePanel (#30) — the closure layer under learning gaps: remediation
 * plans (user+position-keyed) + analysis results, live over
 * /v1/learning-gaps/{closure-plans,analysis-results}. Org-gated server-side.
 * `self` uses /v1/me/gaps/closure (I17) — plans + own-gap actions.
 */
interface PlanList { items: GapClosurePlan[]; total: number }
interface ResultList { items: GapAnalysisResult[]; total: number }

function planTone(s: string): "success" | "info" | "warning" | "neutral" {
  if (s === "COMPLETED") return "success";
  if (s === "ACTIVE") return "info";
  if (s === "ON_HOLD") return "warning";
  return "neutral";
}

export function GapClosurePanel() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const plans = useQuery({
    queryKey: ["gap-closure", "plans"],
    queryFn: () => apiFetch<PlanList>("/v1/learning-gaps/closure-plans?limit=200"),
  });
  const results = useQuery({
    queryKey: ["gap-closure", "analysis-results"],
    queryFn: () => apiFetch<ResultList>("/v1/learning-gaps/analysis-results?limit=200"),
  });

  const planCols = useMemo<DataColumn<GapClosurePlan>[]>(() => [
    { header: t("gaps.closure.subject"), cell: (p) => <span className="font-mono text-xs">{p.userId.slice(0, 8)}</span> },
    { header: t("gaps.closure.milestones"), align: "right", cell: (p) => <span className="tabular-nums">{p.milestones.length}</span> },
    { header: t("gaps.closure.target"), cell: (p) => <span className="text-xs text-muted-foreground">{p.targetCompletionDate ?? "—"}</span> },
    { header: t("shared.status"), cell: (p) => <EnumStatusPill domain="gapClosurePlanStatus" value={p.status} tone={planTone(p.status)} /> },
  ], [t]);

  const resultCols = useMemo<DataColumn<GapAnalysisResult>[]>(() => [
    { header: t("gaps.closure.subject"), cell: (r) => <span className="font-mono text-xs">{r.userId.slice(0, 8)}</span> },
    { header: t("gaps.closure.kind"), cell: (r) => <Badge variant="secondary">{enumLabel("gapClosureActionKind", r.kind)}</Badge> },
    { header: t("gaps.closure.score"), align: "right", cell: (r) => <span className="tabular-nums">{r.overallScore != null ? r.overallScore.toFixed(1) : "—"}</span> },
  ], [t, enumLabel]);

  return (
    <section data-testid="gap-closure" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{t("gaps.closure.plansTitle")}</h2>
        <EntityTable<GapClosurePlan>
          isLoading={plans.isLoading} isError={plans.isError} errorMessage={t("gaps.error")}
          rows={plans.data?.items ?? []} rowKey={(p) => p.planId} rowTestId="gap-plan-row"
          columns={planCols} emptyTitle={t("gaps.closure.plansEmpty")} caption={t("gaps.closure.plansTitle")}
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{t("gaps.closure.resultsTitle")}</h2>
        <EntityTable<GapAnalysisResult>
          isLoading={results.isLoading} isError={results.isError} errorMessage={t("gaps.error")}
          rows={results.data?.items ?? []} rowKey={(r) => r.resultId} rowTestId="gap-result-row"
          columns={resultCols} emptyTitle={t("gaps.closure.resultsEmpty")} caption={t("gaps.closure.resultsTitle")}
        />
      </div>
    </section>
  );
}
