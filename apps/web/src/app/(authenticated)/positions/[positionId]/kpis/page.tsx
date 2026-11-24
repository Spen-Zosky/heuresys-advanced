"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable } from "@/components/data-table-panel";
import { NomeOppure } from "@/components/senza-nome";
import { Codice } from "@/components/codice";
import { useFormat } from "@/lib/format";
import { vociTemplateKpi } from "@/lib/template-kpi";
import { NuovoIndicatoreRichiesto, PesoIndicatore, TogliRequisito, usePuoModificarePosizione } from "../_components/requisiti-modifica";

interface PositionKpiReq {
  requirementId: string;
  kpiDefinitionId: string;
  kpiCode: string | null;
  kpiName: string | null;
  weight: number;
  targetTemplate: Record<string, unknown>;
}

export default function PositionKpisPage() {
  const { t } = useTranslation("admin");
  // K15: la colonna «Togli» c'è solo per chi può modificare la posizione; per gli altri sarebbe
  // una fila di celle vuote senza spiegazione.
  const puo = usePuoModificarePosizione();
  const fmt = useFormat();
  const params = useParams<{ positionId: string }>();
  const positionId = params.positionId;
  const kpis = useQuery({
    queryKey: ["positions", positionId, "kpis"],
    queryFn: () => apiFetch<{ items: PositionKpiReq[] }>(`/v1/positions/${positionId}/kpis`),
    enabled: !!positionId,
  });

  const items = kpis.data?.items ?? [];

  return (
    <div data-testid="position-kpis-page" className="mx-auto max-w-5xl space-y-6 px-6 pb-8">
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
            {kpis.data ? t("positions.kpis.count", { count: items.length }) : kpis.isError ? t("common:stato.nonDisponibile") : t("common:loading")}
          </span>
        }
      />

      <NuovoIndicatoreRichiesto positionId={positionId} />

      <Card>
        <CardHeader><CardTitle as="h2">{t("positions.kpis.cardTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<PositionKpiReq> originPath={"/v1/positions"}
            isLoading={kpis.isLoading}
            isError={kpis.isError}
            error={kpis.error}
            rows={items}
            rowKey={(k) => k.requirementId}
            rowTestId="position-kpi-row"
            emptyTestId="position-kpis-empty"
            emptyTitle={t("positions.kpis.empty")}
            caption={t("positions.kpis.caption")}
            columns={[
              { header: t("positions.kpis.columns.kpi"), cell: (k) => <NomeOppure nome={k.kpiName} id={k.kpiDefinitionId} /> },
              { header: t("positions.kpis.columns.code"), cell: (k) => <Codice value={k.kpiCode} /> },
              { header: t("positions.kpis.columns.weight"), cell: (k) => <PesoIndicatore key={`${k.kpiDefinitionId}-${k.weight}`} positionId={positionId} kpiId={k.kpiDefinitionId} peso={k.weight} /> },
              { header: t("positions.kpis.columns.template"), cell: (k) => {
                // C4: le soglie in parole, mai il JSON del modello importato.
                const voci = vociTemplateKpi(k.targetTemplate);
                return voci.length === 0 ? <span className="text-xs text-muted-foreground">—</span> : (
                  <span className="text-xs text-foreground">
                    {voci.map((v) => `${t(`positions.kpis.soglia.${v.chiave}`)} ${fmt.numero(v.valore, 2)}`).join(" · ")}
                  </span>
                );
              } },
              ...(puo ? [{ header: "", cell: (k: PositionKpiReq) => (
                <TogliRequisito percorso={`/v1/positions/${positionId}/kpis/${k.kpiDefinitionId}`} chiave={["positions", positionId, "kpis"]} testId="position-kpi-remove" />
              ) }] : []),
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
