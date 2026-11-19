"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { SeedAcquisitionRun } from "@heuresys/shared";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { ProposteCorsa } from "./proposte-corsa";

function buildColumns(t: TFunction, aperta: string | null, apri: (id: string | null) => void): DataColumn<SeedAcquisitionRun>[] {
  const none = t("common:value.none");
  return [
    {
      // Was a `blueprintVariantId` column — a field the API never returned, so it
      // rendered the "none" dash on every row. Replaced with the run code, which
      // the contract does expose (C4 #42: local interfaces had drifted).
      header: t("seedRuns.columns.code"),
      // F-3 (L6): l'identificativo della corsa non è più una colonna a sé; resta nel suggerimento del codice.
      cell: (r) => <span className="font-mono text-xs text-muted-foreground" title={r.seedAcquisitionRunId}>{r.code}</span>,
    },
    {
      header: t("seedRuns.columns.startedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.startedAt.slice(0, 19)}</span>,
    },
    {
      header: t("seedRuns.columns.finishedAt"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.finishedAt?.slice(0, 19) ?? none}</span>,
    },
    // Repertorio interfacce, R3: lo stato chiude la riga.
    { header: t("seedRuns.columns.status"), cell: (r) => <EnumStatusBadge domain="seedRunStatus" value={r.status} /> },
    {
      header: t("proposteCorsa.colonna"),
      cell: (r) => (
        <button type="button" className="text-xs underline" data-testid="seed-run-proposals-toggle"
          onClick={() => apri(aperta === r.seedAcquisitionRunId ? null : r.seedAcquisitionRunId)}>
          {aperta === r.seedAcquisitionRunId ? t("proposteCorsa.chiudi") : t("proposteCorsa.apri")}
        </button>
      ),
    },
  ];
}

export default function SeedRunsPage() {
  const { t } = useTranslation("blueprints");
  // C4 (#42): server-side pagination (was `?limit=200`).
  const runs = usePaginatedList<SeedAcquisitionRun>({
    queryKey: ["seed-acquisition-runs", "list"],
    path: "/v1/seed-acquisition-runs",
  });

  const [aperta, setAperta] = useState<string | null>(null);
  const columns = useMemo(() => buildColumns(t, aperta, setAperta), [t, aperta]);
  const corsaAperta = aperta ? runs.rows.find((r) => r.seedAcquisitionRunId === aperta) : undefined;

  return (
    <div className="space-y-6">
    <DataTablePanel<SeedAcquisitionRun>
      pageTestId="seed-runs-page"
      titleTestId="seed-runs-title"
      countTestId="seed-runs-count"
      title={t("seedRuns.title")}
      description={t("seedRuns.description")}
      count={runs.query.data ? t("seedRuns.count", { count: runs.total }) : undefined}
      isLoading={runs.query.isLoading}
      isError={runs.query.isError}
      error={runs.query.error}
      errorMessage={t("seedRuns.error")}
      rows={runs.rows}
      server={runs.server}
      rowKey={(r) => r.seedAcquisitionRunId}
      rowTestId="seed-runs-row"
      columns={columns}
      emptyTestId="seed-runs-empty"
      emptyTitle={t("seedRuns.emptyTitle")}
      emptyDescription={t("seedRuns.emptyDescription")}
      caption={t("seedRuns.caption")}
    />
    {corsaAperta && <ProposteCorsa corsa={corsaAperta} />}
    </div>
  );
}
