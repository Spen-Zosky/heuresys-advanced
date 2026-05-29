"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";

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
const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: "inventory", label: "Inventory" },
  { key: "mapping", label: "Mapping" },
  { key: "runs", label: "Runs" },
];

const INVENTORY_COLS: DataColumn<BrownfieldExport>[] = [
  { header: "Sistema", cell: (e) => <span className="text-foreground">{e.sourceSystem}</span> },
  { header: "Catturato", cell: (e) => <span className="text-xs text-muted-foreground">{e.capturedAt.slice(0, 19)}</span> },
  { header: "Righe", align: "right", cell: (e) => <span className="text-xs">{e.rowCount ?? "—"}</span> },
  { header: "Stato", cell: (e) => <StatusBadge value={e.status} /> },
];
const MAPPING_COLS: DataColumn<BrownfieldMapping>[] = [
  { header: "Source table", cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.sourceTable}</span> },
  { header: "Target table", cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.targetTable}</span> },
  { header: "Stato", cell: (m) => <StatusBadge value={m.status} /> },
];
const RUNS_COLS: DataColumn<BrownfieldRun>[] = [
  { header: "Run", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.importRunId.slice(0, 8)}</span> },
  { header: "Wave", cell: (r) => <span className="text-xs">{r.wave}</span> },
  { header: "Scope", cell: (r) => <span className="text-xs">{r.classificationScope}</span> },
  { header: "Stato", cell: (r) => <StatusBadge value={r.status} /> },
  { header: "Inizio", cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt?.slice(0, 19) ?? "—"}</span> },
];

export default function BrownfieldAdaptationPage() {
  const [tab, setTab] = useState<Tab>("inventory");
  const exports = useQuery({
    queryKey: ["brownfield-source-exports"],
    queryFn: () => apiFetch<{ items: BrownfieldExport[]; total: number }>("/v1/brownfield-source-exports?limit=200"),
    enabled: tab === "inventory",
  });
  const mappings = useQuery({
    queryKey: ["brownfield-table-mappings"],
    queryFn: () => apiFetch<{ items: BrownfieldMapping[]; total: number }>("/v1/brownfield-table-mappings?limit=200"),
    enabled: tab === "mapping",
  });
  const runs = useQuery({
    queryKey: ["brownfield-import-runs"],
    queryFn: () => apiFetch<{ items: BrownfieldRun[]; total: number }>("/v1/brownfield-import-runs?limit=200"),
    enabled: tab === "runs",
  });

  return (
    <main data-testid="brownfield-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader data-testid="brownfield-title" title="Brownfield adaptation" description="Inventario, mapping e run di import dei dati legacy." />

      <nav className="flex gap-1 border-b border-border" data-testid="brownfield-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            data-testid={`brownfield-tab-${t.key}`}
            className={`px-3 py-2 text-sm transition-colors ${tab === t.key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "inventory" && (
        <div data-testid="brownfield-content-inventory">
          <EntityTable<BrownfieldExport>
            isLoading={exports.isLoading}
            isError={exports.isError}
            rows={exports.data?.items ?? []}
            rowKey={(e) => e.brownfieldSourceExportId}
            rowTestId="brownfield-inventory-row"
            columns={INVENTORY_COLS}
            emptyTestId="brownfield-inventory-empty"
            emptyTitle="Nessun export registrato"
            caption="Source exports"
          />
        </div>
      )}
      {tab === "mapping" && (
        <div data-testid="brownfield-content-mapping">
          <EntityTable<BrownfieldMapping>
            isLoading={mappings.isLoading}
            isError={mappings.isError}
            rows={mappings.data?.items ?? []}
            rowKey={(m) => m.brownfieldTableMappingId}
            rowTestId="brownfield-mapping-row"
            columns={MAPPING_COLS}
            emptyTestId="brownfield-mapping-empty"
            emptyTitle="Nessuna mapping registrata"
            caption="Table mappings"
          />
        </div>
      )}
      {tab === "runs" && (
        <div data-testid="brownfield-content-runs">
          <EntityTable<BrownfieldRun>
            isLoading={runs.isLoading}
            isError={runs.isError}
            rows={runs.data?.items ?? []}
            rowKey={(r) => r.importRunId}
            rowTestId="brownfield-runs-row"
            columns={RUNS_COLS}
            emptyTestId="brownfield-runs-empty"
            emptyTitle="Nessun run"
            caption="Import runs"
          />
        </div>
      )}
    </main>
  );
}
