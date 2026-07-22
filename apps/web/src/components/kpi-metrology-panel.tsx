"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { KpiAssessmentMethod, KpiWeightingRule } from "@heuresys/shared";
import { Badge } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { useEnumLabel } from "@/lib/enum-labels";

/**
 * KpiMetrologyPanel (#31) — the "how KPIs are measured/weighted" surface: the
 * two global catalogs (assessment methods + weighting rules) live over
 * /v1/kpi-definitions/{assessment-methods,weighting-rules}. Per-KPI measurements
 * live under /v1/kpi-definitions/:id/measurements (surfaced from the KPI drill-down).
 */
interface MethodList { items: KpiAssessmentMethod[]; total: number }
interface RuleList { items: KpiWeightingRule[]; total: number }

export function KpiMetrologyPanel() {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  const methods = useQuery({
    queryKey: ["kpi-metrology", "methods"],
    queryFn: () => apiFetch<MethodList>("/v1/kpi-definitions/assessment-methods"),
  });
  const rules = useQuery({
    queryKey: ["kpi-metrology", "weighting-rules"],
    queryFn: () => apiFetch<RuleList>("/v1/kpi-definitions/weighting-rules"),
  });

  const methodCols = useMemo<DataColumn<KpiAssessmentMethod>[]>(() => [
    { header: t("kpis.metrology.code"), cell: (m) => <Badge variant="secondary">{enumLabel("kpiMethodCode", m.code)}</Badge> },
    { header: t("shared.name"), cell: (m) => <span className="font-medium text-foreground">{m.name}</span> },
    { header: t("kpis.metrology.description"), cell: (m) => <span className="text-xs text-muted-foreground">{m.description ?? "—"}</span> },
  ], [t, enumLabel]);

  const ruleCols = useMemo<DataColumn<KpiWeightingRule>[]>(() => [
    { header: t("kpis.metrology.code"), cell: (r) => <span className="font-mono text-xs">{enumLabel("kpiRuleCode", r.code)}</span> },
    { header: t("shared.name"), cell: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { header: t("kpis.metrology.kind"), cell: (r) => <Badge variant="secondary">{enumLabel("kpiRuleKind", r.kind)}</Badge> },
    { header: t("kpis.metrology.description"), cell: (r) => <span className="text-xs text-muted-foreground">{r.description ?? "—"}</span> },
  ], [t, enumLabel]);

  return (
    <section data-testid="kpi-metrology" className="space-y-6 rounded-card border border-border bg-card p-4 shadow-card">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{t("kpis.metrology.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("kpis.metrology.description2")}</p>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("kpis.metrology.methods")}</h3>
        <EntityTable<KpiAssessmentMethod>
          isLoading={methods.isLoading} isError={methods.isError} errorMessage={t("kpis.errorMessage")}
          rows={methods.data?.items ?? []} rowKey={(m) => m.methodId} rowTestId="kpi-method-row"
          columns={methodCols} emptyTitle={t("kpis.metrology.empty")} caption={t("kpis.metrology.methods")}
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("kpis.metrology.rules")}</h3>
        <EntityTable<KpiWeightingRule>
          isLoading={rules.isLoading} isError={rules.isError} errorMessage={t("kpis.errorMessage")}
          rows={rules.data?.items ?? []} rowKey={(r) => r.ruleId} rowTestId="kpi-rule-row"
          columns={ruleCols} emptyTitle={t("kpis.metrology.empty")} caption={t("kpis.metrology.rules")}
        />
      </div>
    </section>
  );
}
