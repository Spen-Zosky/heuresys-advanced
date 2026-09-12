"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  PageHeader, Card, CardContent, EmptyState, Spinner, KanbanBoard,
  type KanbanColumn,
} from "@heuresys/ui";
import type { ApplicationStage, CandidateApplication } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import {
  APPLICATION_STAGES, KEY, candidateName,
  useApplications, useCandidates, usePostings, useRequisitions,
} from "@/lib/recruiting";

/**
 * `#54` F4 — la pipeline di selezione: ogni candidatura e' una carta, ogni stadio una
 * colonna. Il componente Kanban di `@heuresys/ui` e' usato qui per la prima volta.
 *
 * ⚠ La colonna NON e' lo stato della carta: e' una VISTA dello stato che sta nel database.
 * Trascinare una carta manda un `PATCH /v1/candidate-applications/:id { stage }`, e la
 * tavola si ricostruisce dal re-fetch — mai da cio' che il browser crede di aver spostato.
 * Se il server rifiuta (una regola del ciclo, un permesso), la carta torna dov'era perche'
 * la verita' torna dall'API: la `key` della tavola cambia con i dati, cosi' il suo stato
 * interno si riallinea invece di restare sull'ultimo trascinamento.
 *
 * Il nome del candidato e il titolo dell'annuncio non stanno sulla candidatura: si leggono
 * dalle due liste (`/v1/candidates`, `/v1/job-postings`) e si uniscono qui per id. E' un
 * join di presentazione, non un dato nuovo.
 */
export default function RecruitingPipelinePage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const apps = useApplications();
  const candidates = useCandidates();
  const postings = usePostings();
  const requisitions = useRequisitions();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const move = useMutation({
    mutationFn: (v: { id: string; stage: ApplicationStage }) =>
      apiFetch<CandidateApplication>(`/v1/candidate-applications/${v.id}`, {
        method: "PATCH",
        body: { stage: v.stage },
      }),
    onSuccess: (a) => {
      setFeedback({ kind: "ok", msg: t("recruiting.pipeline.moved", { stage: t(`recruiting.stage.${a.stage}`) }) });
      void qc.invalidateQueries({ queryKey: KEY.applications });
    },
    onError: (e: unknown) => {
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.pipeline.moveError") });
      // la tavola torna alla verita' del server
      void qc.invalidateQueries({ queryKey: KEY.applications });
    },
  });

  const byCandidate = useMemo(
    () => new Map((candidates.data?.items ?? []).map((c) => [c.candidateId, c])),
    [candidates.data],
  );
  const byPosting = useMemo(
    () => new Map((postings.data?.items ?? []).map((p) => [p.postingId, p])),
    [postings.data],
  );

  const items = useMemo(() => apps.data?.items ?? [], [apps.data]);

  const columns: KanbanColumn[] = useMemo(
    () =>
      APPLICATION_STAGES.map((stage) => ({
        id: stage,
        title: t(`recruiting.stage.${stage}`),
        cards: items
          .filter((a) => a.stage === stage)
          .map((a) => {
            const c = byCandidate.get(a.candidateId);
            const p = byPosting.get(a.postingId);
            return {
              id: a.applicationId,
              title: c ? candidateName(c) : a.candidateId.slice(0, 8),
              description: p ? p.title : a.postingId.slice(0, 8),
              meta: (
                <Link
                  href={`/recruiting/applications/${a.applicationId}`}
                  data-testid="pipeline-card-link"
                  className="text-xs underline"
                >
                  {t("recruiting.pipeline.open")} · {a.appliedOn}
                </Link>
              ),
            };
          }),
      })),
    [items, byCandidate, byPosting, t],
  );

  // L'impronta dei dati: cambia quando cambia una candidatura o il suo stadio, e rimonta la
  // tavola. Senza, il Kanban terrebbe il suo stato interno e ignorerebbe il re-fetch.
  const impronta = items.map((a) => `${a.applicationId}:${a.stage}`).join("|");

  function onChange(next: KanbanColumn[]) {
    for (const col of next) {
      for (const card of col.cards) {
        const prima = items.find((a) => a.applicationId === card.id);
        if (prima && prima.stage !== col.id) {
          move.mutate({ id: card.id, stage: col.id as ApplicationStage });
          return; // un solo spostamento per gesto
        }
      }
    }
  }

  const loading = apps.isLoading || candidates.isLoading || postings.isLoading;
  const error = apps.isError || candidates.isError || postings.isError;
  const openRequisitions = (requisitions.data?.items ?? []).filter((r) => r.status === "OPEN" || r.status === "APPROVED").length;
  const publishedPostings = (postings.data?.items ?? []).filter((p) => p.status === "PUBLISHED").length;

  return (
    <main data-testid="recruiting-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("recruiting.title")} description={t("recruiting.description")} />

      <section className="grid gap-4 sm:grid-cols-3" data-testid="recruiting-summary">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t("recruiting.summary.requisitions")}</p>
            <p className="text-2xl font-semibold" data-testid="summary-requisitions">{openRequisitions}</p>
            <Link href="/recruiting/requisitions" className="text-xs underline">{t("recruiting.summary.manage")}</Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t("recruiting.summary.postings")}</p>
            <p className="text-2xl font-semibold" data-testid="summary-postings">{publishedPostings}</p>
            <Link href="/recruiting/postings" className="text-xs underline">{t("recruiting.summary.manage")}</Link>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">{t("recruiting.summary.applications")}</p>
            <p className="text-2xl font-semibold" data-testid="summary-applications">{apps.data?.total ?? 0}</p>
            <Link href="/recruiting/candidates" className="text-xs underline">{t("recruiting.summary.candidates")}</Link>
          </CardContent>
        </Card>
      </section>

      {feedback && (
        <p
          data-testid="pipeline-feedback"
          className={`text-sm ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}
          role="status"
        >
          {feedback.msg}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12" data-testid="recruiting-loading"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-danger" data-testid="recruiting-error">{t("recruiting.error")}</p>
      ) : items.length === 0 ? (
        <EmptyState
          data-testid="pipeline-empty"
          title={t("recruiting.pipeline.emptyTitle")}
          description={t("recruiting.pipeline.emptyDesc")}
        />
      ) : (
        <div data-testid="pipeline-board" className="overflow-x-auto">
          <KanbanBoard key={impronta} columns={columns} onChange={onChange} />
        </div>
      )}
    </main>
  );
}
