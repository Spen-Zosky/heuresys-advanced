"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("admin");
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
        title={t("positions.kpis.title")}
        breadcrumbs={
          <Link
            href={`/positions/${positionId}`}
            data-testid="position-kpis-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("positions.kpis.back")}
          </Link>
        }
        badges={
          <span data-testid="position-kpis-count" className="text-sm text-muted-foreground">
            {kpis.data ? t("positions.kpis.count", { count: items.length }) : t("common:loading")}
          </span>
        }
      />

      <Card>
        <CardHeader><CardTitle>{t("positions.kpis.cardTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionKpiReq>
            isLoading={kpis.isLoading}
            isError={kpis.isError}
            rows={items}
            rowKey={(k) => k.positionKpiRequirementId}
            rowTestId="position-kpi-row"
            emptyTestId="position-kpis-empty"
            emptyTitle={t("positions.kpis.empty")}
            caption={t("positions.kpis.caption")}
            columns={[
              { header: t("positions.kpis.columns.code"), cell: (k) => <span className="font-mono text-xs">{k.kpiCode}</span> },
              { header: t("positions.kpis.columns.kpi"), cell: (k) => k.kpiName },
              { header: t("positions.kpis.columns.weight"), cell: (k) => <span className="text-xs">{k.weight}</span> },
              { header: t("positions.kpis.columns.template"), cell: (k) => <span className="font-mono text-xs">{JSON.stringify(k.targetTemplate)}</span> },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
