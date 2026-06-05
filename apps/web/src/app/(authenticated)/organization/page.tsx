"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

export default function OrganizationPage() {
  const { t } = useTranslation("admin");
  const ous = useQuery({
    queryKey: ["organization-units", "list"],
    queryFn: () => apiFetch<OrgUnitsList>("/v1/organization-units?limit=200"),
  });

  const columns = useMemo<DataColumn<OrgUnit>[]>(
    () => [
      { header: t("organization.columns.code"), cell: (o) => <span className="font-mono text-xs">{o.code}</span> },
      { header: t("organization.columns.name"), cell: (o) => <span className="font-medium text-foreground">{o.name}</span> },
      { header: t("organization.columns.type"), cell: (o) => <span className="text-xs uppercase text-muted-foreground">{o.type}</span> },
      {
        header: t("organization.columns.parent"),
        cell: (o) => <span className="font-mono text-xs text-muted-foreground">{o.parentId?.slice(0, 8) ?? t("organization.dash")}</span>,
      },
      {
        header: t("organization.columns.active"),
        cell: (o) => <StatusPill tone={o.isActive ? "success" : "neutral"}>{o.isActive ? t("organization.activeYes") : t("organization.activeNo")}</StatusPill>,
      },
    ],
    [t],
  );

  return (
    <DataTablePanel<OrgUnit>
      pageTestId="organization-page"
      titleTestId="organization-title"
      countTestId="organization-count"
      title={t("organization.title")}
      description={t("organization.description")}
      count={ous.data ? t("organization.count", { count: ous.data.total }) : undefined}
      isLoading={ous.isLoading}
      isError={ous.isError}
      errorMessage={t("organization.errorMessage")}
      rows={ous.data?.items ?? []}
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
