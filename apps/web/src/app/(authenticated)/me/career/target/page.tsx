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
          ← La mia carriera
        </Link>
        <PageHeader
          data-testid="career-target-title"
          title="Dichiara obiettivo di carriera"
          description="Seleziona la posizione che desideri raggiungere; la richiesta sarà revisionata dal tuo manager."
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Nuova posizione target</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => { void onSubmit(e); }}
            className="space-y-4"
            data-testid="career-target-form"
          >
            <div className="space-y-1.5">
              <label htmlFor="filter" className="text-sm font-medium text-foreground">Cerca posizione</label>
              <Input
                id="filter"
                data-testid="career-target-filter"
                placeholder="Digita per filtrare…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="positionId" className="text-sm font-medium text-foreground">Posizione</label>
              <select
                id="positionId"
                data-testid="career-target-position"
                className="w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register("positionId")}
              >
                <option value="">— Seleziona —</option>
                {filtered.slice(0, 50).map((p) => (
                  <option key={p.positionId} value={p.positionId}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
              {errors.positionId && (
                <p className="mt-1 text-xs text-danger">Posizione richiesta.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="targetDate" className="text-sm font-medium text-foreground">Data target (YYYY-MM-DD)</label>
              <Input
                id="targetDate"
                data-testid="career-target-date"
                placeholder="es. 2027-12-31"
                {...register("targetDate")}
              />
              {errors.targetDate && (
                <p className="mt-1 text-xs text-danger">Formato data non valido.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="notes" className="text-sm font-medium text-foreground">Note</label>
              <Input id="notes" data-testid="career-target-notes" {...register("notes")} />
            </div>

            {create.isError && (
              <p className="text-sm text-danger" data-testid="career-target-error">
                Errore durante l&apos;invio.
              </p>
            )}
            {create.isSuccess && (
              <p data-testid="career-target-success">
                <StatusPill tone="success">
                  Obiettivo registrato. Sarà revisionato dal tuo manager.
                </StatusPill>
              </p>
            )}

            <Button
              type="submit"
              data-testid="career-target-submit"
              disabled={isSubmitting || create.isPending}
            >
              {create.isPending ? "Invio…" : "Invia richiesta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
