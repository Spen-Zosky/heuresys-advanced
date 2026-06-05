"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

interface Tenant {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  tenantLegalName: string | null;
  tenantCountryCode: string | null;
  tenantIndustryCode: string | null;
  tenantSizeBand: string | null;
  tenantStatus: string;
}

interface TenantsList {
  items: Tenant[];
  total: number;
}

export default function TenantsListPage() {
  const { t } = useTranslation("admin");
  const tenants = useQuery({
    queryKey: ["tenants", "list"],
    queryFn: () => apiFetch<TenantsList>("/v1/tenants?limit=200"),
  });

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
      count={tenants.data ? t("tenants.count", { count: tenants.data.total }) : undefined}
      isLoading={tenants.isLoading}
      isError={tenants.isError}
      errorTestId="tenants-error"
      errorMessage={t("tenants.errorMessage")}
      rows={tenants.data?.items ?? []}
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
