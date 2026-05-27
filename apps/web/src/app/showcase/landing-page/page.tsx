import Link from "next/link";
import { HeuresysMark, HeuresysWordmark } from "@/app/showcase/_ui-client";

export const metadata = { title: "Showcase / Landing page — Heuresys" };

const FEATURES = [
  {
    title: "Position-centric workforce",
    blurb: "Model jobs, not just people. Skills attach to positions; incumbents attach to positions. Survives reorgs, hiring rounds, and tenant onboarding.",
  },
  {
    title: "Brownfield enrichment",
    blurb: "Ingest legacy HR exports (47k+ rows) via the wave-executor — SQL-side staging eliminates JS-heap pressure. Provenance preserved; PII handling is explicit.",
  },
  {
    title: "Skills coverage you can defend",
    blurb: "Self-assessed + manager-validated + endorsed signals collapse into a single coverage score per position × skill. Heatmaps + decay rules built in.",
  },
  {
    title: "BPM blueprints",
    blurb: "Process owners declare blueprints once; mappings to positions + responsibilities + KPIs derive automatically. No more PDFs that drift from reality.",
  },
];

export default function LandingPageShowcase() {
  return (
    <div className="-mx-6 -my-10">
      <div className="border-b border-border bg-card px-6 py-3">
        <Link href="/showcase" className="text-xs text-muted-foreground underline">← back to showcase index</Link>
      </div>

      {/* Hero band: inverse contrast surface for marketing impact. Uses
          `bg-foreground` + `text-background` so palette/theme switches still
          propagate (the hero stays "dark in light theme, light in dark theme"
          — i.e. always opposite to the body, which is the standard pattern
          for marketing hero stripes). */}
      <div className="bg-foreground text-background">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <HeuresysWordmark variant="brand" size="lg" />
          <ul className="hidden items-center gap-6 text-sm opacity-80 md:flex">
            <li className="hover:opacity-100">Product</li>
            <li className="hover:opacity-100">Solutions</li>
            <li className="hover:opacity-100">Resources</li>
            <li className="hover:opacity-100">Pricing</li>
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <a href="/login" className="opacity-80 hover:opacity-100">Log in</a>
            <a href="/showcase" className="rounded-full bg-background px-4 py-1.5 font-medium text-foreground">
              Request demo
            </a>
          </div>
        </nav>

        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Heuresys · v0.3</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight tracking-tight">
              Workforce intelligence,<br />
              <span className="text-primary">position-first.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg opacity-80">
              The HRMS / BPM platform that maps positions, skills, processes and learning into a
              single tenant-isolated graph. Built on PostgreSQL 16, Fastify, Next.js 15 — no Docker,
              no RLS, no mocks.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#demo" className="rounded-full bg-primary px-6 py-3 font-medium text-background hover:opacity-90">
                Request demo
              </a>
              <a href="#docs" className="rounded-full border border-background/40 px-6 py-3 font-medium hover:bg-background/10">
                Read the docs
              </a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs opacity-70">
              <span>★ 4.8 / 5 — design partners</span>
              <span aria-hidden>·</span>
              <span>23 tenants live</span>
              <span aria-hidden>·</span>
              <span>EU-only data residency</span>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-card border border-background/20 bg-background/5 p-6 shadow-2xl backdrop-blur">
              <div className="flex items-center gap-2 border-b border-background/20 pb-3">
                <HeuresysMark size={24} />
                <span className="text-sm font-medium">Executive dashboard</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-card bg-background/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Active positions</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">1,284</p>
                  <p className="text-xs text-success">+12 this week</p>
                </div>
                <div className="rounded-card bg-background/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Skill gaps</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">342</p>
                  <p className="text-xs text-success">−18 vs last month</p>
                </div>
                <div className="rounded-card bg-background/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Learning YTD</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">5,917</p>
                  <p className="text-xs text-primary">78% of plan</p>
                </div>
                <div className="rounded-card bg-background/10 p-3">
                  <p className="text-[10px] uppercase tracking-wider opacity-70">Tenants live</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">23</p>
                  <p className="text-xs opacity-70">+1 this quarter</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Why teams pick Heuresys</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">A workforce graph that survives reality.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Most HRMS treat employees as the root entity. Heuresys treats <em>positions</em> as the
            root. Reorgs, hiring rounds, succession plans and tenant onboarding stop breaking your
            data model.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-card border border-border bg-muted p-6">
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-card-foreground">{f.blurb}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary text-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-16 md:flex-row">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Ready to see Heuresys on your org?</h2>
            <p className="mt-2 opacity-80">30-min walkthrough on your seed data. EU-only. No sales call.</p>
          </div>
          <a href="#" className="rounded-full bg-background px-6 py-3 font-semibold text-primary hover:opacity-90">
            Request demo
          </a>
        </div>
      </section>

      <footer className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground md:flex-row">
          <span>© 2026 Heuresys S.r.l. · heuresys.com</span>
          <span className="flex gap-3">
            <a aria-label="LinkedIn" href="#">in</a>
            <a aria-label="GitHub" href="#">gh</a>
            <a aria-label="X" href="#">x</a>
            <a aria-label="Facebook" href="#">fb</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
