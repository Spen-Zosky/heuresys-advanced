"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
const TAB_KEYS: ReadonlyArray<Tab> = ["inventory", "mapping", "runs"];

function buildInventoryCols(t: TFunction): DataColumn<BrownfieldExport>[] {
  const none = t("common:value.none");
  return [
    { header: t("brownfield.inventoryColumns.system"), cell: (e) => <span className="text-foreground">{e.sourceSystem}</span> },
    { header: t("brownfield.inventoryColumns.capturedAt"), cell: (e) => <span className="text-xs text-muted-foreground">{e.capturedAt.slice(0, 19)}</span> },
    { header: t("brownfield.inventoryColumns.rowCount"), align: "right", cell: (e) => <span className="text-xs">{e.rowCount ?? none}</span> },
    { header: t("brownfield.inventoryColumns.status"), cell: (e) => <StatusBadge value={e.status} /> },
  ];
}
function buildMappingCols(t: TFunction): DataColumn<BrownfieldMapping>[] {
  return [
    { header: t("brownfield.mappingColumns.sourceTable"), cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.sourceTable}</span> },
    { header: t("brownfield.mappingColumns.targetTable"), cell: (m) => <span className="font-mono text-xs text-muted-foreground">{m.targetTable}</span> },
    { header: t("brownfield.mappingColumns.status"), cell: (m) => <StatusBadge value={m.status} /> },
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
            isLoading={exports.isLoading}
            isError={exports.isError}
            rows={exports.data?.items ?? []}
            rowKey={(e) => e.brownfieldSourceExportId}
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
            isLoading={mappings.isLoading}
            isError={mappings.isError}
            rows={mappings.data?.items ?? []}
            rowKey={(m) => m.brownfieldTableMappingId}
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
            isLoading={runs.isLoading}
            isError={runs.isError}
            rows={runs.data?.items ?? []}
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
