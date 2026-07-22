"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import { TimeOffRequestStatusEnum } from "@heuresys/shared";
import type {
  TimeOffRequest, LeaveAccrualRule, LeaveBalanceTransaction,
} from "@heuresys/shared";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { StatusPill } from "@/components/status-pill";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { EnumStatusPill } from "@/components/enum-badge";

/**
 * A/L8 (#33) — Time-off & leave admin page. Live over /v1/time-off/*:
 * leave requests (PERSONAL, org-gated), tenant accrual rules (policy), and the
 * per-balance transaction ledger (org-gated). READ-only consultation — ESS
 * submission stays out (Series E-E3). Sidebar row gated on leave:read.
 */
function toneForRequestStatus(s: string): "success" | "warning" | "danger" | "neutral" {
  const u = s.toUpperCase();
  if (u === "APPROVED") return "success";
  if (u === "PENDING") return "warning";
  if (u === "REJECTED" || u === "CANCELLED") return "danger";
  return "neutral";
}

function buildRequestColumns(t: TFunction): DataColumn<TimeOffRequest>[] {
  return [
    { header: t("timeOff.cols.employee"), cell: (r) => <span>{r.subjectUserName ?? "—"}</span> },
    { header: t("timeOff.cols.leaveType"), cell: (r) => <span className="font-mono text-xs">{r.leaveType}</span> },
    { header: t("timeOff.cols.period"), cell: (r) => <span className="tabular-nums text-xs">{r.startDate} → {r.endDate}</span> },
    { header: t("timeOff.cols.days"), align: "right", cell: (r) => <span className="tabular-nums">{r.daysRequested}</span> },
    { header: t("timeOff.cols.status"), cell: (r) => <EnumStatusPill domain="timeOffStatus" value={r.status} tone={toneForRequestStatus(r.status)} /> },
  ];
}

function buildRuleColumns(t: TFunction): DataColumn<LeaveAccrualRule>[] {
  return [
    { header: t("timeOff.cols.leaveType"), cell: (r) => <span className="font-mono text-xs">{r.leaveType}</span> },
    { header: t("timeOff.cols.ruleName"), cell: (r) => <span>{r.name}</span> },
    { header: t("timeOff.cols.method"), cell: (r) => <span className="text-xs text-muted-foreground">{r.method}</span> },
    { header: t("timeOff.cols.amount"), align: "right", cell: (r) => <span className="tabular-nums">{r.amount}</span> },
    { header: t("timeOff.cols.ccnl"), cell: (r) => <span className="text-xs">{r.ccnlType ?? "—"}</span> },
    { header: t("timeOff.cols.active"), cell: (r) => <StatusPill tone={r.isActive ? "success" : "neutral"}>{r.isActive ? t("timeOff.active") : t("timeOff.inactive")}</StatusPill> },
  ];
}

function buildTxnColumns(t: TFunction, enumLabel: EnumLabelFn): DataColumn<LeaveBalanceTransaction>[] {
  return [
    { header: t("timeOff.cols.txnType"), cell: (r) => <span className="font-mono text-xs">{enumLabel("timeOffTxnType", r.type)}</span> },
    { header: t("timeOff.cols.days"), align: "right", cell: (r) => <span className="tabular-nums">{r.daysAmount}</span> },
    { header: t("timeOff.cols.description"), cell: (r) => <span className="text-xs text-muted-foreground">{r.description ?? "—"}</span> },
    { header: t("timeOff.cols.reference"), cell: (r) => <span className="text-xs">{r.referenceType ?? "—"}</span> },
    { header: t("timeOff.cols.date"), cell: (r) => <span className="tabular-nums text-xs">{r.createdAt.slice(0, 10)}</span> },
  ];
}

const REQUEST_STATUSES = TimeOffRequestStatusEnum.options;

export default function TimeOffPage() {
  const { t } = useTranslation("admin");
  const enumLabel = useEnumLabel();
  const [status, setStatus] = useState<string>("");

  const requests = usePaginatedList<TimeOffRequest>({
    queryKey: ["time-off", "requests"],
    path: "/v1/time-off/requests",
    params: { status: status || undefined },
  });
  const rules = usePaginatedList<LeaveAccrualRule>({
    queryKey: ["time-off", "accrual-rules"],
    path: "/v1/time-off/accrual-rules",
  });
  const txns = usePaginatedList<LeaveBalanceTransaction>({
    queryKey: ["time-off", "balance-transactions"],
    path: "/v1/time-off/balance-transactions",
  });

  const requestColumns = useMemo(() => buildRequestColumns(t), [t]);
  const ruleColumns = useMemo(() => buildRuleColumns(t), [t]);
  const txnColumns = useMemo(() => buildTxnColumns(t, enumLabel), [t, enumLabel]);

  const kpis: KpiCardData[] = useMemo(() => [
    { label: t("timeOff.kpi.requests"), value: requests.total.toLocaleString() },
    { label: t("timeOff.kpi.rules"), value: rules.total.toLocaleString() },
    { label: t("timeOff.kpi.transactions"), value: txns.total.toLocaleString() },
  ], [requests.total, rules.total, txns.total, t]);

  return (
    <main data-testid="time-off-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader data-testid="time-off-title" title={t("timeOff.title")} description={t("timeOff.description")} />

      <KPIStrip items={kpis} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t("timeOff.requests")}</h2>
          <select
            data-testid="time-off-status-filter"
            aria-label={t("timeOff.cols.status")}
            className="rounded-control border border-border bg-card px-2 py-1 text-sm text-muted-foreground"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("timeOff.allStatuses")}</option>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <EntityTable<TimeOffRequest>
          isLoading={requests.query.isLoading}
          isError={requests.query.isError}
          errorMessage={t("timeOff.error")}
          rows={requests.rows}
          server={requests.server}
          rowKey={(r) => r.requestId}
          rowTestId="time-off-request-row"
          columns={requestColumns}
          emptyTitle={t("timeOff.empty")}
          caption={t("timeOff.requests")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("timeOff.accrualRules")}</h2>
        <EntityTable<LeaveAccrualRule>
          isLoading={rules.query.isLoading}
          isError={rules.query.isError}
          errorMessage={t("timeOff.error")}
          rows={rules.rows}
          server={rules.server}
          rowKey={(r) => r.accrualRuleId}
          rowTestId="time-off-rule-row"
          columns={ruleColumns}
          emptyTitle={t("timeOff.empty")}
          caption={t("timeOff.accrualRules")}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("timeOff.transactions")}</h2>
        <EntityTable<LeaveBalanceTransaction>
          isLoading={txns.query.isLoading}
          isError={txns.query.isError}
          errorMessage={t("timeOff.error")}
          rows={txns.rows}
          server={txns.server}
          rowKey={(r) => r.transactionId}
          rowTestId="time-off-txn-row"
          columns={txnColumns}
          emptyTitle={t("timeOff.empty")}
          caption={t("timeOff.transactions")}
        />
      </section>
    </main>
  );
}
