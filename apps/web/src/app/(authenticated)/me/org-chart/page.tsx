"use client";

/**
 * /me/org-chart — il mio organigramma.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V6). Lo stesso organigramma vivo
 * di /organization/org-chart (`GET /v1/me/organigramma`), con la propria unità in risalto: nei
 * blocchi il riquadro ha il bordo del colore primario, nei nodi il ramo che porta a lei è aperto.
 * Prima era il grafo a forza salvato, con le posizioni di un'organizzazione che non c'è più.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useOrganigramma, VistaOrganigramma } from "@/components/organigramma/vista";

interface MeProfilo { userId: string }

export default function MeOrgChartPage() {
  const { t } = useTranslation("ess");
  const io = useQuery({ queryKey: ["me", "profile"], queryFn: () => apiFetch<MeProfilo>("/v1/me/profile") });
  const org = useOrganigramma();
  const mio = io.data?.userId ?? null;
  const evidenzia = useMemo(
    () => new Set((org.data?.unita ?? []).filter((u) => mio && u.persone.some((p) => p.id === mio)).map((u) => u.id)),
    [org.data, mio],
  );

  return (
    <main data-testid="me-org-chart-page" className="mx-auto max-w-[96rem] space-y-6 px-6 pb-8">
      <PageHeader
        title={t("orgChart.title")}
        description={t("orgChart.description")}
        badges={
          <span data-testid="me-org-chart-badge" className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {t("orgChart.personalView")}
          </span>
        }
      />
      <Card>
        <CardContent className="space-y-2 pt-6" data-testid="me-org-chart-graph">
          {evidenzia.size ? <p className="text-xs text-muted-foreground">{t("orgChart.tuaUnita")}</p> : null}
          <VistaOrganigramma evidenzia={evidenzia} testId="me-org-chart-vista" />
        </CardContent>
      </Card>
    </main>
  );
}
