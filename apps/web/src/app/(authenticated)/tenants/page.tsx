"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { Tenant } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

export default function TenantsListPage() {
  const { t } = useTranslation("admin");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const tenants = usePaginatedList<Tenant>({ queryKey: ["tenants", "list"], path: "/v1/tenants" });

  const columns = useMemo<DataColumn<Tenant>[]>(
    () => [
      {
        header: t("tenants.columns.name"),
        cell: (row) => (
          <div className="flex flex-col">
            <Link
              href={`/tenants/${row.tenantId}`}
              data-testid="tenant-link"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {row.tenantName ?? t("tenants.fallbackName")}
            </Link>
            <span className="font-mono text-xs text-muted-foreground">{row.tenantCode}</span>
          </div>
        ),
      },
      {
        header: t("tenants.columns.country"),
        cell: (row) => <span className="text-xs text-muted-foreground">{row.tenantCountryCode ?? t("tenants.dash")}</span>,
      },
      {
        header: t("tenants.columns.size"),
        cell: (row) => <span className="text-xs text-muted-foreground">{row.tenantSizeBand ?? t("tenants.dash")}</span>,
      },
      { header: t("tenants.columns.status"), cell: (row) => <StatusBadge value={row.tenantStatus} /> },
    ],
    [t],
  );

  return (
    <DataTablePanel<Tenant>
      pageTestId="tenants-page"
      titleTestId="tenants-title"
      countTestId="tenants-count"
      title={t("tenants.title")}
      description={t("tenants.description")}
      count={tenants.query.data ? t("tenants.count", { count: tenants.total }) : undefined}
      isLoading={tenants.query.isLoading}
      isError={tenants.query.isError}
      errorTestId="tenants-error"
      errorMessage={t("tenants.errorMessage")}
      rows={tenants.rows}
      server={tenants.server}
      rowKey={(row) => row.tenantId}
      rowTestId="tenants-row"
      columns={columns}
      emptyTestId="tenants-empty"
      emptyTitle={t("tenants.emptyTitle")}
      emptyDescription={t("tenants.emptyDescription")}
      caption={t("tenants.caption")}
    />
  );
}
