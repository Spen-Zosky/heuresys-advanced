"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface Position {
  positionId: string;
  code: string;
  title: string;
  tenantId: string;
  organizationUnitId: string | null;
  jobRoleId: string | null;
  reportsToPositionId: string | null;
  ownerUserId: string | null;
  criticality: string | null;
  isActive: boolean;
}
interface PositionsList {
  items: Position[];
  total: number;
}

export default function PositionsListPage() {
  const positions = useQuery({
    queryKey: ["positions", "list"],
    queryFn: () => apiFetch<PositionsList>("/v1/positions"),
  });

  return (
    <main data-testid="positions-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="positions-title">Posizioni</h1>
        <p className="text-sm opacity-70" data-testid="positions-count">
          {positions.data ? `${positions.data.total} totali` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Elenco</CardTitle></CardHeader>
        <CardContent className="p-0">
          {positions.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : positions.isError ? (
            <div className="p-6 text-red-600" data-testid="positions-error">Errore di caricamento.</div>
          ) : positions.data && positions.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="positions-empty">Nessuna posizione.</div>
          ) : (
            <table className="w-full text-sm" data-testid="positions-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Titolo</th>
                  <th className="px-4 py-2">Criticità</th>
                  <th className="px-4 py-2">Attiva</th>
                </tr>
              </thead>
              <tbody>
                {positions.data!.items.map((p) => (
                  <tr key={p.positionId} className="border-b last:border-b-0" data-testid="positions-row">
                    <td className="px-4 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-4 py-2">
                      <Link href={`/positions/${p.positionId}`} className="underline" data-testid="position-link">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs uppercase opacity-70">{p.criticality ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{p.isActive ? "sì" : "no"}</td>
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
