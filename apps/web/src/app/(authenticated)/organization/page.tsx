"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

interface OrgUnit {
  organizationUnitId: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  managerUserId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
}

interface OrgUnitsList {
  items: OrgUnit[];
  total: number;
}

const COLUMNS: DataColumn<OrgUnit>[] = [
  { header: "Codice", cell: (o) => <span className="font-mono text-xs">{o.code}</span> },
  { header: "Nome", cell: (o) => <span className="font-medium text-foreground">{o.name}</span> },
  { header: "Tipo", cell: (o) => <span className="text-xs uppercase text-muted-foreground">{o.type}</span> },
  {
    header: "Parent",
    cell: (o) => <span className="font-mono text-xs text-muted-foreground">{o.parentId?.slice(0, 8) ?? "—"}</span>,
  },
  {
    header: "Attiva",
    cell: (o) => <StatusPill tone={o.isActive ? "success" : "neutral"}>{o.isActive ? "sì" : "no"}</StatusPill>,
  },
];

export default function OrganizationPage() {
  const ous = useQuery({
    queryKey: ["organization-units", "list"],
    queryFn: () => apiFetch<OrgUnitsList>("/v1/organization-units?limit=200"),
  });

  return (
    <DataTablePanel<OrgUnit>
      pageTestId="organization-page"
      titleTestId="organization-title"
      countTestId="organization-count"
      title="Organization Units"
      description="Gerarchia delle unità organizzative del tenant."
      count={ous.data ? `${ous.data.total} unità` : undefined}
      isLoading={ous.isLoading}
      isError={ous.isError}
      errorMessage="Impossibile caricare le unità organizzative."
      rows={ous.data?.items ?? []}
      rowKey={(o) => o.organizationUnitId}
      rowTestId="organization-row"
      columns={COLUMNS}
      emptyTestId="organization-empty"
      emptyTitle="Nessuna OU"
      emptyDescription="Non ci sono unità organizzative."
      caption="Gerarchia organizzativa"
    />
  );
}
