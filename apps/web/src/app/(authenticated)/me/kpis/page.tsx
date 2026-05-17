"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface MeKpi {
  positionKpiRequirementId: string;
  kpiCode: string;
  kpiName: string;
  unit: string | null;
  polarity: string;
  weight: string;
  latestMeasuredValue: string | null;
  latestTargetValue: string | null;
  latestRecordedAt: string | null;
}

export default function MeKpisPage() {
  const kpis = useQuery({
    queryKey: ["me", "kpis"],
    queryFn: () => apiFetch<{ items: MeKpi[]; total: number }>("/v1/me/kpis"),
  });

  return (
    <main data-testid="me-kpis-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="me-kpis-title">I miei KPI</h1>
        <p className="text-sm opacity-70" data-testid="me-kpis-count">
          {kpis.data ? `${kpis.data.total} obiettivi` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Obiettivi attivi</CardTitle></CardHeader>
        <CardContent className="p-0">
          {kpis.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : kpis.data && kpis.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="me-kpis-empty">
              Nessun KPI assegnato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="me-kpis-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">KPI</th>
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Direzione</th>
                  <th className="px-4 py-2">Peso</th>
                  <th className="px-4 py-2">Ultima misura</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {kpis.data!.items.map((k) => (
                  <tr key={k.positionKpiRequirementId} className="border-b last:border-b-0" data-testid="me-kpi-row">
                    <td className="px-4 py-2">{k.kpiName}</td>
                    <td className="px-4 py-2 font-mono text-xs">{k.kpiCode}</td>
                    <td className="px-4 py-2 text-xs">{k.polarity}</td>
                    <td className="px-4 py-2 text-xs">{k.weight}</td>
                    <td className="px-4 py-2 text-xs">{k.latestMeasuredValue ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{k.latestTargetValue ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">
                      {k.latestRecordedAt ? k.latestRecordedAt.slice(0, 10) : "—"}
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
