"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, HeuresysWordmark } from "@heuresys/ui";
import LeadForm from "@/components/lead-form";
import { usePlatformStats } from "@/lib/api/public-stats";
import type { PlatformStatsResponse } from "@heuresys/shared/schemas/public-stats";

const LIVE_KEYS: (keyof PlatformStatsResponse)[] = [
  "skills", "occupationSkillEdges", "escoOccupationMappings", "users", "positions",
  "organizationUnits", "teams", "rolePermissionMappings", "uiInterfaces", "activeTenancies",
];

const STATIC_FACTS = [
  { key: "modules", value: 85 }, { key: "endpoints", value: 466 }, { key: "migrations", value: 165 },
  { key: "apiTests", value: 1098 }, { key: "e2e", value: 123 }, { key: "pages", value: 98 },
] as const;

export default function InvestorsPage() {
  const { t } = useTranslation("investors");
  const { data } = usePlatformStats();
  return (
    <main data-testid="investors-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HeuresysWordmark />
        <div className="flex items-center gap-3 print:hidden">
          <Link href="/login" data-testid="investors-login" className="text-sm text-muted-foreground hover:text-foreground">{t("nav.login")}</Link>
          <Button size="sm" data-testid="investors-download-pdf" onClick={() => window.print()}>{t("nav.downloadPdf")}</Button>
        </div>
      </header>

      <section data-testid="investors-hero" className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("hero.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("hero.thesis")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 className="text-xl font-semibold">{t("opportunity.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("opportunity.body")}</p>
      </section>

      <section data-testid="investors-proof" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-xl font-semibold">{t("proof.title")}</h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">{t("proof.tagline")}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIVE_KEYS.map((k) => (
            <Card key={k} data-print-card {...(k === "skills" ? { "data-testid": "stat-skills" } : {})}>
              <CardContent className="p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-2xl font-semibold tabular-nums">{data ? data[k].toLocaleString("it") : t("proof.loading")}</span>
                  <span className="rounded-control bg-card px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{t("proof.liveLabel")}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t(`proof.live.${k}`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STATIC_FACTS.map((f) => (
            <Card key={f.key} data-print-card>
              <CardContent className="p-5">
                <span className="text-2xl font-semibold tabular-nums">{f.value.toLocaleString("it")}</span>
                <p className="mt-1 text-sm text-muted-foreground">{t(`proof.static.${f.key}`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">{t("proof.asOf")}</p>
      </section>

      <section data-testid="investors-wedges" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-center text-xl font-semibold">{t("wedges.title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["esco", "explain", "position"] as const).map((k) => (
            <Card key={k} data-testid={`wedge-${k}`} data-print-card>
              <CardContent className="space-y-2 p-6">
                <h3 className="font-medium">{t(`wedges.${k}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`wedges.${k}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 className="text-xl font-semibold">{t("traction.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("traction.body")}</p>
        <p className="mt-3 font-medium text-foreground">{t("traction.gapClosed")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 className="text-xl font-semibold">{t("whyNow.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("whyNow.body")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-10 text-center">
        <h2 className="text-xl font-semibold">{t("roadmap.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("roadmap.body")}</p>
      </section>

      <section id="contact" data-testid="investors-cta" className="mx-auto max-w-2xl px-6 py-16 print:hidden">
        <h2 className="text-center text-2xl font-semibold">{t("cta.title")}</h2>
        <p className="mx-auto mt-2 mb-6 max-w-xl text-center text-muted-foreground">{t("cta.subtitle")}</p>
        <LeadForm source="INVESTOR" />
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground print:hidden">{t("footer.tagline")}</footer>
    </main>
  );
}
