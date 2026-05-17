"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface LearningGap {
  learningGapId: string;
  userId: string;
  positionId: string | null;
  skillId: string | null;
  severity: string;
  requiredProficiency: string | null;
  currentProficiency: string | null;
  detectedAt: string;
}

export default function AdminGapsPage() {
  const gaps = useQuery({
    queryKey: ["learning-gaps", "all"],
    queryFn: () =>
      apiFetch<{ items: LearningGap[]; total: number }>("/v1/learning-gaps?limit=200"),
  });

  const bySev = (gaps.data?.items ?? []).reduce<Record<string, number>>((acc, g) => {
    acc[g.severity] = (acc[g.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main data-testid="gaps-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="gaps-title">Gap analysis</h1>
        <p className="text-sm opacity-70" data-testid="gaps-count">
          {gaps.data ? `${gaps.data.total} gap registrati` : "Caricamento…"}
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="gaps-summary">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((s) => (
          <Card key={s}>
            <CardHeader><CardTitle>{s}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold" data-testid={`gaps-severity-${s}`}>
                {bySev[s] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader><CardTitle>Elenco gap</CardTitle></CardHeader>
        <CardContent className="p-0">
          {gaps.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : gaps.data && gaps.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="gaps-empty">Nessun gap registrato.</div>
          ) : (
            <table className="w-full text-sm" data-testid="gaps-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Posizione</th>
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Severità</th>
                  <th className="px-4 py-2">Richiesto</th>
                  <th className="px-4 py-2">Attuale</th>
                </tr>
              </thead>
              <tbody>
                {gaps.data!.items.map((g) => (
                  <tr key={g.learningGapId} className="border-b last:border-b-0" data-testid="gaps-row">
                    <td className="px-4 py-2 font-mono text-xs">{g.userId.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{g.positionId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs">{g.skillId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase">{g.severity}</td>
                    <td className="px-4 py-2 text-xs">{g.requiredProficiency ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{g.currentProficiency ?? "—"}</td>
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
