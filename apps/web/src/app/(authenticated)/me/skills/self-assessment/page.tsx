"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import type { Skill } from "@heuresys/shared";
import { StatusPill } from "@/components/status-pill";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { apiFetch } from "../../../../../lib/api/fetch";

const SelfAssessmentSchema = z.object({
  skillId: z.string().uuid(),
  declaredProficiency: z.string().min(1).max(32),
  score: z.string().regex(/^$|^\d+(\.\d+)?$/).optional(),
  comment: z.string().max(4096).optional(),
});
type SelfAssessmentValues = z.infer<typeof SelfAssessmentSchema>;

const PROFICIENCY_LEVELS = ["NOVICE", "ADVANCED_BEGINNER", "COMPETENT", "PROFICIENT", "EXPERT"];

export default function MeSelfAssessmentPage() {
  const { t } = useTranslation("ess");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  // C4 (#42): the picker searches SERVER-side. It used to pull `?limit=200` and
  // filter in the browser, which silently capped the reachable catalogue at the
  // first 200 rows — unusable now that the ESCO taxonomy is visible to tenants
  // (migration 000175). The endpoint's `search` does ILIKE on name OR code, the
  // same match the client filter did.
  const debouncedFilter = useDebouncedValue(filter, 300);
  const skills = usePaginatedList<Skill>({
    queryKey: ["skills", "picker"],
    path: "/v1/skills",
    params: { search: debouncedFilter },
    initialPageSize: 50,
  });

  const create = useMutation({
    mutationFn: (body: SelfAssessmentValues) => {
      const payload: Record<string, unknown> = {
        skillId: body.skillId,
        declaredProficiency: body.declaredProficiency,
      };
      if (body.score && body.score.length > 0) payload.score = Number(body.score);
      if (body.comment) payload.comment = body.comment;
      return apiFetch("/v1/me/skills/self-assessments", { method: "POST", body: payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "skills"] }),
  });

  const { register, handleSubmit, formState: { isSubmitting, errors } } =
    useForm<SelfAssessmentValues>({
      resolver: zodResolver(SelfAssessmentSchema),
      defaultValues: { skillId: "", declaredProficiency: "COMPETENT" },
    });

  const onSubmit = handleSubmit(async (vals) => { await create.mutateAsync(vals); });

  return (
    <main data-testid="self-assessment-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <Link
          href="/me/skills"
          data-testid="self-assessment-back"
          className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("selfAssessment.back")}
        </Link>
        <PageHeader
          data-testid="self-assessment-title"
          title={t("selfAssessment.title")}
          description={t("selfAssessment.description")}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("selfAssessment.cardTitle")}</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="self-assessment-form"
          >
            <div className="space-y-1.5">
              <label htmlFor="filter" className="text-sm font-medium text-foreground">{t("selfAssessment.filterLabel")}</label>
              <Input
                id="filter"
                data-testid="self-assessment-filter"
                placeholder={t("selfAssessment.filterPlaceholder")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="skillId" className="text-sm font-medium text-foreground">{t("selfAssessment.skillLabel")}</label>
              <select
                id="skillId"
                data-testid="self-assessment-skill"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("skillId")}
              >
                <option value="">{t("selfAssessment.selectPlaceholder")}</option>
                {skills.rows.map((s) => (
                  <option key={s.skillId} value={s.skillId}>{s.name}</option>
                ))}
              </select>
              {skills.total > skills.rows.length && (
                <p className="mt-1 text-xs text-muted-foreground" data-testid="self-assessment-skill-more">
                  {t("selfAssessment.moreResults", {
                    shown: skills.rows.length,
                    total: skills.total,
                  })}
                </p>
              )}
              {errors.skillId && (
                <p className="mt-1 text-xs text-danger">{t("selfAssessment.skillRequired")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="declaredProficiency" className="text-sm font-medium text-foreground">{t("selfAssessment.levelLabel")}</label>
              <select
                id="declaredProficiency"
                data-testid="self-assessment-proficiency"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("declaredProficiency")}
              >
                {PROFICIENCY_LEVELS.map((l) => (
                  <option key={l} value={l}>{t(`selfAssessment.levels.${l}`, { defaultValue: l })}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="score" className="text-sm font-medium text-foreground">{t("selfAssessment.scoreLabel")}</label>
              <Input
                id="score"
                type="text"
                data-testid="self-assessment-score"
                placeholder={t("selfAssessment.scorePlaceholder")}
                {...register("score")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="comment" className="text-sm font-medium text-foreground">{t("selfAssessment.commentLabel")}</label>
              <Input id="comment" data-testid="self-assessment-comment" {...register("comment")} />
            </div>

            {create.isError && (
              <p className="text-sm text-danger" data-testid="self-assessment-error">
                {t("selfAssessment.errorSubmit")}
              </p>
            )}
            {create.isSuccess && (
              <p data-testid="self-assessment-success">
                <StatusPill tone="success">{t("selfAssessment.success")}</StatusPill>
              </p>
            )}

            <Button
              type="submit"
              data-testid="self-assessment-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? t("selfAssessment.submitting") : t("selfAssessment.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
