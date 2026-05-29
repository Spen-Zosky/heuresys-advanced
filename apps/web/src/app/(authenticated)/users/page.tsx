"use client";

import { useQuery } from "@tanstack/react-query";
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

const COLUMNS: DataColumn<User>[] = [
  {
    header: "Nome",
    cell: (u) => (
      <Link href={`/users/${u.userId}`} data-testid="user-link" className="font-medium text-foreground underline-offset-2 hover:underline">
        {u.displayName ?? "—"}
      </Link>
    ),
  },
  { header: "Email", cell: (u) => <span data-testid="user-email" className="text-muted-foreground">{u.email}</span> },
  { header: "Stato", cell: (u) => <StatusBadge value={u.status} /> },
  { header: "Tipo", cell: (u) => <span className="text-xs uppercase text-muted-foreground">{u.type}</span> },
];

export default function UsersListPage() {
  const users = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<UsersList>("/v1/users"),
  });

  return (
    <DataTablePanel<User>
      pageTestId="users-page"
      titleTestId="users-title"
      countTestId="users-count"
      title="Utenti"
      description="Utenti del tenant con stato e tipo."
      count={users.data ? `${users.data.total} totali` : undefined}
      isLoading={users.isLoading}
      isError={users.isError}
      errorTestId="users-error"
      errorMessage="Impossibile caricare gli utenti."
      rows={users.data?.items ?? []}
      rowKey={(u) => u.userId}
      rowTestId="users-row"
      columns={COLUMNS}
      emptyTestId="users-empty"
      emptyTitle="Nessun utente"
      emptyDescription="Non ci sono utenti nel tenant."
      caption="Elenco utenti"
    />
  );
}
