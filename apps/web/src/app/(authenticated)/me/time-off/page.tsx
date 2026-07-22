"use client";

/**
 * /me/time-off — B3 (#34): ferie e permessi ESS.
 *
 * Balances (live from /v1/me/attendance), own request history
 * (/v1/me/time-off/requests) and the submission form (POST — creates a
 * TIME_OFF_REQUEST approval routed to the direct org manager; the leave
 * tables are written by the apply-effect only once approved, so the pending
 * state is visible in /me/approvals, not here).
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import {
  CreateMeTimeOffRequestBodySchema,
  ME_LEAVE_TYPES,
  type CreateMeTimeOffRequestBody,
  type MeAttendanceResponse,
  type MeTimeOffRequestSubmitted,
  type TimeOffRequest,
} from "@heuresys/shared";
import { EnumStatusBadge } from "@/components/enum-badge";
import { useEnumLabel } from "@/lib/enum-labels";
import { EntityTable } from "@/components/data-table-panel";
import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/fetch";

export default function MeTimeOffPage() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();

  const attendance = useQuery({
    queryKey: ["me", "attendance"],
    queryFn: () => apiFetch<MeAttendanceResponse>("/v1/me/attendance"),
  });
  const requests = useQuery({
    queryKey: ["me", "time-off", "requests"],
    queryFn: () => apiFetch<{ items: TimeOffRequest[]; total: number }>("/v1/me/time-off/requests?limit=100"),
  });

  const submit = useMutation({
    mutationFn: (body: CreateMeTimeOffRequestBody) =>
      apiFetch<MeTimeOffRequestSubmitted>("/v1/me/time-off/requests", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me", "time-off", "requests"] });
      void qc.invalidateQueries({ queryKey: ["me", "approvals"] });
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } =
    useForm<CreateMeTimeOffRequestBody>({
      resolver: zodResolver(CreateMeTimeOffRequestBodySchema),
      defaultValues: { leaveType: "VACATION" },
    });
  const onSubmit = handleSubmit(async (vals) => {
    try {
      await submit.mutateAsync(vals);
    } catch {
      /* surfaced via submit.error below */
    }
  });

  const balances = attendance.data?.leaveBalances ?? [];
  const submitError = submit.error;
  const submitErrorText = submitError
    ? isApiError(submitError)
      ? t(`timeOff.errors.${submitError.code}`, { defaultValue: submitError.message })
      : t("timeOff.errors.GENERIC")
    : null;

  const requestColumns = useMemo(
    () => [
      { header: t("timeOff.colType"), cell: (r: TimeOffRequest) => <span className="text-sm">{enumLabel("leaveType", r.leaveType)}</span> },
      { header: t("timeOff.colPeriod"), cell: (r: TimeOffRequest) => <span className="tabular-nums text-xs">{r.startDate} → {r.endDate}</span> },
      { header: t("timeOff.colDays"), align: "right" as const, cell: (r: TimeOffRequest) => <span className="tabular-nums">{r.daysRequested}</span> },
      { header: t("timeOff.colStatus"), cell: (r: TimeOffRequest) => <EnumStatusBadge domain="timeOffStatus" value={r.status} /> },
    ],
    [t, enumLabel],
  );

  return (
    <main data-testid="me-time-off-page" className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        data-testid="me-time-off-title"
        title={t("timeOff.title")}
        description={t("timeOff.description")}
      />

      {/* Balances — live rows from /v1/me/attendance */}
      <Card>
        <CardHeader><CardTitle>{t("timeOff.balancesTitle")}</CardTitle></CardHeader>
        <CardContent>
          {attendance.isLoading ? (
            <p className="p-2 text-sm text-muted-foreground">{t("common:loading")}</p>
          ) : balances.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground" data-testid="me-time-off-balances-empty">{t("timeOff.balancesEmpty")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3" data-testid="me-time-off-balances">
              {balances.map((b) => (
                <div key={`${b.leaveType}-${b.year}`} className="rounded-control border border-border bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{enumLabel("leaveType", b.leaveType)} · {b.year}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground tabular-nums">
                    {b.totalDays !== null && b.usedDays !== null ? (b.totalDays + (b.carryoverDays ?? 0) - b.usedDays).toFixed(1) : "—"}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{t("timeOff.daysAvailable")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {t("timeOff.balanceDetail", { total: b.totalDays ?? 0, used: b.usedDays ?? 0 })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission form */}
      <Card>
        <CardHeader><CardTitle>{t("timeOff.formTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { void onSubmit(e); }} className="space-y-4" data-testid="me-time-off-form">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="leaveType" className="text-sm font-medium text-foreground">{t("timeOff.typeLabel")}</label>
                <select
                  id="leaveType"
                  data-testid="me-time-off-type"
                  className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("leaveType")}
                >
                  {ME_LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>{enumLabel("leaveType", lt)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="startDate" className="text-sm font-medium text-foreground">{t("timeOff.startLabel")}</label>
                <Input id="startDate" type="date" data-testid="me-time-off-start" {...register("startDate")} />
                {errors.startDate && <p className="text-xs text-danger">{t("timeOff.dateRequired")}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="endDate" className="text-sm font-medium text-foreground">{t("timeOff.endLabel")}</label>
                <Input id="endDate" type="date" data-testid="me-time-off-end" {...register("endDate")} />
                {errors.endDate && <p className="text-xs text-danger">{t("timeOff.dateRequired")}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-sm font-medium text-foreground">{t("timeOff.reasonLabel")}</label>
              <Input id="reason" data-testid="me-time-off-reason" placeholder={t("timeOff.reasonPlaceholder")} {...register("reason")} />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" data-testid="me-time-off-half-start" {...register("halfDayStart")} />
                {t("timeOff.halfDayStart")}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" data-testid="me-time-off-half-end" {...register("halfDayEnd")} />
                {t("timeOff.halfDayEnd")}
              </label>
            </div>

            {submitErrorText && (
              <p className="text-sm text-danger" data-testid="me-time-off-error">{submitErrorText}</p>
            )}
            {submit.isSuccess && (
              <p className="text-sm text-success" data-testid="me-time-off-success">
                {t("timeOff.submitted", { days: submit.data.daysRequested })}{" "}
                <Link href="/me/approvals" className="underline underline-offset-2">{t("timeOff.trackLink")}</Link>
              </p>
            )}

            <Button type="submit" data-testid="me-time-off-submit" disabled={isSubmitting || submit.isPending}>
              {submit.isPending ? t("timeOff.submitting") : t("timeOff.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Own request history (approved ones materialize here; pending live in /me/approvals) */}
      <Card>
        <CardHeader><CardTitle>{t("timeOff.historyTitle")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <EntityTable<TimeOffRequest>
            isLoading={requests.isLoading}
            isError={requests.isError}
            errorMessage={t("timeOff.historyError")}
            rows={requests.data?.items ?? []}
            rowKey={(r) => r.requestId}
            rowTestId="me-time-off-row"
            emptyTestId="me-time-off-empty"
            emptyTitle={t("timeOff.historyEmptyTitle")}
            emptyDescription={t("timeOff.historyEmptyDesc")}
            caption={t("timeOff.historyCaption")}
            columns={requestColumns}
          />
        </CardContent>
      </Card>
    </main>
  );
}
