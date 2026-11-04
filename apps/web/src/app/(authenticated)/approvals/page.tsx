"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type {
  ApprovalListResponse,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
  ApprovalDecisionPolicy,
  ApprovalPriority,
  ApprovalProcessFacet,
  User,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCan } from "@/lib/api/auth";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { PersonPicker } from "@/components/person-picker";
import { useFormat } from "@/lib/format";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Value lists duplicated as plain literals (apps/web can only import TYPES from
// @heuresys/shared). Keep in sync with packages/shared/src/schemas/approvals.ts.
const STATUSES: readonly ApprovalStatus[] = ["PENDING", "APPROVED", "REJECTED", "APPLIED"];
const POLICIES: readonly ApprovalDecisionPolicy[] = ["ALL_OF", "ANY_OF"];
const PRIORITIES: readonly ApprovalPriority[] = ["INFO", "MEDIUM", "HIGH", "CRITICAL"];

function statusVariant(s: ApprovalStatus): "success" | "secondary" | "destructive" {
  if (s === "APPROVED" || s === "APPLIED") return "success";
  if (s === "REJECTED") return "destructive";
  return "secondary";
}

export default function ApprovalsPage() {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [processFilter, setProcessFilter] = useState("");
  const [stepFilter, setStepFilter] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [policy, setPolicy] = useState<ApprovalDecisionPolicy>("ALL_OF");
  const [priority, setPriority] = useState<ApprovalPriority>("MEDIUM");
  const [approvers, setApprovers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // V-1 (D-27): la lista si sfoglia sul server e il totale e' quello vero, non la pagina.
  // Prima si chiedevano 200 righe e la pagina diceva «200 richieste» anche quando erano 741.
  const list = usePaginatedList<ApprovalRequestListItem>({
    queryKey: ["approvals", "list"],
    path: "/v1/approvals",
    params: { status: statusFilter, processId: processFilter, processStepId: stepFilter },
  });
  const requests = list.query;
  const processes: ApprovalProcessFacet[] = (requests.data as ApprovalListResponse | undefined)?.processes ?? [];
  const stepsOfProcess = processes.find((p) => p.processId === processFilter)?.steps ?? [];

  // S-5, S-19: il modulo di creazione serve solo a chi puo' creare una richiesta.
  // V-2: le persone si cercano sul server (PersonPicker), non si caricano le prime 200.
  const canCreate = useCan("approval:create");
  const canReadUsers = useCan("user:read");

  const createReq = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = { title, decisionPolicy: policy, priority, approverUserIds: approvers.map((u) => u.userId) };
      if (body) payload.body = body;
      return apiFetch<ApprovalRequest>("/v1/approvals", { method: "POST", body: payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals", "list"] });
      setFeedback({ kind: "ok", msg: t("approvals.create.successMsg") });
      setTitle("");
      setBody("");
      setApprovers([]);
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("approvals.create.errorUnexpected") }),
  });

  const canSubmit = title.trim().length > 0 && approvers.length > 0 && !createReq.isPending;

  const columns: DataColumn<ApprovalRequestListItem>[] = useMemo(
    () => [
      {
        header: t("approvals.columns.title"),
        cell: (r) => (
          <Link href={`/approvals/${r.approvalRequestId}`} data-testid="approval-row-link" className="font-medium text-foreground hover:underline">
            {r.title}
          </Link>
        ),
      },
      {
        // V-3 (ADR-0049): processo e attivita' della richiesta.
        header: t("approvals.columns.process"),
        cell: (r) =>
          r.processName ? (
            <span data-testid="approval-row-process">
              <span className="text-foreground">{r.processName}</span>
              {r.processStepName && <span className="block text-xs text-muted-foreground">{r.processStepName}</span>}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("approvals.noProcess")}</span>
          ),
      },
      {
        header: t("approvals.columns.status"),
        cell: (r) => (
          <span className="flex flex-col items-start gap-1">
            <Badge variant={statusVariant(r.status)}>{t(`approvals.status.${r.status}`)}</Badge>
            {/* V-3 (ADR-0051): se un passo l'ha deciso un delegato, la riga lo dice. */}
            {r.delegatedStepCount > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="approval-row-delegated">
                {t("approvals.delegated", { count: r.delegatedStepCount })}
              </span>
            )}
          </span>
        ),
      },
      { header: t("approvals.columns.policy"), cell: (r) => <span className="text-muted-foreground">{t(`approvals.policy.${r.decisionPolicy}`)}</span> },
      { header: t("approvals.columns.priority"), cell: (r) => <span className="text-muted-foreground">{t(`approvals.priority.${r.priority}`)}</span> },
      {
        header: t("approvals.columns.steps"),
        cell: (r) => <span className="text-muted-foreground">{t("approvals.stepSummary", { pending: r.pendingStepCount, total: r.stepCount })}</span>,
      },
      {
        header: t("approvals.columns.created"),
        cell: (r) => (
          <time dateTime={r.createdAt} className="text-xs text-muted-foreground">
            {fmt.data(r.createdAt)}
          </time>
        ),
      },
    ],
    [t, fmt],
  );

  return (
    <main data-testid="approvals-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="approvals-title"
        title={t("approvals.title")}
        description={t("approvals.description")}
        badges={
          <Badge variant="secondary" data-testid="approvals-count">
            {requests.data ? t("approvals.count", { count: list.total }) : t("common:loading")}
          </Badge>
        }
      />

      {/* Create approval request */}
      {canCreate && (
      <Card>
        <CardHeader>
          <CardTitle>{t("approvals.create.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            data-testid="approval-create-form"
            onSubmit={(e) => {
              e.preventDefault();
              setFeedback(null);
              if (canSubmit) createReq.mutate();
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            noValidate
          >
            <div>
              <label htmlFor="approval-title" className="mb-1 block text-sm font-medium text-foreground">
                {t("approvals.create.titleLabel")} <span aria-hidden="true">*</span>
              </label>
              <Input id="approval-title" data-testid="approval-create-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
            </div>
            <div>
              <label htmlFor="approval-policy" className="mb-1 block text-sm font-medium text-foreground">
                {t("approvals.create.policyLabel")}
              </label>
              <select id="approval-policy" data-testid="approval-create-policy" className={SELECT_CLASS} value={policy} onChange={(e) => setPolicy(e.target.value as ApprovalDecisionPolicy)}>
                {POLICIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`approvals.policy.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="approval-priority" className="mb-1 block text-sm font-medium text-foreground">
                {t("approvals.create.priorityLabel")}
              </label>
              <select id="approval-priority" data-testid="approval-create-priority" className={SELECT_CLASS} value={priority} onChange={(e) => setPriority(e.target.value as ApprovalPriority)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`approvals.priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <PersonPicker
                label={t("approvals.create.approversLabel")}
                value={approvers}
                onChange={setApprovers}
                hint={t("approvals.create.approversHint")}
                testId="approval-create-approvers"
                enabled={canReadUsers}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="approval-body" className="mb-1 block text-sm font-medium text-foreground">
                {t("approvals.create.bodyLabel")}
              </label>
              <textarea id="approval-body" data-testid="approval-create-body" rows={3} className={SELECT_CLASS} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" data-testid="approval-create-submit" disabled={!canSubmit}>
                {createReq.isPending ? t("approvals.create.submitting") : t("approvals.create.submit")}
              </Button>
              {feedback && (
                <p
                  data-testid={feedback.kind === "ok" ? "approval-create-success" : "approval-create-error"}
                  className={feedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
                  role={feedback.kind === "err" ? "alert" : undefined}
                >
                  {feedback.msg}
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {/* Filter */}
      <div data-testid="approvals-filters" className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <label htmlFor="approvals-filter-status" className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("approvals.columns.status")}
          </label>
          <select id="approvals-filter-status" data-testid="approvals-filter-status" className={SELECT_CLASS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("approvals.filters.statusAll")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`approvals.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        {processes.length > 0 && (
          <div className="w-64">
            <label htmlFor="approvals-filter-process" className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("approvals.filters.process")}
            </label>
            <select
              id="approvals-filter-process"
              data-testid="approvals-filter-process"
              className={SELECT_CLASS}
              value={processFilter}
              onChange={(e) => {
                setProcessFilter(e.target.value);
                setStepFilter("");
              }}
            >
              <option value="">{t("approvals.filters.processAll")}</option>
              {processes.map((p) => (
                <option key={p.processId} value={p.processId}>
                  {p.processName} ({p.count})
                </option>
              ))}
            </select>
          </div>
        )}
        {stepsOfProcess.length > 0 && (
          <div className="w-64">
            <label htmlFor="approvals-filter-step" className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("approvals.filters.step")}
            </label>
            <select id="approvals-filter-step" data-testid="approvals-filter-step" className={SELECT_CLASS} value={stepFilter} onChange={(e) => setStepFilter(e.target.value)}>
              <option value="">{t("approvals.filters.stepAll")}</option>
              {stepsOfProcess.map((st) => (
                <option key={st.processStepId} value={st.processStepId}>
                  {st.processStepName} ({st.count})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Requests table */}
      <div data-testid="approvals-table">
        <EntityTable<ApprovalRequestListItem>
          isLoading={requests.isLoading}
          isError={requests.isError}
          error={requests.error}
          errorMessage={t("approvals.errorMessage")}
          rows={list.rows}
          server={list.server}
          rowKey={(r) => r.approvalRequestId}
          rowTestId="approval-row"
          columns={columns}
          emptyTestId="approvals-empty"
          emptyTitle={t("approvals.emptyTitle")}
          emptyDescription={t("approvals.emptyDescription")}
          caption={t("approvals.caption")}
        />
      </div>
    </main>
  );
}
