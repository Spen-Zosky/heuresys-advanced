"use client";

/**
 * /organization/org-chart — l'organigramma del cliente.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V6). Fino al 2026-11-14 questa
 * pagina disegnava il grafo a forza salvato (`sys_visualization_*`), scritto una volta da un seed
 * e mai aggiornato: 162 nodi di posizione sovrapposti, nomi in inglese di posizioni scomparse,
 * «HR Director» staccato dal «CEO». Ora l'organigramma si calcola dai dati vivi a ogni apertura
 * (`GET /v1/me/organigramma`), a blocchi con le persone come nel banco del datastore, oppure a
 * nodi; «Aggiorna» lo ricalcola. Un mandato che vede più clienti sceglie con `?tenantId=`.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { VistaOrganigramma } from "@/components/organigramma/vista";

export default function OrgChartPage() {
  const { t } = useTranslation("admin");
  const tenantId = useSearchParams().get("tenantId");
  return (
    <main data-testid="org-chart-page" className="mx-auto max-w-[96rem] space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="org-chart-title"
        title={t("orgChart.title")}
        description={t("orgChart.description")}
        breadcrumbs={
          <Link
            href="/organization"
            data-testid="org-chart-back"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("orgChart.back")}
          </Link>
        }
      />
      <Card>
        <CardContent className="pt-6" data-testid="org-chart-graph">
          <VistaOrganigramma tenantId={tenantId} testId="org-chart-vista" />
        </CardContent>
      </Card>
    </main>
  );
}
