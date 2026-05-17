"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface KpiDef {
  kpiDefinitionId: string;
  code: string;
  name: string;
  unit: string | null;
  polarity: string;
  isGlobal: boolean;
}

export default function KpisCataloguePage() {
  const kpis = useQuery({
    queryKey: ["kpi-definitions", "list"],
    queryFn: () => apiFetch<{ items: KpiDef[]; total: number }>("/v1/kpi-definitions?limit=200"),
  });

  return (
    <main data-testid="kpis-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="kpis-title">Catalogo KPI</h1>
        <p className="text-sm opacity-70" data-testid="kpis-count">
          {kpis.data ? `${kpis.data.total} KPI definiti` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>KPI</CardTitle></CardHeader>
        <CardContent className="p-0">
          {kpis.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : kpis.data && kpis.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="kpis-empty">Nessun KPI.</div>
          ) : (
            <table className="w-full text-sm" data-testid="kpis-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Unità</th>
                  <th className="px-4 py-2">Polarità</th>
                  <th className="px-4 py-2">Scope</th>
                </tr>
              </thead>
              <tbody>
                {kpis.data!.items.map((k) => (
                  <tr key={k.kpiDefinitionId} className="border-b last:border-b-0" data-testid="kpis-row">
                    <td className="px-4 py-2 font-mono text-xs">{k.code}</td>
                    <td className="px-4 py-2">{k.name}</td>
                    <td className="px-4 py-2 text-xs">{k.unit ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{k.polarity}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">
                      {k.isGlobal ? "global" : "tenant"}
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
