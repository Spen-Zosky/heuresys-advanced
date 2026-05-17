"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeCareerTarget {
  userCareerPlanId: string;
  positionId: string;
  positionTitle: string;
  status: string;
  targetDate: string | null;
  notes: string | null;
}

export default function MeCareerPage() {
  const career = useQuery({
    queryKey: ["me", "career"],
    queryFn: () => apiFetch<{ items: MeCareerTarget[]; total: number }>("/v1/me/career"),
  });

  return (
    <main data-testid="me-career-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-career-title">La mia carriera</h1>
        <p className="text-sm opacity-70" data-testid="me-career-count">
          {career.data ? `${career.data.total} obiettivi` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Posizioni target</CardTitle></CardHeader>
        <CardContent className="p-0">
          {career.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : career.data && career.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-career-empty">
              Nessun obiettivo di carriera dichiarato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-career-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Posizione target</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {career.data!.items.map((c) => (
                  <tr key={c.userCareerPlanId} className="border-b last:border-b-0" data-testid="me-career-row">
                    <td className="px-4 py-2">{c.positionTitle}</td>
                    <td className="px-4 py-2 text-xs uppercase">{c.status}</td>
                    <td className="px-4 py-2 text-xs">{c.targetDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{c.notes ?? "—"}</td>
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
