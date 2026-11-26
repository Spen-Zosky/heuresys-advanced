"use client";

/**
 * /admin/agent-weekly-summary — il riepilogo settimanale delle scritture fatte con l'assistente
 * (ADR-0063 D3, piano «Heuresys AI-driven» voce F0c, decisione E5 di Enzo del 2026-11-26).
 *
 * Ogni scrittura che una persona ha confermato, quelle che ha negato e quelle eseguite senza
 * conferma (devono restare zero: il modo LIBERA è spento, ADR-0063 D4). Dati da
 * `GET /v1/agent-weekly-summary`, sola lettura. Ogni lunedì l'avviso nella casella porta qui.
 * La piattaforma vede tutti i tenant, con la colonna e il filtro Tenant che parte da «Tutti» (R5).
 */

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import type { AgentWeeklySummary } from "@heuresys/shared";
import { PageHeader } from "@/components/intestazione-pagina";
import { apiFetch } from "@/lib/api/fetch";
import { useCurrentUserPermissions } from "@/lib/api/auth";
import { useFormat } from "@/lib/format";
import { StatoCaricamento, StatoErrore, StatoNegato, StatoVuoto } from "@/components/stato-pagina";

const SELECT_CLASS =
  "rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const TUTTI = "";

/** Il giorno `d` spostato di `giorni`, come YYYY-MM-DD (date pure, senza fuso). */
function sposta(d: string, giorni: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + giorni);
  return x.toISOString().slice(0, 10);
}

