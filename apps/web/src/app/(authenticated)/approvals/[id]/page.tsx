"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AgentPanel, Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import type { ApprovalRequestDetail, ApprovalStatus, ApprovalStepStatus, ApprovalStepDetail } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUser } from "@/lib/api/auth";
import { AGENT_DEV_ENABLED, useAgentStream } from "@/lib/use-agent-stream";

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

/**
 * #159 F3 (S1116) — prima pagina parametrica ad adottare il ponte dopo la console.
 *
 * Monta `AgentPanel` (`@heuresys/ui`) con `useAgentStream`, LO STESSO canale/componente
 * della console `/dev/agent`: questa pagina non li tocca, li usa. Il `context` e' un
 * valore VERO — titolo + id della richiesta di approvazione realmente aperta, presi dal
 * segmento dinamico `[id]` — mai un ramo condizionale per tipo di pagina. Le parole
 * vivono nel namespace proprio di questa pagina (`approvals.detail.agent.*`), cosi'
 * nessuna pagina eredita le stringhe della prima (`agentDev.*`). Dietro lo stesso flag
 * `NEXT_PUBLIC_ENABLE_AGENT_DEV` della console: l'agente resta uno strumento di sviluppo,
 * non una funzione servita ai clienti.
 */

export default function ApprovalDetailPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useCurrentUser();
  const [comment, setComment] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // #159 F3 — il prompt dell'assistente e' della VISTA; canale, stato e traduzione dei
  // suoi avvisi restano lo stesso pattern del primo consumatore (`dev/agent`).
  const [agentPrompt, setAgentPrompt] = useState("");
  const agent = useAgentStream();

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

  // #159 F3 — stessa traduzione del `notice` non tradotto dell'hook (`code` senza
  // namespace), qui prefissato con `approvals.detail.agent.*` invece di `agentDev.*`.
  const agentNoticeText =
    agent.notice === null ? null : t(`approvals.detail.agent.${agent.notice.code}`, agent.notice.params ?? {});

  // Stessa logica a tre esiti del primo consumatore (#252): la descrizione la compone
  // la pagina, mai il pannello, e "non l'ho misurato" resta una frase diversa da "0 persone".
  const agentApprovalDesc =
    agent.approval?.classe === "read"
      ? agent.approval.personeDistinte === undefined
        ? t("approvals.detail.agent.approvalDescReadUnknown")
        : t("approvals.detail.agent.approvalDescRead", { persone: agent.approval.personeDistinte })
      : t("approvals.detail.agent.approvalDesc");

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

          {/* #159 F3 — l'assistente su QUESTA richiesta, dietro lo stesso flag della console. */}
          {AGENT_DEV_ENABLED && (
            <AgentPanel
              testIdPrefix="approval-agent"
              context={t("approvals.detail.agent.context", { title: d.title, id })}
              labels={{
                title: t("approvals.detail.agent.title"),
                description: t("approvals.detail.agent.description"),
                contextLabel: t("approvals.detail.agent.contextLabel"),
                promptLabel: t("approvals.detail.agent.promptLabel"),
                promptPlaceholder: t("approvals.detail.agent.promptPlaceholder"),
                run: t("approvals.detail.agent.run"),
                running: t("approvals.detail.agent.running"),
                stop: t("approvals.detail.agent.stop"),
                streamTitle: t("approvals.detail.agent.streamTitle"),
                streamEmpty: t("approvals.detail.agent.streamEmpty"),
                approvalTitle: t("approvals.detail.agent.approvalTitle"),
                approvalDesc: agentApprovalDesc,
                approvalTool: t("approvals.detail.agent.approvalTool"),
                approvalInput: t("approvals.detail.agent.approvalInput"),
                allow: t("approvals.detail.agent.allow"),
                deny: t("approvals.detail.agent.deny"),
              }}
              prompt={agentPrompt}
              onPromptChange={setAgentPrompt}
              running={agent.running}
              onRun={() => void agent.run(agentPrompt)}
              onStop={agent.stop}
              lines={agent.lines}
              approval={agent.approval}
              onApproval={(decision) => void agent.resolveApproval(decision)}
              notice={agent.notice === null || agentNoticeText === null ? null : { kind: agent.notice.kind, text: agentNoticeText }}
            />
          )}
        </>
      )}
    </main>
  );
}
