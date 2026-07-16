"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { KPIStrip, PageHeader, Badge, type KpiCardData } from "@heuresys/ui";
import type {
  ProvenanceRecord, ProvenanceSummaryResponse, ProvenanceValidationStatusEnum,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { StatusPill } from "@/components/status-pill";

/**
 * #28 (S1018) — Trust Ledger page: the ingestion provenance of every imported
 * record (source, mapping confidence, AI-assist + human-approval marks,
 * validation status). Live over /v1/provenance/* — the AI-Act / GDPR art.22
 * audit surface. PLATFORM/TENANT_ADMIN only (sidebar row gated on provenance:read).
 */
type ValidationStatus = (typeof ProvenanceValidationStatusEnum)["options"][number];

function toneForStatus(s: ValidationStatus): "success" | "warning" | "danger" | "neutral" {
  if (s === "VALID") return "success";
  if (s === "STALE") return "warning";
  if (s === "CONFLICTED" || s === "REJECTED") return "danger";
  return "neutral";
}

function pct(n: number, d: number): string {
  return d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`;
}

function buildRecordColumns(t: TFunction): DataColumn<ProvenanceRecord>[] {
  return [
    { header: t("provenance.cols.targetTable"), cell: (r) => <span className="font-mono text-xs">{r.targetTableName}</span> },
    { header: t("provenance.cols.sourceTable"), cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.sourceTable}</span> },
    { header: t("provenance.cols.confidence"), align: "right", cell: (r) => <span className="tabular-nums">{(r.mappingConfidence * 100).toFixed(1)}%</span> },
    { header: t("provenance.cols.status"), cell: (r) => <StatusPill tone={toneForStatus(r.validationStatus)}>{r.validationStatus}</StatusPill> },
    {
      header: t("provenance.cols.provenance"),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.sdbiAiModelId ? <Badge variant="secondary">{t("provenance.aiAssisted")}</Badge> : null}
          {r.sdbiHumanApprover ? <Badge variant="secondary">{t("provenance.humanApproved")}</Badge> : null}
        </span>
      ),
    },
  ];
}

const STATUSES: ValidationStatus[] = ["VALID", "STALE", "CONFLICTED", "REJECTED"];

export default function ProvenancePage() {
  const { t } = useTranslation("admin");
  const [status, setStatus] = useState<ValidationStatus | "">("");

  const summary = useQuery({
    queryKey: ["provenance", "summary"],
    queryFn: () => apiFetch<ProvenanceSummaryResponse>("/v1/provenance/summary"),
  });

  const records = usePaginatedList<ProvenanceRecord>({
    queryKey: ["provenance", "records"],
    path: "/v1/provenance",
    params: { validationStatus: status || undefined },
  });

  const columns = useMemo(() => buildRecordColumns(t), [t]);

  const kpis: KpiCardData[] = useMemo(() => {
    const s = summary.data?.totals;
    if (!s) return [];
    return [
      { label: t("provenance.kpi.records"), value: s.records.toLocaleString() },
      { label: t("provenance.kpi.avgConfidence"), value: s.avgConfidence != null ? `${(s.avgConfidence * 100).toFixed(1)}%` : "—" },
      { label: t("provenance.kpi.humanApproved"), value: pct(s.humanApproved, s.records), iconTone: "success" },
      { label: t("provenance.kpi.aiAssisted"), value: pct(s.aiAssisted, s.records), iconTone: "info" },
      { label: t("provenance.kpi.conflicted"), value: s.conflicted.toLocaleString(), iconTone: s.conflicted > 0 ? "warning" : "success" },
    ];
  }, [summary.data, t]);

  const summaryColumns: DataColumn<ProvenanceSummaryResponse["byTable"][number]>[] = useMemo(() => [
    { header: t("provenance.cols.targetTable"), cell: (r) => <span className="font-mono text-xs">{r.targetTable}</span> },
    { header: t("provenance.cols.total"), align: "right", cell: (r) => <span className="tabular-nums">{r.total.toLocaleString()}</span> },
    { header: t("provenance.cols.avgConfidence"), align: "right", cell: (r) => <span className="tabular-nums">{r.avgConfidence != null ? `${(r.avgConfidence * 100).toFixed(1)}%` : "—"}</span> },
    { header: "VALID", align: "right", cell: (r) => <span className="tabular-nums">{r.valid.toLocaleString()}</span> },
    { header: t("provenance.cols.conflicted"), align: "right", cell: (r) => <span className="tabular-nums">{(r.conflicted + r.rejected).toLocaleString()}</span> },
  ], [t]);

  return (
    <main data-testid="provenance-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader data-testid="provenance-title" title={t("provenance.title")} description={t("provenance.description")} />

      {kpis.length > 0 ? <KPIStrip items={kpis} /> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("provenance.byTable")}</h2>
        <EntityTable<ProvenanceSummaryResponse["byTable"][number]>
          isLoading={summary.isLoading}
          isError={summary.isError}
          errorMessage={t("provenance.error")}
          rows={summary.data?.byTable ?? []}
          rowKey={(r) => r.targetTable}
          columns={summaryColumns}
          emptyTitle={t("provenance.empty")}
          caption={t("provenance.byTable")}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t("provenance.records")}</h2>
          <select
            data-testid="provenance-status-filter"
            aria-label={t("provenance.cols.status")}
            className="rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground"
            value={status}
            onChange={(e) => setStatus(e.target.value as ValidationStatus | "")}
          >
            <option value="">{t("provenance.allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <EntityTable<ProvenanceRecord>
          isLoading={records.query.isLoading}
          isError={records.query.isError}
          errorMessage={t("provenance.error")}
          rows={records.rows}
          server={records.server}
          rowKey={(r) => r.lineageId}
          rowTestId="provenance-record-row"
          columns={columns}
          emptyTitle={t("provenance.empty")}
          caption={t("provenance.records")}
        />
      </section>
    </main>
  );
}
