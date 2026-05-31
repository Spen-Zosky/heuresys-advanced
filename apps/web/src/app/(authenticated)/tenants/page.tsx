"use client";

import { useQuery } from "@tanstack/react-query";
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

const COLUMNS: DataColumn<Tenant>[] = [
  {
    header: "Nome",
    cell: (t) => (
      <div className="flex flex-col">
        <Link
          href={`/tenants/${t.tenantId}`}
          data-testid="tenant-link"
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {t.tenantName ?? "ND"}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{t.tenantCode}</span>
      </div>
    ),
  },
  {
    header: "Country",
    cell: (t) => <span className="text-xs text-muted-foreground">{t.tenantCountryCode ?? "—"}</span>,
  },
  {
    header: "Size",
    cell: (t) => <span className="text-xs text-muted-foreground">{t.tenantSizeBand ?? "—"}</span>,
  },
  { header: "Stato", cell: (t) => <StatusBadge value={t.tenantStatus} /> },
];

export default function TenantsListPage() {
  const tenants = useQuery({
    queryKey: ["tenants", "list"],
    queryFn: () => apiFetch<TenantsList>("/v1/tenants?limit=200"),
  });

  return (
    <DataTablePanel<Tenant>
      pageTestId="tenants-page"
      titleTestId="tenants-title"
      countTestId="tenants-count"
      title="Tenant"
      description="Registry dei tenant con codice, country e stato."
      count={tenants.data ? `${tenants.data.total} totali` : undefined}
      isLoading={tenants.isLoading}
      isError={tenants.isError}
      errorTestId="tenants-error"
      errorMessage="Accesso negato o errore di caricamento."
      rows={tenants.data?.items ?? []}
      rowKey={(t) => t.tenantId}
      rowTestId="tenants-row"
      columns={COLUMNS}
      emptyTestId="tenants-empty"
      emptyTitle="Nessun tenant"
      emptyDescription="Non ci sono tenant registrati."
      caption="Registry tenant"
    />
  );
}
