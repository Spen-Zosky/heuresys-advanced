"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Badge, Card, CardContent, CardHeader, CardTitle, type KpiCardData } from "@heuresys/ui";
import { PageHeader } from "@/components/intestazione-pagina";
import { KPIStrip } from "@/components/indicatori-leggibili";
import { SchedePagina } from "@/components/schede-pagina";
import type {
  NineBoxRow, TalentBand, FitScore, ReadinessScore, SuccessionScore,
  CriticalPosition, CriticalCoverage, EquitaDichiarazione,
} from "@heuresys/shared";
import { DichiarazioneEquita } from "@/components/dichiarazione-equita";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { StatoErrore } from "@/components/stato-pagina";
import { useEnumLabel, type EnumLabelFn } from "@/lib/enum-labels";
import { useFormat, type Formati } from "@/lib/format";
import { NomeOppure } from "@/components/senza-nome";
import { NomePersona } from "@/components/nome-persona";

/**
 * A/L3 (#29) — Talent review admin page. Live over /v1/talent-review/*:
 * a board-ready 3×3 9-box grid (potential × performance, EVALUATION org-gated),
 * plus position-fit / readiness / succession score panels (org-gated) and the
 * critical-positions / critical-role-coverage catalog panels (tenant-scoped).
 * READ-only consultation. Sidebar row gated on talent:read (no self-view).
 */

// grid axes: potential HIGH→LOW top-to-bottom (rows); performance LOW→HIGH left-to-right (cols)
const POTENTIAL_ROWS: TalentBand[] = ["HIGH", "MEDIUM", "LOW"];
const PERFORMANCE_COLS: TalentBand[] = ["LOW", "MEDIUM", "HIGH"];

function cellKey(pot: TalentBand, perf: TalentBand): string {
  return `${pot}|${perf}`;
}

function buildFitColumns(t: TFunction, f: Formati, enumLabel: EnumLabelFn): DataColumn<FitScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span><NomePersona nome={r.subjectUserName} id={r.userId} /></span> },
    { header: t("talentReview.cols.position"), cell: (r) => <NomeOppure nome={r.positionTitle} id={r.positionId} /> },
    { header: t("talentReview.cols.dimension"), cell: (r) => <span className="text-xs text-muted-foreground">{enumLabel("fitDimension", r.dimension)}</span> },
    { header: t("talentReview.cols.score"), align: "right", cell: (r) => <span className="tabular-nums">{r.score}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{f.data(r.computedAt)}</span> },
  ];
}

function buildReadinessColumns(t: TFunction, enumLabel: EnumLabelFn, f: Formati): DataColumn<ReadinessScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span><NomePersona nome={r.subjectUserName} id={r.userId} /></span> },
    { header: t("talentReview.cols.position"), cell: (r) => <NomeOppure nome={r.positionTitle} id={r.positionId} /> },
    { header: t("talentReview.cols.horizon"), cell: (r) => <span className="text-xs text-muted-foreground">{enumLabel("horizon", r.horizon)}</span> },
    { header: t("talentReview.cols.value"), align: "right", cell: (r) => <span className="tabular-nums">{r.value ?? "—"}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{f.data(r.computedAt)}</span> },
  ];
}

function buildSuccessionColumns(t: TFunction, enumLabel: EnumLabelFn, f: Formati): DataColumn<SuccessionScore>[] {
  return [
    { header: t("talentReview.cols.employee"), cell: (r) => <span><NomePersona nome={r.subjectUserName} id={r.userId} /></span> },
    { header: t("talentReview.cols.position"), cell: (r) => <NomeOppure nome={r.positionTitle} id={r.positionId} /> },
    { header: t("talentReview.cols.value"), align: "right", cell: (r) => <span className="tabular-nums">{r.value ?? "—"}</span> },
    { header: t("talentReview.cols.horizon"), cell: (r) => <span className="text-xs text-muted-foreground">{enumLabel("horizon", r.horizon)}</span> },
    { header: t("talentReview.cols.computedAt"), cell: (r) => <span className="tabular-nums text-xs">{f.data(r.computedAt)}</span> },
  ];
}

