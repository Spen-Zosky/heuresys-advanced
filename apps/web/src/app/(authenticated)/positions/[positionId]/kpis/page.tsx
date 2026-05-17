"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../../lib/api/fetch";

interface PositionKpiReq {
  positionKpiRequirementId: string;
  kpiDefinitionId: string;
  kpiCode: string;
  kpiName: string;
  weight: string;
  targetTemplate: Record<string, unknown>;
}

export default function PositionKpisPage() {
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const kpis = useQuery({
    queryKey: ["positions", positionId, "kpis"],
    queryFn: () => apiFetch<{ items: PositionKpiReq[] }>(`/v1/positions/${positionId}/kpis`),
    enabled: !!positionId,
  });

  return (
    <main data-testid="position-kpis-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href={`/positions/${positionId}`} className="underline text-sm" data-testid="position-kpis-back">
          ← Posizione
        </Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="position-kpis-title">
          KPI richiesti
        </h1>
        <p className="text-sm opacity-70" data-testid="position-kpis-count">
          {kpis.data ? `${kpis.data.items.length} KPI associati` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Requisiti</CardTitle></CardHeader>
        <CardContent className="p-0">
          {kpis.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : kpis.data && kpis.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="position-kpis-empty">
              Nessun KPI richiesto dichiarato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="position-kpis-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">KPI</th>
                  <th className="px-4 py-2">Peso</th>
                  <th className="px-4 py-2">Template</th>
                </tr>
              </thead>
              <tbody>
                {kpis.data!.items.map((k) => (
                  <tr key={k.positionKpiRequirementId} className="border-b last:border-b-0" data-testid="position-kpi-row">
                    <td className="px-4 py-2 font-mono text-xs">{k.kpiCode}</td>
                    <td className="px-4 py-2">{k.kpiName}</td>
                    <td className="px-4 py-2 text-xs">{k.weight}</td>
                    <td className="px-4 py-2 text-xs font-mono">
                      {JSON.stringify(k.targetTemplate)}
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
