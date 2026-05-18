import Link from "next/link";

export const metadata = {
  title: "Showcase / Typography — Heuresys",
};

type ScaleStep = {
  token: string;
  px: number;
  lineHeight: number;
  weight: number;
  sample: string;
  role: string;
};

type Typography = {
  id: "A" | "B";
  name: string;
  family: string;
  stack: string;
  thesis: string;
  scale: ScaleStep[];
};

const TYPOGRAPHY_A: Typography = {
  id: "A",
  name: "Exo 2 (current)",
  family: "Exo 2",
  stack: "'Exo 2', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  thesis:
    "Geometric humanist sans with restrained character — already in use as default in tokens.css. Strong KPI numerals (oldstyle off), supportive at body sizes, ascender clarity intact at 12px.",
  scale: [
    { token: "--font-size-display", px: 48, lineHeight: 1.1, weight: 700, role: "Display", sample: "Workforce intelligence" },
    { token: "--font-size-h1", px: 32, lineHeight: 1.2, weight: 600, role: "H1", sample: "Active positions" },
    { token: "--font-size-h2", px: 24, lineHeight: 1.3, weight: 600, role: "H2", sample: "Skills coverage" },
    { token: "--font-size-h3", px: 18, lineHeight: 1.4, weight: 600, role: "H3", sample: "Top-10 gaps" },
    { token: "--font-size-body", px: 14, lineHeight: 1.5, weight: 400, role: "Body", sample: "The Skills module ingests competency records and produces a coverage heatmap for every position." },
    { token: "--font-size-caption", px: 12, lineHeight: 1.4, weight: 500, role: "Caption", sample: "Last refresh · 14:02 · RTL_BANK_REFERENCE" },
  ],
};

const TYPOGRAPHY_B: Typography = {
  id: "B",
  name: "Inter + IBM Plex Mono (alternative)",
  family: "Inter",
  stack: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  thesis:
    "Modern grotesque. Inter is the de-facto SaaS sans (Linear, Vercel, Stripe). Pair with IBM Plex Mono for tabular numerics in KPI cards and code snippets. Slightly more neutral than Exo 2, leans editorial.",
  scale: [
    { token: "--font-size-display", px: 48, lineHeight: 1.05, weight: 700, role: "Display", sample: "Workforce intelligence" },
    { token: "--font-size-h1", px: 32, lineHeight: 1.15, weight: 700, role: "H1", sample: "Active positions" },
    { token: "--font-size-h2", px: 24, lineHeight: 1.25, weight: 600, role: "H2", sample: "Skills coverage" },
    { token: "--font-size-h3", px: 18, lineHeight: 1.35, weight: 600, role: "H3", sample: "Top-10 gaps" },
    { token: "--font-size-body", px: 14, lineHeight: 1.55, weight: 400, role: "Body", sample: "The Skills module ingests competency records and produces a coverage heatmap for every position." },
    { token: "--font-size-caption", px: 12, lineHeight: 1.45, weight: 500, role: "Caption", sample: "Last refresh · 14:02 · RTL_BANK_REFERENCE" },
  ],
};

const CANDIDATES: Typography[] = [TYPOGRAPHY_A, TYPOGRAPHY_B];

function ScaleRow({ step, family }: { step: ScaleStep; family: string }) {
  return (
    <li className="flex items-baseline gap-4 border-t border-[var(--border)] py-3 first:border-t-0">
      <div className="w-24 shrink-0 text-xs text-[var(--muted-foreground)]">
        <p className="font-medium">{step.role}</p>
        <p className="font-mono">{step.px}px / {step.weight}</p>
      </div>
      <p
        className="flex-1 leading-tight"
        style={{
          fontFamily: family,
          fontSize: `${step.px}px`,
          fontWeight: step.weight,
          lineHeight: step.lineHeight,
        }}
      >
        {step.sample}
      </p>
    </li>
  );
}

function TypographyCard({ t }: { t: Typography }) {
  return (
    <article className="hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Candidate {t.id}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{t.name}</h3>
          <p className="mt-0.5 text-xs font-mono text-[var(--muted-foreground)]">{t.stack}</p>
        </div>
      </header>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">{t.thesis}</p>
      <ul className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
        {t.scale.map((s) => (
          <ScaleRow key={s.token} step={s} family={t.family} />
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-[var(--border)] p-4">
        <p
          className="text-[11px] uppercase tracking-wider text-[var(--muted-foreground)]"
          style={{ fontFamily: t.family }}
        >
          KPI sample
        </p>
        <p
          className="mt-1 text-3xl font-bold tracking-tight"
          style={{ fontFamily: t.family, fontVariantNumeric: "tabular-nums" }}
        >
          1,284
        </p>
        <p
          className="mt-0.5 text-xs text-[var(--muted-foreground)]"
          style={{ fontFamily: t.family }}
        >
          +12 this week · 78% capacity
        </p>
      </div>
    </article>
  );
}

export default function TypographyShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">UXIX-0006 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Brand typography</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Typeface and modular scale candidates. Product Owner picks; the chosen candidate becomes the
          authoritative scale in <code>D:\ux-design-shared\ui\src\styles\tokens.css</code>.
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Note · web fonts are not yet wired into the document head — the cards below fall back to
          system stacks if the family is not installed locally.{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="candidates" className="space-y-3">
        <h2 id="candidates" className="sr-only">Candidates</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CANDIDATES.map((t) => (
            <TypographyCard key={t.id} t={t} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-base font-semibold tracking-tight">Scale rationale</h2>
        <p className="mt-2 text-sm text-[var(--card-foreground)]">
          A 6-step modular scale (Display / H1 / H2 / H3 / Body / Caption) is sufficient for an HRMS
          dashboard. Adding a 7th step risks pollution of the type system without payoff. Both
          candidates align on the same step boundaries (48 / 32 / 24 / 18 / 14 / 12) so the decision is
          purely about voice + family, not rhythm.
        </p>
      </section>
    </div>
  );
}
