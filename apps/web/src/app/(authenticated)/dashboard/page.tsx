"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="dashboard-counters">
        {w.counters.tenants !== null && (
          <Card>
            <CardHeader><CardTitle>Tenants</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" data-testid="counter-tenants">{w.counters.tenants}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle>Utenti</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold" data-testid="counter-users">{w.counters.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Posizioni</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold" data-testid="counter-positions">{w.counters.positions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Org Units</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold" data-testid="counter-ous">{w.counters.organizationUnits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Learning Paths</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold" data-testid="counter-learning">{w.counters.learningPaths}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Learning Gaps</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold" data-testid="counter-gaps">{w.counters.learningGaps}</p>
          </CardContent>
        </Card>
        {w.counters.blueprints !== null && (
          <Card>
            <CardHeader><CardTitle>Blueprints</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" data-testid="counter-blueprints">{w.counters.blueprints}</p>
            </CardContent>
          </Card>
        )}
        {w.counters.pendingRecommendations !== null && (
          <Card>
            <CardHeader><CardTitle>Reward proposte</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" data-testid="counter-recommendations">{w.counters.pendingRecommendations}</p>
            </CardContent>
          </Card>
        )}
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
