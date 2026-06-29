"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { MePaySlipsResponse } from "@heuresys/shared";
import { apiFetch } from "../../../../../lib/api/fetch";
import { Field, ProfileSection, fmtDate, fmtMoney } from "./field";

/** Cedolini — pay-slip history (mig 000167, read-only consultation), lazy on tab open. */
export function PaySlipsTab() {
  const { t } = useTranslation("ess");
  const q = useQuery({
    queryKey: ["me", "pay-slips"],
    queryFn: () => apiFetch<MePaySlipsResponse>("/v1/me/pay-slips"),
  });

  if (q.isLoading) {
    return <span className="text-sm text-muted-foreground" data-testid="profile-payslips-loading">{t("common:loading")}</span>;
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-danger" data-testid="profile-payslips-error">{t("profile.full.error")}</p>;
  }
  const items = q.data.items;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="profile-payslips-empty">{t("profile.full.paySlips.none")}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="profile-payslips">
      {items.map((s, i) => (
        <ProfileSection
          key={`slip-${i}`}
          title={s.period ?? t("profile.full.paySlips.title")}
          testId={i === 0 ? "section-payslip-primary" : undefined}
        >
          <Field label={t("profile.full.paySlips.status")} value={s.status} />
          <Field label={t("profile.full.paySlips.gross")} value={fmtMoney(s.grossPay, "EUR")} testId={i === 0 ? "ps-gross" : undefined} />
          <Field label={t("profile.full.paySlips.net")} value={fmtMoney(s.netPay, "EUR")} />
          <Field label={t("profile.full.paySlips.paymentDate")} value={fmtDate(s.paymentDate)} />
          <Field label="INPS" value={s.deductions.INPS != null ? fmtMoney(s.deductions.INPS, "EUR") : null} />
          <Field label="IRPEF" value={s.deductions.IRPEF != null ? fmtMoney(s.deductions.IRPEF, "EUR") : null} />
          <Field label={t("profile.full.paySlips.totalDeductions")} value={s.deductions.total != null ? fmtMoney(s.deductions.total, "EUR") : null} />
        </ProfileSection>
      ))}
    </div>
  );
}
