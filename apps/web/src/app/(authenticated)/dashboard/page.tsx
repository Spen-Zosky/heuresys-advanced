"use client";

import { useQuery } from "@tanstack/react-query";
import { KPIStrip, type KpiCardData } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface DashboardWidgets {
  role: string;
  scope: { kind: string; tenantId: string | null; teamPositionIds: string[] };
  counters: {
    tenants: number | null;
    users: number;
    positions: number;
    organizationUnits: number;
    learningPaths: number;
    learningGaps: number;
    blueprints: number | null;
    pendingRecommendations: number | null;
  };
  upcomingLearningDeadlines: Array<{
    learningGapId: string;
    userDisplayName: string;
    skillName: string | null;
    severity: string;
    detectedAt: string;
  }>;
  recentActivity: Array<{ kind: string; summary: string; occurredAt: string }>;
  generatedAt: string;
}

export default function DashboardPage() {
  const widgets = useQuery({
    queryKey: ["dashboard", "widgets"],
    queryFn: () => apiFetch<DashboardWidgets>("/v1/dashboard/widgets"),
  });

  if (widgets.isLoading) {
    return (
      <main data-testid="dashboard-loading" className="max-w-7xl mx-auto px-6 py-8">
        <span className="opacity-60">Caricamento…</span>
      </main>
    );
  }
  if (widgets.isError) {
    return (
      <main data-testid="dashboard-error" className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-red-600">Impossibile caricare il dashboard.</p>
      </main>
    );
  }
  const w = widgets.data!;
  return (
    <main data-testid="dashboard-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-sm opacity-70" data-testid="dashboard-scope">
          Scope: {w.scope.kind} — {w.role}
        </p>
      </header>

      <section data-testid="dashboard-counters">
        <KPIStrip items={[
          ...(w.counters.tenants !== null ? [{
            label: "Tenants",
            value: <span data-testid="counter-tenants">{w.counters.tenants}</span>,
            iconTone: "palette-1" as const,
          } satisfies KpiCardData] : []),
          { label: "Utenti", value: <span data-testid="counter-users">{w.counters.users}</span>, iconTone: "palette-2" },
          { label: "Posizioni", value: <span data-testid="counter-positions">{w.counters.positions}</span>, iconTone: "palette-1" },
          { label: "Org Units", value: <span data-testid="counter-ous">{w.counters.organizationUnits}</span>, iconTone: "palette-3" },
          { label: "Learning Paths", value: <span data-testid="counter-learning">{w.counters.learningPaths}</span>, iconTone: "palette-4" },
          { label: "Learning Gaps", value: <span data-testid="counter-gaps">{w.counters.learningGaps}</span>, iconTone: "warning" },
          ...(w.counters.blueprints !== null ? [{
            label: "Blueprints",
            value: <span data-testid="counter-blueprints">{w.counters.blueprints}</span>,
            iconTone: "palette-2" as const,
          } satisfies KpiCardData] : []),
          ...(w.counters.pendingRecommendations !== null ? [{
            label: "Reward proposte",
            value: <span data-testid="counter-recommendations">{w.counters.pendingRecommendations}</span>,
            iconTone: "info" as const,
          } satisfies KpiCardData] : []),
        ]} />
      </section>

      <section data-testid="dashboard-deadlines">
        <h2 className="text-lg font-semibold mb-2">Gap critici/alti recenti</h2>
        {w.upcomingLearningDeadlines.length === 0 ? (
          <p className="opacity-60 text-sm" data-testid="deadlines-empty">Nessun gap critico aperto.</p>
        ) : (
          <ul className="divide-y border rounded">
            {w.upcomingLearningDeadlines.map((d) => (
              <li key={d.learningGapId} className="px-4 py-2 text-sm flex justify-between" data-testid="deadline-item">
                <span>{d.userDisplayName} — {d.skillName ?? "Generale"}</span>
                <span className="text-xs uppercase opacity-70">{d.severity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
