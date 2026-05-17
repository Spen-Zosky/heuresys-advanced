"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

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

export default function CompensationIntelligencePage() {
  const gates = useQuery({
    queryKey: ["compensation", "reward-gates"],
    queryFn: () =>
      apiFetch<{ items: RewardGate[]; total: number }>(
        "/v1/compensation/reward-gates?limit=200",
      ),
  });

  const counts = (gates.data?.items ?? []).reduce<Record<string, number>>((acc, g) => {
    const k = g.latestResult?.status ?? "PENDING";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main data-testid="compensation-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="compensation-title">
          Compensation intelligence
        </h1>
        <p className="text-sm opacity-70" data-testid="compensation-count">
          {gates.data ? `${gates.data.total} reward gate registrati` : "Caricamento…"}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="compensation-summary">
        {(["PASSED", "WARNING", "BLOCKED", "ESCALATED", "OVERRIDDEN_WITH_REASON", "PENDING"] as const).map((s) => (
          <Card key={s}>
            <CardHeader><CardTitle className="text-sm">{s}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold" data-testid={`compensation-status-${s}`}>
                {counts[s] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>Reward gate</CardTitle></CardHeader>
        <CardContent className="p-0">
          {gates.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : gates.isError ? (
            <div className="p-6 text-red-600" data-testid="compensation-error">
              Accesso negato o errore.
            </div>
          ) : gates.data && gates.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="compensation-empty">
              Nessun reward gate.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="compensation-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Gate</th>
                  <th className="px-4 py-2">Periodo</th>
                  <th className="px-4 py-2">Blocking</th>
                  <th className="px-4 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {gates.data!.items.map((g) => (
                  <tr key={g.rewardGateId} className="border-b last:border-b-0" data-testid="compensation-row">
                    <td className="px-4 py-2 font-mono text-xs">{g.userId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs">{g.catalogCode}</span>
                      <span className="block opacity-70 text-xs">{g.catalogName}</span>
                    </td>
                    <td className="px-4 py-2 text-xs">{g.periodStart} → {g.periodEnd}</td>
                    <td className="px-4 py-2 text-xs">{g.isBlocking ? "sì" : "no"}</td>
                    <td className="px-4 py-2 text-xs uppercase">
                      {g.latestResult?.status ?? "PENDING"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
