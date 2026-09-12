"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, EmptyState, Spinner,
} from "@heuresys/ui";
import type { Candidate, CandidateApplication } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import {
  CANDIDATE_SOURCES, KEY, candidateName,
  useApplications, useCandidates, usePostings,
} from "@/lib/recruiting";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  consentGivenOn: string;
  retentionUntil: string;
};

/**
 * `#54` F4 — i candidati, e la loro candidatura a un annuncio.
 *
 * ⚠ Un candidato NON e' un utente: nome, indirizzo e telefono sono dati personali di una
 * persona che non e' (ancora) in azienda, e il consenso con la sua scadenza sono colonne
 * con un CHECK, non una nota. Il form le chiede insieme al resto perche' un candidato senza
 * consenso e' un dato che non si dovrebbe conservare.
 *
 * «Candida a» crea la candidatura (`POST /v1/candidate-applications`), che da quel momento
 * compare nella pipeline come carta in `APPLIED`. Lo stesso candidato sullo stesso annuncio
 * due volte e' rifiutato dal database (`APPLICATION_DUPLICATE`), e il messaggio arriva qui.
 */
export default function CandidatesPage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const q = useCandidates();
  const postings = usePostings();
  const applications = useApplications();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [postingFor, setPostingFor] = useState<Record<string, string>>({});

  const oggi = new Date().toISOString().slice(0, 10);
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", source: "DIRECT", consentGivenOn: oggi, retentionUntil: "" },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiFetch<Candidate>("/v1/candidates", {
        method: "POST",
        body: {
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          email: v.email.trim().toLowerCase(),
          phone: v.phone.trim() || null,
          source: v.source,
          consentGivenOn: v.consentGivenOn || null,
          retentionUntil: v.retentionUntil || null,
        },
      }),
    onSuccess: (c) => {
      setFeedback({ kind: "ok", msg: t("recruiting.candidates.created", { name: candidateName(c) }) });
      reset({ firstName: "", lastName: "", email: "", phone: "", source: "DIRECT", consentGivenOn: oggi, retentionUntil: "" });
      void qc.invalidateQueries({ queryKey: KEY.candidates });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.candidates.createError") }),
  });

  const apply = useMutation({
    mutationFn: (v: { candidateId: string; postingId: string }) =>
      apiFetch<CandidateApplication>("/v1/candidate-applications", { method: "POST", body: v }),
    onSuccess: () => {
      setFeedback({ kind: "ok", msg: t("recruiting.candidates.applied") });
      void qc.invalidateQueries({ queryKey: KEY.applications });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.candidates.applyError") }),
  });

  const items = q.data?.items ?? [];
  const openPostings = (postings.data?.items ?? []).filter((p) => p.status === "PUBLISHED" || p.status === "DRAFT");
  const applicationsOf = (candidateId: string) =>
    (applications.data?.items ?? []).filter((a) => a.candidateId === candidateId);

  return (
    <main data-testid="candidates-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("recruiting.candidates.title")} description={t("recruiting.candidates.description")} />

      <Card>
        <CardHeader><CardTitle>{t("recruiting.candidates.newTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" data-testid="candidate-form" onSubmit={handleSubmit((v) => create.mutate(v))}>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.firstName")}</span>
              <Input data-testid="candidate-first-name" {...register("firstName", { required: true })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.lastName")}</span>
              <Input data-testid="candidate-last-name" {...register("lastName", { required: true })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.email")}</span>
              <Input type="email" data-testid="candidate-email" {...register("email", { required: true })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.phone")}</span>
              <Input data-testid="candidate-phone" {...register("phone")} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.source")}</span>
              <select data-testid="candidate-source" className={SELECT_CLASS} {...register("source")}>
                {CANDIDATE_SOURCES.map((s) => (
                  <option key={s} value={s}>{t(`recruiting.source.${s}`)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.consentGivenOn")}</span>
              <Input type="date" data-testid="candidate-consent" {...register("consentGivenOn")} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.retentionUntil")}</span>
              <Input type="date" data-testid="candidate-retention" {...register("retentionUntil")} />
            </label>
            <div className="md:col-span-3">
              <Button type="submit" data-testid="candidate-submit" disabled={create.isPending}>{t("recruiting.candidates.submit")}</Button>
            </div>
          </form>
          {feedback && (
            <p data-testid="candidate-feedback" role="status" className={`mt-3 text-sm ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}>{feedback.msg}</p>
          )}
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : q.isError ? (
        <p className="text-sm text-danger" data-testid="candidates-error">{t("recruiting.error")}</p>
      ) : items.length === 0 ? (
        <EmptyState data-testid="candidates-empty" title={t("recruiting.candidates.emptyTitle")} description={t("recruiting.candidates.emptyDesc")} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2" data-testid="candidates-list">
          {items.map((c) => {
            const sue = applicationsOf(c.candidateId);
            return (
              <Card key={c.candidateId} data-testid="candidate-row">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium" data-testid="candidate-row-name">{candidateName(c)}</p>
                      <p className="text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                    </div>
                    <Badge data-testid="candidate-row-status">{t(`recruiting.candidateStatus.${c.status}`)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(`recruiting.source.${c.source}`)}
                    {c.consentGivenOn ? ` · ${t("recruiting.fields.consentGivenOn")}: ${c.consentGivenOn}` : ""}
                  </p>

                  {sue.length > 0 && (
                    <ul className="space-y-1 text-sm" data-testid="candidate-applications">
                      {sue.map((a) => (
                        <li key={a.applicationId}>
                          <Link href={`/recruiting/applications/${a.applicationId}`} className="underline" data-testid="candidate-application-link">
                            {t(`recruiting.stage.${a.stage}`)} · {a.appliedOn}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {c.status === "ACTIVE" && (
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={t("recruiting.fields.posting")}
                        data-testid="candidate-apply-posting"
                        className={SELECT_CLASS}
                        value={postingFor[c.candidateId] ?? ""}
                        onChange={(e) => setPostingFor((s) => ({ ...s, [c.candidateId]: e.target.value }))}
                      >
                        <option value="">{t("recruiting.fields.choosePosting")}</option>
                        {openPostings.map((p) => (
                          <option key={p.postingId} value={p.postingId}>{p.code} · {p.title}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="candidate-apply"
                        disabled={!postingFor[c.candidateId] || apply.isPending}
                        onClick={() => apply.mutate({ candidateId: c.candidateId, postingId: postingFor[c.candidateId]! })}
                      >
                        {t("recruiting.candidates.apply")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}
    </main>
  );
}
