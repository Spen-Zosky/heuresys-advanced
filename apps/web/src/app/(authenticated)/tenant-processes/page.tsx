"use client";

/**
 * apps/web/src/app/(authenticated)/tenant-processes/page.tsx — i processi del tenant (V5 del piano
 * docs/piani/PIANO_processi-e-progetti-sistematici_20261118.md).
 *
 * Un solo numero (R5): i processi attivi di primo livello del tenant, da `GET /v1/processes?level=1`;
 * i sottoprocessi stanno dentro la scheda del loro processo. Il catalogo dei processi del modello
 * resta in `/processes`: è un altro oggetto, con il suo nome (V3, un termine per concetto).
 * Un mandato di piattaforma vede tutti i tenant, con la colonna e la scelta del tenant che parte da
 * «Tutti».
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TenantProcessListResponse, TenantProcessSummary } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useFormat } from "@/lib/format";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { PageHeader } from "@/components/intestazione-pagina";
import { OggettoContato } from "@/components/processo/oggetto-contato";
import { SchedePagina } from "@/components/schede-pagina";
import { MatriceProcessi } from "@/components/processo/matrice-processi";
import { Badge } from "@heuresys/ui";
import { NomeOppure } from "@/components/senza-nome";

function buildColumns(t: TFunction, numero: (v: number) => string, conTenant: boolean): DataColumn<TenantProcessSummary>[] {
  const c = (k: string) => t(`processiDelTenant.columns.${k}`);
  return [
    {
      header: c("name"),
      cell: (p) => (
        <Link href={`/tenant-processes/${p.processId}`} className="font-medium text-foreground hover:underline" data-testid="tenant-process-link">
          {p.name}
        </Link>
      ),
    },
    {
      header: c("owner"),
      cell: (p) => (p.ownerPositionTitle ? (
        <span className="text-sm">
          {p.ownerName ? <span>{p.ownerName}</span> : null}
          <span className="block text-xs text-muted-foreground">{p.ownerPositionTitle}</span>
        </span>
      ) : <span className="text-xs text-muted-foreground">{t("processiDelTenant.scheda.senzaResponsabile")}</span>),
    },
    { header: c("subprocesses"), align: "right", cell: (p) => <span className="tabular-nums">{numero(p.subprocessCount)}</span> },
    { header: c("activities"), align: "right", cell: (p) => <span className="tabular-nums">{numero(p.activityCount)}</span> },
    { header: c("units"), align: "right", cell: (p) => <span className="tabular-nums">{numero(p.unitCount)}</span> },
    ...(conTenant ? [{ header: c("tenant"), cell: (p: TenantProcessSummary) => <span className="text-xs"><NomeOppure nome={p.tenantName} id={p.tenantId} /></span> }] : []),
  ];
}

export default function TenantProcessesPage() {
  const { t } = useTranslation("blueprints");
  const fmt = useFormat();
  const [tenant, setTenant] = useState("");
  const q = useQuery({
    queryKey: ["processes", "list", 1],
    queryFn: ({ signal }) => apiFetch<TenantProcessListResponse>("/v1/processes?level=1", { signal }),
    staleTime: 60_000,
  });
  const tenants = useMemo(
    () => [...new Map((q.data?.items ?? []).map((p) => [p.tenantId, p.tenantName])).entries()],
    [q.data],
  );
  const conTenant = tenants.length > 1;
  const righe = useMemo(() => (q.data?.items ?? []).filter((p) => !tenant || p.tenantId === tenant), [q.data, tenant]);
  const columns = useMemo(() => buildColumns(t, (v) => fmt.numero(v), conTenant), [t, fmt, conTenant]);

  const tabella = (
    <EntityTable<TenantProcessSummary>
      isLoading={q.isLoading}
      isError={q.isError}
      error={q.error}
      errorMessage={t("processiDelTenant.error")}
      rows={righe}
      rowKey={(p) => p.processId}
      rowTestId="tenant-processes-row"
      columns={columns}
      emptyTestId="tenant-processes-empty"
      emptyTitle={t("processiDelTenant.emptyTitle")}
      emptyDescription={t("processiDelTenant.emptyDescription")}
      caption={t("processiDelTenant.caption")}
    />
  );

  return (
    <div data-testid="tenant-processes-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="tenant-processes-title"
        title={t("processiDelTenant.title")}
        description={t("processiDelTenant.description")}
        badges={q.data ? <Badge variant="secondary" data-testid="tenant-processes-count">{t("processiDelTenant.count", { count: righe.length })}</Badge> : undefined}
        actions={conTenant ? (
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("processiDelTenant.columns.tenant")}</span>
            <select value={tenant} onChange={(e) => setTenant(e.target.value)} className="rounded border border-border bg-background px-2 py-1" data-testid="tenant-processes-tenant">
              <option value="">{t("processiDelTenant.tutti")}</option>
              {tenants.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </label>
        ) : undefined}
      />
      <OggettoContato oggetto="configurazione" />
      <SchedePagina
        schede={[
          { id: "elenco", titolo: t("processiDelTenant.matrice.elenco"), conteggio: q.data ? righe.length : null, contenuto: tabella },
          // La matrice chiede sempre il tenant dei processi in elenco: un mandato di piattaforma con un
          // solo tenant in elenco (RTL) senza il parametro riceveva quella del proprio tenant, vuota.
          { id: "matrice", titolo: t("processiDelTenant.matrice.scheda"), contenuto: <MatriceProcessi tenantId={tenant || tenants[0]?.[0]} /> },
        ]}
      />
    </div>
  );
}
