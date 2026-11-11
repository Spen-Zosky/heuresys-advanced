"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Card, CardContent, KanbanBoard, type KanbanColumn } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import type { ApplicationStage, CandidateApplication } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCan } from "@/lib/api/auth";
import {
  APPLICATION_STAGES, KEY, candidateName,
  useApplications, useCandidates, usePostings, useRequisitions,
} from "@/lib/recruiting";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";

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
  const fmt = useFormat();
  const qc = useQueryClient();
  const apps = useApplications();
  const candidates = useCandidates();
  const postings = usePostings();
  const requisitions = useRequisitions();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  // S-5: spostare una candidatura è una PATCH con `candidate:write`. Chi non ce l'ha vede la
  // tavola in sola lettura: un trascinamento viene annullato subito, con il motivo.
  const canWrite = useCan("candidate:write");
  const [annullati, setAnnullati] = useState(0);

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
              title: c ? candidateName(c) : t("common:unnamed"),
              description: p ? p.title : t("common:unnamed"),
              meta: (
                <Link
                  href={`/recruiting/applications/${a.applicationId}`}
                  data-testid="pipeline-card-link"
                  className="text-xs underline"
                >
                  {t("recruiting.pipeline.open")} · {fmt.data(a.appliedOn)}
                </Link>
              ),
            };
          }),
      })),
    [items, byCandidate, byPosting, t, fmt],
  );

  // L'impronta dei dati: cambia quando cambia una candidatura o il suo stadio, e rimonta la
  // tavola. Senza, il Kanban terrebbe il suo stato interno e ignorerebbe il re-fetch.
  const impronta = items.map((a) => `${a.applicationId}:${a.stage}`).join("|");

  function onChange(next: KanbanColumn[]) {
    if (!canWrite) {
      setFeedback({ kind: "err", msg: t("recruiting.pipeline.readOnly") });
      setAnnullati((n) => n + 1);
      return;
    }
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
    <main data-testid="recruiting-page" className="mx-auto max-w-7xl space-y-8 px-6 pb-8">
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
        <StatoCaricamento testId="recruiting-loading" />
      ) : error ? (
        <StatoErrore
          errore={apps.error ?? candidates.error ?? postings.error}
          titolo={t("recruiting.error")}
          testId="recruiting-error"
          onRiprova={() => {
            if (apps.isError) void apps.refetch();
            if (candidates.isError) void candidates.refetch();
            if (postings.isError) void postings.refetch();
          }}
        />
      ) : items.length === 0 ? (
        <StatoVuoto
          testId="pipeline-empty"
          titolo={t("recruiting.pipeline.emptyTitle")}
          motivo={t("recruiting.pipeline.emptyDesc")}
        />
      ) : (
        /* C5: la tavola scorre dentro il suo riquadro, la pagina resta corta */
        <div data-testid="pipeline-board" className="max-h-[calc(100vh-16rem)] overflow-auto">
          <KanbanBoard key={`${impronta}#${annullati}`} columns={columns} onChange={onChange} />
        </div>
      )}
    </main>
  );
}
