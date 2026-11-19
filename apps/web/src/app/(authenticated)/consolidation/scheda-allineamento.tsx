"use client";
import { MODALE } from "@/lib/modale";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@heuresys/ui";
import {
  ALIGNMENT_FAMILIES,
  ALLOWED_ALIGNMENT_DECISIONS,
  type AlignmentApproveResult,
  type AlignmentDecision,
  type AlignmentDomain,
  type AlignmentDraftResult,
  type AlignmentResponse,
  type AlignmentRow,
  type BlueprintRun,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { useFormat } from "@/lib/format";
import { StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { LavoroInCorso } from "@/components/lavoro-in-corso";

// La scheda «Allineamento» (piano `docs/piani/PIANO_scheda-allineamento_20261118.md`, ADR-0059). Disegno preso
// dalla pagina «Corsa del 10/10 e RTL Bank» della console del datastore: quadro d'insieme, un dominio alla volta,
// le sole divergenze con filtri e ricerca, una decisione per voce. I numeri sono quelli della misura della distanza
// di advanced (`GET /v1/consolidation-runs/:runId/alignment`). Le decisioni si salvano in bozza; il pulsante rosso
// le approva. Nessuna decisione cambia i dati dell'azienda: le approvate sono il registro da cui partirà il motore
// dell'allineamento.

const RUNS = "/v1/consolidation-runs";
const SELECT_CLASS =
  "rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const QUADRO = "quadro";
const PULIZIA = "pulizia";

const ESITO_TONO: Record<AlignmentRow["esito"], StatusTone> = {
  uguale: "success", parziale: "info", diverso: "warning", solo_modello: "neutral", solo_tenant: "neutral",
};

type Stato = "daDecidere" | "bozza" | "approvata" | "allineata";
function statoDi(r: AlignmentRow): Stato {
  if (r.esito === "uguale") return "allineata";
  if (r.bozza) return "bozza";
  if (r.approvata) return "approvata";
  return "daDecidere";
}
const STATO_TONO: Record<Stato, StatusTone> = { daDecidere: "warning", bozza: "info", approvata: "success", allineata: "neutral" };

/** La corsa da mostrare per prima: quella definitiva, altrimenti la più recente con un modello. */
function corsaIniziale(corse: BlueprintRun[]): BlueprintRun | null {
  const conModello = corse.filter((r) => r.variantVersionId);
  return conModello.find((r) => r.status === "DEFINITIVA") ?? conModello[0] ?? null;
}

export function SchedaAllineamento() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const [scelta, setScelta] = useState<string | null>(null);
  const [sezione, setSezione] = useState<string>(QUADRO);
  const [esito, setEsito] = useState<string>("");
  const [decisione, setDecisione] = useState<string>("");
  const [cerca, setCerca] = useState("");
  const [conUguali, setConUguali] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [conferma, setConferma] = useState<"approva" | "scarta" | null>(null);
  const [esitoApprovazione, setEsitoApprovazione] = useState<AlignmentApproveResult | null>(null);
  const [scartate, setScartate] = useState<AlignmentDraftResult["scartate"]>([]);

  const runs = useQuery({
    queryKey: ["consolidation-runs", "list"],
    queryFn: () => apiFetch<{ items: BlueprintRun[] }>(RUNS),
  });
  const corse = useMemo(() => (runs.data?.items ?? []).filter((r) => r.variantVersionId), [runs.data]);
  const corsa = corse.find((r) => r.runId === scelta) ?? corsaIniziale(corse);

  const misura = useQuery({
    queryKey: ["consolidation-runs", "alignment", corsa?.runId],
    queryFn: () => apiFetch<AlignmentResponse>(`${RUNS}/${corsa!.runId}/alignment`),
    enabled: corsa !== null,
  });

  const fallita = (e: unknown) =>
    setErrore(e instanceof ApiError ? t(`consolidation.errors.${e.code}`, { defaultValue: e.message }) : t("consolidation.errors.generic"));
  const rinfresca = () => void qc.invalidateQueries({ queryKey: ["consolidation-runs", "alignment", corsa?.runId] });

  const salva = useMutation({
    mutationFn: (voci: Array<{ dominio: AlignmentDomain["dominio"]; chiave: string; decisione: AlignmentDecision }>) =>
      apiFetch<AlignmentDraftResult>(`${RUNS}/${corsa!.runId}/alignment/drafts`, { method: "PUT", body: { voci } }),
    onSuccess: (r) => { setErrore(null); setScartate(r.scartate); rinfresca(); },
    onError: fallita,
  });
  const approva = useMutation({
    mutationFn: () => apiFetch<AlignmentApproveResult>(`${RUNS}/${corsa!.runId}/alignment/approve`, { method: "POST", body: {} }),
    onSuccess: (r) => { setConferma(null); setEsitoApprovazione(r); rinfresca(); },
    onError: fallita,
  });
  const scarta = useMutation({
    mutationFn: () => apiFetch<{ scartate: number }>(`${RUNS}/${corsa!.runId}/alignment/discard`, { method: "POST", body: {} }),
    onSuccess: () => { setConferma(null); rinfresca(); },
    onError: fallita,
  });
  const occupato = salva.isPending || approva.isPending || scarta.isPending;

  const dati = misura.data;
  const puoDecidere = dati?.puoDecidere ?? false;
  const perDominio = useMemo(() => new Map((dati?.domini ?? []).map((d) => [d.dominio, d])), [dati]);
  const nomeDominio = (d: string) => t(`consolidationRuns.distance.domains.${d}`, { defaultValue: d });

  // Le voci della sezione aperta: un dominio, oppure la pulizia (le voci che l'agente propone di togliere).
  const vociSezione = useMemo<Array<AlignmentRow & { dominio: AlignmentDomain["dominio"] }>>(() => {
    if (!dati || sezione === QUADRO) return [];
    const fonti = sezione === PULIZIA ? dati.domini : dati.domini.filter((d) => d.dominio === sezione);
    const tutte = fonti.flatMap((d) => d.righe_voci.map((r) => ({ ...r, dominio: d.dominio })));
    return sezione === PULIZIA ? tutte.filter((r) => r.proposta === "TOLGO") : tutte;
  }, [dati, sezione]);
  const q = cerca.trim().toLowerCase();
  const visibili = vociSezione.filter((r) =>
    (conUguali || r.esito !== "uguale")
    && (!esito || r.esito === esito)
    && (!decisione || (r.bozza ?? r.approvata ?? r.proposta) === decisione)
    && (!q || [r.modello, r.tenant, r.nota].some((x) => (x ?? "").toLowerCase().includes(q))),
  );
  const daProporre = visibili.filter((r) => r.proposta && !r.bozza && !r.approvata);
  const nPulizia = dati ? dati.domini.reduce((n, d) => n + d.righe_voci.filter((r) => r.proposta === "TOLGO").length, 0) : 0;

  if (runs.isError) {
    return <StatoErrore errore={runs.error} titolo={t("alignment.loadError")} testId="alignment-load-error" onRiprova={() => void runs.refetch()} />;
  }
  if (runs.data && corse.length === 0) {
    return <StatoVuoto testId="alignment-no-runs" titolo={t("alignment.noRunsTitle")} motivo={t("alignment.noRuns")} />;
  }

  const apri = (s: string) => { setSezione(s); setEsito(""); setDecisione(""); setCerca(""); setScartate([]); };

  return (
    <div data-testid="alignment-tab" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("alignment.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="max-w-prose text-muted-foreground">{t("alignment.description")}</p>
          {corse.length > 0 ? (
            <label className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{t("alignment.run")}</span>
              <select
                data-testid="alignment-run-select" className={SELECT_CLASS}
                value={corsa?.runId ?? ""} onChange={(e) => { setScelta(e.target.value); apri(QUADRO); }}
              >
                {corse.map((r) => (
                  <option key={r.runId} value={r.runId}>
                    {t("consolidationRuns.option", { model: r.modelLabel, date: fmt.data(r.modelLoadedAt), status: t(`consolidationRuns.statuses.${r.status}`) })}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {dati ? (
            <p data-testid="alignment-measured" className="text-xs text-muted-foreground">
              {t("alignment.measured", { when: fmt.dataOra(dati.misurataIl) })}
              <Button type="button" size="sm" variant="outline" className="ml-2" disabled={misura.isFetching} onClick={() => void misura.refetch()}>
                {t("alignment.refresh")}
              </Button>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <LavoroInCorso
        attivo={misura.isFetching || occupato}
        titolo={misura.isFetching ? t("alignment.measuring") : t("alignment.saving")}
        dettaglio={t("alignment.measuringDetail")}
      />

      {errore ? (
        <div role="alert" data-testid="alignment-error" className="rounded-card border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">{errore}</div>
      ) : null}
      {misura.isError ? (
        <StatoErrore errore={misura.error} titolo={t("alignment.loadError")} testId="alignment-measure-error" onRiprova={() => void misura.refetch()} />
      ) : null}

      {dati && dati.decisioni.bozze > 0 ? (
        <div role="status" data-testid="alignment-pending" className="flex flex-wrap items-center gap-3 rounded-card border border-warning bg-warning/10 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{t("alignment.pending", { count: dati.decisioni.bozze })}</p>
          {puoDecidere ? (
            <>
              <Button type="button" variant="destructive" data-testid="alignment-approve" disabled={occupato} onClick={() => { setErrore(null); setConferma("approva"); }}>
                {t("alignment.approve", { count: dati.decisioni.bozze })}
              </Button>
              <Button type="button" variant="outline" data-testid="alignment-discard" disabled={occupato} onClick={() => { setErrore(null); setConferma("scarta"); }}>
                {t("alignment.discard")}
              </Button>
            </>
          ) : null}
          <p className="w-full text-xs text-muted-foreground">{t("alignment.approveHint")}</p>
        </div>
      ) : null}
      {esitoApprovazione ? (
        <div role="status" data-testid="alignment-approved" className="rounded-card border bg-card px-4 py-3 text-sm">
          {t("alignment.approved", { count: esitoApprovazione.approvate, when: fmt.dataOra(esitoApprovazione.approvateIl) })}
        </div>
      ) : null}

      {dati ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <nav aria-label={t("alignment.navAria")} data-testid="alignment-nav" className="flex shrink-0 flex-col gap-1 lg:sticky lg:top-2 lg:w-60">
            <VoceNav attiva={sezione === QUADRO} onClick={() => apri(QUADRO)} testId="alignment-nav-quadro">{t("alignment.overview")}</VoceNav>
            {ALIGNMENT_FAMILIES.map((f) => (
              <div key={f.famiglia} className="mt-2">
                <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`alignment.families.${f.famiglia}`)}</p>
                {f.domini.map((d) => {
                  const m = perDominio.get(d);
                  const aperte = m ? m.righe - m.uguali : 0;
                  return (
                    <VoceNav key={d} attiva={sezione === d} onClick={() => apri(d)} testId={`alignment-nav-${d}`}>
                      {nomeDominio(d)} <span className="tabular-nums text-muted-foreground">{fmt.numero(aperte)}</span>
                    </VoceNav>
                  );
                })}
              </div>
            ))}
            <div className="mt-2">
              <VoceNav attiva={sezione === PULIZIA} onClick={() => apri(PULIZIA)} testId="alignment-nav-pulizia">
                {t("alignment.cleanup")} <span className="tabular-nums text-muted-foreground">{fmt.numero(nPulizia)}</span>
              </VoceNav>
            </div>
          </nav>

          <section className="min-w-0 flex-1 space-y-3">
            {sezione === QUADRO ? (
              <Quadro dati={dati} nomeDominio={nomeDominio} onApri={apri} />
            ) : (
              <>
                <h3 className="text-lg font-medium text-foreground" data-testid="alignment-section-title">
                  {sezione === PULIZIA ? t("alignment.cleanup") : nomeDominio(sezione)}
                </h3>
                {sezione === PULIZIA ? (
                  <p className="max-w-prose text-sm text-muted-foreground">{t("alignment.cleanupDescription")}</p>
                ) : perDominio.get(sezione as AlignmentDomain["dominio"]) ? (
                  <DescrizioneDominio d={perDominio.get(sezione as AlignmentDomain["dominio"])!} />
                ) : null}
                <div className="flex flex-wrap items-center gap-2" data-testid="alignment-filters">
                  <select aria-label={t("alignment.filterOutcome")} className={SELECT_CLASS} value={esito} onChange={(e) => setEsito(e.target.value)} data-testid="alignment-filter-outcome">
                    <option value="">{t("alignment.allOutcomes")}</option>
                    {(["parziale", "diverso", "solo_modello", "solo_tenant", "uguale"] as const).map((x) => (
                      <option key={x} value={x}>{t(`alignment.outcomes.${x}`)}</option>
                    ))}
                  </select>
                  <select aria-label={t("alignment.filterDecision")} className={SELECT_CLASS} value={decisione} onChange={(e) => setDecisione(e.target.value)} data-testid="alignment-filter-decision">
                    <option value="">{t("alignment.allDecisions")}</option>
                    {(["UNISCO", "ADOTTO", "TENGO", "TOLGO"] as const).map((x) => (
                      <option key={x} value={x}>{t(`alignment.decisions.${x}`)}</option>
                    ))}
                  </select>
                  <input
                    type="search" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder={t("alignment.search")}
                    aria-label={t("alignment.search")} className={`${SELECT_CLASS} min-w-0 flex-1`} data-testid="alignment-search"
                  />
                  <label className="flex items-center gap-1 text-sm text-muted-foreground">
                    <input type="checkbox" checked={conUguali} onChange={(e) => setConUguali(e.target.checked)} data-testid="alignment-show-equal" />
                    {t("alignment.showEqual")}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" data-testid="alignment-count">{t("alignment.shown", { count: visibili.length, total: vociSezione.length })}</Badge>
                  {puoDecidere && daProporre.length > 0 ? (
                    <Button
                      type="button" size="sm" variant="secondary" data-testid="alignment-accept-proposals" disabled={occupato}
                      onClick={() => salva.mutate(daProporre.map((r) => ({ dominio: r.dominio, chiave: r.chiave, decisione: r.proposta! })))}
                    >
                      {t("alignment.acceptProposals", { count: daProporre.length })}
                    </Button>
                  ) : null}
                </div>
                {scartate.length > 0 ? (
                  <p role="alert" data-testid="alignment-rejected" className="text-sm text-destructive">
                    {t("alignment.rejected", { count: scartate.length, reason: scartate[0]!.motivo })}
                  </p>
                ) : null}
                <TabellaVoci
                  righe={visibili} pulizia={sezione === PULIZIA} puoDecidere={puoDecidere} occupato={occupato}
                  nomeDominio={nomeDominio}
                  onDecidi={(r, d) => salva.mutate([{ dominio: r.dominio, chiave: r.chiave, decisione: d }])}
                />
              </>
            )}
          </section>
        </div>
      ) : null}

      {conferma && dati ? (
        <Dialog open onOpenChange={(o) => { if (!o) setConferma(null); }}>
          <DialogContent className={MODALE.piccola} data-testid="alignment-confirm-dialog" closeLabel={t("shell:ui.close")}>
            <DialogHeader>
              <DialogTitle>{t(`alignment.${conferma}Title`)}</DialogTitle>
              <DialogDescription>{t(`alignment.${conferma}Body`, { count: dati.decisioni.bozze })}</DialogDescription>
            </DialogHeader>
            {errore ? <p role="alert" className="text-sm text-destructive">{errore}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={occupato} onClick={() => setConferma(null)}>{t("consolidation.modal.close")}</Button>
              <Button
                type="button" variant="destructive" data-testid="alignment-confirm" disabled={occupato}
                onClick={() => (conferma === "approva" ? approva.mutate() : scarta.mutate())}
              >
                {t(`alignment.${conferma}Confirm`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function VoceNav({ attiva, onClick, testId, children }: { attiva: boolean; onClick: () => void; testId: string; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} data-testid={testId} aria-current={attiva ? "true" : undefined}
      className={`rounded-control px-2 py-1 text-left text-sm ${attiva ? "border border-border bg-muted font-medium" : "hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}

function DescrizioneDominio({ d }: { d: AlignmentDomain }) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  return (
    <div className="space-y-1 text-sm">
      <p className="max-w-prose text-muted-foreground">{d.nota}</p>
      <p className="flex flex-wrap items-center gap-2">
        <StatusPill tone={d.copertura === "GIRI" ? "info" : "neutral"}>{t(`alignment.coverage.${d.copertura}`)}</StatusPill>
        <span className="tabular-nums text-muted-foreground" data-testid="alignment-domain-counts">
          {t("alignment.domainCounts", {
            rows: fmt.numero(d.righe), same: fmt.numero(d.uguali), partial: fmt.numero(d.parziali), different: fmt.numero(d.diversi),
            onlyModel: fmt.numero(d.solo_modello), onlyTenant: fmt.numero(d.solo_tenant),
          })}
        </span>
      </p>
    </div>
  );
}

function Quadro({ dati, nomeDominio, onApri }: { dati: AlignmentResponse; nomeDominio: (d: string) => string; onApri: (d: string) => void }) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const tot = dati.totale;
  return (
    <div className="space-y-3" data-testid="alignment-overview">
      <p className="max-w-prose text-sm">
        {t("alignment.summary", {
          rows: fmt.numero(tot.righe), same: fmt.numero(tot.uguali), partial: fmt.numero(tot.parziali), different: fmt.numero(tot.diversi),
          onlyModel: fmt.numero(tot.solo_modello), onlyTenant: fmt.numero(tot.solo_tenant),
        })}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="alignment-decisions-summary">
        {t("alignment.decisionsSummary", {
          drafts: fmt.numero(dati.decisioni.bozze), approved: fmt.numero(dati.decisioni.approvate), stale: fmt.numero(dati.decisioni.superate),
        })}
      </p>
      <div className="overflow-x-auto rounded-card border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("alignment.cols.domain")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("consolidationRuns.distance.same")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("consolidationRuns.distance.partial")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("consolidationRuns.distance.different")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("consolidationRuns.distance.onlyModel")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("consolidationRuns.distance.onlyTenant")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("alignment.cols.decided")}</th>
              <th className="px-3 py-2 font-medium">{t("alignment.cols.coverage")}</th>
            </tr>
          </thead>
          {ALIGNMENT_FAMILIES.map((f) => (
            <tbody key={f.famiglia}>
              <tr className="border-t bg-card">
                <th colSpan={8} className="px-3 py-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(`alignment.families.${f.famiglia}`)}</th>
              </tr>
              {f.domini.map((dn) => {
                const d = dati.domini.find((x) => x.dominio === dn);
                if (!d) return null;
                const aperte = d.righe_voci.filter((r) => r.esito !== "uguale");
                const decise = aperte.filter((r) => r.bozza || r.approvata).length;
                return (
                  <tr key={dn} className="border-t" data-testid="alignment-overview-row" title={d.nota}>
                    <td className="px-3 py-1">
                      <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => onApri(dn)}>{nomeDominio(dn)}</button>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt.numero(d.uguali)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt.numero(d.parziali)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt.numero(d.diversi)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt.numero(d.solo_modello)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{fmt.numero(d.solo_tenant)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{t("alignment.decidedOf", { done: fmt.numero(decise), total: fmt.numero(aperte.length) })}</td>
                    <td className="px-3 py-1"><StatusPill tone={d.copertura === "GIRI" ? "info" : "neutral"}>{t(`alignment.coverage.${d.copertura}`)}</StatusPill></td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}

function TabellaVoci({
  righe, pulizia, puoDecidere, occupato, nomeDominio, onDecidi,
}: {
  righe: Array<AlignmentRow & { dominio: AlignmentDomain["dominio"] }>;
  pulizia: boolean;
  puoDecidere: boolean;
  occupato: boolean;
  nomeDominio: (d: string) => string;
  onDecidi: (r: AlignmentRow & { dominio: AlignmentDomain["dominio"] }, d: AlignmentDecision) => void;
}) {
  const { t } = useTranslation("hr");
  if (righe.length === 0) {
    return <p className="rounded-card border px-4 py-6 text-center text-sm italic text-muted-foreground" data-testid="alignment-empty">{t("alignment.noRows")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-card border">
      <table className="w-full text-sm" data-testid="alignment-table">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            {pulizia ? <th className="px-3 py-2 font-medium">{t("alignment.cols.domain")}</th> : null}
            <th className="px-3 py-2 font-medium">{t("alignment.cols.model")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.tenant")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.note")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.outcome")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.proposal")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.decision")}</th>
            <th className="px-3 py-2 font-medium">{t("alignment.cols.status")}</th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => {
            const stato = statoDi(r);
            const corrente = r.bozza ?? r.approvata ?? "";
            return (
              <tr key={`${r.dominio}-${r.chiave}`} className="border-t align-top" data-testid="alignment-row">
                {pulizia ? <td className="px-3 py-1">{nomeDominio(r.dominio)}</td> : null}
                <td className={`px-3 py-1 ${r.modello ? "" : "italic text-muted-foreground"}`}>{r.modello ?? t("alignment.none")}</td>
                <td className={`px-3 py-1 ${r.tenant ? "" : "italic text-muted-foreground"}`}>{r.tenant ?? t("alignment.none")}</td>
                <td className="px-3 py-1 text-xs text-muted-foreground">{r.nota ?? ""}</td>
                <td className="px-3 py-1"><StatusPill tone={ESITO_TONO[r.esito]}>{t(`alignment.outcomes.${r.esito}`)}</StatusPill></td>
                <td className="px-3 py-1">{r.proposta ? t(`alignment.decisions.${r.proposta}`) : ""}</td>
                <td className="px-3 py-1">
                  {puoDecidere && r.esito !== "uguale" ? (
                    <select
                      aria-label={t("alignment.cols.decision")} className={SELECT_CLASS} disabled={occupato}
                      value={corrente} data-testid="alignment-decide"
                      onChange={(e) => { if (e.target.value) onDecidi(r, e.target.value as AlignmentDecision); }}
                    >
                      <option value="" disabled>{t("alignment.choose")}</option>
                      {ALLOWED_ALIGNMENT_DECISIONS[r.lato].map((d) => (
                        <option key={d} value={d}>{t(`alignment.decisions.${d}`)}</option>
                      ))}
                    </select>
                  ) : corrente ? t(`alignment.decisions.${corrente}`) : ""}
                </td>
                <td className="px-3 py-1"><StatusPill tone={STATO_TONO[stato]}>{t(`alignment.statuses.${stato}`)}</StatusPill></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
