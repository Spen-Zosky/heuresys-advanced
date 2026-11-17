"use client";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@heuresys/ui";
import {
  PROPOSAL_OUTCOME_VALUES,
  type BulkDecideBody,
  type BulkDecideResult,
  type ConsolidationProposal,
  type ProposalOutcome,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";

// Le decisioni in blocco (Enzo, 2026-11-15). Si filtra (esito, fiducia, stato), si scelgono le righe
// (una per una o tutte le filtrate) e si decide insieme: la raccomandazione dell'agente, il rifiuto,
// oppure la cascata delle decisioni già prese. Tutto va nella bozza come una decisione singola: i dati
// cambiano solo con «Approva definitivamente le modifiche». Il conto di ciò che succede lo dà l'API.

type Stato = "DA_DECIDERE" | "DECISE" | "TUTTE";

export function DecisioniInBlocco({
  righe, colonne, consolidationId, canDecide, isDirector, occupato, onFatto, onErrore,
  isLoading, isError, error,
}: {
  righe: ConsolidationProposal[];
  colonne: DataColumn<ConsolidationProposal>[];
  consolidationId: string;
  canDecide: boolean;
  isDirector: boolean;
  occupato: boolean;
  onFatto: () => void;
  onErrore: (e: unknown) => void;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}) {
  const { t } = useTranslation("hr");
  const [esito, setEsito] = useState<ProposalOutcome | "TUTTI">("TUTTI");
  const [stato, setStato] = useState<Stato>("TUTTE");
  const [minimo, setMinimo] = useState(0);
  const [massimo, setMassimo] = useState(100);
  const [scelte, setScelte] = useState<Set<string>>(new Set());
  const [conCascata, setConCascata] = useState(false);
  const [rivedi, setRivedi] = useState(false);
  const [esitoBlocco, setEsitoBlocco] = useState<{ chiave: string; r: BulkDecideResult | { discarded: number } } | null>(null);

  const filtrate = useMemo(() => righe.filter((p) =>
    (esito === "TUTTI" || p.outcome === esito)
    && p.confidence >= minimo && p.confidence <= massimo
    && (stato === "TUTTE" || (stato === "DA_DECIDERE" ? p.decision === null : p.decision !== null))), [righe, esito, stato, minimo, massimo]);
  // la scelta vale solo per le righe che si vedono: cambiare filtro non decide righe nascoste
  const selezionate = useMemo(() => filtrate.filter((p) => scelte.has(p.proposalId)), [filtrate, scelte]);
  const decise = selezionate.filter((p) => p.decision !== null);

  const blocco = useMutation({
    mutationFn: (v: { chiave: string; body: BulkDecideBody }) =>
      apiFetch<BulkDecideResult>("/v1/tenant-consolidations/proposals/bulk-decision", { method: "POST", body: v.body })
        .then((r) => ({ chiave: v.chiave, r })),
    onSuccess: (x) => { setEsitoBlocco(x); setScelte(new Set()); onFatto(); },
    onError: onErrore,
  });
  const rimetti = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ discarded: number }>(`/v1/tenant-consolidations/${consolidationId}/discard-changes`, { method: "POST", body: { proposalIds: ids } })
        .then((r) => ({ chiave: "undo", r })),
    onSuccess: (x) => { setEsitoBlocco(x); setScelte(new Set()); onFatto(); },
    onError: onErrore,
  });
  const fermo = occupato || blocco.isPending || rimetti.isPending;
  const ids = selezionate.map((p) => p.proposalId);
  const decidi = (chiave: string, mode: BulkDecideBody["mode"]) => blocco.mutate({
    chiave,
    body: { proposalIds: mode === "CASCATA" ? decise.map((p) => p.proposalId) : ids, mode,
      ...(mode !== "CASCATA" && conCascata ? { cascade: true } : {}),
      ...(mode !== "CASCATA" && rivedi && isDirector ? { onlyUndecided: false } : {}) },
  });
  const cambia = (id: string, on: boolean) => setScelte((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  const colonneConScelta: DataColumn<ConsolidationProposal>[] = canDecide ? [{
    header: t("consolidation.bulk.select"),
    cell: (p) => (
      <input
        type="checkbox" data-testid="consolidation-bulk-row" aria-label={t("consolidation.bulk.selectRow")}
        checked={scelte.has(p.proposalId)} onChange={(e) => cambia(p.proposalId, e.target.checked)}
      />
    ),
  }, ...colonne] : colonne;

  const campo = "rounded-md border border-border bg-background px-2 py-1 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-card border bg-card px-4 py-3 text-sm" data-testid="consolidation-filters">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("consolidation.bulk.outcome")}</span>
          <select className={campo} data-testid="consolidation-filter-outcome" value={esito} onChange={(e) => setEsito(e.target.value as ProposalOutcome | "TUTTI")}>
            <option value="TUTTI">{t("consolidation.bulk.all")}</option>
            {PROPOSAL_OUTCOME_VALUES.map((o) => <option key={o} value={o}>{t(`consolidation.outcomes.${o}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("consolidation.bulk.state")}</span>
          <select className={campo} data-testid="consolidation-filter-state" value={stato} onChange={(e) => setStato(e.target.value as Stato)}>
            <option value="TUTTE">{t("consolidation.bulk.all")}</option>
            <option value="DA_DECIDERE">{t("consolidation.bulk.undecided")}</option>
            <option value="DECISE">{t("consolidation.bulk.decided")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("consolidation.bulk.minConfidence")}</span>
          <input type="number" min={0} max={100} className={`${campo} w-20`} data-testid="consolidation-filter-min"
            value={minimo} onChange={(e) => setMinimo(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("consolidation.bulk.maxConfidence")}</span>
          <input type="number" min={0} max={100} className={`${campo} w-20`} data-testid="consolidation-filter-max"
            value={massimo} onChange={(e) => setMassimo(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
        </label>
        <p className="text-xs text-muted-foreground" data-testid="consolidation-filter-count">
          {t("consolidation.bulk.shown", { shown: filtrate.length, total: righe.length })}
        </p>
      </div>

      {canDecide ? (
        <div className="space-y-2 rounded-card border border-primary/40 bg-card px-4 py-3 text-sm" data-testid="consolidation-bulk">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" data-testid="consolidation-bulk-select-all" disabled={fermo || filtrate.length === 0}
              onClick={() => setScelte(new Set(filtrate.map((p) => p.proposalId)))}>
              {t("consolidation.bulk.selectAll", { count: filtrate.length })}
            </Button>
            <Button type="button" size="sm" variant="outline" data-testid="consolidation-bulk-clear" disabled={fermo || selezionate.length === 0}
              onClick={() => setScelte(new Set())}>
              {t("consolidation.bulk.clear")}
            </Button>
            <span className="font-medium" data-testid="consolidation-bulk-count">{t("consolidation.bulk.selected", { count: selezionate.length })}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" data-testid="consolidation-bulk-with-cascade" checked={conCascata} onChange={(e) => setConCascata(e.target.checked)} />
              <span>{t("consolidation.bulk.withCascade")}</span>
            </label>
            {isDirector ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" data-testid="consolidation-bulk-revise" checked={rivedi} onChange={(e) => setRivedi(e.target.checked)} />
                <span>{t("consolidation.bulk.revise")}</span>
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" data-testid="consolidation-bulk-recommended" disabled={fermo || selezionate.length === 0}
              onClick={() => decidi("recommended", "RACCOMANDATA")}>
              {t("consolidation.bulk.recommended", { count: selezionate.length })}
            </Button>
            <Button type="button" size="sm" variant="outline" data-testid="consolidation-bulk-reject" disabled={fermo || selezionate.length === 0}
              onClick={() => decidi("reject", "RIFIUTO")}>
              {t("consolidation.bulk.reject", { count: selezionate.length })}
            </Button>
            <Button type="button" size="sm" variant="secondary" data-testid="consolidation-bulk-cascade" disabled={fermo || decise.length === 0}
              onClick={() => decidi("cascade", "CASCATA")}>
              {t("consolidation.bulk.cascade", { count: decise.length })}
            </Button>
            {isDirector ? (
              <Button type="button" size="sm" variant="outline" data-testid="consolidation-bulk-undo" disabled={fermo || decise.length === 0}
                onClick={() => rimetti.mutate(decise.map((p) => p.proposalId))}>
                {t("consolidation.bulk.undo", { count: decise.length })}
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("consolidation.bulk.hint")}</p>
          {esitoBlocco ? (
            <p role="status" data-testid="consolidation-bulk-result">
              {"discarded" in esitoBlocco.r
                ? t("consolidation.bulk.resultUndo", { count: esitoBlocco.r.discarded })
                : t("consolidation.bulk.result", { decided: esitoBlocco.r.decided, cascaded: esitoBlocco.r.cascaded, skipped: esitoBlocco.r.skipped.length })}
            </p>
          ) : null}
        </div>
      ) : null}

      <EntityTable<ConsolidationProposal> originPath={"/v1/tenant-consolidations"}
        isLoading={isLoading} isError={isError} error={error} errorMessage={t("consolidation.loadError")}
        rows={filtrate} pageSize={10} rowKey={(p) => p.proposalId} rowTestId="consolidation-proposal-row" columns={colonneConScelta}
        emptyTestId="consolidation-proposals-empty"
        emptyTitle={t("consolidation.proposalsEmptyTitle")} emptyDescription={t("consolidation.proposalsEmptyDescription")}
        caption={t("consolidation.caption")}
      />
    </div>
  );
}
