"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  PageHeader, Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, EmptyState, Spinner,
} from "@heuresys/ui";
import type { JobRequisition, JobRequisitionStatus } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import {
  CODE_PATTERN, KEY, REQUISITION_REASONS, REQUISITION_STATUSES,
  useActivePositions, useRequisitions,
} from "@/lib/recruiting";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type FormValues = {
  code: string;
  positionId: string;
  headcount: number;
  reason: string;
  targetStart: string;
  notes: string;
};

/**
 * `#54` F4 — le richieste di personale. Una richiesta copre un POSTO dell'organigramma (I1):
 * il form sceglie fra le posizioni attive del tenant, e non ammette una richiesta senza.
 * Il ciclo di vita (DRAFT → APPROVED → OPEN → …) e' una successione di decisioni: lo stato
 * non si scrive alla creazione, si cambia riga per riga con un PATCH.
 */
export default function RequisitionsPage() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const q = useRequisitions();
  const positions = useActivePositions();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { code: "", positionId: "", headcount: 1, reason: "", targetStart: "", notes: "" },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      apiFetch<JobRequisition>("/v1/job-requisitions", {
        method: "POST",
        body: {
          code: v.code.trim().toUpperCase(),
          positionId: v.positionId,
          headcount: Number(v.headcount) || 1,
          reason: v.reason || null,
          targetStart: v.targetStart || null,
          notes: v.notes.trim() || null,
        },
      }),
    onSuccess: (r) => {
      setFeedback({ kind: "ok", msg: t("recruiting.requisitions.created", { code: r.code }) });
      reset();
      void qc.invalidateQueries({ queryKey: KEY.requisitions });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.requisitions.createError") }),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: JobRequisitionStatus }) =>
      apiFetch<JobRequisition>(`/v1/job-requisitions/${v.id}`, { method: "PATCH", body: { status: v.status } }),
    onSuccess: (r) => {
      setFeedback({ kind: "ok", msg: t("recruiting.requisitions.statusChanged", { code: r.code, status: t(`recruiting.requisitionStatus.${r.status}`) }) });
      void qc.invalidateQueries({ queryKey: KEY.requisitions });
    },
    onError: (e: unknown) =>
      setFeedback({ kind: "err", msg: e instanceof Error ? e.message : t("recruiting.requisitions.createError") }),
  });

  const items = q.data?.items ?? [];

  return (
    <main data-testid="requisitions-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("recruiting.requisitions.title")} description={t("recruiting.requisitions.description")} />

      <Card>
        <CardHeader><CardTitle>{t("recruiting.requisitions.newTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-3"
            data-testid="requisition-form"
            onSubmit={handleSubmit((v) => create.mutate(v))}
          >
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.code")}</span>
              <Input
                data-testid="requisition-code"
                placeholder="REQ-2026-001"
                {...register("code", { required: true, pattern: CODE_PATTERN })}
              />
              {errors.code && <span className="text-xs text-danger">{t("recruiting.fields.codeHint")}</span>}
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.position")}</span>
              <select data-testid="requisition-position" className={SELECT_CLASS} {...register("positionId", { required: true })}>
                <option value="">{t("recruiting.fields.choose")}</option>
                {(positions.data?.items ?? []).map((p) => (
                  <option key={p.positionId} value={p.positionId}>{p.code} · {p.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.headcount")}</span>
              <Input type="number" min={1} max={999} data-testid="requisition-headcount" {...register("headcount", { valueAsNumber: true })} />
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.reason")}</span>
              <select data-testid="requisition-reason" className={SELECT_CLASS} {...register("reason")}>
                <option value="">—</option>
                {REQUISITION_REASONS.map((r) => (
                  <option key={r} value={r}>{t(`recruiting.reason.${r}`)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>{t("recruiting.fields.targetStart")}</span>
              <Input type="date" data-testid="requisition-target-start" {...register("targetStart")} />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">
              <span>{t("recruiting.fields.notes")}</span>
              <Input data-testid="requisition-notes" {...register("notes")} />
            </label>
            <div className="md:col-span-3">
              <Button type="submit" data-testid="requisition-submit" disabled={create.isPending}>
                {t("recruiting.requisitions.submit")}
              </Button>
            </div>
          </form>
          {feedback && (
            <p data-testid="requisition-feedback" role="status" className={`mt-3 text-sm ${feedback.kind === "ok" ? "text-success" : "text-danger"}`}>
              {feedback.msg}
            </p>
          )}
        </CardContent>
      </Card>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : q.isError ? (
        <p className="text-sm text-danger" data-testid="requisitions-error">{t("recruiting.error")}</p>
      ) : items.length === 0 ? (
        <EmptyState data-testid="requisitions-empty" title={t("recruiting.requisitions.emptyTitle")} description={t("recruiting.requisitions.emptyDesc")} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-sm" data-testid="requisitions-table">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("recruiting.fields.code")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.position")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.headcount")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.reason")}</th>
                <th className="px-4 py-2">{t("recruiting.fields.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((r) => (
                <tr key={r.requisitionId} data-testid="requisition-row">
                  <td className="px-4 py-2 font-medium" data-testid="requisition-row-code">{r.code}</td>
                  <td className="px-4 py-2">{r.positionTitle ?? r.positionId.slice(0, 8)}</td>
                  <td className="px-4 py-2">{r.headcount}</td>
                  <td className="px-4 py-2">{r.reason ? t(`recruiting.reason.${r.reason}`) : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Badge data-testid="requisition-row-status">{t(`recruiting.requisitionStatus.${r.status}`)}</Badge>
                      <select
                        aria-label={t("recruiting.fields.status")}
                        data-testid="requisition-row-status-select"
                        className={SELECT_CLASS}
                        value={r.status}
                        disabled={setStatus.isPending}
                        onChange={(e) => setStatus.mutate({ id: r.requisitionId, status: e.target.value as JobRequisitionStatus })}
                      >
                        {REQUISITION_STATUSES.map((s) => (
                          <option key={s} value={s}>{t(`recruiting.requisitionStatus.${s}`)}</option>
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
