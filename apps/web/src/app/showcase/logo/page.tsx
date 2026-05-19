import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  LogoCandidateAFull,
  LogoCandidateASymbol,
  LogoCandidateBFull,
  LogoCandidateBSymbol,
  LogoCandidateCFull,
  LogoCandidateCSymbol,
  LogoCandidateDFull,
  LogoCandidateDSymbol,
} from "@heuresys/ui/brand/candidates";

export const metadata = {
  title: "Showcase / Logo — Heuresys",
};

type LogoCandidate = {
  id: "A" | "B" | "C" | "D";
  name: string;
  thesis: string;
  Symbol: ComponentType<SVGProps<SVGSVGElement>>;
  Full: ComponentType<SVGProps<SVGSVGElement>>;
  wordmarkWeight: string;
  paletteAdaptive: boolean;
};

const CANDIDATES: LogoCandidate[] = [
  {
    id: "A",
    name: "Hex node",
    thesis:
      "Hexagonal frame + internal 3-node constellation (skill / role / capability). Geometric, enterprise-confident. Strong at small symbol scale.",
    Symbol: LogoCandidateASymbol,
    Full: LogoCandidateAFull,
    wordmarkWeight: "700 (bold), letter-spacing −0.5",
    paletteAdaptive: true,
  },
  {
    id: "B",
    name: "H ladder",
    thesis:
      "Rounded square + custom H letterform with internal rungs implying skill-progression. Direct semantic tie (H = Heuresys = HRMS).",
    Symbol: LogoCandidateBSymbol,
    Full: LogoCandidateBFull,
    wordmarkWeight: "500 (medium)",
    paletteAdaptive: true,
  },
  {
    id: "C",
    name: "Constellation",
    thesis:
      "Circle scaffold + three nodes forming a triangle. People / role / capability triangulation. Editorial, leans into 'workforce intelligence' positioning.",
    Symbol: LogoCandidateCSymbol,
    Full: LogoCandidateCFull,
    wordmarkWeight: "300 (light), letter-spacing 1, lowercase",
    paletteAdaptive: true,
  },
  {
    id: "D",
    name: "Y-accent (legacy port)",
    thesis:
      "Lowercase 'heuresys' wordmark with the 'y' as accent letter (different color from the rest). Symbol is the 'y' alone. Typographic, not geometric. Direct port of the evo.heuresys.com legacy brand identity, adapted to follow active palette via --logo-body + --logo-accent CSS vars.",
    Symbol: LogoCandidateDSymbol,
    Full: LogoCandidateDFull,
    wordmarkWeight: "700 (bold), Exo 2, letter-spacing −0.5",
    paletteAdaptive: true,
  },
];

function LogoCard({ c }: { c: LogoCandidate }) {
  const { Symbol, Full } = c;
  return (
    <article className="hx-card-enter hx-card-hover rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--card-foreground)]">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Candidate {c.id}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{c.name}</h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">{c.wordmarkWeight}</p>
        </div>
      </header>
      <p className="mb-4 text-sm text-[var(--muted-foreground)]">{c.thesis}</p>

      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Full (220×48) · active palette surface
          </p>
          <div className="flex items-center justify-center py-4" style={{ color: "var(--palette-1)" }}>
            <Full className="hx-logo h-12 w-auto" />
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            Full · dark surface (currentColor inverts)
          </p>
          <div className="flex items-center justify-center rounded bg-neutral-900 py-4 text-white">
            <Full className="hx-logo h-12 w-auto" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { size: 48, label: "Symbol · 48" },
            { size: 32, label: "Symbol · 32 (header)" },
            { size: 24, label: "Symbol · 24 (sidebar)" },
          ].map(({ size, label }) => (
            <div key={size} className="rounded-lg border border-[var(--border)] p-3 text-center">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {label}
              </p>
              <div className="flex items-center justify-center" style={{ color: "var(--palette-1)" }}>
                <Symbol className="hx-logo" style={{ height: size, width: size }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function LogoShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">UXIX-0007 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Heuresys logo system</h1>
        <p className="max-w-2xl text-sm text-[var(--muted-foreground)]">
          Three logo candidates rendered at the four scales the brand has to survive: full at header
          scale (220×48), symbol at 48 (loading screens, favicon source), symbol at 32 (dashboard
          header), symbol at 24 (collapsed sidebar). Each candidate uses <code>currentColor</code> so
          it inherits theme color (dark surface preview shown).
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Source of truth: <code>@heuresys/ui/brand/candidates</code> (React components) +{" "}
          <code>@heuresys/ui/assets/brand/candidates/UXIX-0007-logo/</code> (raw SVG). Candidate D
          follows the active palette via <code>--logo-body</code> + <code>--logo-accent</code> CSS
          vars — switch palette in the header to see it adapt. Governance:{" "}
          <code>D:\ux-design-shared\governance\DECISION_REGISTER.md</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="candidates" className="space-y-3">
        <h2 id="candidates" className="sr-only">Candidates</h2>
        <div className="hx-stagger grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-4">
          {CANDIDATES.map((c) => (
            <LogoCard key={c.id} c={c} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-base font-semibold tracking-tight">After Acceptance</h2>
        <p className="mt-2 text-sm text-[var(--card-foreground)]">
          The chosen candidate&apos;s components get promoted from{" "}
          <code>@heuresys/ui/brand/candidates</code> to <code>@heuresys/ui/brand</code> as canonical
          <code> HeuresysLogo / HeuresysMark</code>, and the raw SVG sources move from{" "}
          <code>src/assets/brand/candidates/UXIX-0007-logo/</code> to{" "}
          <code>src/assets/brand/logo/</code>. Derivative variants (horizontal, monochrome, light,
          dark) and the favicon set are generated from the chosen mark. Non-chosen candidates remain
          in <code>candidates/</code> as historical record (Decision Register Rule 1 — no deletion).
        </p>
      </section>
    </div>
  );
}
