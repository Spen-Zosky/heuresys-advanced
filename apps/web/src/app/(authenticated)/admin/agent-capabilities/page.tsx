"use client";

/**
 * /admin/agent-capabilities — che cosa l'agente può fare, e con quale libertà (ondata 3 degli endpoint
 * senza consumatori, 2026-11-17). Il registro `/v1/agent-capabilities` aveva elenco, creazione,
 * operazioni, pubblicazione, ritiro e decisione del modo, e nessuna pagina: si entra dalla scheda
 * «Capacità dell'agente» accanto a Ruoli e permessi, perché sono i permessi dell'agente.
 *
 * Il modo «libero» (l'agente agisce senza chiedere conferma) si decide per tenant con una ragione
 * scritta; senza decisione vale «con conferma». L'API rifiuta le regole che non tornano
 * (AGENT_CAPABILITY_RULE, PLATFORM_ONLY_CONFERMA) e la pagina lo dice con il suo motivo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { AgentCapability } from "@heuresys/shared";

interface AgentCapabilityListResponse { items: AgentCapability[] }
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { StatoCaricamento, StatoErrore, StatoNegato, StatoVuoto } from "@/components/stato-pagina";

const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const METODI = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const CLASSI = ["A", "B", "C"] as const;
const ANNULLAMENTI = ["GIORNALE_UNDO", "RIGA_SOSTITUTIVA"] as const;

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("agentCaps.vietato");
    if (err.status === 409) return t("agentCaps.duplicata");
    if (err.serverMessage) return `${t("agentCaps.rifiutata")}: ${err.serverMessage}`;
  }
  return t("agentCaps.errore");
}

function Capacita({ c }: { c: AgentCapability }) {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const gestisce = perms.includes("agent_capability:manage");
  const decide = perms.includes("agent_capability:activate");
  const [aperta, setAperta] = useState(false);
  const [op, setOp] = useState({ conceptId: "", operationId: "", httpMethod: "POST" as string, actionClass: "B" as string });
  const [modo, setModo] = useState({ mode: c.activation?.mode ?? "CONFERMA", reason: "" });
  const ricarica = () => void qc.invalidateQueries({ queryKey: ["agent-capabilities"] });
  const azione = useMutation({
    mutationFn: (v: { path: string; body: unknown }) => apiFetch(`/v1/agent-capabilities/${c.id}/${v.path}`, { method: "POST", body: v.body }),
    onSuccess: ricarica,
  });
  return (
    <li data-testid="agent-capability-row" className="space-y-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-medium">{c.description}</span>
          <span className="block font-mono text-xs text-muted-foreground">{t("agentCaps.identita", { codice: c.code, versione: c.version, agente: c.agentCode })}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={(c.activation?.mode ?? "CONFERMA") === "LIBERA" ? "warning" : "secondary"} data-testid="agent-capability-mode">
            {t(`agentCaps.modi.${c.activation?.mode ?? "CONFERMA"}`)}
          </Badge>
          <Button type="button" size="sm" variant="outline" data-testid="agent-capability-open" onClick={() => setAperta((x) => !x)}>
            {aperta ? t("agentCaps.chiudi") : t("agentCaps.dettagli")}
          </Button>
          <Badge variant={c.status === "PUBBLICATA" ? "success" : "secondary"} data-testid="agent-capability-status">{t(`agentCaps.stati.${c.status}`)}</Badge>
        </span>
      </div>
      {aperta && (
        <div className="space-y-3 text-sm" data-testid="agent-capability-detail">
          <p className="text-xs text-muted-foreground">{t("agentCaps.limiti", { volume: c.volumeCap, annullamento: t(`agentCaps.annullamenti.${c.undoMechanism}`) })}</p>
          <ul className="space-y-1 font-mono text-xs">
            {c.operations.map((o) => <li key={o.id}>{o.httpMethod} {o.operationId} · {t("agentCaps.classe", { classe: o.actionClass })}</li>)}
            {c.operations.length === 0 && <li className="font-sans text-muted-foreground">{t("agentCaps.nessunaOperazione")}</li>}
          </ul>
          {gestisce && c.status === "BOZZA" && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5" data-testid="agent-capability-add-operation">
              <Input aria-label={t("agentCaps.concetto")} placeholder={t("agentCaps.concetto")} value={op.conceptId} onChange={(e) => setOp({ ...op, conceptId: e.target.value })} />
              <Input aria-label={t("agentCaps.operazione")} placeholder={t("agentCaps.operazione")} value={op.operationId} onChange={(e) => setOp({ ...op, operationId: e.target.value })} />
              <select aria-label={t("agentCaps.metodo")} className={SELECT_CLASS} value={op.httpMethod} onChange={(e) => setOp({ ...op, httpMethod: e.target.value })}>
                {METODI.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select aria-label={t("agentCaps.classeLabel")} className={SELECT_CLASS} value={op.actionClass} onChange={(e) => setOp({ ...op, actionClass: e.target.value })}>
                {CLASSI.map((k) => <option key={k} value={k}>{t("agentCaps.classe", { classe: k })}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={!op.conceptId.trim() || !op.operationId.trim() || azione.isPending}
                onClick={() => azione.mutate({ path: "operations", body: op })}>{t("agentCaps.aggiungiOperazione")}</Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {gestisce && c.status === "BOZZA" && (
              <Button type="button" data-testid="agent-capability-publish" disabled={c.operations.length === 0 || azione.isPending}
                onClick={() => { if (window.confirm(t("agentCaps.confermaPubblica"))) azione.mutate({ path: "publish", body: {} }); }}>{t("agentCaps.pubblica")}</Button>
            )}
            {gestisce && c.status === "PUBBLICATA" && (
              <Button type="button" variant="outline" data-testid="agent-capability-retire" disabled={azione.isPending}
                onClick={() => { if (window.confirm(t("agentCaps.confermaRitira"))) azione.mutate({ path: "retire", body: {} }); }}>{t("agentCaps.ritira")}</Button>
            )}
          </div>
          {decide && c.status === "PUBBLICATA" && (
            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3" data-testid="agent-capability-decide">
              <label className="w-48 font-medium text-foreground">{t("agentCaps.modo")}
                <select className={SELECT_CLASS} value={modo.mode} onChange={(e) => setModo({ ...modo, mode: e.target.value as "CONFERMA" | "LIBERA" })} data-testid="agent-capability-mode-select">
                  <option value="CONFERMA">{t("agentCaps.modi.CONFERMA")}</option>
                  <option value="LIBERA">{t("agentCaps.modi.LIBERA")}</option>
                </select></label>
              <label className="min-w-72 flex-1 font-medium text-foreground">{t("agentCaps.ragione")}
                <Input value={modo.reason} maxLength={2000} onChange={(e) => setModo({ ...modo, reason: e.target.value })} data-testid="agent-capability-mode-reason" /></label>
              <Button type="button" data-testid="agent-capability-mode-save" disabled={modo.reason.trim().length < 3 || azione.isPending}
                onClick={() => azione.mutate({ path: "mode", body: { mode: modo.mode, reason: modo.reason.trim() } })}>{t("agentCaps.decidi")}</Button>
            </div>
          )}
          {azione.isError && <p className="text-danger" data-testid="agent-capability-error">{messaggio(azione.error, t)}</p>}
        </div>
      )}
    </li>
  );
}

export default function AgentCapabilitiesPage() {
  const { t } = useTranslation("admin");
  const qc = useQueryClient();
  const permessi = useCurrentUserPermissions();
  const perms = permessi.data?.permissions ?? [];
  const puoLeggere = perms.includes("agent_capability:read");
  const [nuova, setNuova] = useState({ code: "", agentCode: "", description: "", undoMechanism: "GIORNALE_UNDO" as string, undoRef: "", volumeCap: "50" });
  const elenco = useQuery({ queryKey: ["agent-capabilities"], queryFn: () => apiFetch<AgentCapabilityListResponse>("/v1/agent-capabilities"), enabled: puoLeggere });
  const crea = useMutation({
    mutationFn: () => apiFetch("/v1/agent-capabilities", {
      method: "POST",
      body: { code: nuova.code.trim(), agentCode: nuova.agentCode.trim(), description: nuova.description.trim(), undoMechanism: nuova.undoMechanism, undoRef: nuova.undoRef.trim(), volumeCap: Number(nuova.volumeCap) },
    }),
    onSuccess: () => { setNuova({ code: "", agentCode: "", description: "", undoMechanism: "GIORNALE_UNDO", undoRef: "", volumeCap: "50" }); void qc.invalidateQueries({ queryKey: ["agent-capabilities"] }); },
  });
  const codiceValido = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(nuova.code.trim());
  // Il registro è di chi ha agent_capability:read: agli altri la pagina lo dice, senza una chiamata che tornerebbe 403.
  if (permessi.isLoading) return <main className="mx-auto max-w-7xl px-6 pb-8"><StatoCaricamento /></main>;
  if (!puoLeggere) {
    return (
      <main data-testid="agent-capabilities-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
        <PageHeader title={t("agentCaps.titolo")} description={t("agentCaps.descrizione")} />
        <StatoNegato motivo={t("agentCaps.negato")} />
      </main>
    );
  }
  return (
    <main data-testid="agent-capabilities-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("agentCaps.titolo")} description={t("agentCaps.descrizione")} />
      <Card>
        <CardHeader><CardTitle as="h2">{t("agentCaps.elenco", { count: elenco.data?.items.length ?? 0 })}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {elenco.isLoading ? <StatoCaricamento /> : elenco.isError ? (
            <StatoErrore errore={elenco.error} titolo={t("agentCaps.erroreCarica")} onRiprova={() => void elenco.refetch()} />
          ) : (elenco.data?.items ?? []).length === 0 ? <StatoVuoto titolo={t("agentCaps.nessuna")} /> : (
            <ul className="divide-y divide-border">{(elenco.data?.items ?? []).map((c) => <Capacita key={c.id} c={c} />)}</ul>
          )}
        </CardContent>
      </Card>
      {perms.includes("agent_capability:manage") && (
        <Card data-testid="agent-capability-create">
          <CardHeader><CardTitle as="h2">{t("agentCaps.nuova")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <label className="font-medium text-foreground">{t("agentCaps.codice")}
              <Input value={nuova.code} maxLength={100} placeholder="persone.aggiorna_sede" onChange={(e) => setNuova({ ...nuova, code: e.target.value })} aria-invalid={!!nuova.code && !codiceValido} /></label>
            <label className="font-medium text-foreground">{t("agentCaps.agente")}
              <Input value={nuova.agentCode} maxLength={64} onChange={(e) => setNuova({ ...nuova, agentCode: e.target.value })} /></label>
            <label className="font-medium text-foreground">{t("agentCaps.volume")}
              <Input type="number" min={1} max={10000} value={nuova.volumeCap} onChange={(e) => setNuova({ ...nuova, volumeCap: e.target.value })} /></label>
            <label className="font-medium text-foreground md:col-span-3">{t("agentCaps.descrizioneLabel")}
              <Input value={nuova.description} maxLength={2000} onChange={(e) => setNuova({ ...nuova, description: e.target.value })} /></label>
            <label className="font-medium text-foreground">{t("agentCaps.annullamento")}
              <select className={SELECT_CLASS} value={nuova.undoMechanism} onChange={(e) => setNuova({ ...nuova, undoMechanism: e.target.value })}>
                {ANNULLAMENTI.map((a) => <option key={a} value={a}>{t(`agentCaps.annullamenti.${a}`)}</option>)}
              </select></label>
            <label className="font-medium text-foreground md:col-span-2">{t("agentCaps.riferimentoAnnullamento")}
              <Input value={nuova.undoRef} maxLength={300} onChange={(e) => setNuova({ ...nuova, undoRef: e.target.value })} /></label>
            <div className="md:col-span-3">
              <Button type="button" data-testid="agent-capability-create-submit"
                disabled={!codiceValido || !nuova.agentCode.trim() || !nuova.description.trim() || !nuova.undoRef.trim() || crea.isPending} onClick={() => crea.mutate()}>
                {crea.isPending ? t("common:saving") : t("agentCaps.creaBozza")}
              </Button>
              {crea.isError && <span className="ml-3 text-danger">{messaggio(crea.error, t)}</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
