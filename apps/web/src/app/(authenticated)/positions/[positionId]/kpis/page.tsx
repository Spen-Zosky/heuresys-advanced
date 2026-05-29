"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable } from "@/components/data-table-panel";

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

  const items = kpis.data?.items ?? [];

  return (
    <main data-testid="position-kpis-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="position-kpis-title"
        title="KPI richiesti"
        breadcrumbs={
          <Link
            href={`/positions/${positionId}`}
            data-testid="position-kpis-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            ← Posizione
          </Link>
        }
        badges={
          <span data-testid="position-kpis-count" className="text-sm text-muted-foreground">
            {kpis.data ? `${items.length} KPI associati` : "Caricamento…"}
          </span>
        }
      />

      <Card>
        <CardHeader><CardTitle>Requisiti</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionKpiReq>
            isLoading={kpis.isLoading}
            isError={kpis.isError}
            rows={items}
            rowKey={(k) => k.positionKpiRequirementId}
            rowTestId="position-kpi-row"
            emptyTestId="position-kpis-empty"
            emptyTitle="Nessun KPI richiesto dichiarato."
            caption="KPI richiesti dalla posizione"
            columns={[
              { header: "Codice", cell: (k) => <span className="font-mono text-xs">{k.kpiCode}</span> },
              { header: "KPI", cell: (k) => k.kpiName },
              { header: "Peso", cell: (k) => <span className="text-xs">{k.weight}</span> },
              { header: "Template", cell: (k) => <span className="font-mono text-xs">{JSON.stringify(k.targetTemplate)}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
