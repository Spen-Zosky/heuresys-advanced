"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../../lib/api/fetch";

interface SeedRun {
  seedAcquisitionRunId: string;
  tenantId: string | null;
  blueprintVariantId: string | null;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  initiatedBy: string | null;
  metadata: Record<string, unknown>;
}

export default function SeedRunsPage() {
  const runs = useQuery({
    queryKey: ["seed-acquisition-runs", "list"],
    queryFn: () =>
      apiFetch<{ items: SeedRun[]; total: number }>("/v1/seed-acquisition-runs?limit=200"),
  });

  return (
    <main data-testid="seed-runs-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="seed-runs-title">
          Seed acquisition — Runs
        </h1>
        <p className="text-sm opacity-70" data-testid="seed-runs-count">
          {runs.data ? `${runs.data.total} run` : "Caricamento…"}
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Pipeline runs</CardTitle></CardHeader>
        <CardContent className="p-0">
          {runs.isLoading ? (
            <div className="p-6 opacity-60">Caricamento…</div>
          ) : runs.data && runs.data.items.length === 0 ? (
            <div className="p-6 opacity-60" data-testid="seed-runs-empty">
              Nessun run di acquisizione registrato.
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="seed-runs-table">
              <thead>
                <tr className="text-left border-b">
                  <th className="px-4 py-2">Run ID</th>
                  <th className="px-4 py-2">Variant</th>
                  <th className="px-4 py-2">Stato</th>
                  <th className="px-4 py-2">Inizio</th>
                  <th className="px-4 py-2">Fine</th>
                </tr>
              </thead>
              <tbody>
                {runs.data!.items.map((r) => (
                  <tr key={r.seedAcquisitionRunId} className="border-b last:border-b-0" data-testid="seed-runs-row">
                    <td className="px-4 py-2 font-mono text-xs">{r.seedAcquisitionRunId.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.blueprintVariantId?.slice(0, 8) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs uppercase">{r.status}</td>
                    <td className="px-4 py-2 text-xs">{r.startedAt?.slice(0, 19) ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{r.finishedAt?.slice(0, 19) ?? "—"}</td>
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
