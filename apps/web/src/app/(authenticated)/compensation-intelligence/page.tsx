"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import type {
  VariablePayCalculation, CompensationRecommendationRow, BonusPool,
  ObjectiveRewardRule, PositionEconomicWeight, PayrollHandoffRecord,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge, StatusPill } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EChartsCard } from "../_charts-client";

interface RewardGate {
  rewardGateId: string;
  userId: string | null;
  positionId: string | null;
  catalogCode: string;
  catalogName: string;
  isBlocking: boolean;
  periodStart: string;
  periodEnd: string;
  latestResult: {
    status: string;
    score: string | null;
    recordedAt: string;
  } | null;
}

const STATUSES = ["PASSED", "WARNING", "BLOCKED", "ESCALATED", "OVERRIDDEN_WITH_REASON", "PENDING"] as const;
const STATUS_TONE: Record<(typeof STATUSES)[number], KpiCardData["iconTone"]> = {
  PASSED: "success",
  WARNING: "warning",
  BLOCKED: "danger",
  ESCALATED: "danger",
  OVERRIDDEN_WITH_REASON: "palette-3",
  PENDING: "info",
};

// Explicit chart palette (echarts can't read CSS tokens) — kept in step with STATUS_TONE.
const STATUS_COLOR: Record<string, string> = {
  PASSED: "hsl(var(--success))",
  WARNING: "hsl(var(--warning))",
  BLOCKED: "hsl(var(--danger))",
  ESCALATED: "#dc2626",
  OVERRIDDEN_WITH_REASON: "#8b5cf6",
  PENDING: "#3b82f6",
};

interface DistributionItem {
  status: string;
  count: number;
}

// ── A/L7 (#32) read-panel columns (admin namespace) ──────────────────────────

