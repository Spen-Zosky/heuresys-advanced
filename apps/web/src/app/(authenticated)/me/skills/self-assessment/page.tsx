"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader } from "@heuresys/ui";
import { StatusPill } from "@/components/status-pill";
import { apiFetch } from "../../../../../lib/api/fetch";

interface Skill {
  skillId: string;
  code: string;
  name: string;
  isGlobal: boolean;
}

const SelfAssessmentSchema = z.object({
  skillId: z.string().uuid(),
  declaredProficiency: z.string().min(1).max(32),
  score: z.string().regex(/^$|^\d+(\.\d+)?$/).optional(),
  comment: z.string().max(4096).optional(),
});
type SelfAssessmentValues = z.infer<typeof SelfAssessmentSchema>;

const PROFICIENCY_LEVELS = ["NOVICE", "ADVANCED_BEGINNER", "COMPETENT", "PROFICIENT", "EXPERT"];

export default function MeSelfAssessmentPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const skills = useQuery({
    queryKey: ["skills", "list", "all"],
    queryFn: () => apiFetch<{ items: Skill[]; total: number }>("/v1/skills?limit=200"),
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

  const filteredSkills = (skills.data?.items ?? []).filter(
    (s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.code.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <main data-testid="self-assessment-page" className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <Link
          href="/me/skills"
          data-testid="self-assessment-back"
          className="inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Le mie skill
        </Link>
        <PageHeader
          data-testid="self-assessment-title"
          title="Auto-valutazione skill"
          description="Dichiara il tuo livello di competenza su una skill; la valutazione sarà revisionata dal tuo manager."
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Nuova dichiarazione</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="self-assessment-form"
          >
            <div className="space-y-1.5">
              <label htmlFor="filter" className="text-sm font-medium text-foreground">Cerca skill</label>
              <Input
                id="filter"
                data-testid="self-assessment-filter"
                placeholder="Digita per filtrare…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="skillId" className="text-sm font-medium text-foreground">Skill</label>
              <select
                id="skillId"
                data-testid="self-assessment-skill"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("skillId")}
              >
                <option value="">— Seleziona —</option>
                {filteredSkills.slice(0, 50).map((s) => (
                  <option key={s.skillId} value={s.skillId}>{s.code} — {s.name}</option>
                ))}
              </select>
              {errors.skillId && (
                <p className="mt-1 text-xs text-danger">Skill richiesta.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="declaredProficiency" className="text-sm font-medium text-foreground">Livello</label>
              <select
                id="declaredProficiency"
                data-testid="self-assessment-proficiency"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("declaredProficiency")}
              >
                {PROFICIENCY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="score" className="text-sm font-medium text-foreground">Punteggio (0-100, opzionale)</label>
              <Input
                id="score"
                type="text"
                data-testid="self-assessment-score"
                placeholder="es. 80"
                {...register("score")}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="comment" className="text-sm font-medium text-foreground">Commento</label>
              <Input id="comment" data-testid="self-assessment-comment" {...register("comment")} />
            </div>

            {create.isError && (
              <p className="text-sm text-danger" data-testid="self-assessment-error">
                Errore durante l&apos;invio.
              </p>
            )}
            {create.isSuccess && (
              <p data-testid="self-assessment-success">
                <StatusPill tone="success">Auto-valutazione registrata.</StatusPill>
              </p>
            )}

            <Button
              type="submit"
              data-testid="self-assessment-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? "Invio…" : "Invia auto-valutazione"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
