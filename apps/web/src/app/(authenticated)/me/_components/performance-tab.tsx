"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MePerformanceResponse } from "@heuresys/shared";
import { apiFetch } from "../../../../lib/api/fetch";
import { Field, ProfileSection, fmtDate } from "../profile/_components/field";

/** Performance — review history (read-only consultation), lazy on tab open. */
export function MePerformanceTab() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "performance"],
    queryFn: () => apiFetch<MePerformanceResponse>("/v1/me/performance"),
  });

  if (q.isLoading) return <span className="text-sm text-muted-foreground">{t("common:loading")}</span>;
  if (q.isError || !q.data) return <p className="text-sm text-danger" data-testid="myhr-performance-error">{t("landing.perf.error")}</p>;
  const items = q.data.items;
  if (items.length === 0) return <p className="text-sm text-muted-foreground" data-testid="myhr-performance-empty">{t("landing.perf.none")}</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="myhr-performance">
      {items.map((r, i) => (
        <ProfileSection
          key={`rev-${i}`}
          title={`${r.type ?? t("landing.perf.review")}${r.periodEnd ? ` · ${fmtDate(r.periodEnd)}` : ""}`}
          testId={i === 0 ? "perf-primary" : undefined}
        >
          <Field label={t("landing.perf.status")} value={r.status} />
          <Field label={t("landing.perf.overall")} value={r.overallRating != null ? r.overallRating.toFixed(1) : null} testId={i === 0 ? "perf-overall" : undefined} />
          <Field label={t("landing.perf.goal")} value={r.goalRating != null ? r.goalRating.toFixed(1) : null} />
          <Field label={t("landing.perf.competency")} value={r.competencyRating != null ? r.competencyRating.toFixed(1) : null} />
          <Field label={t("landing.perf.perfBox")} value={r.performanceBox != null ? String(r.performanceBox) : null} />
          <Field label={t("landing.perf.potBox")} value={r.potentialBox != null ? String(r.potentialBox) : null} />
          <Field label={t("landing.perf.period")} value={`${fmtDate(r.periodStart) ?? "—"} → ${fmtDate(r.periodEnd) ?? "—"}`} />
        </ProfileSection>
      ))}
    </div>
  );
}
