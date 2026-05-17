"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeLearningAssignment {
  learningPathId: string;
  learningPathName: string;
  status: string;
  mandatory: boolean;
  enrolledAt: string | null;
  completedAt: string | null;
}

export default function MeLearningPage() {
  const learning = useQuery({
    queryKey: ["me", "learning"],
    queryFn: () => apiFetch<{ items: MeLearningAssignment[]; total: number }>("/v1/me/learning"),
  });

  return (
    <main data-testid="me-learning-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-learning-title">I miei percorsi</h1>
        <p className="text-sm opacity-70" data-testid="me-learning-count">
          {learning.data ? `${learning.data.total} percorsi` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Percorsi assegnati</CardTitle></CardHeader>
        <CardContent className="p-0">
          {learning.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : learning.data && learning.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-learning-empty">
              Nessun percorso assegnato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-learning-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Percorso</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Obbligatorio</th>
                  <th className="px-4 py-2">Iscrizione</th>
                  <th className="px-4 py-2">Completato</th>
                </tr>
              </thead>
              <tbody>
                {learning.data!.items.map((l) => (
                  <tr key={l.learningPathId} className="border-b last:border-b-0" data-testid="me-learning-row">
                    <td className="px-4 py-2">{l.learningPathName}</td>
                    <td className="px-4 py-2 text-xs uppercase">{l.status}</td>
                    <td className="px-4 py-2 text-xs">{l.mandatory ? "sì" : "no"}</td>
                    <td className="px-4 py-2 text-xs">{l.enrolledAt?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{l.completedAt?.slice(0, 10) ?? "—"}</td>
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
