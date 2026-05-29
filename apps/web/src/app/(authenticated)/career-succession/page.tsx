"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
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
  successionPoolId: string;
  userId: string;
  readinessLevel: string | null;
  status: string;
}
interface ReadinessDistItem {
  readinessLevel: string;
  count: number;
}

type Tab = "paths" | "pools" | "candidates";
const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "paths", label: "Career paths" },
  { key: "pools", label: "Succession pools" },
  { key: "candidates", label: "Candidati" },
];

const PATHS_COLS: DataColumn<CareerPath>[] = [
  { header: "Codice", cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
  { header: "Nome", cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
  { header: "Difficoltà", cell: (p) => <StatusBadge value={p.difficulty} /> },
];
const POOLS_COLS: DataColumn<SuccessionPool>[] = [
  { header: "Codice", cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.code}</span> },
  { header: "Nome", cell: (p) => <span className="font-medium text-foreground">{p.name}</span> },
  { header: "Stato", cell: (p) => <StatusBadge value={p.status} /> },
];
const CANDIDATES_COLS: DataColumn<SuccessorCandidate>[] = [
  { header: "User", cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.userId.slice(0, 8)}</span> },
  { header: "Pool", cell: (c) => <span className="font-mono text-xs text-muted-foreground">{c.successionPoolId.slice(0, 8)}</span> },
  { header: "Readiness", cell: (c) => <StatusBadge value={c.readinessLevel} /> },
  { header: "Stato", cell: (c) => <StatusBadge value={c.status} /> },
];

export default function CareerSuccessionPage() {
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
      <PageHeader data-testid="career-title" title="Career & Succession" description="Percorsi di carriera, pool di successione e candidati." />

      <nav className="flex gap-1 border-b border-border" data-testid="career-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-testid={`career-tab-${t.key}`}
            className={`px-3 py-2 text-sm transition-colors ${tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
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
            columns={PATHS_COLS}
            emptyTestId="career-paths-empty"
            emptyTitle="Nessun career path definito"
            caption="Career paths"
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
            columns={POOLS_COLS}
            emptyTestId="career-pools-empty"
            emptyTitle="Nessuna pool registrata"
            caption="Succession pools"
          />
        </div>
      )}
      {tab === "candidates" && (
        <div data-testid="career-content-candidates" className="space-y-4">
          <div
            data-testid="career-readiness-chart"
            className="rounded-card border border-border bg-card p-4 shadow-card"
          >
            <h2 className="mb-2 text-sm font-medium text-foreground">Pipeline readiness</h2>
            {readinessDist.data && readinessDist.data.total > 0 ? (
              <EChartsCard
                option={readinessOption}
                height={240}
                ariaLabel="Distribuzione candidati per livello di readiness"
              />
            ) : (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {readinessDist.isLoading ? "Caricamento…" : "Nessun candidato da rappresentare."}
              </p>
            )}
          </div>
          <EntityTable<SuccessorCandidate>
            isLoading={candidates.isLoading}
            isError={candidates.isError}
            rows={candidates.data?.items ?? []}
            rowKey={(c) => c.successorCandidateId}
            rowTestId="career-candidates-row"
            columns={CANDIDATES_COLS}
            emptyTestId="career-candidates-empty"
            emptyTitle="Nessun candidato registrato"
            caption="Candidati alla succession"
          />
        </div>
      )}
    </main>
  );
}
