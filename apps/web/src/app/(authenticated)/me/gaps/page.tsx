"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeGap {
  learningGapId: string;
  skillId: string | null;
  skillName: string | null;
  positionId: string | null;
  severity: string;
  requiredProficiency: string | null;
  currentProficiency: string | null;
  detectedAt: string;
}

export default function MeGapsPage() {
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<{ items: MeGap[]; total: number }>("/v1/me/gaps"),
  });

  return (
    <main data-testid="me-gaps-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-gaps-title">I miei gap</h1>
        <p className="text-sm opacity-70" data-testid="me-gaps-count">
          {gaps.data ? `${gaps.data.total} aperti` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Gap di sviluppo</CardTitle></CardHeader>
        <CardContent className="p-0">
          {gaps.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : gaps.data && gaps.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-gaps-empty">Nessun gap aperto.</div>
          ) : (
            <table className="w-full text-sm" data-testid="me-gaps-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Skill</th>
                  <th className="px-4 py-2">Severità</th>
                  <th className="px-4 py-2">Richiesto</th>
                  <th className="px-4 py-2">Attuale</th>
                  <th className="px-4 py-2">Rilevato</th>
                </tr>
              </thead>
              <tbody>
                {gaps.data!.items.map((g) => (
                  <tr key={g.learningGapId} className="border-b last:border-b-0" data-testid="me-gap-row">
                    <td className="px-4 py-2">{g.skillName ?? "Generale"}</td>
                    <td className="px-4 py-2 text-xs uppercase">{g.severity}</td>
                    <td className="px-4 py-2 text-xs">{g.requiredProficiency ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{g.currentProficiency ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{g.detectedAt.slice(0, 10)}</td>
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
