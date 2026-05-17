"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface BlueprintProcess {
  blueprintProcessId: string;
  variantId: string;
  code: string;
  name: string;
  ordinal: number;
  description: string | null;
  isOptional: boolean;
}

export default function ProcessesPage() {
  const processes = useQuery({
    queryKey: ["blueprint-processes", "list"],
    queryFn: () => apiFetch<{ items: BlueprintProcess[]; total: number }>("/v1/blueprint-processes?limit=200"),
  });

  return (
    <main data-testid="processes-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="processes-title">Processi BPM</h1>
        <p className="text-sm opacity-70" data-testid="processes-count">
          {processes.data ? `${processes.data.total} processi` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Catalogo processi (blueprint-anchored)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {processes.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : processes.data && processes.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="processes-empty">Nessun processo.</div>
          ) : (
            <table className="w-full text-sm" data-testid="processes-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Opzionale</th>
                </tr>
              </thead>
              <tbody>
                {processes.data!.items.map((p) => (
                  <tr key={p.blueprintProcessId} className="border-b last:border-b-0" data-testid="processes-row">
                    <td className="px-4 py-2 text-xs opacity-70">{p.ordinal}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2 text-xs">{p.isOptional ? "sì" : "no"}</td>
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
