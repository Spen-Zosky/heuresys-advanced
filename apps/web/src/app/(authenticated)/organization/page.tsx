"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

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

export default function OrganizationPage() {
  const ous = useQuery({
    queryKey: ["organization-units", "list"],
    queryFn: () => apiFetch<{ items: OrgUnit[]; total: number }>("/v1/organization-units?limit=200"),
  });

  return (
    <main data-testid="organization-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="organization-title">Organization Units</h1>
        <p className="text-sm opacity-70" data-testid="organization-count">
          {ous.data ? `${ous.data.total} unità` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Gerarchia</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ous.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : ous.data && ous.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="organization-empty">Nessuna OU.</div>
          ) : (
            <table className="w-full text-sm" data-testid="organization-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Parent</th>
                  <th className="px-4 py-2">Attiva</th>
                </tr>
              </thead>
              <tbody>
                {ous.data!.items.map((o) => (
                  <tr key={o.organizationUnitId} className="border-b last:border-b-0" data-testid="organization-row">
                    <td className="px-4 py-2 font-mono text-xs">{o.code}</td>
                    <td className="px-4 py-2">{o.name}</td>
                    <td className="px-4 py-2 text-xs uppercase">{o.type}</td>
                    <td className="px-4 py-2 font-mono text-xs">{o.parentId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{o.isActive ? "sì" : "no"}</td>
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
