"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import {
  CONSOLIDATION_CERTAIN_THRESHOLD,
  CONSOLIDATION_GROUP_VALUES,
  nextConsolidationGroup,
  type ApplyChangesResult,
  type ApprovalPreview,
  type PendingChanges,
  type ConsolidationAccess,
  type ConsolidationGroup,
  type ConsolidationItemRef,
  type ConsolidationProposal,
  type Decision,
  type GroupProgress,
  type LinkForm,
  type ProposalOutcome,
  type TenantConsolidation,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { useFormat } from "@/lib/format";
import { StatoErrore, StatoVuoto } from "@/components/stato-pagina";
import { DecisioneDialog } from "./decisione-dialog";
import { RegistroCorse } from "./registro-corse";
import { OrganigrammaCliente } from "./organigramma-cliente";

// AC-10 — La pagina del Direttore HR per il consolidamento del tenant col prototipo
// (`.programmi/consolidamento/agente/`). L'agente propone, una persona decide: qui si avviano
// i giri del gruppo aperto, se ne legge l'esito dal registro e si decide proposta per proposta,
// oppure a gruppi sugli abbinamenti certi. Ogni dato viene da `/v1/tenant-consolidations/*`;
// i bottoni sono quelli che la rotta accetta (`ALLOWED_DECISIONS`, `/access`), non ipotesi.

const BASE = "/v1/tenant-consolidations";

const OUTCOME_TONE: Record<ProposalOutcome, StatusTone> = {
  CORRISPONDENZA: "info",
  LACUNA: "warning",
  PERSONALIZZAZIONE: "neutral",
};

function decisionTone(d: Decision): StatusTone {
  return d === "RIFIUTATA" || d === "NON_ADOTTATA" ? "danger" : "success";
}

function nomi(items: readonly ConsolidationItemRef[], vuoto: string): string {
  if (items.length === 0) return vuoto;
  return items.map((i) => i.name ?? i.key).join(" + ");
}

function erroreDi(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) return t(`consolidation.errors.${e.code}`, { defaultValue: e.message });
  return t("consolidation.errors.generic");
}

function buildColumns(
  t: TFunction,
  canDecide: boolean,
  onDecide: (p: ConsolidationProposal) => void,
  busy: boolean,
): DataColumn<ConsolidationProposal>[] {
  return [
    {
      header: t("consolidation.cols.tenant"),
      cell: (p) => <span className="font-medium text-foreground">{nomi(p.tenantItems, t("consolidation.none"))}</span>,
    },
    {
      header: t("consolidation.cols.prototype"),
      cell: (p) => <span className="text-foreground">{nomi(p.prototypeItems, t("consolidation.none"))}</span>,
    },
    {
      header: t("consolidation.cols.outcome"),
      cell: (p) => <StatusPill tone={OUTCOME_TONE[p.outcome]}>{t(`consolidation.outcomes.${p.outcome}`)}</StatusPill>,
    },
    {
      header: t("consolidation.cols.confidence"), align: "right",
      cell: (p) => <span data-testid="consolidation-confidence" className="tabular-nums">{p.confidence}</span>,
    },
    {
      header: t("consolidation.cols.reason"),
      cell: (p) => <span className="text-xs text-muted-foreground">{p.reason}</span>,
    },
    {
      header: t("consolidation.cols.decision"), align: "right",
      cell: (p) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canDecide ? (
            <Button
              type="button" size="sm" variant="outline" disabled={busy}
              data-testid="consolidation-decide-open"
              onClick={() => onDecide(p)}
            >
              {p.decision ? t(`consolidation.decisions.${p.decision}`) : t("consolidation.decideNow")}
            </Button>
          ) : p.decision ? (
            <StatusPill tone={decisionTone(p.decision)}>{t(`consolidation.decisions.${p.decision}`)}</StatusPill>
          ) : null}
        </div>
      ),
    },
  ];
}

