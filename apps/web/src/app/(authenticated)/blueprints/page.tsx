"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface BlueprintVariant {
  blueprintVariantId: string;
  familyId: string;
  code: string;
  name: string;
  description: string | null;
}
interface BlueprintFamily {
  blueprintFamilyId: string;
  code: string;
  name: string;
  industryCode: string | null;
}

export default function BlueprintsPage() {
  const families = useQuery({
    queryKey: ["blueprint-families", "list"],
    queryFn: () => apiFetch<{ items: BlueprintFamily[]; total: number }>("/v1/blueprint-families?limit=200"),
  });
  const variants = useQuery({
    queryKey: ["blueprint-variants", "list"],
    queryFn: () => apiFetch<{ items: BlueprintVariant[]; total: number }>("/v1/blueprint-variants?limit=200"),
  });
  const familyById = new Map(families.data?.items.map((f) => [f.blueprintFamilyId, f]) ?? []);

  return (
    <main data-testid="blueprints-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="blueprints-title">Blueprint</h1>
        <p className="text-sm opacity-70" data-testid="blueprints-count">
          {variants.data ? `${variants.data.total} varianti` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Varianti</CardTitle></CardHeader>
        <CardContent className="p-0">
          {variants.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : variants.data && variants.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="blueprints-empty">Nessuna variante.</div>
          ) : (
            <table className="w-full text-sm" data-testid="blueprints-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Codice</th>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Famiglia</th>
                  <th className="px-4 py-2">Industry</th>
                </tr>
              </thead>
              <tbody>
                {variants.data!.items.map((v) => {
                  const fam = familyById.get(v.familyId);
                  return (
                    <tr key={v.blueprintVariantId} className="border-b last:border-b-0" data-testid="blueprints-row">
                      <td className="px-4 py-2 font-mono text-xs">{v.code}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/blueprints/${v.blueprintVariantId}`}
                          className="underline"
                          data-testid="blueprint-link"
                        >
                          {v.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-xs">{fam?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">{fam?.industryCode ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
