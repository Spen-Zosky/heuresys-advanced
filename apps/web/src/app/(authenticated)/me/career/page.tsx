"use client";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@heuresys/ui";
import { ProfileTabs, type ProfileTabDef } from "@/components/profile-tabs";
import { GoalsTab } from "./_components/goals-tab";
import { PathsTab } from "./_components/paths-tab";
import { RiskTab } from "./_components/risk-tab";

/** Carriera (Personal area) — sub-tab IA (S1011 F3b): Obiettivi + Percorsi + Rischio & Successione. */
export default function MeCareerPage() {
  const { t } = useTranslation("ess");
  const tabs: ProfileTabDef[] = [
    { id: "obiettivi", label: t("career.tabs.obiettivi"), testId: "career-tab-obiettivi", render: () => <GoalsTab /> },
    { id: "percorsi", label: t("career.tabs.percorsi"), testId: "career-tab-percorsi", render: () => <PathsTab /> },
    { id: "rischio", label: t("career.tabs.rischio"), testId: "career-tab-rischio", render: () => <RiskTab /> },
  ];
  return (
    <main data-testid="me-career-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("career.title")} description={t("career.description")} />
      <Suspense fallback={<span className="text-sm text-muted-foreground">{t("common:loading")}</span>}>
        <ProfileTabs tabs={tabs} ariaLabel={t("career.tabs.aria")} />
      </Suspense>
    </main>
  );
}
