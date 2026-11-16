"use client";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@heuresys/ui";
import type { RunDistanceResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";

// La distanza fra il tenant e il modello di una corsa (ADR-0059 D7, `GET /v1/consolidation-runs/:runId/distance`).
// Sola lettura: per ogni dominio dice quante righe sono uguali, parziali, diverse o presenti da una parte sola,
// così chi decide vede quanto è lontano il tenant dal modello prima di avviare o rendere definitivo un giro.

const RUNS = "/v1/consolidation-runs";

export function DistanzaCorsa({ runId }: { runId: string }) {
  const { t } = useTranslation("hr");
  const q = useQuery({
    queryKey: ["consolidation-runs", "distance", runId],
    queryFn: () => apiFetch<RunDistanceResponse>(`${RUNS}/${runId}/distance`),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground" data-testid="consolidation-distance-loading">{t("consolidationRuns.distance.loading")}</p>;
  if (q.isError || !q.data) return <p role="alert" className="text-sm text-destructive" data-testid="consolidation-distance-error">{t("consolidationRuns.distance.error")}</p>;

  const { totale, domini } = q.data;
  return (
    <section data-testid="consolidation-distance" className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{t("consolidationRuns.distance.title")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("consolidationRuns.distance.summary", {
          rows: totale.righe, same: totale.uguali, partial: totale.parziali, different: totale.diversi,
          onlyModel: totale.solo_modello, onlyTenant: totale.solo_tenant,
        })}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">{t("consolidationRuns.distance.domain")}</th>
            <th className="py-1 text-right font-medium">{t("consolidationRuns.distance.same")}</th>
            <th className="py-1 text-right font-medium">{t("consolidationRuns.distance.partial")}</th>
            <th className="py-1 text-right font-medium">{t("consolidationRuns.distance.different")}</th>
            <th className="py-1 text-right font-medium">{t("consolidationRuns.distance.onlyModel")}</th>
            <th className="py-1 text-right font-medium">{t("consolidationRuns.distance.onlyTenant")}</th>
          </tr>
        </thead>
        <tbody>
          {domini.filter((d) => d.righe > 0).map((d) => (
            <tr key={d.dominio} className="border-t border-border" title={d.nota} data-testid="consolidation-distance-row">
              <td className="py-1 text-foreground">{t(`consolidationRuns.distance.domains.${d.dominio}`, { defaultValue: d.dominio })}</td>
              <td className="py-1 text-right tabular-nums">{d.uguali}</td>
              <td className="py-1 text-right tabular-nums">{d.parziali}</td>
              <td className="py-1 text-right tabular-nums">{d.diversi}</td>
              <td className="py-1 text-right tabular-nums">{d.solo_modello}</td>
              <td className="py-1 text-right tabular-nums">{d.solo_tenant}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {totale.ricchezza_persa > 0 ? (
        <Badge variant="secondary" data-testid="consolidation-distance-lost">{t("consolidationRuns.distance.lost", { count: totale.ricchezza_persa })}</Badge>
      ) : null}
    </section>
  );
}
