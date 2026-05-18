import Link from "next/link";

export const metadata = {
  title: "Showcase / Palettes — Heuresys",
};

type Swatch = {
  token: string;
  hex: string;
  role: string;
};

type Palette = {
  id: "A" | "B";
  name: string;
  thesis: string;
  surface: Swatch[];
  accent: Swatch[];
  semantic: Swatch[];
};

const PALETTE_A: Palette = {
  id: "A",
  name: "Blue Primary (current)",
  thesis:
    "Confidence + clarity. Anchored on Heuresys' historical primary blue, extended with cyan/purple/yellow accents per bundle 4-box palette switcher. Reads as enterprise-trustworthy.",
  surface: [
    { token: "--background", hex: "#FAFBFD", role: "App background" },
    { token: "--foreground", hex: "#0F1828", role: "Body text" },
    { token: "--card", hex: "#FFFFFF", role: "Surface" },
    { token: "--border", hex: "#E2E6EE", role: "Divider / outline" },
  ],
  accent: [
    { token: "--palette-1", hex: "#2563EB", role: "Primary blue" },
    { token: "--palette-2", hex: "#06B6D4", role: "Cyan" },
    { token: "--palette-3", hex: "#7C3AED", role: "Purple" },
    { token: "--palette-4", hex: "#F59E0B", role: "Yellow" },
  ],
  semantic: [
    { token: "--color-icon-info", hex: "#2563EB", role: "Info" },
    { token: "--color-icon-success", hex: "#16A34A", role: "Success" },
    { token: "--color-icon-warning", hex: "#F59E0B", role: "Warning" },
    { token: "--color-icon-danger", hex: "#DC2626", role: "Danger" },
  ],
};

const PALETTE_B: Palette = {
  id: "B",
  name: "Slate + Teal (alternative)",
  thesis:
    "Calmer, more editorial. Slate neutrals replace pure cool greys, primary shifts from saturated blue to a deep teal. Reads as modern-restrained and works better in long reading contexts.",
  surface: [
    { token: "--background", hex: "#F7F8F7", role: "App background" },
    { token: "--foreground", hex: "#111418", role: "Body text" },
    { token: "--card", hex: "#FFFFFF", role: "Surface" },
    { token: "--border", hex: "#E1E4E3", role: "Divider / outline" },
  ],
  accent: [
    { token: "--palette-1", hex: "#0F766E", role: "Primary teal" },
    { token: "--palette-2", hex: "#0891B2", role: "Cyan" },
    { token: "--palette-3", hex: "#9333EA", role: "Purple" },
    { token: "--palette-4", hex: "#CA8A04", role: "Ochre" },
  ],
  semantic: [
    { token: "--color-icon-info", hex: "#0F766E", role: "Info" },
    { token: "--color-icon-success", hex: "#15803D", role: "Success" },
    { token: "--color-icon-warning", hex: "#CA8A04", role: "Warning" },
    { token: "--color-icon-danger", hex: "#B91C1C", role: "Danger" },
  ],
};

const PALETTES: Palette[] = [PALETTE_A, PALETTE_B];

function SwatchGroup({ title, items }: { title: string; items: Swatch[] }) {
  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h4>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((s) => (
          <li
            key={s.token}
            className="flex items-center gap-2 rounded border border-neutral-200 bg-white p-1.5"
          >
            <span
              aria-hidden
              className="inline-block h-8 w-8 shrink-0 rounded border border-neutral-300"
              style={{ backgroundColor: s.hex }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-neutral-900">{s.role}</p>
              <p className="truncate text-[10px] font-mono text-neutral-500">{s.hex}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaletteCard({ p }: { p: Palette }) {
  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Candidate {p.id}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tracking-tight">{p.name}</h3>
        </div>
      </header>
      <p className="mb-4 text-sm text-neutral-600">{p.thesis}</p>
      <div className="space-y-4">
        <SwatchGroup title="Surface" items={p.surface} />
        <SwatchGroup title="Brand palette (4-box)" items={p.accent} />
        <SwatchGroup title="Semantic states" items={p.semantic} />
      </div>
      <div
        aria-label={`Preview ${p.id}`}
        className="mt-5 rounded-lg border border-neutral-200 p-4"
        style={{
          backgroundColor: p.surface[0]?.hex,
          color: p.surface[1]?.hex,
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: p.accent[0]?.hex }}>
          KPI · Workforce
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">1,284 positions</p>
        <p className="mt-0.5 text-xs opacity-70">+12 this week · 78% capacity</p>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded px-3 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: p.accent[0]?.hex }}
          >
            Primary action
          </button>
          <button
            className="rounded border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: p.surface[3]?.hex, color: p.surface[1]?.hex }}
          >
            Secondary
          </button>
        </div>
      </div>
    </article>
  );
}

export default function PalettesShowcasePage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-neutral-500">UXIX-0005 · Proposed</p>
        <h1 className="text-3xl font-semibold tracking-tight">Brand primary palette</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Two palette candidates on identical UI fixtures. Product Owner picks; the chosen candidate is
          captured in <code>D:\ux-design-shared\governance\ADR-0005-brand-primary-palette.md</code>{" "}
          and propagated to <code>D:\ux-design-shared\ui\src\styles\tokens.css</code>.
        </p>
        <p className="text-xs text-neutral-500">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="candidates" className="space-y-3">
        <h2 id="candidates" className="sr-only">Candidates</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {PALETTES.map((p) => (
            <PaletteCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-tight">How to decide</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>Open each candidate side-by-side under both light and dark theme (theme switcher pending).</li>
          <li>Compare contrast on the primary CTA against WCAG AA (4.5:1 minimum for text).</li>
          <li>Test on the Workforce KPI card preview — does the value typography retain authority?</li>
          <li>Capture the choice via <code>prompts/DESIGN_DECISION_CAPTURE_PROMPT.md</code> → register update.</li>
        </ol>
      </section>
    </div>
  );
}
