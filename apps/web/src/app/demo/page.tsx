"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { HeuresysWordmark } from "@heuresys/ui";
import LeadForm from "@/components/lead-form";

const STEPS = [
  { id: "s01", img: "/demo/01-landing.png" },
  { id: "s02", img: "/demo/02-org-chart.png" },
  { id: "s03", img: "/demo/03-positions.png" },
  { id: "s04", img: "/demo/04-skills.png" },
  { id: "s05", img: "/demo/05-succession.png" },
  { id: "s06", img: "/demo/06-maturity.png" },
  { id: "s07", img: "/demo/07-raci.png" },
  { id: "s08", img: "/demo/08-matching.png" },
  { id: "s09", img: "/demo/09-team.png" },
  { id: "s10", img: "/demo/10-dashboard.png" },
] as const;

export default function DemoPage() {
  const { t } = useTranslation("demo");
  return (
    <main data-testid="demo-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HeuresysWordmark />
        <Link href="/login" data-testid="demo-login" className="text-sm text-muted-foreground hover:text-foreground">{t("nav.login")}</Link>
      </header>

      <section data-testid="demo-hero" className="mx-auto max-w-4xl px-6 py-14 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("hero.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("hero.subtitle")}</p>
      </section>

      <div className="mx-auto max-w-5xl space-y-12 px-6 pb-12">
        {STEPS.map((s) => (
          <section key={s.id} data-testid={`demo-step-${s.id.slice(1)}`} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-control bg-card text-sm font-semibold tabular-nums text-muted-foreground">{s.id.slice(1)}</span>
              <span className="rounded-control bg-card px-2 py-1 text-xs text-muted-foreground">{t(`steps.${s.id}.persona`)}</span>
            </div>
            <h2 className="text-lg font-semibold">{t(`steps.${s.id}.shows`)}</h2>
            <p className="text-sm text-muted-foreground">{t(`steps.${s.id}.narration`)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-captured demo PNG asset (not a CMS image) */}
            <img src={s.img} alt={t(`steps.${s.id}.shows`)} loading="lazy" className="w-full rounded-card border border-border shadow-card" />
          </section>
        ))}
      </div>

      <section id="contact" data-testid="demo-cta" className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">{t("cta.title")}</h2>
        <p className="mx-auto mt-2 mb-6 max-w-xl text-center text-muted-foreground">{t("cta.subtitle")}</p>
        <LeadForm source="DEMO" />
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">{t("footer.tagline")}</footer>
    </main>
  );
}
