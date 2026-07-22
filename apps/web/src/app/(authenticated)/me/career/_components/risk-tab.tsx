"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeRiskResponse } from "@heuresys/shared";
import { apiFetch } from "@/lib/api/fetch";
import { Field, ProfileSection, fmtDate } from "../../profile/_components/field";
import { useEnumLabel } from "@/lib/enum-labels";

/** Rischio & Successione — own flight-risk + succession-readiness per target position. */
export function RiskTab() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["me", "risk"],
    queryFn: () => apiFetch<MeRiskResponse>("/v1/me/risk"),
  });

  if (q.isLoading) return <span className="text-sm text-muted-foreground">{t("common:loading")}</span>;
  if (q.isError || !q.data) return <p className="text-sm text-danger" data-testid="career-risk-error">{t("career.risk.error")}</p>;
  const { flightRisk, succession } = q.data;

  return (
    <div className="space-y-6" data-testid="career-risk">
      <ProfileSection title={t("career.risk.flightTitle")} testId="career-flight-risk">
        {flightRisk ? (
          <>
            <Field label={t("career.risk.value")} value={flightRisk.value != null ? flightRisk.value.toFixed(2) : null} testId="career-flight-value" />
            <Field label={t("career.risk.band")} value={enumLabel("flightRiskBand", flightRisk.band)} testId="career-flight-band" />
            <Field label={t("career.risk.model")} value={flightRisk.modelVersion} />
            <Field label={t("career.risk.computedAt")} value={flightRisk.computedAt ? fmtDate(flightRisk.computedAt.slice(0, 10)) : null} />
          </>
        ) : (
          <Field label={t("career.risk.value")} value={t("career.risk.none")} />
        )}
      </ProfileSection>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t("career.risk.successionTitle")}</h3>
        {succession.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="career-succession-empty">{t("career.risk.noSuccession")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="career-succession">
            {succession.map((s, i) => (
              <ProfileSection key={`succ-${i}`} title={s.positionTitle ?? t("career.risk.position")}>
                <Field label={t("career.risk.value")} value={s.value != null ? s.value.toFixed(2) : null} />
                <Field label={t("career.risk.horizon")} value={enumLabel("horizon", s.horizon)} />
                <Field label={t("career.risk.model")} value={s.modelVersion} />
              </ProfileSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