/** D12: il codice interno della corsa di importazione non si mostra (R4): resta la frase generica. */
const CODICE_CORSA = /corsa\s+p\d{6,}\w*/i;
const motivazioneLeggibile = (m: string | null, t: TFunction) => (m === null || m === "" ? "—" : CODICE_CORSA.test(m) ? t("talentReview.rationaleImported") : m);

function buildCriticalPositionColumns(t: TFunction, f: Formati): DataColumn<CriticalPosition>[] {
  return [
    { header: t("talentReview.cols.position"), cell: (r) => <NomeOppure nome={r.positionTitle} id={r.positionId} /> },
    { header: t("talentReview.cols.rationale"), cell: (r) => <span className="text-xs text-muted-foreground">{motivazioneLeggibile(r.rationale, t)}</span> },
    { header: t("talentReview.cols.businessImpact"), align: "right", cell: (r) => <span className="tabular-nums">{r.businessImpactScore ?? "—"}</span> },
    { header: t("talentReview.cols.flaggedAt"), cell: (r) => <span className="tabular-nums text-xs">{f.data(r.flaggedAt)}</span> },
  ];
}

function buildCoverageColumns(t: TFunction): DataColumn<CriticalCoverage>[] {
  return [
    { header: t("talentReview.cols.position"), cell: (r) => <NomeOppure nome={r.positionTitle} id={r.positionId} /> },
    { header: t("talentReview.cols.readyNow"), align: "right", cell: (r) => <span className="tabular-nums">{r.readyNowCount ?? "—"}</span> },
    { header: t("talentReview.cols.ready6mo"), align: "right", cell: (r) => <span className="tabular-nums">{r.ready6moCount ?? "—"}</span> },
    { header: t("talentReview.cols.ready1y"), align: "right", cell: (r) => <span className="tabular-nums">{r.ready1yCount ?? "—"}</span> },
    { header: t("talentReview.cols.coverage"), align: "right", cell: (r) => <span className="tabular-nums">{r.overallScore ?? t("talentReview.coverageNotComputed")}</span> },
  ];
}

