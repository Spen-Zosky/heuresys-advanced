"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import { apiFetch } from "../../../lib/api/fetch";

interface BrownfieldExport {
  brownfieldSourceExportId: string;
  sourceSystem: string;
  capturedAt: string;
  rowCount: number | null;
  status: string;
}
interface BrownfieldRun {
  importRunId: string;
  exportId: string | null;
  wave: number;
  classificationScope: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
}
interface BrownfieldMapping {
  brownfieldTableMappingId: string;
  sourceTable: string;
  targetTable: string;
  status: string;
}

type Tab = "inventory" | "mapping" | "runs";

export default function BrownfieldAdaptationPage() {
  const [tab, setTab] = useState<Tab>("inventory");
  const exports = useQuery({
    queryKey: ["brownfield-source-exports"],
    queryFn: () =>
      apiFetch<{ items: BrownfieldExport[]; total: number }>(
        "/v1/brownfield-source-exports?limit=200",
      ),
    enabled: tab === "inventory",
  });
  const mappings = useQuery({
    queryKey: ["brownfield-table-mappings"],
    queryFn: () =>
      apiFetch<{ items: BrownfieldMapping[]; total: number }>(
        "/v1/brownfield-table-mappings?limit=200",
      ),
    enabled: tab === "mapping",
  });
  const runs = useQuery({
    queryKey: ["brownfield-import-runs"],
    queryFn: () =>
      apiFetch<{ items: BrownfieldRun[]; total: number }>(
        "/v1/brownfield-import-runs?limit=200",
      ),
    enabled: tab === "runs",
  });

  return (
    <main data-testid="brownfield-page" className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" data-testid="brownfield-title">
          Brownfield adaptation
        </h1>
      </header>

      <nav className="border-b flex gap-4 text-sm" data-testid="brownfield-tabs">
        {(["inventory", "mapping", "runs"] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            data-testid={`brownfield-tab-${k}`}
            className={`px-3 py-2 ${tab === k ? "border-b-2 border-black font-medium" : "opacity-60"}`}
          >
            {k === "inventory" ? "Inventory" : k === "mapping" ? "Mapping" : "Runs"}
          </button>
        ))}
      </nav>

      {tab === "inventory" && (
        <Card data-testid="brownfield-content-inventory">
          <CardHeader><CardTitle>Source exports</CardTitle></CardHeader>
          <CardContent className="p-0">
            {exports.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : exports.data && exports.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="brownfield-inventory-empty">
                Nessun export registrato.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="brownfield-inventory-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Sistema</th>
                    <th className="px-4 py-2">Catturato</th>
                    <th className="px-4 py-2">Righe</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {exports.data!.items.map((e) => (
                    <tr key={e.brownfieldSourceExportId} className="border-b last:border-b-0" data-testid="brownfield-inventory-row">
                      <td className="px-4 py-2 text-xs">{e.sourceSystem}</td>
                      <td className="px-4 py-2 text-xs">{e.capturedAt.slice(0, 19)}</td>
                      <td className="px-4 py-2 text-xs">{e.rowCount ?? "—"}</td>
                      <td className="px-4 py-2 text-xs uppercase">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "mapping" && (
        <Card data-testid="brownfield-content-mapping">
          <CardHeader><CardTitle>Table mappings</CardTitle></CardHeader>
          <CardContent className="p-0">
            {mappings.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : mappings.data && mappings.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="brownfield-mapping-empty">
                Nessuna mapping registrata.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="brownfield-mapping-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Source table</th>
                    <th className="px-4 py-2">Target table</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.data!.items.map((m) => (
                    <tr key={m.brownfieldTableMappingId} className="border-b last:border-b-0" data-testid="brownfield-mapping-row">
                      <td className="px-4 py-2 font-mono text-xs">{m.sourceTable}</td>
                      <td className="px-4 py-2 font-mono text-xs">{m.targetTable}</td>
                      <td className="px-4 py-2 text-xs uppercase">{m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "runs" && (
        <Card data-testid="brownfield-content-runs">
          <CardHeader><CardTitle>Import runs</CardTitle></CardHeader>
          <CardContent className="p-0">
            {runs.isLoading ? (
              <div className="p-6 opacity-60">Caricamento…</div>
            ) : runs.data && runs.data.items.length === 0 ? (
              <div className="p-6 opacity-60" data-testid="brownfield-runs-empty">
                Nessun run.
              </div>
            ) : (
              <table className="w-full text-sm" data-testid="brownfield-runs-table">
                <thead>
                  <tr className="text-left border-b">
                    <th className="px-4 py-2">Run</th>
                    <th className="px-4 py-2">Wave</th>
                    <th className="px-4 py-2">Scope</th>
                    <th className="px-4 py-2">Stato</th>
                    <th className="px-4 py-2">Inizio</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data!.items.map((r) => (
                    <tr key={r.importRunId} className="border-b last:border-b-0" data-testid="brownfield-runs-row">
                      <td className="px-4 py-2 font-mono text-xs">{r.importRunId.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-xs">{r.wave}</td>
                      <td className="px-4 py-2 text-xs">{r.classificationScope}</td>
                      <td className="px-4 py-2 text-xs uppercase">{r.status}</td>
                      <td className="px-4 py-2 text-xs">{r.startedAt?.slice(0, 19) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
