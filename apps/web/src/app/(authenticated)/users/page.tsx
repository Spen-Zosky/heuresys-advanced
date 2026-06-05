"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { apiFetch } from "../../../lib/api/fetch";
import { DataTablePanel, type DataColumn } from "../../../components/data-table-panel";
import { StatusBadge } from "../../../components/status-pill";

interface User {
  userId: string;
  email: string;
  displayName: string | null;
  tenantId: string | null;
  status: string;
  type: string;
}
interface UsersList {
  items: User[];
  total: number;
}

export default function UsersListPage() {
  const { t } = useTranslation("admin");
  const users = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<UsersList>("/v1/users"),
  });

  const columns = useMemo<DataColumn<User>[]>(
    () => [
      {
        header: t("users.columns.name"),
        cell: (u) => (
          <Link href={`/users/${u.userId}`} data-testid="user-link" className="font-medium text-foreground underline-offset-2 hover:underline">
            {u.displayName ?? t("users.noName")}
          </Link>
        ),
      },
      { header: t("users.columns.email"), cell: (u) => <span data-testid="user-email" className="text-muted-foreground">{u.email}</span> },
      { header: t("users.columns.status"), cell: (u) => <StatusBadge value={u.status} /> },
      { header: t("users.columns.type"), cell: (u) => <span className="text-xs uppercase text-muted-foreground">{u.type}</span> },
    ],
    [t],
  );

  return (
    <DataTablePanel<User>
      pageTestId="users-page"
      titleTestId="users-title"
      countTestId="users-count"
      title={t("users.title")}
      description={t("users.description")}
      count={users.data ? t("users.count", { count: users.data.total }) : undefined}
      isLoading={users.isLoading}
      isError={users.isError}
      errorTestId="users-error"
      errorMessage={t("users.errorMessage")}
      rows={users.data?.items ?? []}
      rowKey={(u) => u.userId}
      rowTestId="users-row"
      columns={columns}
      emptyTestId="users-empty"
      emptyTitle={t("users.emptyTitle")}
      emptyDescription={t("users.emptyDescription")}
      caption={t("users.caption")}
    />
  );
}
