"use client";

/**
 * Posizioni — repertorio interfacce (docs/kb/xtras/INTERFACCE_INTELLIGENTI.md), blocco B2.
 *
 * Chi la usa: chi governa l'organizzazione del tenant (direzione HR, amministrazione).
 * Che cosa ci decide: quali posti ci sono, chi li occupa, dove stanno e quanto contano.
 * Colonne: il titolo del posto (prima colonna, non il codice: R2), il titolare scritto
 * «Cognome, Nome» (R1), l'unità e la sede, la criticità in parole (R4), lo stato in coda (R3).
 * Il numero in testa e le righe vengono dalla stessa risposta paginata del server (R5): niente
 * più «316 totali» sopra un elenco fermo a 50, e per default si contano le posizioni attive,
 * con la casella «Mostra» per le altre.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { PositionListItem, Tenant } from "@heuresys/shared";
import { apiFetch } from "../../../lib/api/fetch";
import { useCurrentUserPermissions } from "../../../lib/api/auth";
import { usePaginatedList } from "../../../lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "../../../components/data-table-panel";
import { EnumStatusBadge } from "../../../components/enum-badge";
import { StatusPill } from "../../../components/status-pill";
import { cognomeNome } from "../../../lib/person-label";

const STATI = ["ALL", "ACTIVE", "INACTIVE"] as const; // R6: «Tutte» in testa
type Stato = (typeof STATI)[number];

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground";

function titolare(p: PositionListItem): string {
  return cognomeNome({
    firstName: p.incumbentFirstName,
    lastName: p.incumbentLastName,
    displayName: p.incumbentDisplayName ?? "",
  });
}

export default function PositionsListPage() {
  const { t } = useTranslation("admin");
  const perms = useCurrentUserPermissions();
  const vedeTuttiITenant = perms.data?.roles.includes("PLATFORM_ADMIN") ?? false;

  const [stato, setStato] = useState<Stato>("ACTIVE");
  const [tenantId, setTenantId] = useState("");

  const tenants = useQuery({
    queryKey: ["tenants", "for-positions-filter"],
    queryFn: () => apiFetch<{ items: Tenant[] }>("/v1/tenants?limit=200"),
    enabled: vedeTuttiITenant,
  });
  const tenantOptions = useMemo(
    () =>
      [...(tenants.data?.items ?? [])].sort((a, b) =>
        a.tenantName.localeCompare(b.tenantName, undefined, { sensitivity: "base" }),
      ),
    [tenants.data],
  );

  const list = usePaginatedList<PositionListItem>({
    queryKey: ["positions", "list"],
    path: "/v1/positions",
    params: {
      isActive: stato === "ALL" ? undefined : stato === "ACTIVE" ? "true" : "false",
      tenantId: vedeTuttiITenant ? tenantId : undefined,
    },
  });

  const columns = useMemo<DataColumn<PositionListItem>[]>(() => {
    const cols: DataColumn<PositionListItem>[] = [
      {
        header: t("positions.columns.title"),
        cell: (p) => (
          <Link
            href={`/positions/${p.positionId}`}
            data-testid="position-link"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {p.title}
          </Link>
        ),
      },
      {
        header: t("positions.columns.incumbent"),
        cell: (p) => {
          const nome = titolare(p);
          return nome ? (
            <span data-testid="position-incumbent">{nome}</span>
          ) : (
            <span data-testid="position-incumbent" className="text-muted-foreground">
              {t("positions.vacant")}
            </span>
          );
        },
      },
      {
        header: t("positions.columns.unit"),
        cell: (p) => (
          <span data-testid="position-unit" className="text-muted-foreground">
            {p.organizationUnitName ?? "—"}
          </span>
        ),
      },
      {
        header: t("positions.columns.site"),
        cell: (p) => (
          <span data-testid="position-site" className="text-muted-foreground">
            {p.siteName ?? "—"}
          </span>
        ),
      },
      {
        header: t("positions.columns.criticality"),
        cell: (p) => <EnumStatusBadge domain="positionCriticality" value={p.criticality} />,
      },
    ];
    if (vedeTuttiITenant) {
      cols.push({
        header: t("positions.columns.tenant"),
        cell: (p) => <span data-testid="position-tenant">{p.tenantName ?? "—"}</span>,
      });
    }
    // R3: lo stato chiude la riga.
    cols.push({
      header: t("positions.columns.status"),
      cell: (p) => (
        <StatusPill tone={p.isActive ? "success" : "neutral"}>
          {p.isActive ? t("positions.activeOn") : t("positions.activeOff")}
        </StatusPill>
      ),
    });
    return cols;
  }, [t, vedeTuttiITenant]);

  const total = list.query.data?.total;

  return (
    <DataTablePanel<PositionListItem>
      originPath={"/v1/positions"}
      pageTestId="positions-page"
      titleTestId="positions-title"
      countTestId="positions-count"
      title={t("positions.title")}
      description={t("positions.description")}
      count={total !== undefined ? t(`positions.countKind.${stato}`, { count: total }) : undefined}
      isLoading={list.query.isLoading}
      isError={list.query.isError}
      error={list.query.error}
      errorTestId="positions-error"
      errorMessage={t("positions.errorMessage")}
      rows={list.rows}
      server={list.server}
      rowKey={(p) => p.positionId}
      rowTestId="positions-row"
      columns={columns}
      emptyTestId="positions-empty"
      emptyTitle={t("positions.emptyTitle")}
      emptyDescription={t("positions.emptyDescription")}
      caption={t("positions.caption")}
    >
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("positions.filters.status")}
          <select
            data-testid="positions-status-filter"
            className={SELECT_CLASS}
            value={stato}
            onChange={(e) => setStato(e.target.value as Stato)}
          >
            {STATI.map((s) => (
              <option key={s} value={s}>
                {t(`positions.filters.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {vedeTuttiITenant ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("positions.filters.tenant")}
            <select
              data-testid="positions-tenant-filter"
              className={SELECT_CLASS}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">{t("positions.filters.allTenants")}</option>
              {tenantOptions.map((tn) => (
                <option key={tn.tenantId} value={tn.tenantId}>
                  {tn.tenantName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </DataTablePanel>
  );
}
