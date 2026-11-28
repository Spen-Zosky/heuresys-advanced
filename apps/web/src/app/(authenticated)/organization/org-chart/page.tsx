"use client";

/**
 * /organization/org-chart — l'organigramma del cliente.
 *
 * Piano docs/piani/PIANO_organigrammi-a-blocchi_20261114.md (V6). Fino al 2026-11-14 questa
 * pagina disegnava il grafo a forza salvato (`sys_visualization_*`), scritto una volta da un seed
 * e mai aggiornato: 162 nodi di posizione sovrapposti, nomi in inglese di posizioni scomparse,
 * «HR Director» staccato dal «CEO». Ora l'organigramma si calcola dai dati vivi a ogni apertura
 * (`GET /v1/me/organigramma`), a blocchi con le persone come nel banco del datastore, oppure a
 * nodi; «Aggiorna» lo ricalcola. Un mandato che vede più clienti sceglie con `?tenantId=` o con la
 * casella «Cliente»; senza scelta parte dal primo cliente diverso dal proprio tenant, così un
 * mandato di piattaforma (tenant Heuresys) non apre l'organigramma della piattaforma al posto di
 * quello del cliente (2026-11-21, la stessa classe della matrice dei processi).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { TenantListResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUser } from "@/lib/api/auth";
import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import { Card, CardContent } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { VistaOrganigramma } from "@/components/organigramma/vista";

export default function OrgChartPage() {
  const { t } = useTranslation("admin");
  const richiesto = useSearchParams().get("tenantId");
  const me = useCurrentUser();
  // I tenant che la persona vede: per un ruolo del tenant è solo il suo, per un mandato di piattaforma tutti.
  const elenco = useQuery({
    queryKey: ["tenants", "scelta-organigramma"],
    queryFn: ({ signal }) => apiFetch<TenantListResponse>("/v1/tenants?limit=200", { signal }),
    retry: false,
    staleTime: 300_000,
  });
  const clienti = useMemo(
    () => (elenco.data?.items ?? []).filter((x) => x.tenantStatus === "ACTIVE").sort((a, b) => a.tenantName.localeCompare(b.tenantName, "it")),
    [elenco.data],
  );
  const [scelto, setScelto] = useState("");
  const predefinito = clienti.length > 1 && me.data ? (clienti.find((x) => x.tenantId !== me.data?.tenantId)?.tenantId ?? null) : null;
  const tenantId = richiesto ?? (scelto || predefinito);
  return (
    <div data-testid="org-chart-page" className="mx-auto max-w-[96rem] space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="org-chart-title"
        title={t("orgChart.title")}
        description={t("orgChart.description")}
        actions={
          <Link
            href={tenantId ? `/organization/backstage?tenantId=${encodeURIComponent(tenantId)}` : "/organization/backstage"}
            data-testid="org-chart-backstage"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Layers className="h-4 w-4" aria-hidden />{t("orgChart.backstage")}
          </Link>
        }
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
      {clienti.length > 1 && !richiesto ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("orgChart.cliente")}</span>
          <select value={tenantId ?? ""} onChange={(e) => setScelto(e.target.value)} className="rounded border border-border bg-background px-2 py-1" data-testid="org-chart-cliente">
            {clienti.map((x) => <option key={x.tenantId} value={x.tenantId}>{x.tenantName}</option>)}
          </select>
        </label>
      ) : null}
      <Card>
        <CardContent className="pt-6" data-testid="org-chart-graph">
          <VistaOrganigramma tenantId={tenantId} testId="org-chart-vista" />
        </CardContent>
      </Card>
    </div>
  );
}
