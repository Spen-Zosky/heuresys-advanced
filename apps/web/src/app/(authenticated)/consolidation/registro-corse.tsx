"use client";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@heuresys/ui";
import {
  CONSOLIDATION_GROUP_VALUES,
  type AvailableDeliveryList,
  type BlueprintRun,
  type BlueprintRunStatus,
  type TenantConsolidation,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { ApiError } from "@/lib/api/errors";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { useFormat } from "@/lib/format";

// Il registro delle corse del modello (mig 000489, `/v1/consolidation-runs`). La pagina parte dalla
// corsa caricata più di recente; da qui si sceglie con quale corsa (cioè con quale modello) fare un
// giro di consolidamento, si accoglie una corsa nuova consegnata dal datastore, e si dice quale è
// diventata definitiva. Un modello mai consolidato si annuncia come tale, e il tempo dell'agente nel
// primo giro di ogni gruppo resta scritto nel registro.

const RUNS = "/v1/consolidation-runs";
const SESSIONI = "/v1/tenant-consolidations";
const SELECT_CLASS =
  "w-full rounded-control border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATO_TONO: Record<BlueprintRunStatus, StatusTone> = {
  CARICATA: "warning",
  IN_CONSOLIDAMENTO: "info",
  DEFINITIVA: "success",
  SUPERATA: "neutral",
};

/** Il tempo totale dell'agente nei primi giri registrati, o null se non ce n'è ancora uno. */
function tempoAgente(r: BlueprintRun): number | null {
  const v = Object.values(r.initialResults);
  return v.length === 0 ? null : v.reduce((a, x) => a + (x?.ms ?? 0), 0);
}

