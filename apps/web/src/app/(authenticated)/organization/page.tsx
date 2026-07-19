"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { OrganizationUnit } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { StatusPill } from "@/components/status-pill";

export default function OrganizationPage() {
  const { t } = useTranslation("admin");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const ous = usePaginatedList<OrganizationUnit>({
    queryKey: ["organization-units", "list"],
    path: "/v1/organization-units",
  });

  const columns = useMemo<DataColumn<OrganizationUnit>[]>(
    () => [
      { header: t("organization.columns.code"), cell: (o) => <span className="font-mono text-xs">{o.code}</span> },
      { header: t("organization.columns.name"), cell: (o) => <span className="font-medium text-foreground">{o.name}</span> },
      { header: t("organization.columns.type"), cell: (o) => <span className="text-xs uppercase text-muted-foreground">{o.type}</span> },
      {
        header: t("organization.columns.parent"),
        cell: (o) => <span className="text-xs text-muted-foreground">{o.parentName ?? (o.parentId ? o.parentId.slice(0, 8) : t("organization.dash"))}</span>,
      },
      {
        header: t("organization.columns.active"),
        cell: (o) => <StatusPill tone={o.isActive ? "success" : "neutral"}>{o.isActive ? t("organization.activeYes") : t("organization.activeNo")}</StatusPill>,
      },
    ],
    [t],
  );

  return (
    <DataTablePanel<OrganizationUnit>
      pageTestId="organization-page"
      titleTestId="organization-title"
      countTestId="organization-count"
      title={t("organization.title")}
      description={t("organization.description")}
      count={ous.query.data ? t("organization.count", { count: ous.total }) : undefined}
      isLoading={ous.query.isLoading}
      isError={ous.query.isError}
      errorMessage={t("organization.errorMessage")}
      rows={ous.rows}
      server={ous.server}
      rowKey={(o) => o.organizationUnitId}
      rowTestId="organization-row"
      columns={columns}
      emptyTestId="organization-empty"
      emptyTitle={t("organization.emptyTitle")}
      emptyDescription={t("organization.emptyDescription")}
      caption={t("organization.caption")}
    />
  );
}
