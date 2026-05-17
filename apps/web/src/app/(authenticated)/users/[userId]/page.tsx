"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";
import { isApiError } from "../../../../lib/api/errors";

interface UserDetail {
  userId: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  tenantId: string | null;
  status: string;
  type: string;
  locale: string | null;
  timezone: string | null;
  isSynthetic: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export default function UserDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const user = useQuery({
    queryKey: ["users", userId],
    queryFn: () => apiFetch<UserDetail>(`/v1/users/${userId}`),
    enabled: !!userId,
  });

  if (user.isLoading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <span className="opacity-60">Caricamento…</span>
      </main>
    );
  }
  if (user.isError) {
    const code = isApiError(user.error) ? user.error.status : 0;
    return (
      <main className="max-w-5xl mx-auto px-6 py-8" data-testid="user-error">
        <Link href="/users" className="underline text-sm">← Utenti</Link>
        <p className="text-red-600 mt-4">
          {code === 404 ? "Utente non trovato." : "Errore di caricamento."}
        </p>
      </main>
    );
  }
  const u = user.data!;
  return (
    <main data-testid="user-detail-page" className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header>
        <Link href="/users" className="underline text-sm" data-testid="user-back">← Utenti</Link>
        <h1 className="text-2xl font-semibold mt-2" data-testid="user-display-name">
          {u.displayName ?? "(senza nome)"}
        </h1>
        <p className="text-sm opacity-70" data-testid="user-email-detail">{u.email}</p>
      </header>

      <Card>
        <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm" data-testid="user-fields">
            <dt className="opacity-70">User ID</dt>
            <dd className="font-mono text-xs" data-testid="field-userId">{u.userId}</dd>
            <dt className="opacity-70">Tenant ID</dt>
            <dd className="font-mono text-xs">{u.tenantId ?? "—"}</dd>
            <dt className="opacity-70">Stato</dt>
            <dd>{u.status}</dd>
            <dt className="opacity-70">Tipo</dt>
            <dd>{u.type}</dd>
            <dt className="opacity-70">Locale</dt>
            <dd>{u.locale ?? "—"}</dd>
            <dt className="opacity-70">Timezone</dt>
            <dd>{u.timezone ?? "—"}</dd>
            <dt className="opacity-70">Synthetic</dt>
            <dd>{u.isSynthetic ? "sì" : "no"}</dd>
            <dt className="opacity-70">Creato</dt>
            <dd className="text-xs">{u.createdAt}</dd>
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
