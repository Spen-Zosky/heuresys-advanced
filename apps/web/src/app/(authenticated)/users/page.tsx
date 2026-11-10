"use client";

/**
 * /users — l'elenco delle persone. Primo esempio del repertorio interfacce
 * (docs/kb/xtras/INTERFACCE_INTELLIGENTI.md, regole di Enzo del 10/11/2026):
 *
 *   R1  ordine per cognome, scritto «Cognome, Nome» (l'ordine lo fa l'API, su tutto l'elenco);
 *   R2  colonne scelte per il contesto: chi è (nome), che cosa fa (ruolo e unità), dove
 *       opera (sede). L'email non serve a riconoscere una persona e sta nella sua scheda;
 *   R3  lo stato è l'ultima colonna;
 *   R4  niente codici a video: il «tipo» diventa la scelta «Mostra: Persone / Utenze di
 *       servizio / ...», con descrizioni leggibili;
 *   R5  un solo numero, coerente col perimetro e coi filtri: «158 persone», non «167 totali»
 *       che conta anche le utenze di servizio. Chi vede tutti i tenant (PLATFORM_ADMIN) ha la
 *       colonna Tenant e il filtro per tenant, che parte da «Tutti».
 *
 * La paginazione è del server (usePaginatedList): il numero in testa e le righe vengono
 * dalla stessa risposta, e non si ferma più a 50 righe come prima.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { UserListItem, Tenant } from "@heuresys/shared";
import { apiFetch } from "../../../lib/api/fetch";
import { useCurrentUserPermissions } from "../../../lib/api/auth";
import { usePaginatedList } from "../../../lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "../../../components/data-table-panel";
import { EnumStatusBadge } from "../../../components/enum-badge";
import { useEnumLabel } from "../../../lib/enum-labels";
import { cognomeNome } from "../../../lib/person-label";

const KINDS = ["STANDARD", "SERVICE", "GENERATED_INCUMBENT", "ALL"] as const;
type Kind = (typeof KINDS)[number];

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground";

export default function UsersListPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const perms = useCurrentUserPermissions();
  const vedeTuttiITenant = perms.data?.roles.includes("PLATFORM_ADMIN") ?? false;

  const [kind, setKind] = useState<Kind>("STANDARD");
  const [tenantId, setTenantId] = useState("");

  const tenants = useQuery({
    queryKey: ["tenants", "for-users-filter"],
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

  const list = usePaginatedList<UserListItem>({
    queryKey: ["users", "list"],
    path: "/v1/users",
    params: {
      type: kind === "ALL" ? undefined : kind,
      tenantId: vedeTuttiITenant ? tenantId : undefined,
    },
  });

  const columns = useMemo<DataColumn<UserListItem>[]>(() => {
    const cols: DataColumn<UserListItem>[] = [
      {
        header: t("users.columns.name"),
        cell: (u) => (
          <span className="flex flex-col">
            <Link
              href={`/users/${u.userId}`}
              data-testid="user-link"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {cognomeNome(u) || t("users.noName")}
            </Link>
            {u.type !== "STANDARD" ? (
              <span data-testid="user-type-badge" className="text-xs text-muted-foreground">
                {enumLabel("userType", u.type)}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        header: t("users.columns.role"),
        cell: (u) =>
          u.positionTitle ? (
            <span className="flex flex-col" data-testid="user-role">
              <span className="text-foreground">{u.positionTitle}</span>
              {u.organizationUnitName ? (
                <span className="text-xs text-muted-foreground">{u.organizationUnitName}</span>
              ) : null}
            </span>
          ) : (
            <span data-testid="user-role" className="text-muted-foreground">{t("users.noRole")}</span>
          ),
      },
      {
        header: t("users.columns.site"),
        cell: (u) => (
          <span data-testid="user-site" className="text-muted-foreground">
            {u.siteName ?? t("users.noSite")}
          </span>
        ),
      },
    ];
    if (vedeTuttiITenant) {
      cols.push({
        header: t("users.columns.tenant"),
        cell: (u) => <span data-testid="user-tenant">{u.tenantName ?? "—"}</span>,
      });
    }
    // R3: lo stato chiude la riga.
    cols.push({
      header: t("users.columns.status"),
      cell: (u) => <EnumStatusBadge domain="userStatus" value={u.status} />,
    });
    return cols;
  }, [t, enumLabel, vedeTuttiITenant]);

  const total = list.query.data?.total;

  return (
    <DataTablePanel<UserListItem>
      pageTestId="users-page"
      titleTestId="users-title"
      countTestId="users-count"
      title={t("users.title")}
      description={t("users.description")}
      count={total !== undefined ? t(`users.countKind.${kind}`, { count: total }) : undefined}
      isLoading={list.query.isLoading}
      isError={list.query.isError}
      error={list.query.error}
      errorTestId="users-error"
      errorMessage={t("users.errorMessage")}
      rows={list.rows}
      server={list.server}
      rowKey={(u) => u.userId}
      rowTestId="users-row"
      columns={columns}
      emptyTestId="users-empty"
      emptyTitle={t("users.emptyTitle")}
      emptyDescription={t("users.emptyDescription")}
      caption={t("users.caption")}
    >
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("users.filters.kind")}
          <select
            data-testid="users-kind-filter"
            className={SELECT_CLASS}
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k === "ALL" ? t("users.filters.ALL") : enumLabel("userTypePlural", k)}
              </option>
            ))}
          </select>
        </label>
        {vedeTuttiITenant ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("users.filters.tenant")}
            <select
              data-testid="users-tenant-filter"
              className={SELECT_CLASS}
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">{t("users.filters.allTenants")}</option>
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