export default function AgentWeeklySummaryPage() {
  const { t, i18n } = useTranslation("admin");
  const fmt = useFormat();
  const router = useRouter();
  const settimana = useSearchParams().get("week") ?? undefined;
  const [tenant, setTenant] = useState(TUTTI);
  const permessi = useCurrentUserPermissions();
  const puoLeggere = (permessi.data?.permissions ?? []).includes("agent_capability:read");
  const dati = useQuery({
    queryKey: ["agent-weekly-summary", settimana ?? "ultima"],
    queryFn: () => apiFetch<AgentWeeklySummary>(`/v1/agent-weekly-summary${settimana ? `?week=${settimana}` : ""}`),
    enabled: puoLeggere,
  });
  const inglese = (i18n.language ?? "it").startsWith("en");

  const tenants = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of dati.data?.people ?? []) m.set(p.tenantCode, p.tenantName ?? p.tenantCode);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [dati.data]);
  const nomeTenant = (code: string) => tenants.find(([c]) => c === code)?.[1] ?? code;
  const persone = (dati.data?.people ?? []).filter((p) => tenant === TUTTI || p.tenantCode === tenant);
  const scritture = (dati.data?.writes ?? []).filter((w) => tenant === TUTTI || w.tenantName === nomeTenant(tenant));

  const vai = (giorno: string) => router.push(`/admin/agent-weekly-summary?week=${giorno}`);

  if (permessi.isLoading) return <div className="mx-auto max-w-7xl px-6 pb-8"><StatoCaricamento /></div>;
  if (!puoLeggere) {
    return (
      <div data-testid="agent-weekly-summary-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
        <PageHeader title={t("agentWeekly.titolo")} description={t("agentWeekly.descrizione")} />
        <StatoNegato motivo={t("agentWeekly.negato")} />
      </div>
    );
  }
  const s = dati.data;
  return (
    <div data-testid="agent-weekly-summary-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader title={t("agentWeekly.titolo")} description={t("agentWeekly.descrizione")} />
      {dati.isLoading ? <StatoCaricamento /> : dati.isError || !s ? (
        <StatoErrore errore={dati.error} titolo={t("agentWeekly.erroreCarica")} onRiprova={() => void dati.refetch()} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button type="button" variant="outline" data-testid="agent-weekly-prev" onClick={() => vai(sposta(s.weekStart, -7))}>{t("agentWeekly.precedente")}</Button>
            <span className="font-medium text-foreground" data-testid="agent-weekly-range">
              {t("agentWeekly.intervallo", { dal: fmt.data(s.weekStart), al: fmt.data(s.weekEnd) })}
            </span>
            <Button type="button" variant="outline" data-testid="agent-weekly-next" onClick={() => vai(sposta(s.weekStart, 7))}>{t("agentWeekly.successiva")}</Button>
            {tenants.length > 0 && (
              <label className="ml-auto flex items-center gap-2 font-medium text-foreground">{t("agentWeekly.tenant")}
                <select className={SELECT_CLASS} value={tenant} onChange={(e) => setTenant(e.target.value)} data-testid="agent-weekly-tenant">
                  <option value={TUTTI}>{t("agentWeekly.tutti")}</option>
                  {tenants.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select></label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="agent-weekly-totals">
            {([
              ["confermate", s.totals.confirmed],
              ["negate", s.totals.denied],
              ["autonome", s.totals.autonomous],
              ["persone", s.totals.people],
              ["conversazioni", s.totals.conversations],
            ] as const).map(([k, v]) => (
              <Card key={k} data-testid={`agent-weekly-total-${k}`}>
                <CardContent className="py-3">
                  <div className="text-xs text-muted-foreground">{t(`agentWeekly.totali.${k}`)}</div>
                  <div className={`text-2xl font-semibold ${k === "autonome" && v > 0 ? "text-danger" : "text-foreground"}`}>{fmt.numero(v)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          {s.totals.autonomous > 0 && <p className="text-danger" data-testid="agent-weekly-alarm">{t("agentWeekly.allarme")}</p>}

          <Card>
            <CardHeader><CardTitle as="h2">{t("agentWeekly.perPersona", { count: persone.length })}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {persone.length === 0 ? <StatoVuoto titolo={t("agentWeekly.nessuna")} /> : (
                <table className="w-full text-sm" data-testid="agent-weekly-people">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">{t("agentWeekly.colonne.persona")}</th><th>{t("agentWeekly.colonne.tenant")}</th>
                    <th className="text-right">{t("agentWeekly.totali.confermate")}</th><th className="text-right">{t("agentWeekly.totali.negate")}</th>
                    <th className="text-right">{t("agentWeekly.totali.autonome")}</th><th>{t("agentWeekly.colonne.ultima")}</th>
                  </tr></thead>
                  <tbody>
                    {persone.map((p) => (
                      <tr key={`${p.tenantCode}:${p.userId ?? "?"}`} className="border-t border-border" data-testid="agent-weekly-person-row">
                        <td className="py-1">{p.personName ?? t("agentWeekly.personaAssente")}</td>
                        <td>{p.tenantName ?? p.tenantCode}</td>
                        <td className="text-right">{fmt.numero(p.confirmed)}</td>
                        <td className="text-right">{fmt.numero(p.denied)}</td>
                        <td className="text-right">{fmt.numero(p.autonomous)}</td>
                        <td>{fmt.dataOra(p.lastAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle as="h2">{t("agentWeekly.elenco", { count: s.writesTotal })}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              {s.writesTotal > s.writes.length && (
                <p className="pb-2 text-muted-foreground" data-testid="agent-weekly-truncated">
                  {t("agentWeekly.troncato", { mostrate: fmt.numero(s.writes.length), totale: fmt.numero(s.writesTotal) })}
                </p>
              )}
              {scritture.length === 0 ? <StatoVuoto titolo={t("agentWeekly.nessuna")} /> : (
                <table className="w-full text-sm" data-testid="agent-weekly-writes">
                  <thead><tr className="text-left text-muted-foreground">
                    <th className="py-1">{t("agentWeekly.colonne.quando")}</th><th>{t("agentWeekly.colonne.persona")}</th>
                    <th>{t("agentWeekly.colonne.tenant")}</th><th>{t("agentWeekly.colonne.operazione")}</th><th>{t("agentWeekly.colonne.esito")}</th>
                  </tr></thead>
                  <tbody>
                    {scritture.map((w) => (
                      <tr key={w.id} className="border-t border-border" data-testid="agent-weekly-write-row">
                        <td className="py-1 whitespace-nowrap">{fmt.dataOra(w.at)}</td>
                        <td>{w.personName ?? t("agentWeekly.personaAssente")}</td>
                        <td>{w.tenantName ?? "—"}</td>
                        <td>{w.operationLabel ? (inglese ? w.operationLabel.en : w.operationLabel.it) : t("agentWeekly.operazioneSenzaNome")}</td>
                        <td>
                          <Badge variant={w.outcome === "CONFERMATA" ? "success" : w.outcome === "NEGATA" ? "secondary" : "destructive"}>
                            {t(`agentWeekly.esiti.${w.outcome}`)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
