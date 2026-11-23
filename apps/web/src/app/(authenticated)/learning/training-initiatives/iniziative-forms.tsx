"use client";

/**
 * Iniziative di formazione: crearle e correggerle dalla pagina (ondata 2 degli endpoint senza
 * consumatori, 2026-11-17). `POST` e `PATCH /v1/training-initiatives` esistevano e nessuna pagina
 * li chiamava. Il corso si sceglie dal catalogo vivo `/v1/learning-modules`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { LearningModule, TrainingInitiative, TrainingInitiativeStatus } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Lista locale: il web importa TIPI, non valori (stesso ordine di TrainingInitiativeStatusSchema).
const STATI: readonly TrainingInitiativeStatus[] = ["PLANNED", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("training.form.vietato");
    if (err.status === 409) return t("training.form.duplicato");
  }
  return t("training.form.errore");
}

interface Campi { cohortName: string; startDate: string; endDate: string; capacity: string; status: TrainingInitiativeStatus }

function CampiIniziativa({ v, set, prefisso }: { v: Campi; set: (c: Campi) => void; prefisso: string }) {
  const { t } = useTranslation("hr");
  const enumLabel = useEnumLabel();
  return (
    <>
      <label className="text-sm font-medium text-foreground">
        {t("training.cols.cohort")}
        <Input data-testid={`${prefisso}-cohort`} value={v.cohortName} maxLength={255} onChange={(e) => set({ ...v, cohortName: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-foreground">
        {t("training.cols.start")}
        <Input data-testid={`${prefisso}-start`} type="date" value={v.startDate} onChange={(e) => set({ ...v, startDate: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-foreground">
        {t("training.cols.end")}
        <Input data-testid={`${prefisso}-end`} type="date" value={v.endDate} onChange={(e) => set({ ...v, endDate: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-foreground">
        {t("training.cols.seats")}
        <Input data-testid={`${prefisso}-capacity`} type="number" min={0} max={10000} value={v.capacity} onChange={(e) => set({ ...v, capacity: e.target.value })} />
      </label>
      <label className="text-sm font-medium text-foreground">
        {t("training.cols.status")}
        <select data-testid={`${prefisso}-status`} className={SELECT_CLASS} value={v.status} onChange={(e) => set({ ...v, status: e.target.value as TrainingInitiativeStatus })}>
          {STATI.map((s) => <option key={s} value={s}>{enumLabel("trainingInitiativeStatus", s)}</option>)}
        </select>
      </label>
    </>
  );
}

const corpo = (v: Campi) => ({
  cohortName: v.cohortName.trim() || null,
  startDate: v.startDate,
  endDate: v.endDate || null,
  capacity: v.capacity.trim() === "" ? null : Number(v.capacity),
  status: v.status,
});

export function NuovaIniziativa() {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const puo = (useCurrentUserPermissions().data?.permissions ?? []).includes("training_initiative:create");
  const [aperto, setAperto] = useState(false);
  const [cerca, setCerca] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [codice, setCodice] = useState("");
  const [v, setV] = useState<Campi>({ cohortName: "", startDate: "", endDate: "", capacity: "", status: "PLANNED" });
  const moduli = useQuery({
    queryKey: ["learning-modules", "scelta", cerca],
    queryFn: () => apiFetch<{ items: LearningModule[] }>(`/v1/learning-modules?limit=50${cerca.trim() ? `&search=${encodeURIComponent(cerca.trim())}` : ""}`),
    enabled: puo && aperto,
  });
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/training-initiatives", { method: "POST", body: { moduleId, code: codice.trim(), ...corpo(v) } }),
    onSuccess: () => {
      setModuleId(""); setCodice(""); setV({ cohortName: "", startDate: "", endDate: "", capacity: "", status: "PLANNED" });
      void qc.invalidateQueries({ queryKey: ["training-initiatives"] });
    },
  });
  if (!puo) return null;
  return (
    <Card data-testid="training-create">
      <CardHeader>
        <CardTitle as="h2" className="flex items-center justify-between gap-3">
          <span>{t("training.form.nuova")}</span>
          <Button type="button" variant="outline" data-testid="training-create-toggle" onClick={() => setAperto((x) => !x)}>
            {aperto ? t("training.form.chiudi") : t("training.form.crea")}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent hidden={!aperto} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Input data-testid="training-create-module-search" aria-label={t("training.form.cercaCorso")} placeholder={t("training.form.cercaCorso")}
            value={cerca} onChange={(e) => setCerca(e.target.value)} />
          <select data-testid="training-create-module" aria-label={t("training.form.corso")} className={SELECT_CLASS} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="">{moduli.isLoading ? t("common:loading") : t("training.form.scegliCorso")}</option>
            {(moduli.data?.items ?? []).map((m) => <option key={m.learningModuleId} value={m.learningModuleId}>{m.title}</option>)}
          </select>
        </div>
        <label className="text-sm font-medium text-foreground">
          {t("training.form.codice")}
          <Input data-testid="training-create-code" value={codice} maxLength={128} onChange={(e) => setCodice(e.target.value)} />
        </label>
        <CampiIniziativa v={v} set={setV} prefisso="training-create" />
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="button" data-testid="training-create-submit" disabled={!moduleId || !codice.trim() || !v.startDate || crea.isPending} onClick={() => crea.mutate()}>
            {crea.isPending ? t("common:saving") : t("training.form.crea")}
          </Button>
          {crea.isError && <span data-testid="training-create-error" className="text-sm text-danger">{messaggio(crea.error, t)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function usePuoModificareIniziative(): boolean {
  return (useCurrentUserPermissions().data?.permissions ?? []).includes("training_initiative:update");
}

export function ModificaIniziativa({ iniziativa, onChiudi }: { iniziativa: TrainingInitiative; onChiudi: () => void }) {
  const { t } = useTranslation("hr");
  const qc = useQueryClient();
  const [v, setV] = useState<Campi>({
    cohortName: iniziativa.cohortName ?? "",
    startDate: iniziativa.startDate,
    endDate: iniziativa.endDate ?? "",
    capacity: iniziativa.capacity === null ? "" : String(iniziativa.capacity),
    status: iniziativa.status,
  });
  const salva = useMutation({
    mutationFn: () => apiFetch(`/v1/training-initiatives/${iniziativa.trainingInitiativeId}`, { method: "PATCH", body: corpo(v) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["training-initiatives"] }); onChiudi(); },
  });
  return (
    <Card data-testid="training-edit">
      <CardHeader><CardTitle as="h2">{t("training.form.modifica", { nome: iniziativa.cohortName ?? t("training.cohortNd") })}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CampiIniziativa v={v} set={setV} prefisso="training-edit" />
        <div className="flex items-center gap-3 md:col-span-3">
          <Button type="button" data-testid="training-edit-submit" disabled={!v.startDate || salva.isPending} onClick={() => salva.mutate()}>
            {salva.isPending ? t("common:saving") : t("training.form.salva")}
          </Button>
          <Button type="button" variant="outline" data-testid="training-edit-cancel" onClick={onChiudi}>{t("training.form.annulla")}</Button>
          {salva.isError && <span data-testid="training-edit-error" className="text-sm text-danger">{messaggio(salva.error, t)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
