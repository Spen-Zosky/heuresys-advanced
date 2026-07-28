"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeProfessionalExperiencesResponse } from "@heuresys/shared";
import { apiFetch } from "../../../../../lib/api/fetch";
import { Field, ProfileSection, fmtDate } from "./field";

/**
 * Esperienze — la carriera precedente all'ingresso in azienda.
 *
 * Nasce dal cancello di esposizione: le righe esistevano nel database ma nessun
 * endpoint le leggeva, quindi il curriculum di una persona non era visibile da
 * nessuna parte nel portale.
 */
export function ExperiencesTab() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "professional-experiences"],
    queryFn: () => apiFetch<MeProfessionalExperiencesResponse>("/v1/me/professional-experiences"),
  });

  if (q.isLoading) {
    return (
      <span className="text-sm text-muted-foreground" data-testid="profile-experiences-loading">
        {t("common:loading")}
      </span>
    );
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-danger" data-testid="profile-experiences-error">{t("profile.full.error")}</p>;
  }
  const items = q.data.items;
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="profile-experiences-empty">
        {t("profile.full.experiences.none")}
      </p>
    );
  }

  const durata = (mesi: number | null): string | null => {
    if (mesi === null) return null;
    const anni = Math.floor(mesi / 12);
    const resto = mesi % 12;
    if (anni === 0) return t("profile.full.experiences.months", { count: resto });
    if (resto === 0) return t("profile.full.experiences.years", { count: anni });
    return `${t("profile.full.experiences.years", { count: anni })} ${t("profile.full.experiences.months", { count: resto })}`;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="profile-experiences">
      {items.map((e, i) => (
        <ProfileSection
          key={e.professionalExperienceId}
          title={`${e.roleTitle} · ${e.employer}`}
          testId={i === 0 ? "section-experience-latest" : undefined}
        >
          <Field
            label={t("profile.full.experiences.employer")}
            value={e.employer}
            testId={i === 0 ? "exp-employer" : undefined}
          />
          <Field label={t("profile.full.experiences.role")} value={e.roleTitle} />
          <Field label={t("profile.full.experiences.industry")} value={e.industry} />
          <Field label={t("profile.full.experiences.from")} value={fmtDate(e.startDate)} />
          <Field label={t("profile.full.experiences.to")} value={fmtDate(e.endDate)} />
          <Field label={t("profile.full.experiences.duration")} value={durata(e.durationMonths)} />
        </ProfileSection>
      ))}
    </div>
  );
}
