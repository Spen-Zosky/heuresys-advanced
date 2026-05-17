"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface Tenant {
  tenantId: string;
  code: string;
  name: string;
  industryCode: string | null;
  status: string;
  isReference: boolean;
}

export default function TenantsListPage() {
  const tenants = useQuery({
    queryKey: ["tenants", "list"],
    queryFn: () => apiFetch<{ items: Tenant[]; total: number }>("/v1/tenants?limit=200"),
  });

  return (
    <main data-testid="tenants-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="tenants-title">Tenant</h1>
        <p className="text-sm opacity-70" data-testid="tenants-count">
          {tenants.data ? `${tenants.data.total} totali` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Registry</CardTitle></CardHeader>
        <CardContent className="p-0">
          {tenants.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : tenants.isError ? (
            <div className="p-6 text-red-600" data-testid="tenants-error">
              Accesso negato o errore di caricamento.
            </div>
          ) : tenants.data && tenants.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="tenants-empty">Nessun tenant.</div>
          ) : (
            <table className="w-full text-sm" data-testid="tenants-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Industry</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {tenants.data!.items.map((t) => (
                  <tr key={t.tenantId} className="border-b last:border-b-0" data-testid="tenants-row">
                    <td className="px-4 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-4 py-2">{t.name}</td>
                    <td className="px-4 py-2 text-xs">{t.industryCode ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">{t.status}</td>
                    <td className="px-4 py-2 text-xs">{t.isReference ? "sì" : "no"}</td>
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
