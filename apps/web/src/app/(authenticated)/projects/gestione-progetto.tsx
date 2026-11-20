"use client";

/**
 * Progetti: creare, cambiare stato e avanzamento, aggiungere e togliere chi ci lavora
 * (ondata 2 degli endpoint senza consumatori, 2026-11-17).
 *
 * `POST /v1/projects`, `PATCH /v1/projects/:id`, `PATCH /v1/projects/:id/progress` e
 * `PUT/DELETE /v1/projects/:id/members/:userId` esistevano e nessuna pagina li chiamava. Tutto
 * chiede `project:manage`: chi non l'ha vede le pagine come prima, senza comandi.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { ProjectDetail, ProjectMemberRole, ProjectStatus, User } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { PersonPicker } from "@/components/person-picker";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Liste locali: il web importa TIPI, non valori (stesso ordine di PROJECT_STATUSES e PROJECT_MEMBER_ROLES).
const STATI: readonly ProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const RUOLI: readonly ProjectMemberRole[] = ["LEAD", "MEMBER", "CONTRIBUTOR", "OBSERVER"];

export function usePuoGestireProgetti(): boolean {
  return (useCurrentUserPermissions().data?.permissions ?? []).includes("project:manage");
}

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("projects.gestione.vietato");
    if (err.status === 409) return t("projects.gestione.duplicato");
  }
  return t("projects.gestione.errore");
}

/** Crea un progetto e apre il suo dettaglio. */
export function NuovoProgetto() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [scopo, setScopo] = useState("");
  const crea = useMutation({
    mutationFn: () => apiFetch<{ projectId: string }>("/v1/projects", {
      method: "POST",
      body: { code: codice.trim(), name: nome.trim(), purpose: scopo.trim() || null },
    }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${p.projectId}`);
    },
  });
  if (!usePuoGestireProgetti()) return null;
  return (
    <Card data-testid="project-create">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>{t("projects.gestione.nuovo")}</span>
          <Button type="button" variant="outline" data-testid="project-create-toggle" onClick={() => setAperto((v) => !v)}>
            {aperto ? t("projects.gestione.chiudi") : t("projects.gestione.crea")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-foreground">
          {t("projects.gestione.nome")}
          <Input data-testid="project-create-name" value={nome} maxLength={255} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="text-sm font-medium text-foreground">
          {t("projects.gestione.codice")}
          <Input data-testid="project-create-code" value={codice} maxLength={64} onChange={(e) => setCodice(e.target.value)} />
        </label>
        <label className="text-sm font-medium text-foreground md:col-span-2">
          {t("projects.purpose")}
          <Input data-testid="project-create-purpose" value={scopo} maxLength={4000} onChange={(e) => setScopo(e.target.value)} />
        </label>
        <div className="flex items-center gap-3 md:col-span-2">
          <Button type="button" data-testid="project-create-submit" disabled={!codice.trim() || !nome.trim() || crea.isPending} onClick={() => crea.mutate()}>
            {crea.isPending ? t("common:saving") : t("projects.gestione.crea")}
          </Button>
          {crea.isError && <span data-testid="project-create-error" className="text-sm text-danger">{messaggio(crea.error, t)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Stato e avanzamento del progetto, e l'aggiunta di chi ci lavora. */
export function GestioneProgetto({ progetto }: { progetto: ProjectDetail }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const id = progetto.projectId;
  const [stato, setStato] = useState<ProjectStatus>(progetto.status);
  const [avanzamento, setAvanzamento] = useState(progetto.progressPct === null ? "" : String(progetto.progressPct));
  const [persone, setPersone] = useState<User[]>([]);
  const [ruolo, setRuolo] = useState<ProjectMemberRole>("MEMBER");
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["projects"] });
  const salvaStato = useMutation({
    mutationFn: () => apiFetch(`/v1/projects/${id}`, { method: "PATCH", body: { status: stato } }),
    onSuccess: ricarica,
  });
  const salvaAvanzamento = useMutation({
    mutationFn: () => apiFetch(`/v1/projects/${id}/progress`, { method: "PATCH", body: { progressPct: Number(avanzamento) } }),
    onSuccess: ricarica,
  });
  const aggiungi = useMutation({
    mutationFn: async () => {
      for (const p of persone) await apiFetch(`/v1/projects/${id}/members/${p.userId}`, { method: "PUT", body: { role: ruolo } });
    },
    onSuccess: () => { setPersone([]); ricarica(); },
  });
  const avanzamentoValido = avanzamento.trim() !== "" && Number(avanzamento) >= 0 && Number(avanzamento) <= 100;
  if (!usePuoGestireProgetti()) return null;
  return (
    <Card data-testid="project-manage">
      <CardHeader><CardTitle>{t("projects.gestione.titolo")}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="project-status" className="text-sm font-medium text-foreground">{t("projects.statusLabel")}</label>
          <div className="flex gap-2">
            <select id="project-status" data-testid="project-status-select" className={SELECT_CLASS} value={stato}
              onChange={(e) => setStato(e.target.value as ProjectStatus)}>
              {STATI.map((s) => <option key={s} value={s}>{t(`projects.status.${s}`)}</option>)}
            </select>
            <Button type="button" variant="outline" data-testid="project-status-save" disabled={stato === progetto.status || salvaStato.isPending}
              onClick={() => salvaStato.mutate()}>
              {salvaStato.isPending ? t("common:saving") : t("projects.gestione.salva")}
            </Button>
          </div>
          {salvaStato.isError && <p className="text-sm text-danger">{messaggio(salvaStato.error, t)}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="project-progress" className="text-sm font-medium text-foreground">{t("projects.gestione.avanzamento")}</label>
          <div className="flex gap-2">
            <Input id="project-progress" data-testid="project-progress-input" type="number" min={0} max={100} step="1"
              value={avanzamento} onChange={(e) => setAvanzamento(e.target.value)} />
            <Button type="button" variant="outline" data-testid="project-progress-save"
              disabled={!avanzamentoValido || Number(avanzamento) === progetto.progressPct || salvaAvanzamento.isPending}
              onClick={() => salvaAvanzamento.mutate()}>
              {salvaAvanzamento.isPending ? t("common:saving") : t("projects.gestione.salva")}
            </Button>
          </div>
          {salvaAvanzamento.isError && <p className="text-sm text-danger">{messaggio(salvaAvanzamento.error, t)}</p>}
        </div>
        <div className="space-y-2 md:col-span-2">
          <PersonPicker label={t("projects.gestione.aggiungiPersone")} value={persone} onChange={setPersone} testId="project-member-picker" />
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium text-foreground">
              {t("projects.gestione.ruolo")}
              <select data-testid="project-member-role" className={SELECT_CLASS} value={ruolo} onChange={(e) => setRuolo(e.target.value as ProjectMemberRole)}>
                {RUOLI.map((r) => <option key={r} value={r}>{t(`projects.role.${r}`)}</option>)}
              </select>
            </label>
            <Button type="button" data-testid="project-member-add" disabled={persone.length === 0 || aggiungi.isPending} onClick={() => aggiungi.mutate()}>
              {aggiungi.isPending ? t("common:saving") : t("projects.gestione.aggiungi")}
            </Button>
            {aggiungi.isError && <span className="text-sm text-danger">{messaggio(aggiungi.error, t)}</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Toglie una persona dal progetto, con conferma. */
export function TogliMembro({ projectId, userId }: { projectId: string; userId: string }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const puo = usePuoGestireProgetti();
  const togli = useMutation({
    mutationFn: () => apiFetch(`/v1/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["projects"] }),
  });
  if (!puo) return null;
  return (
    <Button type="button" size="sm" variant="outline" data-testid="project-member-remove" disabled={togli.isPending}
      onClick={() => { if (window.confirm(t("projects.gestione.confermaTogli"))) togli.mutate(); }}>
      {togli.isPending ? t("common:saving") : t("projects.gestione.togli")}
    </Button>
  );
}
