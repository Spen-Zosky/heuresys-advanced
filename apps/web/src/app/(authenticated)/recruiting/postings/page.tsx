"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, EmptyState, Spinner,
} from "@heuresys/ui";
import type { JobPosting, JobPostingStatus } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import {
  CODE_PATTERN, KEY, POSTING_STATUSES, POSTING_VISIBILITIES,
  usePostings, useRequisitions,
} from "@/lib/recruiting";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type FormValues = {
  requisitionId: string;
  code: string;
  title: string;
  description: string;
  visibility: string;
  location: string;
  expiresOn: string;
};

/**
 * `#54` F4 — gli annunci. Un annuncio nasce da una richiesta e ne EREDITA il tenant: il form
 * non chiede l'azienda, chiede la richiesta. La visibilita' decide chi lo legge: `INTERNAL`
 * i dipendenti, `EXTERNAL` chi lo riceve, `PUBLIC` chiunque passi da `/jobs` — la vetrina
 * del prospect (ADR-0026), che mostra SOLO cio' che e' `PUBLISHED` e `PUBLIC`.
 */
export default function PostingsPage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const q = usePostings();
  const requisitions = useRequisitions();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { requisitionId: "", code: "", title: "", description: "", visibility: "INTERNAL", location: "", expiresOn: "" },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiFetch<JobPosting>("/v1/job-postings", {
        method: "POST",
        body: {
          requisitionId: v.requisitionId,
          code: v.code.trim().toUpperCase(),
          title: v.title.trim(),
          description: v.description.trim() || null,
          visibility: v.visibility,
          location: v.location.trim() || null,
          expiresOn: v.expiresOn || null,
        },
      }),
    onSuccess: (p) => {
      setFeedback({ kind: "ok", msg: t("recruiting.postings.created", { code: p.code }) });
      reset();
      void qc.invalidateQueries({ queryKey: KEY.postings });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.postings.createError") }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: JobPostingStatus }) =>
      apiFetch<JobPosting>(`/v1/job-postings/${v.id}`, {
        method: "PATCH",
        // pubblicare senza una data di pubblicazione e' un annuncio senza «da quando»
        body: v.status === "PUBLISHED"
          ? { status: v.status, publishedOn: new Date().toISOString().slice(0, 10) }
          : { status: v.status },
      }),
    onSuccess: (p) => {
      setFeedback({ kind: "ok", msg: t("recruiting.postings.statusChanged", { code: p.code, status: t(`recruiting.postingStatus.${p.status}`) }) });
      void qc.invalidateQueries({ queryKey: KEY.postings });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.postings.createError") }),
  });

  const items = q.data?.items ?? [];

  return (
    <main data-testid="postings-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("recruiting.postings.title")} description={t("recruiting.postings.description")} />

      <Card>
        <CardHeader><CardTitle>{t("recruiting.postings.newTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" data-testid="posting-form" onSubmit={handleSubmit((v) => create.mutate(v))}>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.requisition")}</span>
              <select data-testid="posting-requisition" className={SELECT_CLASS} {...register("requisitionId", { required: true })}>
                <option value="">{t("recruiting.fields.choose")}</option>
                {(requisitions.data?.items ?? []).map((r) => (
                  <option key={r.requisitionId} value={r.requisitionId}>{r.code} · {r.positionTitle ?? ""}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.code")}</span>
              <Input data-testid="posting-code" placeholder="JOB-2026-001" {...register("code", { required: true, pattern: CODE_PATTERN })} />
              {errors.code && <span className="text-xs text-danger">{t("recruiting.fields.codeHint")}</span>}
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.title")}</span>
              <Input data-testid="posting-title" {...register("title", { required: true, minLength: 2 })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.visibility")}</span>
              <select data-testid="posting-visibility" className={SELECT_CLASS} {...register("visibility")}>
                {POSTING_VISIBILITIES.map((v) => (
                  <option key={v} value={v}>{t(`recruiting.visibility.${v}`)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.location")}</span>
              <Input data-testid="posting-location" {...register("location")} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.expiresOn")}</span>
              <Input type="date" data-testid="posting-expires-on" {...register("expiresOn")} />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">
              <span>{t("recruiting.fields.description")}</span>
              <textarea data-testid="posting-description" rows={3} className={SELECT_CLASS} {...register("description")} />
            </label>
            <div className="md:col-span-3">
              <Button type="submit" data-testid="posting-submit" disabled={create.isPending}>{t("recruiting.postings.submit")}</Button>
            </div>
          </form>
          {feedback && (
            <p data-testid="posting-feedback" role="status" className={`mt-3 text-sm ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}>{feedback.msg}</p>
          )}
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : q.isError ? (
        <p className="text-sm text-danger" data-testid="postings-error">{t("recruiting.error")}</p>
      ) : items.length === 0 ? (
        <EmptyState data-testid="postings-empty" title={t("recruiting.postings.emptyTitle")} description={t("recruiting.postings.emptyDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm" data-testid="postings-table">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("recruiting.fields.code")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.title")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.requisition")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.visibility")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => (
                <tr key={p.postingId} data-testid="posting-row">
                  <td className="px-4 py-2 font-medium" data-testid="posting-row-code">{p.code}</td>
                  <td className="px-4 py-2">{p.title}</td>
                  <td className="px-4 py-2">{p.requisitionCode ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant="outline" data-testid="posting-row-visibility">{t(`recruiting.visibility.${p.visibility}`)}</Badge></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Badge data-testid="posting-row-status">{t(`recruiting.postingStatus.${p.status}`)}</Badge>
                      <select
                        aria-label={t("recruiting.fields.status")}
                        data-testid="posting-row-status-select"
                        className={SELECT_CLASS}
                        value={p.status}
                        disabled={setStatus.isPending}
                        onChange={(e) => setStatus.mutate({ id: p.postingId, status: e.target.value as JobPostingStatus })}
                      >
                        {POSTING_STATUSES.map((s) => (
                          <option key={s} value={s}>{t(`recruiting.postingStatus.${s}`)}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
