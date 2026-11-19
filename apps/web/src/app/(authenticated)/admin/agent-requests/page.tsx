"use client";

/**
 * /admin/agent-requests — la coda delle richieste dell'agente (tappa T2, 2026-11-19).
 * Ogni richiesta nasce con una previsione di spesa e un tetto e aspetta un sì o un no: chi decide
 * (`agent_request:decide`) accetta, oppure rifiuta scrivendo il motivo. L'API rifiuta ciò che non
 * torna (previsione sopra il tetto, richiesta già decisa) e la pagina lo dice con il suo motivo.
 * Sotto la coda c'è il registro di costo e durata delle chiamate dell'agente.
 * Dati vivi: `/v1/agent-requests` e `/v1/agent-requests/calls`.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@heuresys/ui";
import type { AgentCallListResponse, AgentRequest, AgentRequestListResponse, AgentRequestStatus } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { StatoCaricamento, StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { isApiError } from "@/lib/api/errors";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const STATI: readonly AgentRequestStatus[] = ["IN_ATTESA", "ACCETTATA", "RIFIUTATA"];

function messaggio(err: unknown, t: (k: string) => string): string {
  if (isApiError(err)) {
    if (err.status === 403) return t("agentReq.vietato");
    if (err.status === 409) return t("agentReq.giaDecisa");
    if (err.serverMessage) return `${t("agentReq.rifiutata")}: ${err.serverMessage}`;
  }
  return t("agentReq.errore");
}

function Richiesta({ r, decide }: { r: AgentRequest; decide: boolean }) {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [rifiuto, setRifiuto] = useState(false);
  const azione = useMutation({
    mutationFn: (body: { decision: "ACCETTA" } | { decision: "RIFIUTA"; reason: string }) =>
      apiFetch(`/v1/agent-requests/${r.id}/decision`, { method: "POST", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agent-requests"] }),
  });
  return (
    <li data-testid="agent-request-row" className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span>
          <span className="font-medium">{r.title}</span>
          <span className="block text-xs text-muted-foreground">
            {t("agentReq.chi", { persona: r.requesterName ?? t("agentReq.personaAssente"), perimetro: r.perimeter, data: f.dataOra(r.createdAt) })}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-3 text-sm">
          <span data-testid="agent-request-cost">{t("agentReq.spesa", { previsione: f.importo(r.estimateUsd, "USD", 4), tetto: f.importo(r.capUsd, "USD", 4) })}</span>
          <Badge variant={r.status === "ACCETTATA" ? "success" : r.status === "RIFIUTATA" ? "destructive" : "secondary"} data-testid="agent-request-status">
            {t(`agentReq.stati.${r.status}`)}
          </Badge>
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>
      {r.status === "RIFIUTATA" && r.rejectReason && <p className="text-sm">{t("agentReq.motivo", { motivo: r.rejectReason })}</p>}
      {decide && r.status === "IN_ATTESA" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" data-testid="agent-request-accept" disabled={azione.isPending} onClick={() => azione.mutate({ decision: "ACCETTA" })}>{t("agentReq.accetta")}</Button>
          {!rifiuto ? (
            <Button type="button" variant="outline" data-testid="agent-request-reject-open" onClick={() => setRifiuto(true)}>{t("agentReq.rifiuta")}</Button>
          ) : (
            <>
              <Input className="min-w-72 flex-1" aria-label={t("agentReq.motivoLabel")} placeholder={t("agentReq.motivoLabel")} maxLength={2000} value={motivo}
                onChange={(e) => setMotivo(e.target.value)} data-testid="agent-request-reject-reason" />
              <Button type="button" variant="outline" data-testid="agent-request-reject" disabled={!motivo.trim() || azione.isPending}
                onClick={() => azione.mutate({ decision: "RIFIUTA", reason: motivo.trim() })}>{t("agentReq.confermaRifiuto")}</Button>
            </>
          )}
        </div>
      )}
      {azione.isError && <p className="text-sm text-danger" data-testid="agent-request-error">{messaggio(azione.error, t)}</p>}
    </li>
  );
}

export default function AgentRequestsPage() {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const perms = useCurrentUserPermissions().data?.permissions ?? [];
  const decide = perms.includes("agent_request:decide");
  const leggeTutte = perms.includes("agent_request:read:all");
  const [stato, setStato] = useState<"" | AgentRequestStatus>("");
  const elenco = useQuery({
    queryKey: ["agent-requests", stato, leggeTutte],
    queryFn: () => {
      const q = new URLSearchParams({ scope: leggeTutte ? "all" : "own" });
      if (stato) q.set("status", stato);
      return apiFetch<AgentRequestListResponse>(`/v1/agent-requests?${q.toString()}`);
    },
  });
  const chiamate = useQuery({
    queryKey: ["agent-requests", "calls"],
    enabled: leggeTutte,
    queryFn: () => apiFetch<AgentCallListResponse>("/v1/agent-requests/calls"),
  });
  const righe = elenco.data?.items ?? [];
  return (
    <main data-testid="agent-requests-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("agentReq.titolo")} description={t("agentReq.descrizione")} />
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("agentReq.elenco", { count: righe.length })}</CardTitle>
          <select aria-label={t("agentReq.filtroStato")} className={SELECT_CLASS} value={stato} data-testid="agent-request-filter"
            onChange={(e) => setStato(e.target.value as "" | AgentRequestStatus)}>
            <option value="">{t("agentReq.tutte")}</option>
            {STATI.map((s) => <option key={s} value={s}>{t(`agentReq.stati.${s}`)}</option>)}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {elenco.isLoading ? <StatoCaricamento /> : elenco.isError ? (
            <StatoErrore errore={elenco.error} titolo={t("agentReq.erroreCarica")} onRiprova={() => void elenco.refetch()} />
          ) : righe.length === 0 ? <StatoVuoto titolo={t("agentReq.nessuna")} /> : (
            <ul className="divide-y divide-border">{righe.map((r) => <Richiesta key={r.id} r={r} decide={decide} />)}</ul>
          )}
        </CardContent>
      </Card>
      {leggeTutte && (
        <Card data-testid="agent-calls-card">
          <CardHeader><CardTitle>{t("agentReq.registroTitolo")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {chiamate.isLoading ? <StatoCaricamento /> : chiamate.isError ? (
              <StatoErrore errore={chiamate.error} titolo={t("agentReq.erroreRegistro")} onRiprova={() => void chiamate.refetch()} />
            ) : (
              <p data-testid="agent-calls-totals">
                {t("agentReq.registroTotali", {
                  chiamate: f.numero(chiamate.data?.totals.calls ?? 0),
                  costo: f.importo(chiamate.data?.totals.costUsd ?? 0, "USD", 4),
                  durata: f.durata(chiamate.data?.totals.durationMs ?? 0),
                })}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
