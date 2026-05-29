"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { FieldGrid } from "@/components/detail-panel";
import { StatusBadge } from "@/components/status-pill";

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
      <main className="mx-auto max-w-5xl px-6 py-8">
        <span className="text-sm text-muted-foreground">Caricamento…</span>
      </main>
    );
  }
  if (user.isError) {
    const code = isApiError(user.error) ? user.error.status : 0;
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="user-error">
        <Link href="/users" className="text-sm underline">← Utenti</Link>
        <p className="mt-4 text-destructive">{code === 404 ? "Utente non trovato." : "Errore di caricamento."}</p>
      </main>
    );
  }
  const u = user.data!;
  return (
    <main data-testid="user-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="user-display-name"
        title={u.displayName ?? "(senza nome)"}
        breadcrumbs={
          <Link href="/users" data-testid="user-back" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            ← Utenti
          </Link>
        }
        badges={
          <>
            <span data-testid="user-email-detail" className="text-sm text-muted-foreground">{u.email}</span>
            <StatusBadge value={u.status} />
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle>Anagrafica</CardTitle></CardHeader>
        <CardContent>
          <FieldGrid
            testId="user-fields"
            fields={[
              { label: "User ID", value: u.userId, mono: true, testId: "field-userId" },
              { label: "Tenant ID", value: u.tenantId ?? "—", mono: true },
              { label: "Stato", value: <StatusBadge value={u.status} /> },
              { label: "Tipo", value: u.type },
              { label: "Locale", value: u.locale ?? "—" },
              { label: "Timezone", value: u.timezone ?? "—" },
              { label: "Synthetic", value: u.isSynthetic ? "sì" : "no" },
              { label: "Creato", value: u.createdAt },
            ]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