export default function ConsolidationPage() {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const [scelto, setScelto] = useState<ConsolidationGroup | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const access = useQuery({
    queryKey: ["tenant-consolidations", "access"],
    queryFn: () => apiFetch<ConsolidationAccess>(`${BASE}/access`),
  });
  const sessions = useQuery({
    queryKey: ["tenant-consolidations", "list"],
    queryFn: () => apiFetch<{ items: TenantConsolidation[] }>(BASE),
    // Mentre un giro gira, la pagina rilegge da sé: l'esito arriva dal registro, non dalla risposta.
    refetchInterval: (q) => (q.state.data?.items.some((s) => s.runningGroup !== null) ? 5000 : false),
  });
  const corrente = useMemo<TenantConsolidation | null>(
    () => sessions.data?.items.find((s) => s.status === "GIRI" || s.status === "IN_CONFERMA") ?? null,
    [sessions.data],
  );
  const inCorso = corrente?.runningGroup ?? null;
  const idCorrente = corrente?.consolidationId ?? null;

  const progress = useQuery({
    queryKey: ["tenant-consolidations", idCorrente, "progress", inCorso],
    queryFn: () => apiFetch<{ groups: GroupProgress[] }>(`${BASE}/${idCorrente}/progress`),
    enabled: idCorrente !== null,
  });

  // Chi legge per permesso vede tutti i gruppi; un delegato solo quelli della sua delega.
  // Decidere è un'altra cosa: vale solo sui gruppi di `access.groups`.
  const gruppi: readonly ConsolidationGroup[] = access.data
    ? access.data.decidesAs === "DELEGATO" ? access.data.groups : CONSOLIDATION_GROUP_VALUES
    : [];
  const gruppo: ConsolidationGroup | null =
    scelto ?? (corrente?.openGroup && gruppi.includes(corrente.openGroup) ? corrente.openGroup : gruppi[0] ?? null);

  const proposals = useQuery({
    queryKey: ["tenant-consolidations", idCorrente, "proposals", gruppo, inCorso],
    queryFn: () => apiFetch<{ items: ConsolidationProposal[] }>(`${BASE}/${idCorrente}/proposals?group=${gruppo}`),
    enabled: idCorrente !== null && gruppo !== null,
  });
  // Le righe da decidere in cima, e fra queste le più incerte prima: è lì che serve lo sguardo.
  const righe = useMemo(
    () => [...(proposals.data?.items ?? [])].sort(
      (a, b) => Number(a.decision !== null) - Number(b.decision !== null) || a.confidence - b.confidence,
    ),
    [proposals.data],
  );
  const certe = useMemo(
    () => righe.filter((p) => p.outcome === "CORRISPONDENZA" && p.confidence >= CONSOLIDATION_CERTAIN_THRESHOLD && p.decision === null),
    [righe],
  );

  const rinfresca = () => {
    setErrore(null);
    void qc.invalidateQueries({ queryKey: ["tenant-consolidations"] });
  };
  const fallita = (e: unknown) => setErrore(erroreDi(t, e));

  const start = useMutation({
    mutationFn: () => apiFetch<TenantConsolidation>(BASE, { method: "POST", body: { trigger: "RICHIESTA" } }),
    onSuccess: rinfresca, onError: fallita,
  });
  const run = useMutation({
    mutationFn: (g: ConsolidationGroup) => apiFetch(`${BASE}/${idCorrente}/groups/${g}/run`, { method: "POST", body: {} }),
    onSuccess: rinfresca, onError: fallita,
  });
  const close = useMutation({
    mutationFn: (g: ConsolidationGroup) => apiFetch(`${BASE}/${idCorrente}/groups/${g}/close`, { method: "POST", body: {} }),
    onSuccess: () => { setScelto(null); rinfresca(); }, onError: fallita,
  });
  const [inDecisione, setInDecisione] = useState<ConsolidationProposal | null>(null);
  const [esito, setEsito] = useState<ApplyChangesResult | null>(null);
  const decide = useMutation({
    mutationFn: (v: { p: ConsolidationProposal; d: Decision; form: LinkForm | undefined; cascade: boolean }) =>
      apiFetch(`${BASE}/proposals/${v.p.proposalId}/decision`, {
        method: "POST", body: { decision: v.d, ...(v.form ? { form: v.form } : {}), ...(v.cascade ? { cascade: true } : {}) },
      }),
    // Decidere registra soltanto nella bozza: i dati vivi cambiano solo con l'approvazione definitiva.
    onSuccess: () => { setInDecisione(null); rinfresca(); }, onError: fallita,
  });
  const chiudiDecisione = () => { setInDecisione(null); setErrore(null); };
  const pendenti = useQuery({
    queryKey: ["tenant-consolidations", idCorrente, "pending-changes"],
    queryFn: () => apiFetch<PendingChanges>(`${BASE}/${idCorrente}/pending-changes`),
    enabled: idCorrente !== null,
  });
  // «Apporta modifiche (N)»: l'anteprima nella bozza, provata e annullata. Niente cambia nei dati vivi.
  const [anteprima, setAnteprima] = useState<ApprovalPreview | null>(null);
  const prova = useMutation({
    mutationFn: () => apiFetch<ApprovalPreview>(`${BASE}/${idCorrente}/preview-changes`, { method: "POST", body: {} }),
    onSuccess: (r) => { setEsito(null); setAnteprima(r); }, onError: fallita,
  });
  // Il pulsante rosso: solo qui le modifiche della bozza entrano nei dati vivi.
  const [conferma, setConferma] = useState<"approva" | "scarta" | null>(null);
  const applica = useMutation({
    mutationFn: () => apiFetch<ApplyChangesResult>(`${BASE}/${idCorrente}/apply-changes`, { method: "POST", body: {} }),
    onSuccess: (r) => { setConferma(null); setAnteprima(null); setEsito(r); rinfresca(); }, onError: fallita,
  });
  const scarta = useMutation({
    mutationFn: () => apiFetch<{ discarded: number }>(`${BASE}/${idCorrente}/discard-changes`, { method: "POST", body: {} }),
    onSuccess: () => { setConferma(null); setAnteprima(null); rinfresca(); }, onError: fallita,
  });
  const confirm = useMutation({
    mutationFn: (ids: string[]) => apiFetch(`${BASE}/proposals/confirm-certain`, { method: "POST", body: { proposalIds: ids } }),
    onSuccess: rinfresca, onError: fallita,
  });

  const occupato = start.isPending || run.isPending || close.isPending || decide.isPending || confirm.isPending || applica.isPending || prova.isPending || scarta.isPending;
  const canRun = access.data?.canRun ?? false;
  const isDirector = access.data?.decidesAs === "DIRETTORE";
  const nBozza = pendenti.data?.pending ?? 0;
  const canDecide = corrente !== null && gruppo !== null && (access.data?.groups.includes(gruppo) ?? false);
  const columns = useMemo(
    () => buildColumns(t, canDecide, (p) => { setErrore(null); setInDecisione(p); }, occupato),
    [t, canDecide, occupato],
  );
  const avanzamento = progress.data?.groups ?? [];
  const delGruppo = avanzamento.find((g) => g.group === gruppo) ?? null;
  const ultimo = corrente?.lastRun ?? null;

  // Il passo successivo, detto in parole: chi decide non deve indovinare l'ordine dei pulsanti.
  const aperto = corrente?.status === "GIRI" ? corrente.openGroup : null;
  const prossimoPasso: { chiave: string; vars: Record<string, unknown> } | null = (() => {
    if (!corrente || !aperto || !(canRun || access.data?.decidesAs)) return null;
    const nomeAperto = t(`consolidation.groups.${aperto}`);
    if (inCorso) return { chiave: "nextRunning", vars: { group: t(`consolidation.groups.${inCorso}`) } };
    if (gruppo !== aperto) return { chiave: "nextOther", vars: { group: nomeAperto } };
    if (righe.length === 0) return { chiave: "nextRun", vars: { group: nomeAperto } };
    if (delGruppo && delGruppo.pending > 0) return { chiave: "nextDecide", vars: { count: delGruppo.pending } };
    const prossimo = nextConsolidationGroup(aperto);
    return prossimo
      ? { chiave: "nextClose", vars: { next: t(`consolidation.groups.${prossimo}`) } }
      : { chiave: "nextCloseLast", vars: {} };
  })();

  return (
    <main data-testid="consolidation-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="consolidation-title"
        title={t("consolidation.title")}
        description={t("consolidation.description")}
        badges={access.data?.decidesAs
          ? <Badge variant="secondary" data-testid="consolidation-role">{t(`consolidation.roles.${access.data.decidesAs}`)}</Badge>
          : undefined}
      />

      {errore ? (
        <div role="alert" data-testid="consolidation-error" className="rounded-card border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive">
          {errore}
        </div>
      ) : null}

      {access.isError || sessions.isError ? (
        <StatoErrore
          errore={access.error ?? sessions.error}
          titolo={t("consolidation.loadError")}
          testId="consolidation-load-error"
          onRiprova={() => {
            void access.refetch();
            void sessions.refetch();
          }}
        />
      ) : null}

      {access.data ? (
        <RegistroCorse
          canRun={canRun}
          isDirector={access.data.decidesAs === "DIRETTORE"}
          sessioneAperta={corrente}
          occupato={occupato}
          onErrore={setErrore}
        />
      ) : null}

      {access.data ? <OrganigrammaCliente /> : null}

      {sessions.data && corrente === null ? (
        <StatoVuoto
          testId="consolidation-empty"
          titolo={t("consolidation.emptyTitle")}
          motivo={t("consolidation.emptyDescription")}
          azione={
            canRun ? (
              <Button type="button" data-testid="consolidation-start" disabled={occupato} onClick={() => start.mutate()}>
                {t("consolidation.start")}
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {corrente ? (
        <Card data-testid="consolidation-session">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span>{t("consolidation.session", { date: fmt.data(corrente.startedAt) })}</span>
              <StatusPill tone="info">{t(`consolidation.statuses.${corrente.status}`)}</StatusPill>
              {inCorso ? (
                <StatusPill tone="warning" data-testid="consolidation-running">
                  {t("consolidation.running", { group: t(`consolidation.groups.${inCorso}`) })}
                </StatusPill>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {esito ? (
              <div role="status" data-testid="consolidation-apply-result" className="rounded-card border bg-card px-4 py-3 text-sm space-y-1">
                <p className="font-medium">{t("consolidation.applyResult.title", { count: esito.applied })}</p>
                <p>{t("consolidation.applyResult.detail", { changed: esito.changed, created: esito.created, reverted: esito.reverted })}</p>
                {esito.skipped.length > 0 ? (
                  <ul className="list-disc pl-5 text-muted-foreground">{esito.skipped.map((x) => <li key={x}>{x}</li>)}</ul>
                ) : null}
              </div>
            ) : null}
            {anteprima ? (
              <div role="status" data-testid="consolidation-preview" className="rounded-card border border-primary/40 bg-card px-4 py-3 text-sm space-y-1">
                <p className="font-medium">{t("consolidation.approval.previewTitle", { count: anteprima.result.applied })}</p>
                <p>{t("consolidation.applyResult.detail", { changed: anteprima.result.changed, created: anteprima.result.created, reverted: anteprima.result.reverted })}</p>
                {anteprima.result.skipped.length > 0 ? (
                  <ul className="list-disc pl-5 text-muted-foreground">{anteprima.result.skipped.map((x) => <li key={x}>{x}</li>)}</ul>
                ) : null}
                {anteprima.violations.length > 0 ? (
                  <p role="alert" data-testid="consolidation-preview-violations" className="text-destructive">
                    {t("consolidation.approval.violations", { views: anteprima.violations.map((v) => v.view).join(", ") })}
                  </p>
                ) : <p className="text-muted-foreground">{t("consolidation.approval.noViolations")}</p>}
                {anteprima.toRecompute.length > 0 ? (
                  <p className="text-muted-foreground">{t("consolidation.approval.toRecompute", { views: anteprima.toRecompute.map((v) => v.view).join(", ") })}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{t("consolidation.approval.previewHint")}</p>
              </div>
            ) : null}
            <ol data-testid="consolidation-groups" className="grid gap-2 sm:grid-cols-5">
              {CONSOLIDATION_GROUP_VALUES.map((g) => {
                const p = avanzamento.find((x) => x.group === g);
                const aperto = corrente.openGroup === g;
                const leggibile = gruppi.includes(g);
                return (
                  <li key={g}>
                    <button
                      type="button" disabled={!leggibile}
                      data-testid={`consolidation-group-${g}`}
                      aria-pressed={gruppo === g}
                      onClick={() => setScelto(g)}
                      className={`w-full rounded-card border px-3 py-2 text-left text-sm ${gruppo === g ? "border-primary" : "border-border"} ${leggibile ? "" : "opacity-50"}`}
                    >
                      <span className="block font-medium text-foreground">{t(`consolidation.groups.${g}`)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {aperto ? t("consolidation.open") : p && p.pending === 0 && p.linked + p.adopted + p.rejected + p.customized > 0 ? t("consolidation.done") : t("consolidation.waiting")}
                        {p && p.pending > 0 ? ` · ${t("consolidation.pending", { count: p.pending })}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {ultimo ? (
              <p data-testid="consolidation-last-run" className="text-sm text-muted-foreground">
                {ultimo.ok
                  ? t("consolidation.lastRunOk", {
                    group: t(`consolidation.groups.${ultimo.group}`),
                    proposals: ultimo.proposals ?? 0, rounds: ultimo.rounds ?? 0,
                    seconds: Math.round((ultimo.ms ?? 0) / 1000),
                  })
                  : t("consolidation.lastRunFailed", {
                    group: t(`consolidation.groups.${ultimo.group}`),
                    error: t(`consolidation.errors.${ultimo.error ?? "CONSOLIDATION_RUN_FAILED"}`, { defaultValue: ultimo.error ?? "" }),
                  })}
              </p>
            ) : null}

            {prossimoPasso ? (
              <div role="status" data-testid="consolidation-next-step" className="rounded-card border border-primary/40 bg-card px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-foreground">{t("consolidation.nextTitle")}</p>
                <p>{t(`consolidation.${prossimoPasso.chiave}`, prossimoPasso.vars)}</p>
                <p className="text-xs text-muted-foreground">{t("consolidation.stepsHint")}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canRun && corrente.status === "GIRI" && corrente.openGroup ? (
                <Button
                  type="button" data-testid="consolidation-run" disabled={occupato || inCorso !== null}
                  onClick={() => corrente.openGroup && run.mutate(corrente.openGroup)}
                >
                  {t("consolidation.run", { group: t(`consolidation.groups.${corrente.openGroup}`) })}
                </Button>
              ) : null}
              {isDirector ? (
                <Button
                  type="button" variant="outline" data-testid="consolidation-apply-changes"
                  disabled={occupato || nBozza === 0}
                  onClick={() => prova.mutate()}
                >
                  {prova.isPending ? t("consolidation.applying") : t("consolidation.applyChanges", { count: nBozza })}
                </Button>
              ) : null}
              {canDecide && certe.length > 0 ? (
                <Button
                  type="button" variant="secondary" data-testid="consolidation-confirm-certain" disabled={occupato}
                  onClick={() => confirm.mutate(certe.map((p) => p.proposalId))}
                >
                  {t("consolidation.confirmCertain", { count: certe.length, threshold: CONSOLIDATION_CERTAIN_THRESHOLD })}
                </Button>
              ) : null}
              {canRun && corrente.status === "GIRI" && corrente.openGroup && gruppo === corrente.openGroup ? (
                <Button
                  type="button" variant="outline" data-testid="consolidation-close-group"
                  disabled={occupato || inCorso !== null || !delGruppo || delGruppo.pending > 0 || righe.length === 0}
                  onClick={() => corrente.openGroup && close.mutate(corrente.openGroup)}
                >
                  {t("consolidation.closeGroup")}
                </Button>
              ) : null}
            </div>
            {isDirector && nBozza > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4" data-testid="consolidation-approval">
                <Button
                  type="button" variant="destructive" data-testid="consolidation-approve"
                  disabled={occupato || inCorso !== null}
                  onClick={() => { setErrore(null); setConferma("approva"); }}
                >
                  {t("consolidation.approval.approve", { count: nBozza })}
                </Button>
                <Button
                  type="button" variant="outline" data-testid="consolidation-discard"
                  disabled={occupato}
                  onClick={() => { setErrore(null); setConferma("scarta"); }}
                >
                  {t("consolidation.approval.discard")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("consolidation.approval.hint")}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {corrente && gruppo ? (
        <section data-testid="consolidation-proposals" className="space-y-3">
          <PageHeader
            data-testid="consolidation-proposals-title"
            senzaQuadro
            title={t("consolidation.proposalsTitle", { group: t(`consolidation.groups.${gruppo}`) })}
            description={t("consolidation.proposalsDescription")}
            badges={proposals.data
              ? <Badge variant="secondary" data-testid="consolidation-proposals-count">{t("consolidation.count", { count: righe.length })}</Badge>
              : undefined}
          />
          <EntityTable<ConsolidationProposal> originPath={"/v1/tenant-consolidations"}
            isLoading={proposals.isLoading} isError={proposals.isError} error={proposals.error} errorMessage={t("consolidation.loadError")}
            rows={righe} pageSize={10} rowKey={(p) => p.proposalId} rowTestId="consolidation-proposal-row" columns={columns}
            emptyTestId="consolidation-proposals-empty"
            emptyTitle={t("consolidation.proposalsEmptyTitle")} emptyDescription={t("consolidation.proposalsEmptyDescription")}
            caption={t("consolidation.caption")}
          />
        </section>
      ) : null}
      {conferma ? (
        <Dialog open onOpenChange={(o) => { if (!o) setConferma(null); }}>
          <DialogContent data-testid="consolidation-approval-dialog">
            <DialogHeader>
              <DialogTitle>{t(`consolidation.approval.${conferma}Title`)}</DialogTitle>
              <DialogDescription>{t(`consolidation.approval.${conferma}Body`, { count: nBozza })}</DialogDescription>
            </DialogHeader>
            {errore ? <p role="alert" className="text-sm text-destructive">{errore}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={occupato} onClick={() => setConferma(null)}>{t("consolidation.modal.close")}</Button>
              <Button
                type="button" variant="destructive" data-testid="consolidation-approval-confirm" disabled={occupato}
                onClick={() => (conferma === "approva" ? applica.mutate() : scarta.mutate())}
              >
                {t(`consolidation.approval.${conferma}Confirm`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
      {inDecisione ? (
        <DecisioneDialog
          key={inDecisione.proposalId}
          proposta={inDecisione}
          occupato={decide.isPending}
          errore={errore}
          onConferma={(d, form, cascade) => decide.mutate({ p: inDecisione, d, form, cascade })}
          onChiudi={chiudiDecisione}
        />
      ) : null}
    </main>
  );
}
