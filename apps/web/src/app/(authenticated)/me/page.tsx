"use client";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@heuresys/ui";
import { ProfileTabs, type ProfileTabDef } from "../../../components/profile-tabs";
import { MeSummaryTab } from "./_components/summary-tab";
import { MePerformanceTab } from "./_components/performance-tab";
import { MeAttendanceTab } from "./_components/attendance-tab";
import { TimelinePanel } from "@/components/timeline-panel";

/** My HR (the Personal-area landing) — sub-tab IA (S1010 F3a): Riepilogo + Performance + Presenze. */
export default function MeLandingPage() {
  const { t } = useTranslation("ess");
  const tabs: ProfileTabDef[] = [
    { id: "riepilogo", label: t("landing.tabs.summary"), testId: "myhr-tab-riepilogo", render: () => <MeSummaryTab /> },
    { id: "performance", label: t("landing.tabs.performance"), testId: "myhr-tab-performance", render: () => <MePerformanceTab /> },
    { id: "presenze", label: t("landing.tabs.attendance"), testId: "myhr-tab-presenze", render: () => <MeAttendanceTab /> },
    // D5 (#49): la propria storia. Stesso pannello della scheda persona, altro
    // endpoint: qui il filtro e' l'identita' di chi guarda (I17).
    {
      id: "storia",
      label: t("landing.tabs.history"),
      testId: "myhr-tab-storia",
      render: () => <TimelinePanel basePath="/v1/me/timeline" testId="me-timeline-panel" />,
    },
  ];
  return (
    <main data-testid="me-page" className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <PageHeader title={t("landing.title")} description={t("landing.description")} />
      <Suspense fallback={<span className="text-sm text-muted-foreground">{t("common:loading")}</span>}>
        <ProfileTabs tabs={tabs} ariaLabel={t("landing.tabs.aria")} />
      </Suspense>
    </main>
  );
}
