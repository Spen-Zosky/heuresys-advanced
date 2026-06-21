"use client";
import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
  const { t } = useTranslation("landing");
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-6 py-16 space-y-6 text-sm text-foreground">
      <h1 className="text-2xl font-semibold">{t("privacy.title")}</h1>
      <p className="text-muted-foreground">{t("privacy.intro")}</p>
      <p className="text-muted-foreground">{t("privacy.dataCollected")}</p>
      <p className="text-muted-foreground">{t("privacy.purpose")}</p>
      <p className="text-muted-foreground">{t("privacy.legalBasis")}</p>
      <p className="text-muted-foreground">{t("privacy.retention")}</p>
      <p className="text-muted-foreground">{t("privacy.contact")}</p>
    </main>
  );
}
