"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type { CreateMeCareerTargetBody, Position } from "@heuresys/shared";
import { CAREER_TARGET_HORIZON_VALUES, CareerTargetHorizonSchema, CreateMeCareerTargetBodySchema } from "@heuresys/shared";
import { StatusPill } from "@/components/status-pill";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { apiFetch } from "../../../../../lib/api/fetch";

// Derivato dal contratto (S1101, 2026-09-14). Prima il form aveva `targetDate` e `notes`, che il
// contratto `CreateMeCareerTargetBodySchema` non dichiara: l'API scartava le due chiavi in silenzio
// e l'utente scriveva una nota che non veniva salvata. La tabella ha `horizon` (tre valori, CHECK).
const CareerTargetSchema = CreateMeCareerTargetBodySchema.extend({
  positionId: z.string().uuid(),
  horizon: z.union([CareerTargetHorizonSchema, z.literal("")]),
});
type CareerTargetValues = z.infer<typeof CareerTargetSchema>;

export default function MeCareerTargetPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  // C4 (#42): server-side search. The old `?limit=200` + in-browser filter was
  // already at 81% of its ceiling (162 positions) and would have started hiding
  // rows silently as the tenant grew.
  const debouncedFilter = useDebouncedValue(filter, 300);
  const positions = usePaginatedList<Position>({
    queryKey: ["positions", "picker"],
    path: "/v1/positions",
    params: { search: debouncedFilter },
    initialPageSize: 50,
  });

  const create = useMutation({
    mutationFn: (body: CareerTargetValues) => {
      const payload: CreateMeCareerTargetBody = {
        positionId: body.positionId,
        horizon: body.horizon === "" ? null : body.horizon,
      };
      return apiFetch("/v1/me/career/target-positions", { method: "POST", body: payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "career"] }),
  });

  const { register, handleSubmit, formState: { isSubmitting, errors } } =
    useForm<CareerTargetValues>({
      resolver: zodResolver(CareerTargetSchema),
      defaultValues: { positionId: "", horizon: "" },
    });

  const onSubmit = handleSubmit(async (vals) => { await create.mutateAsync(vals); });

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
                {positions.rows.map((p) => (
                  <option key={p.positionId} value={p.positionId}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
              {positions.total > positions.rows.length && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="career-target-position-more">
                  {t("careerTarget.moreResults", {
                    shown: positions.rows.length,
                    total: positions.total,
                  })}
                </p>
              )}
              {errors.positionId && (
                <p className="mt-1 text-xs text-danger">{t("careerTarget.positionRequired")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="horizon" className="text-sm font-medium text-foreground">{t("careerTarget.horizonLabel")}</label>
              <select
                id="horizon"
                data-testid="career-target-horizon"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("horizon")}
              >
                <option value="">{t("careerTarget.horizonNone")}</option>
                {CAREER_TARGET_HORIZON_VALUES.map((h) => (
                  <option key={h} value={h}>{t(`careerTarget.horizon.${h}`)}</option>
                ))}
              </select>
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
