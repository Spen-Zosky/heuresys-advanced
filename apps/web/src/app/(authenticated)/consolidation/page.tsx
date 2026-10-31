"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@heuresys/ui";
import {
  ALLOWED_DECISIONS,
  CONSOLIDATION_CERTAIN_THRESHOLD,
  CONSOLIDATION_GROUP_VALUES,
  type ConsolidationAccess,
  type ConsolidationGroup,
  type ConsolidationItemRef,
  type ConsolidationProposal,
  type Decision,
  type GroupProgress,
  type ProposalOutcome,
  type TenantConsolidation,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill, type StatusTone } from "@/components/status-pill";

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
  onDecide: (p: ConsolidationProposal, d: Decision) => void,
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
          {p.decision ? (
            <StatusPill tone={decisionTone(p.decision)}>{t(`consolidation.decisions.${p.decision}`)}</StatusPill>
          ) : null}
          {canDecide
            ? ALLOWED_DECISIONS[p.outcome].filter((d) => d !== p.decision).map((d) => (
              <Button
                key={d} type="button" size="sm" variant="outline" disabled={busy}
                data-testid={`consolidation-decide-${d}`}
                onClick={() => onDecide(p, d)}
              >
                {t(`consolidation.actions.${d}`)}
              </Button>
            ))
            : null}
        </div>
      ),
    },
  ];
}

export default function ConsolidationPage() {
  const { t } = useTranslation("hr");
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
  const righe = useMemo(() => proposals.data?.items ?? [], [proposals.data]);
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
  const decide = useMutation({
    mutationFn: (v: { p: ConsolidationProposal; d: Decision }) =>
      apiFetch(`${BASE}/proposals/${v.p.proposalId}/decision`, { method: "POST", body: { decision: v.d } }),
    onSuccess: rinfresca, onError: fallita,
  });
  const confirm = useMutation({
    mutationFn: (ids: string[]) => apiFetch(`${BASE}/proposals/confirm-certain`, { method: "POST", body: { proposalIds: ids } }),
    onSuccess: rinfresca, onError: fallita,
  });

  const occupato = start.isPending || run.isPending || close.isPending || decide.isPending || confirm.isPending;
  const canRun = access.data?.canRun ?? false;
  const canDecide = corrente !== null && gruppo !== null && (access.data?.groups.includes(gruppo) ?? false);
  const columns = useMemo(
    () => buildColumns(t, canDecide, (p, d) => decide.mutate({ p, d }), occupato),
    [t, canDecide, decide, occupato],
  );
  const avanzamento = progress.data?.groups ?? [];
  const delGruppo = avanzamento.find((g) => g.group === gruppo) ?? null;
  const ultimo = corrente?.lastRun ?? null;

  return (
    <main data-testid="consolidation-page" className="mx-auto max-w-7xl space-y-6 px-6 py-8">
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
        <div data-testid="consolidation-load-error" className="rounded-card border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {t("consolidation.loadError")}
        </div>
      ) : null}

      {sessions.data && corrente === null ? (
        <Card data-testid="consolidation-empty">
          <CardHeader><CardTitle>{t("consolidation.emptyTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{t("consolidation.emptyDescription")}</p>
            {canRun ? (
              <Button type="button" data-testid="consolidation-start" disabled={occupato} onClick={() => start.mutate()}>
                {t("consolidation.start")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {corrente ? (
        <Card data-testid="consolidation-session">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span>{t("consolidation.session", { date: new Date(corrente.startedAt).toLocaleDateString() })}</span>
              <StatusPill tone="info">{t(`consolidation.statuses.${corrente.status}`)}</StatusPill>
              {inCorso ? (
                <StatusPill tone="warning" data-testid="consolidation-running">
                  {t("consolidation.running", { group: t(`consolidation.groups.${inCorso}`) })}
                </StatusPill>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="flex flex-wrap gap-2">
              {canRun && corrente.status === "GIRI" && corrente.openGroup ? (
                <Button
                  type="button" data-testid="consolidation-run" disabled={occupato || inCorso !== null}
                  onClick={() => corrente.openGroup && run.mutate(corrente.openGroup)}
                >
                  {t("consolidation.run", { group: t(`consolidation.groups.${corrente.openGroup}`) })}
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
          </CardContent>
        </Card>
      ) : null}

      {corrente && gruppo ? (
        <section data-testid="consolidation-proposals" className="space-y-3">
          <PageHeader
            data-testid="consolidation-proposals-title"
            title={t("consolidation.proposalsTitle", { group: t(`consolidation.groups.${gruppo}`) })}
            description={t("consolidation.proposalsDescription")}
            badges={proposals.data
              ? <Badge variant="secondary" data-testid="consolidation-proposals-count">{t("consolidation.count", { count: righe.length })}</Badge>
              : undefined}
          />
          <EntityTable<ConsolidationProposal>
            isLoading={proposals.isLoading} isError={proposals.isError} errorMessage={t("consolidation.loadError")}
            rows={righe} rowKey={(p) => p.proposalId} rowTestId="consolidation-proposal-row" columns={columns}
            emptyTestId="consolidation-proposals-empty"
            emptyTitle={t("consolidation.proposalsEmptyTitle")} emptyDescription={t("consolidation.proposalsEmptyDescription")}
            caption={t("consolidation.caption")}
          />
        </section>
      ) : null}
    </main>
  );
}
