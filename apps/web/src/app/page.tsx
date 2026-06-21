"use client";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, CardContent, HeuresysWordmark } from "@heuresys/ui";
import LeadForm from "@/components/lead-form";

export default function HomePage() {
  const { t } = useTranslation("landing");
  return (
    <main data-testid="landing-page" className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <HeuresysWordmark />
        <div className="flex items-center gap-3">
          <Link href="/login" data-testid="landing-login" className="text-sm text-muted-foreground hover:text-foreground">{t("nav.login")}</Link>
          <a href="#demo"><Button size="sm">{t("nav.cta")}</Button></a>
        </div>
      </header>

      <section data-testid="landing-hero" className="mx-auto max-w-4xl px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("hero.title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{t("hero.subtitle")}</p>
        <a href="#demo" className="mt-8 inline-block"><Button size="lg" data-testid="hero-cta">{t("hero.cta")}</Button></a>
      </section>

      <section data-testid="landing-wedges" className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-center text-xl font-semibold">{t("wedges.title")}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["esco", "explain", "position"] as const).map((k) => (
            <Card key={k} data-testid={`wedge-${k}`}>
              <CardContent className="space-y-2 p-6">
                <h3 className="font-medium">{t(`wedges.${k}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`wedges.${k}.body`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">{t("icp.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("icp.body")}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">{t("credibility.title")}</h2>
        <p className="mt-3 text-muted-foreground">{t("credibility.body")}</p>
      </section>

      <section id="demo" data-testid="landing-demo" className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">{t("form.title")}</h2>
        <p className="mx-auto mt-2 mb-6 max-w-xl text-center text-muted-foreground">{t("form.subtitle")}</p>
        <LeadForm />
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">{t("footer.tagline")}</footer>
    </main>
  );
}
