"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

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
  const users = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<UsersList>("/v1/users"),
  });

  return (
    <main data-testid="users-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="users-title">Utenti</h1>
        <p className="text-sm opacity-70" data-testid="users-count">
          {users.data ? `${users.data.total} totali` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="p-0">
          {users.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : users.isError ? (
            <div className="p-6 text-red-600" data-testid="users-error">Impossibile caricare gli utenti.</div>
          ) : users.data && users.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="users-empty">Nessun utente nel tenant.</div>
          ) : (
            <table className="w-full text-sm" data-testid="users-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {users.data!.items.map((u) => (
                  <tr key={u.userId} className="border-b last:border-b-0" data-testid="users-row">
                    <td className="px-4 py-2">
                      <Link href={`/users/${u.userId}`} className="underline" data-testid="user-link">
                        {u.displayName ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2" data-testid="user-email">{u.email}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">{u.status}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">{u.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
