"use client";

/**
 * /performance — il ciclo di valutazione, lato chi lo conduce (#92 F6).
 *
 * Le dieci rotte costruite da F3/F4/F5 non avevano ancora una pagina: l'unico modo di
 * vedere 548 valutazioni e 35 sessioni di calibrazione era interrogare l'API a mano.
 *
 * Tre sezioni, tre domande diverse, e sono deliberatamente separate invece che fuse in
 * una tabella sola: **il ciclo** (quando si valuta), **le valutazioni** (chi, come è
 * andata, a che punto è il percorso), **la calibrazione** (dove i giudizi vengono
 * confrontati fra pari).
 *
 * ⚠ La sezione dei cicli nasce su un **empty-state reale**: misurato il 2026-08-15,
 * `sys_review_cycles` ha **0 righe**, perché aprire il ciclo di valutazione dell'azienda è
 * una decisione di Enzo, non una migrazione (vedi #92 F5). Non è un difetto della pagina né
 * un dato finto: è l'unico vuoto che la dottrina live-data ammette — la lista è vuota
 * perché l'API risponde vuota. Il giorno che un ciclo si apre, compare da sé.
 *
 * ⚠ I giudizi possono essere MASCHERATI (ADR-0032): `PLATFORM_ADMIN` è un mandato tecnico,
 * non HR, e non li vede. Il campo non si mostra vuoto — si dichiara con `MaskedCell`, che è
 * la differenza fra «non c'è» e «non te lo mostro».
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { KPIStrip, PageHeader, type KpiCardData } from "@heuresys/ui";
import type {
  CalibrationSession,
  PerformanceReview,
  ReviewCycle,
} from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { EntityTable, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { MaskedCell, isMasked } from "@/components/masked-cell";

interface ListaCicli { items: ReviewCycle[]; total: number }
interface ListaCalibrazioni { items: CalibrationSession[]; total: number }

/** Un intervallo di date leggibile, o un trattino se il dato non lo porta. */
function periodo(da: string | null, a: string | null): string {
  if (!da && !a) return "—";
  return `${da ?? "…"} → ${a ?? "…"}`;
}

/** Il voto, oppure la dichiarazione che è stato ritirato per mandato. */
function voto(riga: { masked?: string[] }, campo: string, valore: number | null | undefined) {
  if (isMasked(riga, campo)) return <MaskedCell />;
  return <span className="text-xs">{valore ?? "—"}</span>;
}

