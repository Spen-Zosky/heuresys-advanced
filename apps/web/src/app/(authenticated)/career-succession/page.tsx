"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
import { EnumStatusBadge } from "@/components/enum-badge";
import { EChartsCard } from "../_charts-client";

interface CareerPath {
  careerPathId: string;
  code: string;
  name: string;
  fromJobRoleId: string | null;
  toJobRoleId: string | null;
  difficulty: string | null;
}
interface SuccessionPool {
  successionPoolId: string;
  code: string;
  name: string;
  targetPositionId: string | null;
  status: string;
}
interface SuccessorCandidate {
  successorCandidateId: string;
  poolId: string;
  poolName: string | null;
  userId: string;
  userName: string | null;
  readinessLevel: string | null;
  status: string;
}
interface ReadinessDistItem {
  readinessLevel: string;
  count: number;
}

type Tab = "paths" | "pools" | "candidates";

function buildTabs(t: TFunction): ReadonlyArray<{ key: Tab; label: string }> {
  return [
    { key: "paths", label: t("career.tabs.paths") },
    { key: "pools", label: t("career.tabs.pools") },
    { key: "candidates", label: t("career.tabs.candidates") },
  ];
}

function buildPathsCols(t: TFunction): DataColumn<CareerPath>[] {
  return [
    { header: t("career.pathsCols.code"), cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
    { header: t("career.pathsCols.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    { header: t("career.pathsCols.difficulty"), cell: (p) => <StatusBadge value={p.difficulty} /> },
  ];
}
function buildPoolsCols(t: TFunction): DataColumn<SuccessionPool>[] {
  return [
    { header: t("career.poolsCols.code"), cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
    { header: t("career.poolsCols.name"), cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
    { header: t("career.poolsCols.status"), cell: (p) => <EnumStatusBadge domain="successionPoolStatus" value={p.status} /> },
  ];
}
function buildCandidatesCols(t: TFunction): DataColumn<SuccessorCandidate>[] {
  return [
    { header: t("career.candidatesCols.user"), cell: (c) => <span className="text-xs text-foreground">{c.userName ?? c.userId.slice(0, 8)}</span> },
    { header: t("career.candidatesCols.pool"), cell: (c) => <span className="text-xs text-muted-foreground">{c.poolName ?? c.poolId.slice(0, 8)}</span> },
    { header: t("career.candidatesCols.readiness"), cell: (c) => <StatusBadge value={c.readinessLevel} /> },
    { header: t("career.candidatesCols.status"), cell: (c) => <EnumStatusBadge domain="successorCandidateStatus" value={c.status} /> },
  ];
}

export default function CareerSuccessionPage() {
  const { t } = useTranslation("hr");
  const tabs = useMemo(() => buildTabs(t), [t]);
  const pathsCols = useMemo(() => buildPathsCols(t), [t]);
  const poolsCols = useMemo(() => buildPoolsCols(t), [t]);
  const candidatesCols = useMemo(() => buildCandidatesCols(t), [t]);
  const [tab, setTab] = useState<Tab>("paths");

  const paths = useQuery({
    queryKey: ["career-paths"],
    queryFn: () => apiFetch<{ items: CareerPath[]; total: number }>("/v1/career-paths?limit=200"),
    enabled: tab === "paths",
  });
  const pools = useQuery({
    queryKey: ["succession-pools"],
    queryFn: () => apiFetch<{ items: SuccessionPool[]; total: number }>("/v1/succession-pools?limit=200"),
    enabled: tab === "pools",
  });
  const candidates = useQuery({
    queryKey: ["successor-candidates"],
    queryFn: () => apiFetch<{ items: SuccessorCandidate[]; total: number }>("/v1/successor-candidates?limit=200"),
    enabled: tab === "candidates",
  });
  // Readiness pipeline — server-side GROUP BY aggregate (API-first, F4).
  const readinessDist = useQuery({
    queryKey: ["successor-candidates", "readiness-distribution"],
    queryFn: () =>
      apiFetch<{ items: ReadinessDistItem[]; total: number }>(
        "/v1/successor-candidates/readiness-distribution",
      ),
    enabled: tab === "candidates",
  });

  const readinessOption = {
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: (readinessDist.data?.items ?? []).map((i) => i.readinessLevel.replace(/_/g, " ")),
      axisLabel: { color: "#94a3b8", fontSize: 11, interval: 0, rotate: 20 },
      axisLine: { lineStyle: { color: "#334155" } },
    },
    yAxis: {
      type: "value" as const,
      minInterval: 1,
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      {
        type: "bar" as const,
        data: (readinessDist.data?.items ?? []).map((i) => i.count),
        itemStyle: { color: "#6366f1", borderRadius: [4, 4, 0, 0] as [number, number, number, number] },
        barMaxWidth: 48,
      },
    ],
  };

  return (
    <main data-testid="career-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader data-testid="career-title" title={t("career.title")} description={t("career.description")} />

      <nav className="flex gap-1 border-b border-border" data-testid="career-tabs">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.key)}
            data-testid={`career-tab-${tabItem.key}`}
            className={`px-3 py-2 text-sm transition-colors ${tab === tabItem.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tabItem.label}
          </button>
        ))}
      </nav>

      {tab === "paths" && (
        <div data-testid="career-content-paths">
          <EntityTable<CareerPath>
            isLoading={paths.isLoading}
            isError={paths.isError}
            rows={paths.data?.items ?? []}
            rowKey={(p) => p.careerPathId}
            rowTestId="career-paths-row"
            columns={pathsCols}
            emptyTestId="career-paths-empty"
            emptyTitle={t("career.pathsEmpty")}
            caption={t("career.pathsCaption")}
          />
        </div>
      )}
      {tab === "pools" && (
        <div data-testid="career-content-pools">
          <EntityTable<SuccessionPool>
            isLoading={pools.isLoading}
            isError={pools.isError}
            rows={pools.data?.items ?? []}
            rowKey={(p) => p.successionPoolId}
            rowTestId="career-pools-row"
            columns={poolsCols}
            emptyTestId="career-pools-empty"
            emptyTitle={t("career.poolsEmpty")}
            caption={t("career.poolsCaption")}
          />
        </div>
      )}
      {tab === "candidates" && (
        <div data-testid="career-content-candidates" className="space-y-4">
          <div
            data-testid="career-readiness-chart"
            className="rounded-card border border-border bg-card p-4 shadow-card"
          >
            <h2 className="mb-2 text-sm font-medium text-foreground">{t("career.pipelineTitle")}</h2>
            {readinessDist.data && readinessDist.data.total > 0 ? (
              <EChartsCard
                option={readinessOption}
                height={240}
                ariaLabel={t("career.pipelineAria")}
              />
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {readinessDist.isLoading ? t("common:loading") : t("career.pipelineEmpty")}
              </p>
            )}
          </div>
          <EntityTable<SuccessorCandidate>
            isLoading={candidates.isLoading}
            isError={candidates.isError}
            rows={candidates.data?.items ?? []}
            rowKey={(c) => c.successorCandidateId}
            rowTestId="career-candidates-row"
            columns={candidatesCols}
            emptyTestId="career-candidates-empty"
            emptyTitle={t("career.candidatesEmpty")}
            caption={t("career.candidatesCaption")}
          />
        </div>
      )}
    </main>
  );
}
