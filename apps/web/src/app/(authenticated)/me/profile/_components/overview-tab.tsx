"use client";

import { useTranslation } from "react-i18next";
import type { MeProfileFull } from "@heuresys/shared";
import { Field, ProfileSection, fmtDate } from "./field";

const DOC_KIND_KEY: Record<string, string> = {
  NATIONAL_ID: "profile.full.docKind.nationalId",
  PASSPORT: "profile.full.docKind.passport",
  DRIVER_LICENSE: "profile.full.docKind.driverLicense",
};
const ADDR_KIND_KEY: Record<string, string> = {
  PERMANENT: "profile.full.addrKind.permanent",
  TEMPORARY: "profile.full.addrKind.temporary",
};

/** Panoramica — anagraphic identity, documents, addresses, contacts, family, education, banking. */
export function OverviewTab({ data }: { data: MeProfileFull }) {
  const { t } = useTranslation("ess");
  const id = data.identity;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-testid="profile-overview">
      <ProfileSection title={t("profile.full.identity.title")} testId="section-identity">
        <Field label={t("profile.full.identity.firstName")} value={id.firstName} testId="ov-firstName" />
        <Field label={t("profile.full.identity.lastName")} value={id.lastName} />
        <Field label={t("profile.full.identity.middleName")} value={id.middleName} />
        <Field label={t("profile.full.identity.birthDate")} value={fmtDate(id.birthDate)} />
        <Field label={t("profile.full.identity.birthPlace")} value={id.birthPlace} />
        <Field label={t("profile.full.identity.gender")} value={id.gender} />
        <Field label={t("profile.full.identity.nationality")} value={id.nationality} />
        <Field label={t("profile.full.identity.maritalStatus")} value={id.maritalStatus} />
        <Field label={t("profile.full.identity.taxId")} value={id.taxId} testId="ov-taxId" />
      </ProfileSection>

      <ProfileSection title={t("profile.full.documents.title")} testId="section-documents">
        {data.documents.length === 0 ? (
          <Field label={t("profile.full.documents.none")} value={null} />
        ) : (
          data.documents.map((d) => (
            <Field
              key={d.kind}
              label={t(DOC_KIND_KEY[d.kind] ?? d.kind)}
              value={`${d.number}${d.expiryDate ? ` · ${t("profile.full.documents.expiry")} ${fmtDate(d.expiryDate)}` : ""}`}
            />
          ))
        )}
      </ProfileSection>

      {data.addresses.map((a) => (
        <ProfileSection
          key={a.kind}
          title={t(ADDR_KIND_KEY[a.kind] ?? a.kind)}
          testId={`section-address-${a.kind.toLowerCase()}`}
        >
          <Field label={t("profile.full.address.street")} value={a.street} />
          <Field label={t("profile.full.address.city")} value={a.city} />
          <Field label={t("profile.full.address.postalCode")} value={a.postalCode} />
          <Field label={t("profile.full.address.country")} value={a.country} />
          <Field label={t("profile.full.address.region")} value={a.region} />
        </ProfileSection>
      ))}

      <ProfileSection title={t("profile.full.contacts.title")} testId="section-contacts">
        <Field label={t("profile.full.contacts.phoneMobile")} value={data.contacts.phoneMobile} />
        <Field label={t("profile.full.contacts.phoneHome")} value={data.contacts.phoneHome} />
        <Field label={t("profile.full.contacts.personalEmail")} value={data.contacts.personalEmail} />
      </ProfileSection>

      <ProfileSection title={t("profile.full.family.title")} testId="section-family">
        <Field label={t("profile.full.emergency.name")} value={data.emergency.name} />
        <Field label={t("profile.full.emergency.phone")} value={data.emergency.phone} />
        <Field label={t("profile.full.emergency.relationship")} value={data.emergency.relationship} />
        {data.family.map((f, i) => (
          <Field
            key={`fam-${i}`}
            label={t("profile.full.family.member")}
            value={`${[f.firstName, f.lastName].filter(Boolean).join(" ")}${f.relationship ? ` (${f.relationship})` : ""}${f.birthDate ? ` · ${fmtDate(f.birthDate)}` : ""}${f.isDependent ? ` · ${t("profile.full.family.dependent")}` : ""}`}
          />
        ))}
      </ProfileSection>

      <ProfileSection title={t("profile.full.education.title")} testId="section-education">
        {data.education.length === 0 ? (
          <Field label={t("profile.full.education.none")} value={null} />
        ) : (
          data.education.map((e, i) => (
            <Field
              key={`edu-${i}`}
              label={e.degree}
              value={`${e.institution}${e.fieldOfStudy ? ` · ${e.fieldOfStudy}` : ""}${e.grade ? ` · ${e.grade}` : ""}`}
            />
          ))
        )}
      </ProfileSection>

      <ProfileSection title={t("profile.full.banking.title")} testId="section-banking">
        <Field label={t("profile.full.banking.iban")} value={data.banking?.iban ?? null} testId="ov-iban" />
        <Field label={t("profile.full.banking.swiftBic")} value={data.banking?.swiftBic ?? null} />
        <Field label={t("profile.full.banking.bankName")} value={data.banking?.bankName ?? null} />
        <Field label={t("profile.full.banking.accountNumber")} value={data.banking?.accountNumber ?? null} />
      </ProfileSection>
    </div>
  );
}
