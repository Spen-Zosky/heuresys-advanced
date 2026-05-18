import Link from "next/link";

export const metadata = {
  title: "Showcase / Logo — Heuresys",
};

type LogoCandidate = {
  id: "A" | "B" | "C";
  name: string;
  thesis: string;
  symbolPath: string;
  fullPath: string;
  wordmarkWeight: string;
};

const CANDIDATES: LogoCandidate[] = [
  {
    id: "A",
    name: "Hex node",
    thesis:
      "Hexagonal frame + internal 3-node constellation (skill / role / capability). Reads as structured, geometric, enterprise-confident. Strong at small symbol scale.",
    symbolPath: "/brand-candidates/UXIX-0007/heuresys-logo-A-symbol.svg",
    fullPath: "/brand-candidates/UXIX-0007/heuresys-logo-A-full.svg",
    wordmarkWeight: "700 (bold), letter-spacing −0.5",
  },
  {
    id: "B",
    name: "H ladder",
    thesis:
      "Rounded square + custom H letterform with internal rungs implying skill-progression. Direct semantic tie (H = Heuresys = HRMS) and ladder = career path / learning steps.",
    symbolPath: "/brand-candidates/UXIX-0007/heuresys-logo-B-symbol.svg",
    fullPath: "/brand-candidates/UXIX-0007/heuresys-logo-B-full.svg",
    wordmarkWeight: "500 (medium)",
  },
  {
    id: "C",
    name: "Constellation",
    thesis:
      "Circle scaffold + three nodes forming a triangle. People / role / capability triangulation. Lightest of the three, more editorial, leans into 'workforce intelligence' positioning.",
    symbolPath: "/brand-candidates/UXIX-0007/heuresys-logo-C-symbol.svg",
    fullPath: "/brand-candidates/UXIX-0007/heuresys-logo-C-full.svg",
    wordmarkWeight: "300 (light), letter-spacing 1, lowercase",
  },
];

function LogoCard({ c }: { c: LogoCandidate }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Candidate {c.id}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{c.name}</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">{c.wordmarkWeight}</p>
        </div>
      </header>
      <p className="mb-4 text-sm text-neutral-600">{c.thesis}</p>

      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Full (220×48) · light surface
          </p>
          <div className="flex items-center justify-center bg-white py-4 text-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.fullPath} alt={`Heuresys ${c.name} — full logo`} className="h-12" />
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Full · dark surface (currentColor inverts)
          </p>
          <div className="flex items-center justify-center rounded bg-neutral-900 py-4 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.fullPath} alt={`Heuresys ${c.name} — full logo on dark`} className="h-12 invert" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-neutral-200 p-3 text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Symbol · 48
            </p>
            <div className="flex items-center justify-center text-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.symbolPath} alt={`Heuresys ${c.name} — symbol 48px`} className="h-12 w-12" />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Symbol · 32 (header)
            </p>
            <div className="flex items-center justify-center text-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.symbolPath} alt={`Heuresys ${c.name} — symbol 32px`} className="h-8 w-8" />
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 text-center">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              Symbol · 24 (collapsed sidebar)
            </p>
            <div className="flex items-center justify-center text-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.symbolPath} alt={`Heuresys ${c.name} — symbol 24px`} className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function LogoShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">UXIX-0007 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Heuresys logo system</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Three logo candidates rendered at the three scales the brand has to survive: full at header
          scale (220×48), symbol at 48 (loading screens, favicon source), symbol at 32 (dashboard
          header), symbol at 24 (collapsed sidebar). Each candidate uses{" "}
          <code>currentColor</code> so it inherits theme color (dark surface preview shown).
        </p>
        <p className="text-xs text-neutral-500">
          Asset sources: <code>docs/design-decisions/candidates/UXIX-0007-logo/</code> ·{" "}
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="candidates" className="space-y-3">
        <h2 id="candidates" className="sr-only">Candidates</h2>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {CANDIDATES.map((c) => (
            <LogoCard key={c.id} c={c} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-tight">After Acceptance</h2>
        <p className="mt-2 text-sm text-neutral-700">
          The chosen candidate's symbol + full files get promoted to{" "}
          <code>D:\ux-design-shared\ui\src\brand\</code> as canonical assets. Derivative variants
          (horizontal, monochrome, light, dark) and the favicon set are generated from the chosen
          mark. Non-chosen candidates remain in <code>docs/design-decisions/candidates/UXIX-0007-logo/</code>{" "}
          as historical record (Decision Register Rule 1 — no deletion).
        </p>
      </section>
    </div>
  );
}
