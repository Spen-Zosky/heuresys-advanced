"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface LearningModule {
  learningModuleId: string;
  code: string;
  name: string;
  isGlobal: boolean;
  durationMinutes: number | null;
}

export default function LearningCataloguePage() {
  const modules = useQuery({
    queryKey: ["learning-modules", "list"],
    queryFn: () => apiFetch<{ items: LearningModule[]; total: number }>("/v1/learning-modules?limit=200"),
  });

  return (
    <main data-testid="learning-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="learning-title">Catalogo moduli</h1>
        <p className="text-sm opacity-70" data-testid="learning-count">
          {modules.data ? `${modules.data.total} moduli` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Moduli formativi</CardTitle></CardHeader>
        <CardContent className="p-0">
          {modules.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : modules.data && modules.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="learning-empty">Nessun modulo.</div>
          ) : (
            <table className="w-full text-sm" data-testid="learning-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Durata (min)</th>
                  <th className="px-4 py-2">Scope</th>
                </tr>
              </thead>
              <tbody>
                {modules.data!.items.map((m) => (
                  <tr key={m.learningModuleId} className="border-b last:border-b-0" data-testid="learning-row">
                    <td className="px-4 py-2 font-mono text-xs">{m.code}</td>
                    <td className="px-4 py-2">{m.name}</td>
                    <td className="px-4 py-2 text-xs">{m.durationMinutes ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">
                      {m.isGlobal ? "global" : "tenant"}
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