export default function TalentReviewPage() {
  const { t } = useTranslation("admin");
  const f = useFormat();
  const enumLabel = useEnumLabel();

  // C4 (#42): server-side pagination. `initialPageSize: 200` is an HONEST cap (matches
  // both the schema's max and the previous hardcoded `?limit=200`) — the 3×3 grid needs
  // the full assessed set as ONE coherent snapshot (bucketed by potential×performance),
  // not incremental pages; there is no pager UI on a grid, unlike the row-list panels below.
  const nineBox = usePaginatedList<NineBoxRow>({
    queryKey: ["talent-review", "nine-box"],
    path: "/v1/talent-review/nine-box",
    initialPageSize: 200,
  });

  const fit = usePaginatedList<FitScore>({ queryKey: ["talent-review", "fit"], path: "/v1/talent-review/fit" });
  const readiness = usePaginatedList<ReadinessScore>({ queryKey: ["talent-review", "readiness"], path: "/v1/talent-review/readiness" });
  const succession = usePaginatedList<SuccessionScore>({ queryKey: ["talent-review", "succession"], path: "/v1/talent-review/succession" });
  const criticalPositions = usePaginatedList<CriticalPosition>({ queryKey: ["talent-review", "critical-positions"], path: "/v1/talent-review/critical-positions" });
  const coverage = usePaginatedList<CriticalCoverage>({ queryKey: ["talent-review", "critical-coverage"], path: "/v1/talent-review/critical-coverage" });
  // E12 (F6b): ogni elenco che si pronuncia sulle persone porta la sua dichiarazione di equità,
  // calcolata dall'API sull'intera popolazione del perimetro (non sulla pagina).
  const equitaDi = (d: unknown): EquitaDichiarazione | undefined => (d as { equita?: EquitaDichiarazione } | undefined)?.equita;
  const equitaNineBox = equitaDi(nineBox.query.data);
  const equitaReadiness = equitaDi(readiness.query.data);
  const equitaSuccession = equitaDi(succession.query.data);

  const fitColumns = useMemo(() => buildFitColumns(t, f, enumLabel), [t, f, enumLabel]);
  const readinessColumns = useMemo(() => buildReadinessColumns(t, enumLabel, f), [t, enumLabel, f]);
  const successionColumns = useMemo(() => buildSuccessionColumns(t, enumLabel, f), [t, enumLabel, f]);
  const criticalPositionColumns = useMemo(() => buildCriticalPositionColumns(t, f), [t, f]);
  const coverageColumns = useMemo(() => buildCoverageColumns(t), [t]);

  /** Righe che la griglia non può posizionare perché il giudizio è trattenuto (#124 D6). */
  const nonPosizionabili = useMemo(
    () => nineBox.rows.filter((r) => r.potentialBand === undefined || r.performanceBand === undefined).length,
    [nineBox.rows],
  );

  // group the 9-box rows into the 3×3 cells (potentialBand × performanceBand)
  const cells = useMemo(() => {
    const map = new Map<string, NineBoxRow[]>();
    for (const row of nineBox.rows) {
      // #124 D6: senza le bande la riga NON ha una casella nella griglia. Non le
      // si inventa una posizione (falserebbe la lettura) e non la si fa sparire
      // in silenzio: si conta a parte, e il conteggio è dichiarato sotto la
      // griglia. Una persona che scompare senza spiegazione è il difetto
      // peggiore dei due.
      if (row.potentialBand === undefined || row.performanceBand === undefined) continue;
      const key = cellKey(row.potentialBand, row.performanceBand);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return map;
  }, [nineBox.rows]);

  // Giro 18/11 (G-RENDER): con i dati trattenuti (serve la conferma del secondo fattore, o il profilo non
  // li comprende) la pagina scriveva «0» e una griglia vuota, come se nessuno fosse valutato. Una lettura
  // che l'API nega non e' zero: si scrive «—» e la griglia dice perche' non c'e'.
  const num = (q: { total: number; query: { isError: boolean } }): string => (q.query.isError ? "—" : f.numero(q.total));
  const kpis: KpiCardData[] = [
    { label: t("talentReview.kpi.assessed"), value: num(nineBox) },
    { label: t("talentReview.kpi.fit"), value: num(fit) },
    { label: t("talentReview.kpi.readiness"), value: num(readiness) },
    { label: t("talentReview.kpi.succession"), value: num(succession) },
    { label: t("talentReview.kpi.criticalPositions"), value: num(criticalPositions) },
  ];

  return (
    <div data-testid="talent-review-page" className="mx-auto max-w-7xl space-y-6 px-6 pb-8">
      <PageHeader
        data-testid="talent-review-title"
        title={t("talentReview.title")}
        description={t("talentReview.description")}
      />

      <KPIStrip items={kpis} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("talentReview.nineBox.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {nineBox.query.isError ? (
            <StatoErrore errore={nineBox.query.error} testId="talent-nine-box-error" onRiprova={() => void nineBox.query.refetch()} />
          ) : (
          <div className="flex items-stretch gap-3">
            {/* y-axis label */}
            <div className="flex items-center">
              <span className="rotate-180 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
                {t("talentReview.nineBox.axisPotential")}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {nonPosizionabili > 0 && (
                <p data-testid="talent-nine-box-masked" className="text-xs italic text-muted-foreground">
                  {t("talentReview.nineBox.maskedRows", { count: nonPosizionabili })}
                </p>
              )}
              <div data-testid="talent-nine-box" className="grid grid-cols-3 gap-2">
                {POTENTIAL_ROWS.map((pot) =>
                  PERFORMANCE_COLS.map((perf) => {
                    const rows = cells.get(cellKey(pot, perf)) ?? [];
                    return (
                      <div
                        key={cellKey(pot, perf)}
                        data-testid="talent-nine-box-cell"
                        data-potential={pot}
                        data-performance={perf}
                        className="flex min-h-32 flex-col gap-2 rounded-card border border-border bg-card p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs uppercase tracking-wider text-muted-foreground">
                            {t(`talentReview.nineBox.band.${pot}`)} / {t(`talentReview.nineBox.band.${perf}`)}
                          </span>
                          <Badge variant="secondary">{rows.length}</Badge>
                        </div>
                        {/* F-6 (L7): la cella scorre quando le persone sono molte; un'area che
                            scorre deve potersi raggiungere da tastiera (`scrollable-region-focusable`),
                            e allora porta un nome: la casella e quante persone contiene. */}
                        <div
                          role="list"
                          tabIndex={0}
                          aria-label={`${t(`talentReview.nineBox.band.${pot}`)} / ${t(`talentReview.nineBox.band.${perf}`)}: ${rows.length}`}
                          className="flex max-h-40 flex-wrap gap-1 overflow-auto rounded-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {rows.map((r) => (
                            <span
                              role="listitem"
                              key={r.talentScoreId}
                              className="rounded-control border border-border bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
                            >
                              <NomePersona nome={r.subjectUserName} id={r.userId} />
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
              {/* x-axis label */}
              <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("talentReview.nineBox.axisPerformance")}
              </div>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {equitaNineBox && <DichiarazioneEquita equita={equitaNineBox} />}

      {/* C5: le sezioni lunghe stanno in schede orizzontali */}
      <SchedePagina
        schede={[
          { id: "fit", titolo: t("talentReview.sections.fit"), contenuto: (
            <div className="space-y-3">
            <EntityTable<FitScore>
              isLoading={fit.query.isLoading}
              isError={fit.query.isError}
              error={fit.query.error}
              errorMessage={t("talentReview.error")}
              rows={fit.rows}
              server={fit.server}
              rowKey={(r) => r.fitScoreId}
              rowTestId="talent-fit-row"
              columns={fitColumns}
              emptyTitle={t("talentReview.empty")}
              caption={t("talentReview.sections.fit")}
            />
            </div>
          ) },
          { id: "prontezza", titolo: t("talentReview.sections.readiness"), contenuto: (
            <div className="space-y-3">
            {equitaReadiness && <DichiarazioneEquita equita={equitaReadiness} />}
            <EntityTable<ReadinessScore>
              isLoading={readiness.query.isLoading}
              isError={readiness.query.isError}
              error={readiness.query.error}
              errorMessage={t("talentReview.error")}
              rows={readiness.rows}
              server={readiness.server}
              rowKey={(r) => r.readinessScoreId}
              rowTestId="talent-readiness-row"
              columns={readinessColumns}
              emptyTitle={t("talentReview.empty")}
              caption={t("talentReview.sections.readiness")}
            />
            </div>
          ) },
          { id: "successione", titolo: t("talentReview.sections.succession"), contenuto: (
            <div className="space-y-3">
            {equitaSuccession && <DichiarazioneEquita equita={equitaSuccession} />}
            <EntityTable<SuccessionScore>
              isLoading={succession.query.isLoading}
              isError={succession.query.isError}
              error={succession.query.error}
              errorMessage={t("talentReview.error")}
              rows={succession.rows}
              server={succession.server}
              rowKey={(r) => r.successionScoreId}
              rowTestId="talent-succession-row"
              columns={successionColumns}
              emptyTitle={t("talentReview.empty")}
              caption={t("talentReview.sections.succession")}
            />
            </div>
          ) },
          { id: "critiche", titolo: t("talentReview.sections.criticalPositions"), contenuto: (
            <div className="space-y-3">
            <EntityTable<CriticalPosition>
              isLoading={criticalPositions.query.isLoading}
              isError={criticalPositions.query.isError}
              error={criticalPositions.query.error}
              errorMessage={t("talentReview.error")}
              rows={criticalPositions.rows}
              server={criticalPositions.server}
              rowKey={(r) => r.criticalPositionId}
              rowTestId="talent-critical-position-row"
              columns={criticalPositionColumns}
              emptyTitle={t("talentReview.empty")}
              caption={t("talentReview.sections.criticalPositions")}
            />
            </div>
          ) },
          { id: "copertura", titolo: t("talentReview.sections.criticalCoverage"), contenuto: (
            <div className="space-y-3">
            <EntityTable<CriticalCoverage>
              isLoading={coverage.query.isLoading}
              isError={coverage.query.isError}
              error={coverage.query.error}
              errorMessage={t("talentReview.error")}
              rows={coverage.rows}
              server={coverage.server}
              rowKey={(r) => r.criticalRoleCoverageStatusId}
              rowTestId="talent-critical-coverage-row"
              columns={coverageColumns}
              emptyTitle={t("talentReview.empty")}
              caption={t("talentReview.sections.criticalCoverage")}
            />
            </div>
          ) },
        ]}
      />
    </div>
  );
}
