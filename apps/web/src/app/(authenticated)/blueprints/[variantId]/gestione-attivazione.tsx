"use client";

/**
 * Lo stato di un'attivazione e gli scostamenti di un cliente dal modello si decidono dalla scheda
 * della variante (ondata 4a degli endpoint senza consumatori, 2026-11-18): `PATCH` e `DELETE
 * /v1/blueprint-activations/:id`, `PUT /v1/blueprint-overrides` e `DELETE /v1/blueprint-overrides/:id`
 * esistevano e nessuna pagina li chiamava.
 *
 * Ritirare un'attivazione è un cambio di stato (RETIRED), che si disfa. La cancellazione fisica
 * c'è solo per un'attivazione mai partita (PROPOSED): una proposta sbagliata si toglie, una storia
 * no. Togliere uno scostamento riporta il processo a ciò che dice il modello.
 * Comandi solo con `blueprint:activate`, `blueprint:override` e `blueprint:delete`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@heuresys/ui";
import type { BlueprintActivation, BlueprintActivationStatus, BlueprintOverride, BlueprintOverrideInclusion, BlueprintProcess } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useEnumLabel } from "@/lib/enum-labels";

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STATI: readonly BlueprintActivationStatus[] = ["PROPOSED", "ACTIVE", "SUSPENDED", "RETIRED"];
const INCLUSIONI: readonly BlueprintOverrideInclusion[] = ["IN", "PARTIAL", "OUT"];

function usePuo() {
  const perm = useCurrentUserPermissions().data?.permissions ?? [];
  return {
    attiva: perm.includes("blueprint:activate"),
    scosta: perm.includes("blueprint:override"),
    cancella: perm.includes("blueprint:delete"),
  };
}

/** Lo stato dell'attivazione, nella sua riga: un selettore e il pulsante per registrarlo. */
export function StatoAttivazione({ attivazione }: { attivazione: BlueprintActivation }) {
  const { t } = useTranslation("blueprints");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const puo = usePuo();
  const [stato, setStato] = useState<BlueprintActivationStatus>(attivazione.status);
  const salva = useMutation({
    mutationFn: () => apiFetch<BlueprintActivation>(`/v1/blueprint-activations/${attivazione.blueprintActivationId}`, {
      method: "PATCH", body: { status: stato },
    }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["blueprint-activations"] }),
  });
  const togli = useMutation({
    mutationFn: () => apiFetch<null>(`/v1/blueprint-activations/${attivazione.blueprintActivationId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["blueprint-activations"] }),
  });
  if (!puo.attiva) return <span className="text-xs text-muted-foreground">{enumLabel("blueprintActivationStatus", attivazione.status)}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={SELECT_CLASS} value={stato} aria-label={t("gestione.stato")}
        onChange={(e) => setStato(e.target.value as BlueprintActivationStatus)} data-testid="activation-status-select">
        {STATI.map((s) => <option key={s} value={s}>{enumLabel("blueprintActivationStatus", s)}</option>)}
      </select>
      <Button type="button" size="sm" data-testid="activation-status-save" disabled={stato === attivazione.status || salva.isPending}
        onClick={() => { if (window.confirm(t("gestione.confermaStato", { stato: enumLabel("blueprintActivationStatus", stato) }))) salva.mutate(); }}>
        {salva.isPending ? t("common:saving") : t("gestione.salvaStato")}
      </Button>
      {puo.cancella && attivazione.status === "PROPOSED" && (
        <Button type="button" size="sm" variant="outline" data-testid="activation-delete" disabled={togli.isPending}
          onClick={() => { if (window.confirm(t("gestione.confermaTogli"))) togli.mutate(); }}>
          {togli.isPending ? t("gestione.inCorso") : t("gestione.togliProposta")}
        </Button>
      )}
      {(salva.isError || togli.isError) && <span data-testid="activation-error" className="text-xs text-danger">{t("gestione.errore")}</span>}
    </div>
  );
}

/** Gli scostamenti di un'attivazione dal modello: un processo per riga, con la sua inclusione. */
export function ScostamentiAttivazione({ attivazione, variantId }: { attivazione: BlueprintActivation; variantId: string }) {
  const { t } = useTranslation("blueprints");
  const enumLabel = useEnumLabel();
  const qc = useQueryClient();
  const puo = usePuo();
  const processi = useQuery({
    queryKey: ["blueprint-processes", variantId, "tutti"],
    queryFn: () => apiFetch<{ items: BlueprintProcess[]; total: number }>(`/v1/blueprint-processes?variantId=${variantId}&limit=500`),
  });
  const scostamenti = useQuery({
    queryKey: ["blueprint-overrides", attivazione.blueprintActivationId],
    queryFn: () => apiFetch<{ items: BlueprintOverride[]; total: number }>(`/v1/blueprint-overrides?activationId=${attivazione.blueprintActivationId}&limit=500`),
  });
  const [scelta, setScelta] = useState<{ processId: string; inclusion: BlueprintOverrideInclusion; rationale: string }>({ processId: "", inclusion: "OUT", rationale: "" });
  const aggiorna = () => void qc.invalidateQueries({ queryKey: ["blueprint-overrides", attivazione.blueprintActivationId] });
  const registra = useMutation({
    mutationFn: () => apiFetch<BlueprintOverride>("/v1/blueprint-overrides", {
      method: "PUT",
      body: { activationId: attivazione.blueprintActivationId, processId: scelta.processId, inclusion: scelta.inclusion, rationale: scelta.rationale.trim() || null },
    }),
    onSuccess: () => { setScelta({ processId: "", inclusion: "OUT", rationale: "" }); aggiorna(); },
  });
  const togli = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/v1/blueprint-overrides/${id}`, { method: "DELETE" }),
    onSuccess: aggiorna,
  });
  const nomeDi = new Map((processi.data?.items ?? []).map((p) => [p.blueprintProcessId, p.name]));
  const righe = scostamenti.data?.items ?? [];
  return (
    <div className="space-y-2 px-4 py-3" data-testid="activation-overrides" data-activation-id={attivazione.blueprintActivationId}>
      <p className="text-xs text-muted-foreground" data-testid="activation-overrides-count">{t("gestione.scostamentiConto", { count: righe.length })}</p>
      {righe.length > 0 && (
        <ul className="space-y-1 text-sm">
          {righe.map((o) => (
            <li key={o.blueprintOverrideId} className="flex flex-wrap items-center gap-2" data-testid="activation-override-row" data-process-id={o.processId}>
              <span className="font-medium text-foreground">{nomeDi.get(o.processId) ?? t("gestione.processoSconosciuto")}</span>
              <span className="text-muted-foreground">{enumLabel("blueprintOverrideInclusion", o.inclusion)}</span>
              {o.rationale && <span className="text-xs text-muted-foreground">· {o.rationale}</span>}
              {puo.cancella && (
                <Button type="button" size="sm" variant="ghost" data-testid="activation-override-remove" disabled={togli.isPending}
                  onClick={() => { if (window.confirm(t("gestione.confermaTogliScostamento"))) togli.mutate(o.blueprintOverrideId); }}>
                  {t("gestione.togliScostamento")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {puo.scosta && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-foreground">{t("gestione.processo")}
            <select className={`${SELECT_CLASS} block`} value={scelta.processId} onChange={(e) => setScelta({ ...scelta, processId: e.target.value })} data-testid="activation-override-process">
              <option value="">{t("gestione.scegliProcesso")}</option>
              {(processi.data?.items ?? []).map((p) => <option key={p.blueprintProcessId} value={p.blueprintProcessId}>{p.name}</option>)}
            </select></label>
          <label className="text-xs font-medium text-foreground">{t("gestione.inclusione")}
            <select className={`${SELECT_CLASS} block`} value={scelta.inclusion} onChange={(e) => setScelta({ ...scelta, inclusion: e.target.value as BlueprintOverrideInclusion })} data-testid="activation-override-inclusion">
              {INCLUSIONI.map((i) => <option key={i} value={i}>{enumLabel("blueprintOverrideInclusion", i)}</option>)}
            </select></label>
          <label className="text-xs font-medium text-foreground">{t("gestione.motivo")}
            <Input value={scelta.rationale} maxLength={500} onChange={(e) => setScelta({ ...scelta, rationale: e.target.value })} data-testid="activation-override-rationale" /></label>
          <Button type="button" size="sm" data-testid="activation-override-save" disabled={!scelta.processId || registra.isPending} onClick={() => registra.mutate()}>
            {registra.isPending ? t("common:saving") : t("gestione.registraScostamento")}
          </Button>
          {(registra.isError || togli.isError) && <span data-testid="activation-override-error" className="text-xs text-danger">{t("gestione.errore")}</span>}
        </div>
      )}
    </div>
  );
}