export function RegistroCorse({
  canRun,
  isDirector,
  sessioneAperta,
  occupato,
  onErrore,
}: {
  canRun: boolean;
  isDirector: boolean;
  sessioneAperta: TenantConsolidation | null;
  occupato: boolean;
  onErrore: (messaggio: string | null) => void;
}) {
  const { t } = useTranslation("hr");
  const fmt = useFormat();
  const qc = useQueryClient();
  const [scelta, setScelta] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["consolidation-runs", "list"],
    queryFn: () => apiFetch<{ items: BlueprintRun[] }>(RUNS),
  });
  const deliveries = useQuery({
    queryKey: ["consolidation-runs", "deliveries"],
    queryFn: () => apiFetch<AvailableDeliveryList>(`${RUNS}/deliveries`),
  });

  // Di partenza la corsa caricata più di recente: l'API le restituisce in quell'ordine.
  const elenco = useMemo(() => runs.data?.items ?? [], [runs.data]);
  const corsa = elenco.find((r) => r.runId === scelta) ?? elenco[0] ?? null;
  const nuove = (deliveries.data?.items ?? []).filter((d) => d.runId === null);

  const errore = (e: unknown) =>
    onErrore(e instanceof ApiError ? t(`consolidationRuns.errors.${e.code}`, { defaultValue: e.message }) : t("consolidation.errors.generic"));
  const rinfresca = () => {
    onErrore(null);
    void qc.invalidateQueries({ queryKey: ["consolidation-runs"] });
    void qc.invalidateQueries({ queryKey: ["tenant-consolidations"] });
  };

  const avvia = useMutation({
    mutationFn: (r: BlueprintRun) => apiFetch<TenantConsolidation>(SESSIONI, {
      method: "POST",
      body: { trigger: r.consolidations === 0 ? "VERSIONE_NUOVA" : "RICHIESTA", runId: r.runId, closeOpen: sessioneAperta !== null },
    }),
    onSuccess: rinfresca, onError: errore,
  });
  const accogli = useMutation({
    mutationFn: (d: { code: string; packageVersion: number }) =>
      apiFetch<BlueprintRun>(`${RUNS}/receive`, { method: "POST", body: d }),
    onSuccess: (r) => { setScelta(r.runId); rinfresca(); }, onError: errore,
  });
  const definitiva = useMutation({
    mutationFn: (r: BlueprintRun) => apiFetch<BlueprintRun>(`${RUNS}/${r.runId}/definitive`, { method: "POST", body: {} }),
    onSuccess: rinfresca, onError: errore,
  });
  const fermo = occupato || avvia.isPending || accogli.isPending || definitiva.isPending;

  const colonne = useMemo<DataColumn<BlueprintRun>[]>(() => [
    {
      header: t("consolidationRuns.cols.model"),
      cell: (r) => (
        <button type="button" className="text-left font-medium text-foreground underline-offset-2 hover:underline"
          data-testid="consolidation-runs-pick" onClick={() => setScelta(r.runId)}>
          {r.modelLabel}
        </button>
      ),
    },
    { header: t("consolidationRuns.cols.executed"), cell: (r) => (r.executedFrom ? fmt.dataOra(r.executedFrom) : t("consolidation.none")) },
    { header: t("consolidationRuns.cols.loaded"), cell: (r) => fmt.dataOra(r.modelLoadedAt) },
    { header: t("consolidationRuns.cols.consolidations"), align: "right", cell: (r) => <span className="tabular-nums">{r.consolidations}</span> },
    { header: t("consolidationRuns.cols.agentTime"), align: "right", cell: (r) => fmt.durata(tempoAgente(r)) },
    { header: t("consolidationRuns.cols.code"), secondaria: true, cell: (r) => `${r.code} · ${r.packageVersion}` },
    {
      header: t("consolidationRuns.cols.status"),
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          <StatusPill tone={STATO_TONO[r.status]}>{t(`consolidationRuns.statuses.${r.status}`)}</StatusPill>
          {r.inUse ? <StatusPill tone="success">{t("consolidationRuns.inUse")}</StatusPill> : null}
        </span>
      ),
    },
  ], [t, fmt]);

  return (
    <Card data-testid="consolidation-runs">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <span>{t("consolidationRuns.title")}</span>
          {runs.data ? <Badge variant="secondary">{t("consolidationRuns.count", { count: elenco.length })}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {elenco.length > 0 ? (
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">{t("consolidationRuns.pick")}</span>
            <select
              data-testid="consolidation-runs-select" className={SELECT_CLASS}
              value={corsa?.runId ?? ""} onChange={(e) => setScelta(e.target.value)}
            >
              {elenco.map((r) => (
                <option key={r.runId} value={r.runId}>
                  {t("consolidationRuns.option", { model: r.modelLabel, date: fmt.data(r.modelLoadedAt), status: t(`consolidationRuns.statuses.${r.status}`) })}
                </option>
              ))}
            </select>
          </label>
        ) : runs.data ? (
          <p data-testid="consolidation-runs-empty" className="text-sm text-muted-foreground">{t("consolidationRuns.empty")}</p>
        ) : null}

        {corsa ? (
          <div data-testid="consolidation-run-selected" className="space-y-3">
            {corsa.consolidations === 0 ? (
              <div role="status" data-testid="consolidation-run-never" className="rounded-card border border-warning/50 bg-card px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-foreground">
                  {t("consolidationRuns.never", { model: corsa.modelLabel, date: fmt.dataOra(corsa.modelLoadedAt) })}
                </p>
                <p className="text-muted-foreground">{t("consolidationRuns.neverHint")}</p>
              </div>
            ) : null}
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <dt className="text-muted-foreground">{t("consolidationRuns.fields.description")}</dt>
              <dd className="text-foreground">{corsa.description ?? t("consolidation.none")}</dd>
              <dt className="text-muted-foreground">{t("consolidationRuns.fields.executed")}</dt>
              <dd className="text-foreground">
                {corsa.executedFrom && corsa.executedTo
                  ? t("consolidationRuns.range", { from: fmt.dataOra(corsa.executedFrom), to: fmt.dataOra(corsa.executedTo) })
                  : t("consolidation.none")}
              </dd>
              <dt className="text-muted-foreground">{t("consolidationRuns.fields.loaded")}</dt>
              <dd className="text-foreground">{fmt.dataOra(corsa.modelLoadedAt)}</dd>
              <dt className="text-muted-foreground">{t("consolidationRuns.fields.status")}</dt>
              <dd className="flex flex-wrap gap-1">
                <StatusPill tone={STATO_TONO[corsa.status]}>{t(`consolidationRuns.statuses.${corsa.status}`)}</StatusPill>
                {corsa.inUse ? <StatusPill tone="success">{t("consolidationRuns.inUse")}</StatusPill> : null}
              </dd>
            </dl>

            {Object.keys(corsa.initialResults).length > 0 ? (
              <table data-testid="consolidation-run-results" className="w-full text-sm">
                <caption className="pb-1 text-left text-muted-foreground">{t("consolidationRuns.results.caption")}</caption>
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 font-medium">{t("consolidationRuns.results.group")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.items")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.proposals")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.certain")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.gaps")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.customizations")}</th>
                    <th className="py-1 text-right font-medium">{t("consolidationRuns.results.time")}</th>
                  </tr>
                </thead>
                <tbody>
                  {CONSOLIDATION_GROUP_VALUES.map((g) => {
                    const x = corsa.initialResults[g];
                    if (!x) return null;
                    return (
                      <tr key={g} className="border-t border-border">
                        <td className="py-1 text-foreground">{t(`consolidation.groups.${g}`)}</td>
                        <td className="py-1 text-right tabular-nums">{t("consolidationRuns.results.itemsValue", { tenant: x.tenantItems, prototype: x.prototypeItems })}</td>
                        <td className="py-1 text-right tabular-nums">{x.proposals}</td>
                        <td className="py-1 text-right tabular-nums">{x.certain}</td>
                        <td className="py-1 text-right tabular-nums">{x.gaps}</td>
                        <td className="py-1 text-right tabular-nums">{x.customizations}</td>
                        <td className="py-1 text-right tabular-nums">{fmt.durata(x.ms)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {canRun && corsa.variantVersionId ? (
                <Button
                  type="button" data-testid="consolidation-run-start" disabled={fermo}
                  onClick={() => {
                    if (sessioneAperta && !window.confirm(t("consolidationRuns.confirmReplace"))) return;
                    avvia.mutate(corsa);
                  }}
                >
                  {corsa.consolidations === 0 ? t("consolidationRuns.startFirst") : t("consolidationRuns.startAgain")}
                </Button>
              ) : null}
              {isDirector && corsa.status !== "DEFINITIVA" && corsa.variantVersionId ? (
                <Button
                  type="button" variant="outline" data-testid="consolidation-run-definitive" disabled={fermo}
                  onClick={() => { if (window.confirm(t("consolidationRuns.confirmDefinitive"))) definitiva.mutate(corsa); }}
                >
                  {t("consolidationRuns.makeDefinitive")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {canRun && nuove.length > 0 ? (
          <div data-testid="consolidation-deliveries" className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t("consolidationRuns.deliveries")}</p>
            <ul className="space-y-2">
              {nuove.map((d) => (
                <li key={`${d.code}-${d.packageVersion}`} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border px-3 py-2 text-sm">
                  <span className="text-foreground">
                    {t("consolidationRuns.delivery", {
                      description: d.description ?? d.code,
                      executed: d.executedFrom ? fmt.dataOra(d.executedFrom) : t("consolidation.none"),
                      delivered: fmt.dataOra(d.deliveredAt),
                    })}
                  </span>
                  <Button
                    type="button" size="sm" variant="secondary" data-testid="consolidation-delivery-receive" disabled={fermo}
                    onClick={() => accogli.mutate({ code: d.code, packageVersion: d.packageVersion })}
                  >
                    {accogli.isPending ? t("consolidationRuns.receiving") : t("consolidationRuns.receive")}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {elenco.length > 0 ? (
          <EntityTable<BlueprintRun> originPath={RUNS}
            isLoading={runs.isLoading} isError={runs.isError} error={runs.error} errorMessage={t("consolidation.loadError")}
            rows={elenco} pageSize={10} rowKey={(r) => r.runId} rowTestId="consolidation-run-row" columns={colonne}
            emptyTestId="consolidation-runs-table-empty"
            emptyTitle={t("consolidationRuns.empty")} emptyDescription={t("consolidationRuns.empty")}
            caption={t("consolidationRuns.caption")}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