export default function PerformancePage() {
  const { t } = useTranslation("hr");

  const cicli = useQuery({
    queryKey: ["review-cycles", "list"],
    queryFn: () => apiFetch<ListaCicli>("/v1/review-cycles?limit=50&offset=0"),
  });

  const valutazioni = usePaginatedList<PerformanceReview>({
    queryKey: ["performance-reviews", "list"],
    path: "/v1/performance-reviews",
  });

  const calibrazioni = useQuery({
    queryKey: ["calibration-sessions", "list"],
    queryFn: () => apiFetch<ListaCalibrazioni>("/v1/calibration-sessions?limit=100&offset=0"),
  });

  const kpi: KpiCardData[] = [
    {
      label: t("performance.kpi.cycles"),
      value: <span data-testid="perf-kpi-cycles">{cicli.data?.total ?? 0}</span>,
      iconTone: "info",
    },
    {
      label: t("performance.kpi.reviews"),
      value: <span data-testid="perf-kpi-reviews">{valutazioni.total}</span>,
      iconTone: "palette-4",
    },
    {
      label: t("performance.kpi.calibrations"),
      value: <span data-testid="perf-kpi-calibrations">{calibrazioni.data?.total ?? 0}</span>,
      iconTone: "success",
    },
  ];

  const colonneCicli = useMemo<DataColumn<ReviewCycle>[]>(
    () => [
      { header: t("performance.cycles.cols.code"), cell: (c) => <span className="text-xs font-medium">{c.code}</span> },
      { header: t("performance.cycles.cols.name"), cell: (c) => <span className="text-xs">{c.name}</span> },
      { header: t("performance.cycles.cols.type"), cell: (c) => <span className="text-xs">{c.type}</span> },
      {
        header: t("performance.cycles.cols.period"),
        cell: (c) => <span className="text-xs text-muted-foreground">{periodo(c.periodStart, c.periodEnd)}</span>,
      },
      { header: t("performance.cycles.cols.status"), cell: (c) => <EnumStatusBadge domain="status" value={c.status} /> },
    ],
    [t],
  );

  const colonneValutazioni = useMemo<DataColumn<PerformanceReview>[]>(
    () => [
      {
        header: t("performance.reviews.cols.subject"),
        cell: (r) => (
          <span className="text-xs text-foreground">
            {r.subjectEmail ?? (r.subjectUserId ? t("performance.reviews.subjectUnnamed") : "—")}
          </span>
        ),
      },
      {
        header: t("performance.reviews.cols.period"),
        cell: (r) => <span className="text-xs text-muted-foreground">{periodo(r.periodStart, r.periodEnd)}</span>,
      },
      { header: t("performance.reviews.cols.type"), cell: (r) => <span className="text-xs">{r.type ?? "—"}</span> },
      {
        header: t("performance.reviews.cols.status"),
        cell: (r) => (r.status ? <EnumStatusBadge domain="status" value={r.status} /> : <span className="text-xs">—</span>),
      },
      {
        header: t("performance.reviews.cols.overall"),
        cell: (r) => voto(r, "overallRating", r.overallRating),
      },
      {
        // Le DATE del percorso non sono il giudizio e restano visibili anche quando il
        // voto è mascherato: è la scelta già fatta nel contratto (ADR-0032).
        header: t("performance.reviews.cols.shared"),
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.sharedAt ? new Date(r.sharedAt).toLocaleDateString() : t("performance.reviews.notShared")}
          </span>
        ),
      },
    ],
    [t],
  );

  const colonneCalibrazioni = useMemo<DataColumn<CalibrationSession>[]>(
    () => [
      { header: t("performance.calib.cols.name"), cell: (s) => <span className="text-xs font-medium">{s.name}</span> },
      {
        header: t("performance.calib.cols.department"),
        cell: (s) => <span className="text-xs text-muted-foreground">{s.department ?? "—"}</span>,
      },
      {
        header: t("performance.calib.cols.scheduled"),
        cell: (s) => (
          <span className="text-xs text-muted-foreground">
            {s.scheduledAt ? new Date(s.scheduledAt).toLocaleDateString() : "—"}
          </span>
        ),
      },
      { header: t("performance.calib.cols.status"), cell: (s) => <EnumStatusBadge domain="status" value={s.status} /> },
    ],
    [t],
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t("performance.title")} description={t("performance.description")} />

      <KPIStrip items={kpi} />

      <section className="space-y-3" data-testid="perf-cycles-section">
        <h2 className="text-sm font-semibold text-foreground">{t("performance.cycles.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("performance.cycles.hint")}</p>
        <EntityTable<ReviewCycle>
          isLoading={cicli.isLoading}
          isError={cicli.isError}
          errorTestId="perf-cycles-error"
          errorMessage={t("performance.error")}
          rows={cicli.data?.items ?? []}
          rowKey={(c) => c.reviewCycleId}
          rowTestId="perf-cycles-row"
          columns={colonneCicli}
          emptyTestId="perf-cycles-empty"
          emptyTitle={t("performance.cycles.emptyTitle")}
          emptyDescription={t("performance.cycles.emptyDescription")}
          caption={t("performance.cycles.caption")}
        />
      </section>

      <section className="space-y-3" data-testid="perf-reviews-section">
        <h2 className="text-sm font-semibold text-foreground">{t("performance.reviews.title")}</h2>
        <EntityTable<PerformanceReview>
          isLoading={valutazioni.query.isLoading}
          isError={valutazioni.query.isError}
          errorTestId="perf-reviews-error"
          errorMessage={t("performance.error")}
          rows={valutazioni.rows}
          server={valutazioni.server}
          rowKey={(r) => r.reviewId}
          rowTestId="perf-reviews-row"
          columns={colonneValutazioni}
          emptyTestId="perf-reviews-empty"
          emptyTitle={t("performance.reviews.emptyTitle")}
          emptyDescription={t("performance.reviews.emptyDescription")}
          caption={t("performance.reviews.caption")}
        />
      </section>

      <section className="space-y-3" data-testid="perf-calib-section">
        <h2 className="text-sm font-semibold text-foreground">{t("performance.calib.title")}</h2>
        <EntityTable<CalibrationSession>
          isLoading={calibrazioni.isLoading}
          isError={calibrazioni.isError}
          errorTestId="perf-calib-error"
          errorMessage={t("performance.error")}
          rows={calibrazioni.data?.items ?? []}
          rowKey={(s) => s.calibrationSessionId}
          rowTestId="perf-calib-row"
          columns={colonneCalibrazioni}
          emptyTestId="perf-calib-empty"
          emptyTitle={t("performance.calib.emptyTitle")}
          emptyDescription={t("performance.calib.emptyDescription")}
          caption={t("performance.calib.caption")}
        />
      </section>
    </div>
  );
}
