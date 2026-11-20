"use client";

/**
 * Riscontri sul clima e piani d'azione (ondata 3 degli endpoint senza consumatori, 2026-11-17).
 * `POST/PATCH /v1/engagement-feedback` e `POST/PATCH /v1/engagement-feedback/action-plans`
 * esistevano e nessuna pagina li chiamava: un riscontro ricevuto non si poteva registrare né
 * prendere in carico, e un piano d'azione non nasceva da niente. Permessi `engagement_feedback:*`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CATEGORIE = ["concern", "recognition", "suggestion", "other"] as const;
const STATI_RISCONTRO = ["new", "reviewed", "actioned", "archived"] as const;
const STATI_PIANO = ["planned", "in_progress", "completed"] as const;
const PRIORITA = ["low", "medium", "high", "critical"] as const;

interface Riscontro { feedbackId: string; category: string; message: string; status: string; actionNotes: string | null; createdAt: string }
interface Piano { actionPlanId: string; title: string; status: string; priority: string; dueDate: string | null; sourceType: string; sourceId: string | null }

function usePermessi() {
  const p = useCurrentUserPermissions().data?.permissions ?? [];
  return { legge: p.includes("engagement_feedback:read"), crea: p.includes("engagement_feedback:create"), modifica: p.includes("engagement_feedback:update") };
}

export function RiscontriEPiani() {
  const { t } = useTranslation("admin");
  const fmt = useFormat();
  const qc = useQueryClient();
  const perm = usePermessi();
  const [filtro, setFiltro] = useState<string>("new");
  const [nuovo, setNuovo] = useState({ category: "other" as string, message: "" });
  const [piano, setPiano] = useState({ title: "", priority: "medium", dueDate: "", sourceId: "" });
  const riscontri = useQuery({
    queryKey: ["engagement-feedback", filtro],
    queryFn: () => apiFetch<{ items: Riscontro[]; total: number }>(`/v1/engagement-feedback?limit=50${filtro ? `&status=${filtro}` : ""}`),
    enabled: perm.legge,
  });
  const piani = useQuery({
    queryKey: ["engagement-action-plans"],
    queryFn: () => apiFetch<{ items: Piano[]; total: number }>("/v1/engagement-feedback/action-plans?limit=100"),
    enabled: perm.legge,
  });
  const ricarica = () => { void qc.invalidateQueries({ queryKey: ["engagement-feedback"] }); void qc.invalidateQueries({ queryKey: ["engagement-action-plans"] }); };
  const registra = useMutation({
    mutationFn: () => apiFetch("/v1/engagement-feedback", { method: "POST", body: { category: nuovo.category, message: nuovo.message.trim() } }),
    onSuccess: () => { setNuovo({ category: "other", message: "" }); ricarica(); },
  });
  const statoRiscontro = useMutation({
    mutationFn: (v: { id: string; status: string }) => apiFetch(`/v1/engagement-feedback/${v.id}`, {
      method: "PATCH", body: { status: v.status, ...(v.status !== "new" ? { reviewedAt: new Date().toISOString() } : {}) },
    }),
    onSuccess: ricarica,
  });
  const creaPiano = useMutation({
    mutationFn: () => apiFetch("/v1/engagement-feedback/action-plans", {
      method: "POST",
      body: { title: piano.title.trim(), priority: piano.priority, dueDate: piano.dueDate || null, sourceType: "feedback", sourceId: piano.sourceId || null },
    }),
    onSuccess: () => { setPiano({ title: "", priority: "medium", dueDate: "", sourceId: "" }); ricarica(); },
  });
  const statoPiano = useMutation({
    mutationFn: (v: { id: string; status: string }) => apiFetch(`/v1/engagement-feedback/action-plans/${v.id}`, {
      method: "PATCH", body: { status: v.status, completedAt: v.status === "completed" ? new Date().toISOString() : null },
    }),
    onSuccess: ricarica,
  });
  if (!perm.legge) return null;
  const errore = registra.error ?? statoRiscontro.error ?? creaPiano.error ?? statoPiano.error;
  return (
    <Card data-testid="engagement-feedback">
      <CardHeader><CardTitle>{t("engagement.riscontri.titolo")}</CardTitle></CardHeader>
      <CardContent className="space-y-6 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-56 font-medium text-foreground">{t("engagement.riscontri.mostra")}
            <select className={SELECT_CLASS} value={filtro} onChange={(e) => setFiltro(e.target.value)} data-testid="engagement-feedback-filter">
              <option value="">{t("engagement.riscontri.tutti")}</option>
              {STATI_RISCONTRO.map((s) => <option key={s} value={s}>{t(`engagement.riscontri.stato.${s}`)}</option>)}
            </select></label>
          <span className="text-xs text-muted-foreground" data-testid="engagement-feedback-count">
            {riscontri.data ? t("engagement.riscontri.conteggio", { mostrati: riscontri.data.items.length, totale: riscontri.data.total }) : t("common:loading")}
          </span>
        </div>
        <ul className="divide-y divide-border rounded-card border border-border">
          {(riscontri.data?.items ?? []).map((r) => (
            <li key={r.feedbackId} data-testid="engagement-feedback-row" className="flex flex-wrap items-start justify-between gap-3 px-4 py-2">
              <span className="max-w-2xl">
                <Badge variant="outline">{t(`engagement.riscontri.categoria.${r.category}`)}</Badge>{" "}
                <span>{r.message}</span>
                <span className="block text-xs text-muted-foreground">{fmt.data(r.createdAt)}</span>
              </span>
              {perm.modifica ? (
                <select aria-label={t("engagement.riscontri.statoDi")} className={`${SELECT_CLASS} w-44`} value={r.status} disabled={statoRiscontro.isPending}
                  onChange={(e) => statoRiscontro.mutate({ id: r.feedbackId, status: e.target.value })} data-testid="engagement-feedback-status">
                  {STATI_RISCONTRO.map((s) => <option key={s} value={s}>{t(`engagement.riscontri.stato.${s}`)}</option>)}
                </select>
              ) : <Badge variant="secondary">{t(`engagement.riscontri.stato.${r.status}`)}</Badge>}
            </li>
          ))}
          {(riscontri.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("engagement.riscontri.nessuno")}</li>}
        </ul>
        {perm.crea && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4" data-testid="engagement-feedback-create">
            <label className="font-medium text-foreground">{t("engagement.riscontri.categoriaLabel")}
              <select className={SELECT_CLASS} value={nuovo.category} onChange={(e) => setNuovo({ ...nuovo, category: e.target.value })} data-testid="engagement-feedback-create-category">
                {CATEGORIE.map((c) => <option key={c} value={c}>{t(`engagement.riscontri.categoria.${c}`)}</option>)}
              </select></label>
            <label className="font-medium text-foreground md:col-span-2">{t("engagement.riscontri.messaggio")}
              <Input value={nuovo.message} onChange={(e) => setNuovo({ ...nuovo, message: e.target.value })} data-testid="engagement-feedback-create-message" /></label>
            <div className="flex items-end">
              <Button type="button" data-testid="engagement-feedback-create-submit" disabled={!nuovo.message.trim() || registra.isPending} onClick={() => registra.mutate()}>
                {registra.isPending ? t("common:saving") : t("engagement.riscontri.registra")}
              </Button>
            </div>
          </div>
        )}

        <h3 className="text-sm font-semibold text-foreground">{t("engagement.piani.titolo")}</h3>
        <ul className="divide-y divide-border rounded-card border border-border">
          {(piani.data?.items ?? []).map((p) => (
            <li key={p.actionPlanId} data-testid="engagement-plan-row" className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
              <span>
                <span className="font-medium">{p.title}</span>
                <span className="text-xs text-muted-foreground"> · {t(`engagement.piani.priorita.${p.priority}`)}{p.dueDate ? ` · ${t("engagement.piani.entro", { data: fmt.data(p.dueDate) })}` : ""}</span>
              </span>
              {perm.modifica ? (
                <select aria-label={t("engagement.piani.statoDi")} className={`${SELECT_CLASS} w-44`} value={p.status} disabled={statoPiano.isPending}
                  onChange={(e) => statoPiano.mutate({ id: p.actionPlanId, status: e.target.value })} data-testid="engagement-plan-status">
                  {STATI_PIANO.map((s) => <option key={s} value={s}>{t(`engagement.piani.stato.${s}`)}</option>)}
                </select>
              ) : <Badge variant="secondary">{t(`engagement.piani.stato.${p.status}`)}</Badge>}
            </li>
          ))}
          {(piani.data?.items ?? []).length === 0 && <li className="px-4 py-2 text-muted-foreground">{t("engagement.piani.nessuno")}</li>}
        </ul>
        {perm.crea && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5" data-testid="engagement-plan-create">
            <label className="font-medium text-foreground md:col-span-2">{t("engagement.piani.titoloLabel")}
              <Input value={piano.title} maxLength={255} onChange={(e) => setPiano({ ...piano, title: e.target.value })} data-testid="engagement-plan-create-title" /></label>
            <label className="font-medium text-foreground">{t("engagement.piani.prioritaLabel")}
              <select className={SELECT_CLASS} value={piano.priority} onChange={(e) => setPiano({ ...piano, priority: e.target.value })} data-testid="engagement-plan-create-priority">
                {PRIORITA.map((p) => <option key={p} value={p}>{t(`engagement.piani.priorita.${p}`)}</option>)}
              </select></label>
            <label className="font-medium text-foreground">{t("engagement.piani.scadenza")}
              <Input type="date" value={piano.dueDate} onChange={(e) => setPiano({ ...piano, dueDate: e.target.value })} data-testid="engagement-plan-create-due" /></label>
            <label className="font-medium text-foreground">{t("engagement.piani.daRiscontro")}
              <select className={SELECT_CLASS} value={piano.sourceId} onChange={(e) => setPiano({ ...piano, sourceId: e.target.value })} data-testid="engagement-plan-create-source">
                <option value="">{t("engagement.piani.nessunRiscontro")}</option>
                {(riscontri.data?.items ?? []).map((r) => <option key={r.feedbackId} value={r.feedbackId}>{r.message.slice(0, 60)}</option>)}
              </select></label>
            <div className="md:col-span-5">
              <Button type="button" data-testid="engagement-plan-create-submit" disabled={!piano.title.trim() || creaPiano.isPending} onClick={() => creaPiano.mutate()}>
                {creaPiano.isPending ? t("common:saving") : t("engagement.piani.crea")}
              </Button>
            </div>
          </div>
        )}
        {errore && <p className="text-danger">{t("engagement.riscontri.errore")}</p>}
      </CardContent>
    </Card>
  );
}
