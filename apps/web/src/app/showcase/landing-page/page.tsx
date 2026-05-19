import Link from "next/link";
import { LogoCandidateAFull, LogoCandidateASymbol } from "@heuresys/ui/brand/candidates";

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
      <div className="border-b border-[var(--border)] bg-[var(--card)] px-6 py-3">
        <Link href="/showcase" className="text-xs text-[var(--muted-foreground)] underline">← back to showcase index</Link>
      </div>

      <div className="bg-neutral-900 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <LogoCandidateAFull className="h-8 w-auto" />
          <ul className="hidden items-center gap-6 text-sm text-neutral-300 md:flex">
            <li className="hover:text-white">Product</li>
            <li className="hover:text-white">Solutions</li>
            <li className="hover:text-white">Resources</li>
            <li className="hover:text-white">Pricing</li>
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <a href="/login" className="text-neutral-300 hover:text-white">Log in</a>
            <a href="/showcase" className="rounded-full bg-[var(--card)] px-4 py-1.5 font-medium text-[var(--card-foreground)]">Request demo</a>
          </div>
        </nav>

        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">Heuresys · v0.3</p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight tracking-tight">
              Workforce intelligence,<br />
              <span className="text-blue-400">position-first.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-neutral-300">
              The HRMS / BPM platform that maps positions, skills, processes and learning into a
              single tenant-isolated graph. Built on PostgreSQL 16, Fastify, Next.js 15 — no Docker,
              no RLS, no mocks.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#demo" className="rounded-full bg-blue-600 px-6 py-3 font-medium hover:bg-blue-700">Request demo</a>
              <a href="#docs" className="rounded-full border border-neutral-700 px-6 py-3 font-medium text-neutral-200 hover:bg-neutral-800">Read the docs</a>
            </div>
            <div className="mt-8 flex items-center gap-6 text-xs text-[var(--muted-foreground)]">
              <span>★ 4.8 / 5 — design partners</span>
              <span aria-hidden>·</span>
              <span>23 tenants live</span>
              <span aria-hidden>·</span>
              <span>EU-only data residency</span>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl border border-neutral-700 bg-neutral-800/70 p-6 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-neutral-700 pb-3">
                <LogoCandidateASymbol className="h-6 w-6 text-blue-400" />
                <span className="text-sm font-medium">Executive dashboard</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-neutral-900 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Active positions</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-white">1,284</p>
                  <p className="text-xs text-emerald-400">+12 this week</p>
                </div>
                <div className="rounded-lg bg-neutral-900 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Skill gaps</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-white">342</p>
                  <p className="text-xs text-emerald-400">−18 vs last month</p>
                </div>
                <div className="rounded-lg bg-neutral-900 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Learning YTD</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-white">5,917</p>
                  <p className="text-xs text-blue-400">78% of plan</p>
                </div>
                <div className="rounded-lg bg-neutral-900 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">Tenants live</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums text-white">23</p>
                  <p className="text-xs text-[var(--muted-foreground)]">+1 this quarter</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="bg-[var(--card)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Why teams pick Heuresys</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">A workforce graph that survives reality.</h2>
          <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">
            Most HRMS treat employees as the root entity. Heuresys treats <em>positions</em> as the
            root. Reorgs, hiring rounds, succession plans and tenant onboarding stop breaking your
            data model.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-6">
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm text-[var(--card-foreground)]">{f.blurb}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-600 text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-16 md:flex-row">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Ready to see Heuresys on your org?</h2>
            <p className="mt-2 text-blue-100">30-min walkthrough on your seed data. EU-only. No sales call.</p>
          </div>
          <a href="#" className="rounded-full bg-[var(--card)] px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50">Request demo</a>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] bg-[var(--muted)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-[var(--muted-foreground)] md:flex-row">
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
