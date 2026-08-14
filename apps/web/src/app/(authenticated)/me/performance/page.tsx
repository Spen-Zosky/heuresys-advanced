"use client";

/**
 * /me/performance — le PROPRIE valutazioni (#92 F6, lato ESS).
 *
 * La rotta `GET /v1/me/performance` esisteva dal 2026-08-14 (#92 F5) ma nessuna pagina la
 * chiamava: la persona poteva leggere le proprie valutazioni solo interrogando l'API.
 *
 * Due cose che questa pagina NON fa, e sono entrambe deliberate:
 *
 * 1. **Non mostra le valutazioni non comunicate.** Il filtro non è qui, è nel repository
 *    (`shared_at OR acknowledged_at`, ADR-0036 §5): una valutazione scritta ma non ancora
 *    consegnata scavalcherebbe il colloquio. La pagina riceve già solo ciò che può vedere —
 *    e questo è il motivo per cui il numero mostrato può essere minore di quello che un
 *    responsabile vede sulla stessa persona.
 * 2. **Non mostra un voto mascherato come se fosse assente.** `masked` arriva dal contratto
 *    e viene dichiarato con `MaskedCell`: «non te lo mostro» e «non c'è» sono due cose
 *    diverse, e confonderle è il difetto che #188 ha chiuso sulle lacune formative.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";
import { MaskedCell, isMasked } from "@/components/masked-cell";

import type { MePerformanceReview, MePerformanceResponse } from "@heuresys/shared";

export default function MePerformancePage() {
  const { t } = useTranslation("ess");

  const reviews = useQuery({
    queryKey: ["me", "performance"],
    queryFn: () => apiFetch<MePerformanceResponse>("/v1/me/performance"),
  });

  /** Il voto, o la dichiarazione che è stato ritirato — mai una cella vuota muta. */
  const voto = (r: MePerformanceReview, campo: string, valore: number | null | undefined) =>
    isMasked(r, campo) ? <MaskedCell /> : <span className="text-xs">{valore ?? "—"}</span>;

  const columns = useMemo<DataColumn<MePerformanceReview>[]>(
    () => [
      {
        header: t("performance.colPeriod"),
        cell: (r) => (
          <span className="text-xs text-muted-foreground">
            {r.periodStart || r.periodEnd ? `${r.periodStart ?? "…"} → ${r.periodEnd ?? "…"}` : "—"}
          </span>
        ),
      },
      { header: t("performance.colType"), cell: (r) => <span className="text-xs">{r.type ?? "—"}</span> },
      {
        header: t("performance.colStatus"),
        cell: (r) => (r.status ? <EnumStatusBadge domain="status" value={r.status} /> : <span className="text-xs">—</span>),
      },
      { header: t("performance.colOverall"), cell: (r) => voto(r, "overallRating", r.overallRating) },
      { header: t("performance.colGoals"), cell: (r) => voto(r, "goalRating", r.goalRating) },
      { header: t("performance.colCompetency"), cell: (r) => voto(r, "competencyRating", r.competencyRating) },
      {
        header: t("performance.colPotential"),
        cell: (r) =>
          isMasked(r, "potentialRating")
            ? <MaskedCell />
            : <span className="text-xs">{r.potentialRating ?? "—"}</span>,
      },
    ],
    // `voto` è una closure stabile sui soli argomenti: la dipendenza vera è `t`.
    [t],
  );

  return (
    <DataTablePanel<MePerformanceReview>
      pageTestId="me-performance-page"
      titleTestId="me-performance-title"
      countTestId="me-performance-count"
      title={t("performance.title")}
      description={t("performance.description")}
      count={reviews.data ? t("performance.count", { count: reviews.data.total }) : undefined}
      isLoading={reviews.isLoading}
      isError={reviews.isError}
      errorMessage={t("performance.errorMessage")}
      rows={reviews.data?.items ?? []}
      // Il contratto ESS non espone l'identificativo della valutazione — di proposito: alla
      // persona serve sapere com'è andata, non con quale chiave è registrata. La chiave di
      // riga si compone quindi dai campi che la distinguono davvero.
      rowKey={(r) => `${r.periodStart ?? "?"}|${r.periodEnd ?? "?"}|${r.type ?? "?"}`}
      rowTestId="me-performance-row"
      columns={columns}
      emptyTestId="me-performance-empty"
      emptyTitle={t("performance.emptyTitle")}
      emptyDescription={t("performance.emptyDescription")}
      caption={t("performance.caption")}
    />
  );
}
