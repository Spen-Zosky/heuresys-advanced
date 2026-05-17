"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface VisualizationGraph {
  visualizationGraphId: string;
  tenantId: string | null;
  code: string;
  name: string;
  graphKind: string;
  status: string;
  createdAt: string;
}

export default function VisualizationsPage() {
  const graphs = useQuery({
    queryKey: ["visualization-graphs"],
    queryFn: () =>
      apiFetch<{ items: VisualizationGraph[]; total: number }>(
        "/v1/visualization-graphs?limit=200",
      ),
  });

  return (
    <main data-testid="visualizations-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="visualizations-title">Visualizations</h1>
        <p className="text-sm opacity-70" data-testid="visualizations-count">
          {graphs.data ? `${graphs.data.total} grafici` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Browser</CardTitle></CardHeader>
        <CardContent className="p-0">
          {graphs.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : graphs.data && graphs.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="visualizations-empty">
              Nessun grafico registrato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="visualizations-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Stato</th>
                </tr>
              </thead>
              <tbody>
                {graphs.data!.items.map((g) => (
                  <tr key={g.visualizationGraphId} className="border-b last:border-b-0" data-testid="visualizations-row">
                    <td className="px-4 py-2 font-mono text-xs">{g.code}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/visualizations/${g.visualizationGraphId}`}
                        className="underline"
                        data-testid="visualization-link"
                      >
                        {g.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs uppercase">{g.graphKind}</td>
                    <td className="px-4 py-2 text-xs">{g.status}</td>
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
