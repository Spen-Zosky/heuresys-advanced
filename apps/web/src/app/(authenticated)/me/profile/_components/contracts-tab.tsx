"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MeContract } from "@heuresys/shared";
import { apiFetch } from "../../../../../lib/api/fetch";
import { useEnumLabel } from "@/lib/enum-labels";
import { Field, ProfileSection, fmtDate, fmtMoney } from "./field";

/** Contratti — employment contract history (mig 000165), fetched lazily on tab open. */
export function ContractsTab() {
  const { t } = useTranslation("ess");
  const enumLabel = useEnumLabel();
  const q = useQuery({
    queryKey: ["me", "contracts"],
    queryFn: () => apiFetch<{ items: MeContract[]; total: number }>("/v1/me/contracts"),
  });

  if (q.isLoading) {
    return <span className="text-sm text-muted-foreground" data-testid="profile-contracts-loading">{t("common:loading")}</span>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-danger" data-testid="profile-contracts-error">{t("profile.full.error")}</p>;
  }
  const items = q.data.items;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="profile-contracts-empty">{t("profile.full.contracts.none")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="profile-contracts">
      {items.map((c, i) => (
        <ProfileSection
          key={`contract-${i}`}
          title={`${c.type ? enumLabel("contractType", c.type) : t("profile.full.contracts.title")}${c.code ? ` · ${c.code}` : ""}`}
          testId={i === 0 ? "section-contract-primary" : undefined}
        >
          <Field label={t("profile.full.contracts.type")} value={enumLabel("contractType", c.type)} testId={i === 0 ? "ct-type" : undefined} />
          <Field label={t("profile.full.contracts.status")} value={enumLabel("contractStatus", c.status)} />
          <Field label={t("profile.full.contracts.ccnlType")} value={c.ccnlType} />
          <Field label={t("profile.full.contracts.ccnlLevel")} value={c.ccnlLevel} />
          <Field
            label={t("profile.full.contracts.gross")}
            value={fmtMoney(c.grossAnnualSalary, c.currency)}
            testId={i === 0 ? "ct-gross" : undefined}
          />
          <Field label={t("profile.full.contracts.workHours")} value={c.workHoursWeekly != null ? `${c.workHoursWeekly} h` : null} />
          <Field label={t("profile.full.contracts.scheduleType")} value={c.workScheduleType} />
          <Field label={t("profile.full.contracts.partTime")} value={c.partTimePercentage != null ? `${c.partTimePercentage}%` : null} />
          <Field label={t("profile.full.contracts.startDate")} value={fmtDate(c.startDate)} />
          <Field label={t("profile.full.contracts.endDate")} value={fmtDate(c.endDate)} />
          <Field label={t("profile.full.contracts.probationEnd")} value={fmtDate(c.probationEndDate)} />
          <Field label={t("profile.full.contracts.jobTitle")} value={c.jobTitle} />
        </ProfileSection>
      ))}
    </div>
  );
}
