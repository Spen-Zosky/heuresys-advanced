"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { PageHeader } from "@heuresys/ui";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusBadge } from "@/components/status-pill";
import type { BrownfieldSourceExport } from "@heuresys/shared/schemas/brownfield-source-exports";
import type { BrownfieldTableMapping } from "@heuresys/shared/schemas/brownfield-table-mappings";
import type { BrownfieldImportRun } from "@heuresys/shared/schemas/brownfield-import-runs";

// B-01 fix: use the SHARED contract types. The previous local interfaces invented
// field names the API never returns (sourceSystem/capturedAt/rowCount/sourceTable
// vs the real name/retrievedAt/sizeBytes/sourceTableId/approvalStatus), which made
// `capturedAt.slice()` crash the inventory tab and left the mapping columns empty.
// Aliases keep the <EntityTable<...>> generics below unchanged.
type BrownfieldExport = BrownfieldSourceExport;
type BrownfieldMapping = BrownfieldTableMapping;
type BrownfieldRun = BrownfieldImportRun;

function formatBytes(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

type Tab = "inventory" | "mapping" | "runs";
const TAB_KEYS: ReadonlyArray<Tab> = ["inventory", "mapping", "runs"];

function buildInventoryCols(t: TFunction): DataColumn<BrownfieldExport>[] {
  const none = t("common:value.none");
  return [
    { header: t("brownfield.inventoryColumns.system"), cell: (e) => <span className="text-foreground">{e.name}</span> },
    { header: t("brownfield.inventoryColumns.capturedAt"), cell: (e) => <span className="text-xs text-muted-foreground">{e.retrievedAt?.slice(0, 19) ?? none}</span> },
    { header: t("brownfield.inventoryColumns.size"), align: "right", cell: (e) => <span className="text-xs">{formatBytes(e.sizeBytes)}</span> },
    { header: t("brownfield.inventoryColumns.status"), cell: (e) => <StatusBadge value={e.status} /> },
  ];
}
function buildMappingCols(t: TFunction): DataColumn<BrownfieldMapping>[] {
  return [
    { header: t("brownfield.mappingColumns.sourceTable"), cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.sourceTableId}</span> },
    { header: t("brownfield.mappingColumns.targetTable"), cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.targetTable}</span> },
    { header: t("brownfield.mappingColumns.status"), cell: (m) => <StatusBadge value={m.approvalStatus} /> },
  ];
}
function buildRunsCols(t: TFunction): DataColumn<BrownfieldRun>[] {
  const none = t("common:value.none");
  return [
    { header: t("brownfield.runsColumns.run"), cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.importRunId.slice(0, 8)}</span> },
    { header: t("brownfield.runsColumns.wave"), cell: (r) => <span className="text-xs">{r.wave}</span> },
    { header: t("brownfield.runsColumns.scope"), cell: (r) => <span className="text-xs">{r.classificationScope}</span> },
    { header: t("brownfield.runsColumns.status"), cell: (r) => <StatusBadge value={r.status} /> },
    { header: t("brownfield.runsColumns.startedAt"), cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt?.slice(0, 19) ?? none}</span> },
  ];
}

export default function BrownfieldAdaptationPage() {
  const { t } = useTranslation("blueprints");
  const [tab, setTab] = useState<Tab>("inventory");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const exports = usePaginatedList<BrownfieldExport>({
    queryKey: ["brownfield-source-exports"],
    path: "/v1/brownfield-source-exports",
    enabled: tab === "inventory",
  });
  const mappings = usePaginatedList<BrownfieldMapping>({
    queryKey: ["brownfield-table-mappings"],
    path: "/v1/brownfield-table-mappings",
    enabled: tab === "mapping",
  });
  const runs = usePaginatedList<BrownfieldRun>({
    queryKey: ["brownfield-import-runs"],
    path: "/v1/brownfield-import-runs",
    enabled: tab === "runs",
  });

  const inventoryCols = useMemo(() => buildInventoryCols(t), [t]);
  const mappingCols = useMemo(() => buildMappingCols(t), [t]);
  const runsCols = useMemo(() => buildRunsCols(t), [t]);

  return (
    <main data-testid="brownfield-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader data-testid="brownfield-title" title={t("brownfield.title")} description={t("brownfield.description")} />

      <nav className="flex gap-1 border-b border-border" data-testid="brownfield-tabs">
        {TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            data-testid={`brownfield-tab-${key}`}
            className={`px-3 py-2 text-sm transition-colors ${tab === key ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t(`brownfield.tabs.${key}`)}
          </button>
        ))}
      </nav>

      {tab === "inventory" && (
        <div data-testid="brownfield-content-inventory">
          <EntityTable<BrownfieldExport>
            isLoading={exports.query.isLoading}
            isError={exports.query.isError}
            rows={exports.rows}
            server={exports.server}
            rowKey={(e) => e.sourceExportId}
            rowTestId="brownfield-inventory-row"
            columns={inventoryCols}
            emptyTestId="brownfield-inventory-empty"
            emptyTitle={t("brownfield.inventoryEmpty")}
            caption={t("brownfield.inventoryCaption")}
          />
        </div>
      )}
      {tab === "mapping" && (
        <div data-testid="brownfield-content-mapping">
          <EntityTable<BrownfieldMapping>
            isLoading={mappings.query.isLoading}
            isError={mappings.query.isError}
            rows={mappings.rows}
            server={mappings.server}
            rowKey={(m) => m.tableMappingId}
            rowTestId="brownfield-mapping-row"
            columns={mappingCols}
            emptyTestId="brownfield-mapping-empty"
            emptyTitle={t("brownfield.mappingEmpty")}
            caption={t("brownfield.mappingCaption")}
          />
        </div>
      )}
      {tab === "runs" && (
        <div data-testid="brownfield-content-runs">
          <EntityTable<BrownfieldRun>
            isLoading={runs.query.isLoading}
            isError={runs.query.isError}
            rows={runs.rows}
            server={runs.server}
            rowKey={(r) => r.importRunId}
            rowTestId="brownfield-runs-row"
            columns={runsCols}
            emptyTestId="brownfield-runs-empty"
            emptyTitle={t("brownfield.runsEmpty")}
            caption={t("brownfield.runsCaption")}
          />
        </div>
      )}
    </main>
  );
}
