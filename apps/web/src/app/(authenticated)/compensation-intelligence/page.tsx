"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, DataTableWithCrossHair, EmptyState, KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import { Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api/fetch";
import { StatusBadge, StatusPill } from "@/components/status-pill";
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
  PASSED: "#10b981",
  WARNING: "#f59e0b",
  BLOCKED: "#ef4444",
  ESCALATED: "#dc2626",
  OVERRIDDEN_WITH_REASON: "#8b5cf6",
  PENDING: "#3b82f6",
};

interface DistributionItem {
  status: string;
  count: number;
}

export default function CompensationIntelligencePage() {
  const { t } = useTranslation("hr");
  const gates = useQuery({
    queryKey: ["compensation", "reward-gates"],
    queryFn: () => apiFetch<{ items: RewardGate[]; total: number }>("/v1/compensation/reward-gates?limit=200"),
  });

  const items = gates.data?.items ?? [];
  const counts = items.reduce<Record<string, number>>((acc, g) => {
    const k = g.latestResult?.status ?? "PENDING";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const statusItems: KpiCardData[] = STATUSES.map((s) => ({
    label: s.replace(/_/g, " "),
    value: <span data-testid={`compensation-status-${s}`}>{counts[s] ?? 0}</span>,
    iconTone: STATUS_TONE[s],
  }));

  // Distribution chart — server-side GROUP BY aggregate (API-first, F4).
  const dist = useQuery({
    queryKey: ["compensation", "distribution"],
    queryFn: () =>
      apiFetch<{ items: DistributionItem[]; total: number }>("/v1/compensation/distribution"),
  });

  const chartOption = {
    tooltip: { trigger: "item" as const, formatter: "{b}: {c} ({d}%)" },
    legend: {
      type: "scroll" as const,
      bottom: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
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

  return (
    <main data-testid="compensation-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="compensation-title"
        title={t("compensation.title")}
        description={t("compensation.description")}
        badges={
          <Badge variant="secondary" data-testid="compensation-count">
            {gates.data ? t("compensation.count", { count: gates.data.total }) : "…"}
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

      {gates.isLoading ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">{t("common:loading")}</div>
      ) : gates.isError ? (
        <div className="rounded-card border border-border bg-card p-6 text-sm text-danger" data-testid="compensation-error">
          {t("compensation.error")}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="compensation-empty"
          icon={<Inbox className="h-6 w-6" />}
          title={t("compensation.emptyTitle")}
          description={t("compensation.emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <DataTableWithCrossHair caption={t("compensation.caption")} className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">{t("compensation.cols.user")}</th>
                <th className="px-4 py-2">{t("compensation.cols.gate")}</th>
                <th className="px-4 py-2">{t("compensation.cols.period")}</th>
                <th className="px-4 py-2">{t("compensation.cols.blocking")}</th>
                <th className="px-4 py-2">{t("compensation.cols.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((g) => (
                <tr key={g.rewardGateId} data-testid="compensation-row" className="transition-colors hover:bg-muted/60">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{g.userId?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{g.catalogCode}</span>
                    <span className="block text-xs text-muted-foreground">{g.catalogName}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">{g.periodStart} → {g.periodEnd}</td>
                  <td className="px-4 py-2"><StatusPill tone={g.isBlocking ? "warning" : "neutral"}>{g.isBlocking ? t("compensation.blockingYes") : t("compensation.blockingNo")}</StatusPill></td>
                  <td className="px-4 py-2"><StatusBadge value={g.latestResult?.status ?? "PENDING"} /></td>
                </tr>
              ))}
            </tbody>
          </DataTableWithCrossHair>
        </div>
      )}
    </main>
  );
}
