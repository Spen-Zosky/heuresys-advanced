"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { ApprovalRequestDetail, ApprovalStatus, ApprovalStepStatus, ApprovalStepDetail } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUser } from "@/lib/api/auth";

function reqStatusVariant(s: ApprovalStatus): "success" | "secondary" | "destructive" {
  if (s === "APPROVED" || s === "APPLIED") return "success";
  if (s === "REJECTED") return "destructive";
  return "secondary";
}
function stepStatusVariant(s: ApprovalStepStatus): "success" | "secondary" | "destructive" {
  if (s === "APPROVED") return "success";
  if (s === "REJECTED") return "destructive";
  return "secondary";
}

export default function ApprovalDetailPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useCurrentUser();
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const detail = useQuery({
    queryKey: ["approvals", "detail", id],
    queryFn: () => apiFetch<ApprovalRequestDetail>(`/v1/approvals/${id}`),
    enabled: Boolean(id),
  });

  const decide = useMutation({
    mutationFn: (v: { stepId: string; decision: "APPROVE" | "REJECT" }) => {
      const payload: Record<string, unknown> = { decision: v.decision };
      if (comment.trim()) payload.comment = comment.trim();
      return apiFetch(`/v1/approvals/${id}/steps/${v.stepId}/decide`, { method: "POST", body: payload });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals", "detail", id] });
      void qc.invalidateQueries({ queryKey: ["approvals", "list"] });
      void qc.invalidateQueries({ queryKey: ["me", "inbox"] });
      setComment("");
      setFeedback({ kind: "ok", msg: t("approvals.detail.decideSuccess") });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("approvals.create.errorUnexpected") }),
  });

  const apply = useMutation({
    mutationFn: () => apiFetch<unknown>(`/v1/approvals/${id}/apply`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["approvals", "detail", id] });
      void qc.invalidateQueries({ queryKey: ["approvals", "list"] });
      setFeedback({ kind: "ok", msg: t("approvals.detail.applySuccess") });
    },
    onError: (err) => setFeedback({ kind: "err", msg: err instanceof Error ? err.message : t("approvals.create.errorUnexpected") }),
  });

  const d = detail.data;
  const myUserId = me.data?.userId;
  const myPendingStep: ApprovalStepDetail | undefined = d?.steps.find((s) => s.approverUserId === myUserId && s.status === "PENDING");
  const busy = decide.isPending || apply.isPending;

  return (
    <main data-testid="approval-detail-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="text-sm">
        <Link href="/approvals" className="text-muted-foreground hover:underline" data-testid="approval-detail-back">
          ← {t("approvals.detail.back")}
        </Link>
      </div>

      {detail.isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="approval-detail-loading">{t("common:loading")}</p>
      ) : detail.isError || !d ? (
        <p className="text-sm text-danger" data-testid="approval-detail-error">{t("approvals.detail.notFound")}</p>
      ) : (
        <>
          <PageHeader
            data-testid="approval-detail-title"
            title={d.title}
            description={d.body ?? undefined}
            badges={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={reqStatusVariant(d.status)} data-testid="approval-detail-status">{t(`approvals.status.${d.status}`)}</Badge>
                <Badge variant="secondary">{t(`approvals.policy.${d.decisionPolicy}`)}</Badge>
                <Badge variant="secondary">{t(`approvals.priority.${d.priority}`)}</Badge>
              </div>
            }
          />

          {/* My pending action (approver of an open step) */}
          {myPendingStep && (
            <Card data-testid="approval-my-action">
              <CardHeader>
                <CardTitle>{t("approvals.detail.yourDecisionTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label htmlFor="approval-comment" className="mb-1 block text-sm font-medium text-foreground">
                    {t("approvals.detail.commentLabel")}
                  </label>
                  <textarea
                    id="approval-comment"
                    data-testid="approval-decide-comment"
                    rows={2}
                    className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="button" data-testid="approval-decide-approve" disabled={busy} onClick={() => decide.mutate({ stepId: myPendingStep.approvalStepId, decision: "APPROVE" })}>
                    {t("approvals.detail.approve")}
                  </Button>
                  <Button type="button" variant="outline" data-testid="approval-decide-reject" disabled={busy} onClick={() => decide.mutate({ stepId: myPendingStep.approvalStepId, decision: "REJECT" })}>
                    {t("approvals.detail.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Apply (terminal effect) — visible when APPROVED */}
          {d.status === "APPROVED" && (
            <Card data-testid="approval-apply-card">
              <CardHeader>
                <CardTitle>{t("approvals.detail.applyTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button type="button" data-testid="approval-apply" disabled={busy} onClick={() => apply.mutate()}>
                  {t("approvals.detail.apply")}
                </Button>
              </CardContent>
            </Card>
          )}

          {feedback && (
            <p
              data-testid={feedback.kind === "ok" ? "approval-detail-success" : "approval-detail-error"}
              className={feedback.kind === "ok" ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"}
              role={feedback.kind === "err" ? "alert" : undefined}
            >
              {feedback.msg}
            </p>
          )}

          {/* Step ledger */}
          <Card data-testid="approval-step-ledger">
            <CardHeader>
              <CardTitle>{t("approvals.detail.ledgerTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border rounded-card border border-border">
                {d.steps.map((s) => (
                  <li key={s.approvalStepId} data-testid="approval-step-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-medium text-foreground">{s.approverName ?? s.approverEmail ?? s.approverUserId}</span>
                    <div className="flex items-center gap-3">
                      {s.decisionComment && <span className="text-xs text-muted-foreground">“{s.decisionComment}”</span>}
                      {s.decidedAt && <span className="text-xs text-muted-foreground">{s.decidedAt.slice(0, 10)}</span>}
                      <Badge variant={stepStatusVariant(s.status)} data-testid="approval-step-status">{t(`approvals.stepStatus.${s.status}`)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
