"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeCareerPathsResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { Field, ProfileSection } from "../../profile/_components/field";
import { useEnumLabel } from "@/lib/enum-labels";

/** Percorsi — career paths from the PRIMARY position + the caller's own plans. */
export function PathsTab() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["me", "career-paths"],
    queryFn: () => apiFetch<MeCareerPathsResponse>("/v1/me/career-paths"),
  });

  if (q.isLoading) return <span className="text-sm text-muted-foreground">{t("common:loading")}</span>;
  if (q.isError || !q.data) return <p className="text-sm text-danger" data-testid="career-paths-error">{t("career.paths.error")}</p>;
  const { fromPositionTitle, paths, plans } = q.data;

  return (
    <div className="space-y-6" data-testid="career-paths">
      {fromPositionTitle && (
        <p className="text-sm text-muted-foreground" data-testid="career-paths-from">
          {t("career.paths.from", { position: fromPositionTitle })}
        </p>
      )}

      {paths.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="career-paths-empty">{t("career.paths.none")}</p>
      ) : (
        <div className="space-y-4">
          {paths.map((p) => (
            <ProfileSection key={p.careerPathId} title={p.name ?? p.code ?? t("career.paths.untitled")}>
              <Field label={t("career.paths.kind")} value={enumLabel("careerPathKind", p.kind)} />
              <Field
                label={t("career.paths.steps")}
                value={
                  p.steps.length === 0
                    ? null
                    : p.steps
                        .map((s) => `${s.ordinal}. ${s.targetPositionTitle ?? "—"}${s.typicalDurationMonths != null ? ` (${t("career.paths.months", { n: s.typicalDurationMonths })})` : ""}`)
                        .join("  →  ")
                }
              />
            </ProfileSection>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t("career.paths.plansTitle")}</h3>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="career-plans-empty">{t("career.paths.noPlans")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="career-plans">
            {plans.map((pl, i) => (
              // #161 — il piano dichiara il PERCORSO che si sta seguendo, ed è il solo
              // dei tre campi valorizzato su tutti i 113 piani reali. Prima il titolo
              // ricadeva su un'etichetta generica e accanto restava una riga vuota,
              // perché il bersaglio puntuale il piano non ce l'ha (vive in
              // sys_user_target_positions, che è un'altra cosa). Il bersaglio si mostra
              // solo se un giorno ci sarà.
              <ProfileSection key={`plan-${i}`} title={pl.pathName ?? pl.targetPositionTitle ?? t("career.paths.planTarget")}>
                <Field label={t("career.paths.planStatus")} value={enumLabel("careerPlanStatus", pl.status)} />
                {pl.targetPositionTitle ? (
                  <Field label={t("career.paths.planTarget")} value={pl.targetPositionTitle} />
                ) : null}
                {pl.horizonMonths != null ? (
                  <Field label={t("career.paths.planHorizon")} value={t("career.paths.months", { n: pl.horizonMonths })} />
                ) : null}
              </ProfileSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