function money(v: number | null): string {
  return v === null ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildVariablePayColumns(t: TFunction): DataColumn<VariablePayCalculation>[] {
  return [
    { header: t("compReward.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("compReward.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.periodStart} → {r.periodEnd}</span> },
    { header: t("compReward.cols.signalScore"), align: "right", cell: (r) => <span className="tabular-nums">{r.signalScore ?? "—"}</span> },
    { header: t("compReward.cols.amount"), align: "right", cell: (r) => <span className="tabular-nums">{money(r.amountEur)}</span> },
  ];
}

function buildRecommendationColumns(t: TFunction): DataColumn<CompensationRecommendationRow>[] {
  return [
    { header: t("compReward.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("compReward.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.periodStart} → {r.periodEnd}</span> },
    { header: t("compReward.cols.signal"), cell: (r) => <StatusBadge value={r.signal} /> },
    { header: t("compReward.cols.amount"), align: "right", cell: (r) => <span className="tabular-nums">{money(r.amountEur)}</span> },
    { header: t("compReward.cols.narrative"), cell: (r) => <span className="text-xs text-muted-foreground">{r.narrative ?? "—"}</span> },
  ];
}

function buildBonusPoolColumns(t: TFunction): DataColumn<BonusPool>[] {
  return [
    { header: t("compReward.cols.scope"), cell: (r) => <span className="font-mono text-xs">{r.scope}</span> },
    { header: t("compReward.cols.orgUnit"), cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.organizationUnitId?.slice(0, 8) ?? "—"}</span> },
    { header: t("compReward.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.periodStart} → {r.periodEnd}</span> },
    { header: t("compReward.cols.total"), align: "right", cell: (r) => <span className="tabular-nums">{money(r.totalEur)}</span> },
  ];
}

function buildObjectiveRuleColumns(t: TFunction): DataColumn<ObjectiveRewardRule>[] {
  return [
    { header: t("compReward.cols.code"), cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { header: t("compReward.cols.name"), cell: (r) => <span>{r.name}</span> },
  ];
}

function buildPositionWeightColumns(t: TFunction): DataColumn<PositionEconomicWeight>[] {
  return [
    { header: t("compReward.cols.position"), cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.positionId.slice(0, 8)}</span> },
    { header: t("compReward.cols.value"), align: "right", cell: (r) => <span className="tabular-nums">{r.value}</span> },
    { header: t("compReward.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.periodStart ?? "—"} → {r.periodEnd ?? "—"}</span> },
  ];
}

function buildHandoffColumns(t: TFunction): DataColumn<PayrollHandoffRecord>[] {
  return [
    { header: t("compReward.cols.recipient"), cell: (r) => <span className="font-mono text-xs">{r.recipientSystem}</span> },
    { header: t("compReward.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.periodStart} → {r.periodEnd}</span> },
    { header: t("compReward.cols.status"), cell: (r) => <EnumStatusBadge domain="payrollHandoffStatus" value={r.status} /> },
    { header: t("compReward.cols.handedOff"), cell: (r) => <span className="tabular-nums text-xs">{r.handedOffAt.slice(0, 10)}</span> },
  ];
}

// C4 (#42): the reward-gates table — was a hand-rolled <table> (pre-dating the
// EntityTable migration of the six panels below). Converted to EntityTable for the
// same server-pagination + loading/error/empty states as everything else on this page.
function buildRewardGateColumns(t: TFunction): DataColumn<RewardGate>[] {
  return [
    { header: t("compensation.cols.user"), cell: (g) => <span className="font-mono text-xs text-muted-foreground">{g.userId?.slice(0, 8) ?? "—"}</span> },
    {
      header: t("compensation.cols.gate"),
      cell: (g) => (
        <span>
          <span className="font-mono text-xs">{g.catalogCode}</span>
          <span className="block text-xs text-muted-foreground">{g.catalogName}</span>
        </span>
      ),
    },
    { header: t("compensation.cols.period"), cell: (g) => <span className="text-xs">{g.periodStart} → {g.periodEnd}</span> },
    {
      header: t("compensation.cols.blocking"),
      cell: (g) => <StatusPill tone={g.isBlocking ? "warning" : "neutral"}>{g.isBlocking ? t("compensation.blockingYes") : t("compensation.blockingNo")}</StatusPill>,
    },
    { header: t("compensation.cols.status"), cell: (g) => <StatusBadge value={g.latestResult?.status ?? "PENDING"} /> },
  ];
}

export default function CompensationIntelligencePage() {
  const { t } = useTranslation("hr");
  const { t: tA } = useTranslation("admin");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const gates = usePaginatedList<RewardGate>({
    queryKey: ["compensation", "reward-gates"],
    path: "/v1/compensation/reward-gates",
  });

  // Distribution chart — server-side GROUP BY aggregate over the FULL table (API-first,
  // F4). Also the KPI-strip counts source below: now that `gates` is paginated, a client
  // `.reduce` over `gates.rows` would only count the current page — `dist` already
  // aggregates every reward gate (same COALESCE(...,'PENDING') semantics) unbounded.
  const dist = useQuery({
    queryKey: ["compensation", "distribution"],
    queryFn: () =>
      apiFetch<{ items: DistributionItem[]; total: number }>("/v1/compensation/distribution"),
  });

  const distByStatus = new Map((dist.data?.items ?? []).map((i) => [i.status, i.count]));
  const statusItems: KpiCardData[] = STATUSES.map((s) => ({
    label: s.replace(/_/g, " "),
    value: <span data-testid={`compensation-status-${s}`}>{distByStatus.get(s) ?? 0}</span>,
    iconTone: STATUS_TONE[s],
  }));

  const chartOption = {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c} ({d}%)" },
    legend: {
      type: "scroll" as const,
      bottom: 0,
      textStyle: { color: "hsl(var(--muted-foreground))", fontSize: 11 },
    },
    series: [
      {
        name: t("compensation.seriesName"),
        type: "pie" as const,
        radius: ["45%", "72%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "transparent", borderWidth: 2 },
        label: { show: false },
        data: (dist.data?.items ?? []).map((i) => ({
          name: i.status.replace(/_/g, " "),
          value: i.count,
          itemStyle: { color: STATUS_COLOR[i.status] ?? "#64748b" },
        })),
      },
    ],
  };

  // ── A/L7 (#32) read lists — server-paginated over the dormant reward tables ──
  const variablePay = usePaginatedList<VariablePayCalculation>({
    queryKey: ["compensation", "variable-pay"], path: "/v1/compensation/variable-pay",
  });
  const recommendations = usePaginatedList<CompensationRecommendationRow>({
    queryKey: ["compensation", "recommendations"], path: "/v1/compensation/recommendations",
  });
  const bonusPools = usePaginatedList<BonusPool>({
    queryKey: ["compensation", "bonus-pools"], path: "/v1/compensation/bonus-pools",
  });
  const objectiveRules = usePaginatedList<ObjectiveRewardRule>({
    queryKey: ["compensation", "objective-reward-rules"], path: "/v1/compensation/objective-reward-rules",
  });
  const positionWeight = usePaginatedList<PositionEconomicWeight>({
    queryKey: ["compensation", "position-economic-weight"], path: "/v1/compensation/position-economic-weight",
  });
  const handoffRecords = usePaginatedList<PayrollHandoffRecord>({
    queryKey: ["compensation", "handoff-records"], path: "/v1/compensation/handoff-records",
  });

  const rewardGateColumns = useMemo(() => buildRewardGateColumns(t), [t]);
  const variablePayColumns = useMemo(() => buildVariablePayColumns(tA), [tA]);
  const recommendationColumns = useMemo(() => buildRecommendationColumns(tA), [tA]);
  const bonusPoolColumns = useMemo(() => buildBonusPoolColumns(tA), [tA]);
  const objectiveRuleColumns = useMemo(() => buildObjectiveRuleColumns(tA), [tA]);
  const positionWeightColumns = useMemo(() => buildPositionWeightColumns(tA), [tA]);
  const handoffColumns = useMemo(() => buildHandoffColumns(tA), [tA]);

  return (
    <main data-testid="compensation-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="compensation-title"
        title={t("compensation.title")}
        description={t("compensation.description")}
        badges={
          <Badge variant="secondary" data-testid="compensation-count">
            {gates.query.data ? t("compensation.count", { count: gates.total }) : "…"}
          </Badge>
        }
      />

      <section
        data-testid="compensation-summary"
        className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,360px)]"
      >
        <KPIStrip items={statusItems} />
        <div
          data-testid="compensation-distribution-chart"
          className="rounded-card border border-border bg-card p-4 shadow-card"
        >
          <h2 className="mb-2 text-sm font-medium text-foreground">{t("compensation.distributionTitle")}</h2>
          {dist.data && dist.data.total > 0 ? (
            <EChartsCard
              option={chartOption}
              height={240}
              ariaLabel={t("compensation.distributionAria")}
            />
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground">
              {dist.isLoading ? t("common:loading") : t("compensation.distributionEmpty")}
            </p>
          )}
        </div>
      </section>

      <EntityTable<RewardGate>
        isLoading={gates.query.isLoading}
        isError={gates.query.isError}
        errorTestId="compensation-error"
        errorMessage={t("compensation.error")}
        rows={gates.rows}
        server={gates.server}
        rowKey={(g) => g.rewardGateId}
        rowTestId="compensation-row"
        columns={rewardGateColumns}
        emptyTestId="compensation-empty"
        emptyTitle={t("compensation.emptyTitle")}
        emptyDescription={t("compensation.emptyDescription")}
        caption={t("compensation.caption")}
      />

      {/* A/L7 (#32) — read panels over the six dormant compensation & reward tables. */}
      <section data-testid="comp-variable-pay-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.variablePay")}</h2>
        <EntityTable<VariablePayCalculation>
          isLoading={variablePay.query.isLoading}
          isError={variablePay.query.isError}
          errorMessage={tA("compReward.error")}
          rows={variablePay.rows}
          server={variablePay.server}
          rowKey={(r) => r.variablePayCalculationId}
          rowTestId="comp-variable-pay-row"
          columns={variablePayColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.variablePay")}
        />
      </section>

      <section data-testid="comp-recommendation-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.recommendations")}</h2>
        <EntityTable<CompensationRecommendationRow>
          isLoading={recommendations.query.isLoading}
          isError={recommendations.query.isError}
          errorMessage={tA("compReward.error")}
          rows={recommendations.rows}
          server={recommendations.server}
          rowKey={(r) => r.compensationRecommendationId}
          rowTestId="comp-recommendation-row"
          columns={recommendationColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.recommendations")}
        />
      </section>

      <section data-testid="comp-bonus-pool-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.bonusPools")}</h2>
        <EntityTable<BonusPool>
          isLoading={bonusPools.query.isLoading}
          isError={bonusPools.query.isError}
          errorMessage={tA("compReward.error")}
          rows={bonusPools.rows}
          server={bonusPools.server}
          rowKey={(r) => r.bonusPoolId}
          rowTestId="comp-bonus-pool-row"
          columns={bonusPoolColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.bonusPools")}
        />
      </section>

      <section data-testid="comp-objective-rule-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.objectiveRewardRules")}</h2>
        <EntityTable<ObjectiveRewardRule>
          isLoading={objectiveRules.query.isLoading}
          isError={objectiveRules.query.isError}
          errorMessage={tA("compReward.error")}
          rows={objectiveRules.rows}
          server={objectiveRules.server}
          rowKey={(r) => r.objectiveRewardRuleId}
          rowTestId="comp-objective-rule-row"
          columns={objectiveRuleColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.objectiveRewardRules")}
        />
      </section>

      <section data-testid="comp-position-weight-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.positionEconomicWeight")}</h2>
        <EntityTable<PositionEconomicWeight>
          isLoading={positionWeight.query.isLoading}
          isError={positionWeight.query.isError}
          errorMessage={tA("compReward.error")}
          rows={positionWeight.rows}
          server={positionWeight.server}
          rowKey={(r) => r.positionEconomicWeightId}
          rowTestId="comp-position-weight-row"
          columns={positionWeightColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.positionEconomicWeight")}
        />
      </section>

      <section data-testid="comp-handoff-panel" className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{tA("compReward.handoffRecords")}</h2>
        <EntityTable<PayrollHandoffRecord>
          isLoading={handoffRecords.query.isLoading}
          isError={handoffRecords.query.isError}
          errorMessage={tA("compReward.error")}
          rows={handoffRecords.rows}
          server={handoffRecords.server}
          rowKey={(r) => r.payrollHandoffRecordId}
          rowTestId="comp-handoff-row"
          columns={handoffColumns}
          emptyTitle={tA("compReward.empty")}
          caption={tA("compReward.handoffRecords")}
        />
      </section>
    </main>
  );
}
