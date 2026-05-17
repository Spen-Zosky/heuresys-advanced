"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface TrainingInitiative {
  trainingInitiativeId: string;
  tenantId: string;
  moduleId: string;
  code: string;
  cohortName: string | null;
  startDate: string | null;
  endDate: string | null;
  facilitatorUserId: string | null;
  status: string;
  capacity: number | null;
}

export default function TrainingInitiativesPage() {
  const inits = useQuery({
    queryKey: ["training-initiatives", "list"],
    queryFn: () => apiFetch<{ items: TrainingInitiative[]; total: number }>("/v1/training-initiatives?limit=200"),
  });

  return (
    <main data-testid="training-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="training-title">Iniziative formative</h1>
        <p className="text-sm opacity-70" data-testid="training-count">
          {inits.data ? `${inits.data.total} pianificate` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Sessioni di erogazione</CardTitle></CardHeader>
        <CardContent className="p-0">
          {inits.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : inits.data && inits.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="training-empty">Nessuna iniziativa schedulata.</div>
          ) : (
            <table className="w-full text-sm" data-testid="training-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Coorte</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Inizio</th>
                  <th className="px-4 py-2">Fine</th>
                  <th className="px-4 py-2">Posti</th>
                </tr>
              </thead>
              <tbody>
                {inits.data!.items.map((t) => (
                  <tr key={t.trainingInitiativeId} className="border-b last:border-b-0" data-testid="training-row">
                    <td className="px-4 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-4 py-2 text-xs">{t.cohortName ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase">{t.status}</td>
                    <td className="px-4 py-2 text-xs">{t.startDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{t.endDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{t.capacity ?? "—"}</td>
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
