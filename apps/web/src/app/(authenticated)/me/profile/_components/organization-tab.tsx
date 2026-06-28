"use client";

import { useTranslation } from "react-i18next";
import type { MeProfileFull } from "@heuresys/shared";
import { Field, ProfileSection, fmtDate, fmtMoney } from "./field";

/** Organizzazione — role/position, lifecycle, compensation, SAP keys, auth summary. */
export function OrganizationTab({ data }: { data: MeProfileFull }) {
  const { t } = useTranslation("ess");
  const o = data.organization;
  const e = data.employment;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="profile-organization">
      <ProfileSection title={t("profile.full.role.title")} testId="section-role">
        <Field label={t("profile.full.role.jobTitle")} value={o.jobTitle} testId="org-jobTitle" />
        <Field label={t("profile.full.role.positionCode")} value={o.positionCode} />
        <Field label={t("profile.full.role.orgUnit")} value={o.orgUnit} />
        <Field label={t("profile.full.role.department")} value={o.department} />
        <Field label={t("profile.full.role.location")} value={o.location} />
        <Field label={t("profile.full.role.costCenter")} value={o.costCenter} />
        <Field label={t("profile.full.role.manager")} value={o.managerName} />
      </ProfileSection>

      <ProfileSection title={t("profile.full.lifecycle.title")} testId="section-lifecycle">
        <Field label={t("profile.full.lifecycle.hireDate")} value={fmtDate(e?.hireDate ?? null)} />
        <Field label={t("profile.full.lifecycle.seniorityDate")} value={fmtDate(e?.seniorityDate ?? null)} />
        <Field label={t("profile.full.lifecycle.probationEnd")} value={fmtDate(e?.probationEndDate ?? null)} />
        <Field label={t("profile.full.lifecycle.contractEnd")} value={fmtDate(e?.contractEndDate ?? null)} />
        <Field label={t("profile.full.lifecycle.status")} value={e?.status ?? null} />
        <Field label={t("profile.full.lifecycle.terminationDate")} value={fmtDate(e?.terminationDate ?? null)} />
      </ProfileSection>

      <ProfileSection title={t("profile.full.compensation.title")} testId="section-compensation">
        <Field
          label={t("profile.full.compensation.salary")}
          value={fmtMoney(e?.salary ?? null, e?.currency ?? null)}
          testId="org-salary"
        />
        <Field label={t("profile.full.compensation.payScaleArea")} value={e?.payScaleArea ?? null} />
        <Field label={t("profile.full.compensation.payScaleType")} value={e?.payScaleType ?? null} />
        <Field label={t("profile.full.compensation.payScaleGroup")} value={e?.payScaleGroup ?? null} />
        <Field label={t("profile.full.compensation.payScaleLevel")} value={e?.payScaleLevel ?? null} />
        <Field
          label={t("profile.full.compensation.payPeriods")}
          value={e?.payPeriodsPerYear != null ? String(e.payPeriodsPerYear) : null}
        />
        <Field
          label={t("profile.full.compensation.workSchedulePct")}
          value={e?.workSchedulePct != null ? `${e.workSchedulePct}%` : null}
        />
      </ProfileSection>

      <ProfileSection title={t("profile.full.sap.title")} testId="section-sap">
        <Field label={t("profile.full.sap.pernr")} value={e?.pernr ?? null} testId="org-pernr" />
        <Field label={t("profile.full.sap.companyCode")} value={e?.companyCode ?? null} />
        <Field label={t("profile.full.sap.personnelArea")} value={e?.personnelArea ?? null} />
        <Field label={t("profile.full.sap.personnelSubarea")} value={e?.personnelSubarea ?? null} />
      </ProfileSection>

      <ProfileSection title={t("profile.full.auth.title")} testId="section-auth">
        <Field label={t("profile.full.auth.username")} value={data.auth.username} />
        <Field label={t("profile.full.auth.roles")} value={data.auth.roles.join(", ")} />
        <Field label={t("profile.full.auth.lastLogin")} value={fmtDate(data.auth.lastLogin)} />
      </ProfileSection>
    </div>
  );
}
