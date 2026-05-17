"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MePositionAssignment {
  userPositionAssignmentId: string;
  positionId: string;
  positionCode: string;
  positionTitle: string;
  isPrimary: boolean;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export default function MePositionsPage() {
  const positions = useQuery({
    queryKey: ["me", "positions"],
    queryFn: () => apiFetch<{ items: MePositionAssignment[]; total: number }>("/v1/me/positions"),
  });

  return (
    <main data-testid="me-positions-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-positions-title">Le mie posizioni</h1>
        <p className="text-sm opacity-70" data-testid="me-positions-count">
          {positions.data ? `${positions.data.total} assegnazioni` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Storico assegnazioni</CardTitle></CardHeader>
        <CardContent className="p-0">
          {positions.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : positions.data && positions.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-positions-empty">
              Nessuna assegnazione.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-positions-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Titolo</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Inizio</th>
                  <th className="px-4 py-2">Fine</th>
                </tr>
              </thead>
              <tbody>
                {positions.data!.items.map((p) => (
                  <tr key={p.userPositionAssignmentId} className="border-b last:border-b-0" data-testid="me-position-row">
                    <td className="px-4 py-2 font-mono text-xs">{p.positionCode}</td>
                    <td className="px-4 py-2">{p.positionTitle}</td>
                    <td className="px-4 py-2 text-xs uppercase">
                      {p.isPrimary ? "PRIMARY" : "ALT"}
                    </td>
                    <td className="px-4 py-2 text-xs">{p.status}</td>
                    <td className="px-4 py-2 text-xs">{p.startDate ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{p.endDate ?? "—"}</td>
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
