"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/fetch";
import { DataTablePanel, type DataColumn } from "@/components/data-table-panel";
import { EnumStatusBadge } from "@/components/enum-badge";

import type { MeGap, MeGapsResponse } from "@heuresys/shared";
import { useFormat } from "@/lib/format";
import { SenzaNome } from "@/components/senza-nome";

export default function MeGapsPage() {
  const { t } = useTranslation("ess");
  const fmt = useFormat();
  const gaps = useQuery({
    queryKey: ["me", "gaps"],
    queryFn: () => apiFetch<MeGapsResponse>("/v1/me/gaps"),
  });

  // Columns mirror the real MeGapSchema contract (census F4 S1026: the page
  // used to render 3 phantom fields and dropped the real `score`).
  const columns = useMemo<DataColumn<MeGap>[]>(
    () => [
      {
        header: t("gaps.colSkill"),
        // `skillId` è NULL su tutte le righe vive: questa colonna mostrava a ciascuno un
        // troncone di UUID o un segnaposto, cioè le PROPRIE lacune senza dire di che
        // competenza. I nomi arrivano da `skillGaps`, normalizzati dall'API.
        cell: (g) => {
          const nomi = g.skillGaps.map((s) => s.skillName);
          if (nomi.length === 0) {
            return (
              <span className="font-medium text-foreground">
                {g.skillId ? <SenzaNome id={g.skillId} /> : t("gaps.skillFallback")}
              </span>
            );
          }
          // D2-17: ogni competenza della lacuna con il suo livello attuale, quello da raggiungere e lo scarto
          // (prima compariva solo il primo nome e i livelli non si vedevano mai).
          return (
            <ul className="space-y-0.5" data-testid="me-gap-skills">
              {g.skillGaps.map((s, i) => (
                <li key={`${s.skillName}-${i}`} className="text-sm">
                  <span className="font-medium text-foreground">{s.skillName}</span>
                  {(s.currentLevel !== null || s.targetLevel !== null) && (
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                      {t("gaps.levels", {
                        current: s.currentLevel !== null ? fmt.numero(s.currentLevel, 1) : "—",
                        target: s.targetLevel !== null ? fmt.numero(s.targetLevel, 1) : "—",
                      })}
                      {s.gap !== null ? ` · ${t("gaps.gapSize", { value: fmt.numero(s.gap, 1) })}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          );
        },
      },
      { header: t("gaps.colSeverity"), cell: (g) => <EnumStatusBadge domain="severity" value={g.severity} /> },
      {
        header: t("gaps.colScore"),
        cell: (g) => <span className="text-xs text-muted-foreground">{g.score !== null ? fmt.numeroFisso(g.score, 1) : "—"}</span>,
      },
      { header: t("gaps.colDetected"), cell: (g) => <span className="text-xs text-muted-foreground">{fmt.data(g.detectedAt)}</span> },
    ],
    [t, fmt],
  );

  return (
    <DataTablePanel<MeGap> originPath={"/v1/me/gaps"}
      pageTestId="me-gaps-page"
      titleTestId="me-gaps-title"
      countTestId="me-gaps-count"
      title={t("gaps.title")}
      description={t("gaps.description")}
      count={gaps.data ? t("gaps.count", { count: gaps.data.total }) : undefined}
      isLoading={gaps.isLoading}
      isError={gaps.isError}
      error={gaps.error}
      errorMessage={t("gaps.errorMessage")}
      rows={gaps.data?.items ?? []}
      rowKey={(g) => g.learningGapId}
      rowTestId="me-gap-row"
      columns={columns}
      emptyTestId="me-gaps-empty"
      emptyTitle={t("gaps.emptyTitle")}
      emptyDescription={t("gaps.emptyDesc")}
      caption={t("gaps.caption")}
    />
  );
}
