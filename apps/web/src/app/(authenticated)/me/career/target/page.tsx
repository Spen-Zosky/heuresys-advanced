"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import { StatusPill } from "@/components/status-pill";
import { apiFetch } from "../../../../../lib/api/fetch";

interface Position {
  positionId: string;
  code: string;
  title: string;
}

const CareerTargetSchema = z.object({
  positionId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().max(2048).optional(),
});
type CareerTargetValues = z.infer<typeof CareerTargetSchema>;

export default function MeCareerTargetPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const positions = useQuery({
    queryKey: ["positions", "list"],
    queryFn: () => apiFetch<{ items: Position[]; total: number }>("/v1/positions?limit=200"),
  });

  const create = useMutation({
    mutationFn: (body: CareerTargetValues) => {
      const payload: Record<string, unknown> = { positionId: body.positionId };
      if (body.targetDate && body.targetDate.length > 0) payload.targetDate = body.targetDate;
      if (body.notes) payload.notes = body.notes;
      return apiFetch("/v1/me/career/target-positions", { method: "POST", body: payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "career"] }),
  });

  const { register, handleSubmit, formState: { isSubmitting, errors } } =
    useForm<CareerTargetValues>({
      resolver: zodResolver(CareerTargetSchema),
      defaultValues: { positionId: "", targetDate: "", notes: "" },
    });

  const onSubmit = handleSubmit(async (vals) => { await create.mutateAsync(vals); });

  const filtered = (positions.data?.items ?? []).filter((p) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
  });

  return (
    <main data-testid="career-target-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <Link
          href="/me/career"
          data-testid="career-target-back"
          className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("careerTarget.back")}
        </Link>
        <PageHeader
          data-testid="career-target-title"
          title={t("careerTarget.title")}
          description={t("careerTarget.description")}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("careerTarget.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="career-target-form"
          >
            <div className="space-y-1.5">
              <label htmlFor="filter" className="text-sm font-medium text-foreground">{t("careerTarget.filterLabel")}</label>
              <Input
                id="filter"
                data-testid="career-target-filter"
                placeholder={t("careerTarget.filterPlaceholder")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="positionId" className="text-sm font-medium text-foreground">{t("careerTarget.positionLabel")}</label>
              <select
                id="positionId"
                data-testid="career-target-position"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("positionId")}
              >
                <option value="">{t("careerTarget.selectPlaceholder")}</option>
                {filtered.slice(0, 50).map((p) => (
                  <option key={p.positionId} value={p.positionId}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
              {errors.positionId && (
                <p className="mt-1 text-xs text-danger">{t("careerTarget.positionRequired")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="targetDate" className="text-sm font-medium text-foreground">{t("careerTarget.dateLabel")}</label>
              <Input
                id="targetDate"
                data-testid="career-target-date"
                placeholder={t("careerTarget.datePlaceholder")}
                {...register("targetDate")}
              />
              {errors.targetDate && (
                <p className="mt-1 text-xs text-danger">{t("careerTarget.dateInvalid")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium text-foreground">{t("careerTarget.notesLabel")}</label>
              <Input id="notes" data-testid="career-target-notes" {...register("notes")} />
            </div>

            {create.isError && (
              <p className="text-sm text-danger" data-testid="career-target-error">
                {t("careerTarget.errorSubmit")}
              </p>
            )}
            {create.isSuccess && (
              <p data-testid="career-target-success">
                <StatusPill tone="success">
                  {t("careerTarget.success")}
                </StatusPill>
              </p>
            )}

            <Button
              type="submit"
              data-testid="career-target-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? t("careerTarget.submitting") : t("careerTarget.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
