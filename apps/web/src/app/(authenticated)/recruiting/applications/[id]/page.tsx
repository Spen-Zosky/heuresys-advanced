"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Spinner,
} from "@heuresys/ui";
import type {
  ApplicationStage, CandidateApplication, Interview, InterviewFeedback,
  InterviewFeedbackListResponse, InterviewListResponse, InterviewStatus,
  JobOffer, JobOfferListResponse, JobOfferStatus, UserListResponse,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import {
  APPLICATION_STAGES, FEEDBACK_RECOMMENDATIONS, INTERVIEW_KINDS, INTERVIEW_STATUSES,
  KEY, OFFER_STATUSES, candidateName, useCandidates, usePostings,
} from "@/lib/recruiting";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Feedback = { kind: "ok" | "err"; msg: string } | null;

/**
 * `#54` F4 — la candidatura per intero: lo stadio, i colloqui con le loro valutazioni, e
 * l'offerta. E' la pagina in cui il ciclo si decide, e ogni decisione e' un PATCH/POST
 * verso l'API con la verita' che torna dal re-fetch.
 *
 * ⚠ Due regole del server si vedono da qui, e la pagina non le anticipa: una candidatura va
 * a `REJECTED` solo con un motivo (409 altrimenti), e una valutazione si registra solo su un
 * colloquio che si e' svolto. L'importo dell'offerta puo' ARRIVARE MASCHERATO (`masked`,
 * ADR-0036): a chi ha il solo mandato tecnico la riga si mostra, l'importo no — e si dice.
 */
export default function ApplicationDetailPage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [feedback, setFeedback] = useState<Feedback>(null);
  const err = (e: unknown, fallback: string) =>
    setFeedback({ kind: "err", msg: e instanceof Error ? e.message : fallback });

  const app = useQuery({
    queryKey: KEY.application(id),
    queryFn: ({ signal }) => apiFetch<CandidateApplication>(`/v1/candidate-applications/${id}`, { signal }),
    enabled: Boolean(id), retry: 0, staleTime: 30_000,
  });
  const candidates = useCandidates();
  const postings = usePostings();
  const interviews = useQuery({
    queryKey: KEY.interviews(id),
    queryFn: ({ signal }) => apiFetch<InterviewListResponse>(`/v1/interviews?applicationId=${id}&limit=200`, { signal }),
    enabled: Boolean(id), retry: 0, staleTime: 30_000,
  });
  const offers = useQuery({
    queryKey: KEY.offers(id),
    queryFn: ({ signal }) => apiFetch<JobOfferListResponse>(`/v1/job-offers?applicationId=${id}&limit=200`, { signal }),
    enabled: Boolean(id), retry: 0, staleTime: 30_000,
  });
  const users = useQuery({
    queryKey: ["recruiting", "interviewers"],
    queryFn: ({ signal }) => apiFetch<UserListResponse>("/v1/users?limit=200", { signal }),
    retry: 0, staleTime: 60_000,
  });

  const [rejectReason, setRejectReason] = useState("");
  const setStage = useMutation({
    mutationFn: (stage: ApplicationStage) =>
      apiFetch<CandidateApplication>(`/v1/candidate-applications/${id}`, {
        method: "PATCH",
        body: stage === "REJECTED" ? { stage, rejectReason: rejectReason.trim() || null } : { stage },
      }),
    onSuccess: (a) => {
      setFeedback({ kind: "ok", msg: t("recruiting.application.stageChanged", { stage: t(`recruiting.stage.${a.stage}`) }) });
      void qc.invalidateQueries({ queryKey: KEY.application(id) });
      void qc.invalidateQueries({ queryKey: KEY.applications });
    },
    onError: (e: unknown) => err(e, t("recruiting.application.stageError")),
  });

  const [iv, setIv] = useState({ kind: "SCREENING", scheduledAt: "", durationMin: "45", location: "" });
  const createInterview = useMutation({
    mutationFn: () =>
      apiFetch<Interview>("/v1/interviews", {
        method: "POST",
        body: {
          applicationId: id,
          kind: iv.kind,
          scheduledAt: iv.scheduledAt ? new Date(iv.scheduledAt).toISOString() : null,
          durationMin: iv.durationMin ? Number(iv.durationMin) : null,
          location: iv.location.trim() || null,
        },
      }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("recruiting.application.interviewCreated") });
      setIv({ kind: "SCREENING", scheduledAt: "", durationMin: "45", location: "" });
      void qc.invalidateQueries({ queryKey: KEY.interviews(id) });
    },
    onError: (e: unknown) => err(e, t("recruiting.application.interviewError")),
  });
  const setInterviewStatus = useMutation({
    mutationFn: (v: { interviewId: string; status: InterviewStatus }) =>
      apiFetch<Interview>(`/v1/interviews/${v.interviewId}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY.interviews(id) }),
    onError: (e: unknown) => err(e, t("recruiting.application.interviewError")),
  });

  const [of, setOf] = useState({ grossAnnualSalary: "", contractType: "permanent", startDate: "" });
  const createOffer = useMutation({
    mutationFn: () =>
      apiFetch<JobOffer>("/v1/job-offers", {
        method: "POST",
        body: {
          applicationId: id,
          grossAnnualSalary: of.grossAnnualSalary ? Number(of.grossAnnualSalary) : null,
          contractType: of.contractType.trim() || null,
          startDate: of.startDate || null,
        },
      }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("recruiting.application.offerCreated") });
      void qc.invalidateQueries({ queryKey: KEY.offers(id) });
    },
    onError: (e: unknown) => err(e, t("recruiting.application.offerError")),
  });
  const setOfferStatus = useMutation({
    mutationFn: (v: { offerId: string; status: JobOfferStatus }) =>
      apiFetch<JobOffer>(`/v1/job-offers/${v.offerId}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY.offers(id) }),
    onError: (e: unknown) => err(e, t("recruiting.application.offerError")),
  });

  if (app.isLoading) {
    return <main className="flex justify-center py-16" data-testid="application-loading"><Spinner /></main>;
  }
  if (app.isError || !app.data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8" data-testid="application-error">
        <p className="text-sm text-danger">{t("recruiting.application.error")}</p>
      </main>
    );
  }

  const a = app.data;
  const candidate = (candidates.data?.items ?? []).find((c) => c.candidateId === a.candidateId);
  const posting = (postings.data?.items ?? []).find((p) => p.postingId === a.postingId);
  const interviewers = users.data?.items ?? [];

  return (
    <main data-testid="application-page" className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <PageHeader
        title={candidate ? candidateName(candidate) : t("recruiting.application.title")}
        description={posting ? `${posting.code} · ${posting.title}` : a.postingId}
      />
      <p className="text-sm"><Link href="/recruiting" className="underline">{t("recruiting.application.backToPipeline")}</Link></p>

      {feedback && (
        <p data-testid="application-feedback" role="status" className={`text-sm ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}>{feedback.msg}</p>
      )}

      <Card>
        <CardHeader><CardTitle>{t("recruiting.application.stageTitle")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div data-testid="field-stage">
            <p className="text-xs text-muted-foreground">{t("recruiting.fields.stage")}</p>
            <Badge data-testid="application-stage">{t(`recruiting.stage.${a.stage}`)}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("recruiting.fields.appliedOn")}</p>
            <p className="text-sm" data-testid="application-applied-on">{a.appliedOn}</p>
          </div>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">{t("recruiting.application.moveTo")}</span>
            <select
              data-testid="application-stage-select"
              className={SELECT_CLASS}
              value={a.stage}
              disabled={setStage.isPending}
              onChange={(e) => setStage.mutate(e.target.value as ApplicationStage)}
            >
              {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{t(`recruiting.stage.${s}`)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-3">
            <span className="text-xs text-muted-foreground">{t("recruiting.fields.rejectReason")}</span>
            <Input data-testid="application-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t("recruiting.application.rejectHint")} />
          </label>
          {a.rejectReason && <p className="text-sm sm:col-span-3" data-testid="application-reject-reason-shown">{t("recruiting.fields.rejectReason")}: {a.rejectReason}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("recruiting.application.interviewsTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5" data-testid="interview-form">
            <select data-testid="interview-kind" className={SELECT_CLASS} value={iv.kind} onChange={(e) => setIv({ ...iv, kind: e.target.value })}>
              {INTERVIEW_KINDS.map((k) => <option key={k} value={k}>{t(`recruiting.interviewKind.${k}`)}</option>)}
            </select>
            <Input type="datetime-local" data-testid="interview-scheduled-at" value={iv.scheduledAt} onChange={(e) => setIv({ ...iv, scheduledAt: e.target.value })} />
            <Input type="number" min={5} max={1440} data-testid="interview-duration" value={iv.durationMin} onChange={(e) => setIv({ ...iv, durationMin: e.target.value })} />
            <Input data-testid="interview-location" placeholder={t("recruiting.fields.location")} value={iv.location} onChange={(e) => setIv({ ...iv, location: e.target.value })} />
            <Button type="button" data-testid="interview-submit" disabled={createInterview.isPending} onClick={() => createInterview.mutate()}>
              {t("recruiting.application.scheduleInterview")}
            </Button>
          </div>

          {(interviews.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="interviews-empty">{t("recruiting.application.noInterviews")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border" data-testid="interviews-list">
              {(interviews.data?.items ?? []).map((i) => (
                <li key={i.interviewId} className="space-y-3 px-4 py-3" data-testid="interview-row">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{t(`recruiting.interviewKind.${i.kind}`)}{i.scheduledAt ? ` · ${new Date(i.scheduledAt).toLocaleString()}` : ""}{i.location ? ` · ${i.location}` : ""}</span>
                    <div className="flex items-center gap-2">
                      <Badge data-testid="interview-row-status">{t(`recruiting.interviewStatus.${i.status}`)}</Badge>
                      <select
                        aria-label={t("recruiting.fields.status")}
                        data-testid="interview-row-status-select"
                        className={SELECT_CLASS}
                        value={i.status}
                        onChange={(e) => setInterviewStatus.mutate({ interviewId: i.interviewId, status: e.target.value as InterviewStatus })}
                      >
                        {INTERVIEW_STATUSES.map((s) => <option key={s} value={s}>{t(`recruiting.interviewStatus.${s}`)}</option>)}
                      </select>
                    </div>
                  </div>
                  <FeedbackBlock interviewId={i.interviewId} interviewers={interviewers} onError={(e) => err(e, t("recruiting.application.feedbackError"))} onOk={() => setFeedback({ kind: "ok", msg: t("recruiting.application.feedbackCreated") })} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("recruiting.application.offerTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4" data-testid="offer-form">
            <Input type="number" min={1} step={100} data-testid="offer-salary" placeholder={t("recruiting.fields.grossAnnualSalary")} value={of.grossAnnualSalary} onChange={(e) => setOf({ ...of, grossAnnualSalary: e.target.value })} />
            <Input data-testid="offer-contract-type" placeholder={t("recruiting.fields.contractType")} value={of.contractType} onChange={(e) => setOf({ ...of, contractType: e.target.value })} />
            <Input type="date" data-testid="offer-start-date" value={of.startDate} onChange={(e) => setOf({ ...of, startDate: e.target.value })} />
            <Button type="button" data-testid="offer-submit" disabled={createOffer.isPending} onClick={() => createOffer.mutate()}>{t("recruiting.application.createOffer")}</Button>
          </div>
          {(offers.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="offers-empty">{t("recruiting.application.noOffers")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border" data-testid="offers-list">
              {(offers.data?.items ?? []).map((o) => (
                <li key={o.offerId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" data-testid="offer-row">
                  <span>
                    {o.masked?.includes("grossAnnualSalary")
                      ? <em data-testid="offer-salary-masked">{t("recruiting.application.salaryMasked")}</em>
                      : <span data-testid="offer-row-salary">{o.grossAnnualSalary !== null && o.grossAnnualSalary !== undefined ? `${o.grossAnnualSalary.toLocaleString()} €` : "—"}</span>}
                    {o.contractType ? ` · ${o.contractType}` : ""}{o.startDate ? ` · ${o.startDate}` : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge data-testid="offer-row-status">{t(`recruiting.offerStatus.${o.status}`)}</Badge>
                    <select
                      aria-label={t("recruiting.fields.status")}
                      data-testid="offer-row-status-select"
                      className={SELECT_CLASS}
                      value={o.status}
                      onChange={(e) => setOfferStatus.mutate({ offerId: o.offerId, status: e.target.value as JobOfferStatus })}
                    >
                      {OFFER_STATUSES.map((s) => <option key={s} value={s}>{t(`recruiting.offerStatus.${s}`)}</option>)}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function FeedbackBlock({
  interviewId, interviewers, onError, onOk,
}: {
  interviewId: string;
  interviewers: UserListResponse["items"];
  onError: (e: unknown) => void;
  onOk: () => void;
}) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY.feedback(interviewId),
    queryFn: ({ signal }) => apiFetch<InterviewFeedbackListResponse>(`/v1/interview-feedback?interviewId=${interviewId}&limit=200`, { signal }),
    retry: 0, staleTime: 30_000,
  });
  const [fb, setFb] = useState({ interviewerUserId: "", recommendation: "YES", score: "", notes: "" });
  const create = useMutation({
    mutationFn: () =>
      apiFetch<InterviewFeedback>("/v1/interview-feedback", {
        method: "POST",
        body: {
          interviewId,
          interviewerUserId: fb.interviewerUserId,
          recommendation: fb.recommendation,
          score: fb.score ? Number(fb.score) : null,
          notes: fb.notes.trim() || null,
          submittedOn: new Date().toISOString().slice(0, 10),
        },
      }),
    onSuccess: () => {
      onOk();
      setFb({ interviewerUserId: "", recommendation: "YES", score: "", notes: "" });
      void qc.invalidateQueries({ queryKey: KEY.feedback(interviewId) });
    },
    onError,
  });
  const byId = new Map(interviewers.map((u) => [u.userId, u.displayName]));

  return (
    <div className="space-y-2 rounded-card bg-muted/30 p-3" data-testid="feedback-block">
      <div className="grid gap-2 md:grid-cols-5" data-testid="feedback-form">
        <select data-testid="feedback-interviewer" className={SELECT_CLASS} value={fb.interviewerUserId} onChange={(e) => setFb({ ...fb, interviewerUserId: e.target.value })}>
          <option value="">{t("recruiting.fields.chooseInterviewer")}</option>
          {interviewers.map((u) => <option key={u.userId} value={u.userId}>{u.displayName}</option>)}
        </select>
        <select data-testid="feedback-recommendation" className={SELECT_CLASS} value={fb.recommendation} onChange={(e) => setFb({ ...fb, recommendation: e.target.value })}>
          {FEEDBACK_RECOMMENDATIONS.map((r) => <option key={r} value={r}>{t(`recruiting.recommendation.${r}`)}</option>)}
        </select>
        <Input type="number" min={0} max={10} step={0.5} data-testid="feedback-score" placeholder="0-10" value={fb.score} onChange={(e) => setFb({ ...fb, score: e.target.value })} />
        <Input data-testid="feedback-notes" placeholder={t("recruiting.fields.notes")} value={fb.notes} onChange={(e) => setFb({ ...fb, notes: e.target.value })} />
        <Button type="button" variant="outline" data-testid="feedback-submit" disabled={!fb.interviewerUserId || create.isPending} onClick={() => create.mutate()}>
          {t("recruiting.application.submitFeedback")}
        </Button>
      </div>
      {(q.data?.items ?? []).length > 0 && (
        <ul className="space-y-1 text-sm" data-testid="feedback-list">
          {(q.data?.items ?? []).map((f) => (
            <li key={f.feedbackId} data-testid="feedback-row">
              <span className="font-medium">{byId.get(f.interviewerUserId) ?? f.interviewerUserId.slice(0, 8)}</span>
              {" · "}<Badge variant="outline" data-testid="feedback-row-recommendation">{t(`recruiting.recommendation.${f.recommendation}`)}</Badge>
              {f.score !== null ? ` · ${f.score}/10` : ""}{f.notes ? ` · ${f.notes}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
