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
  id: "A" | "B" | "C" | "D" | "E";
  name: string;
  thesis: string;
  surface: Swatch[];
  accent: Swatch[];
  semantic: Swatch[];
};

const PALETTES: Palette[] = [
  {
    id: "A",
    name: "Blue Primary (default)",
    thesis:
      "Confidence + clarity. Anchored on Heuresys' historical primary blue, extended with cyan / purple / yellow as 4-box accents. Reads as enterprise-trustworthy, low-risk first impression.",
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
  },
  {
    id: "B",
    name: "Studio Slate",
    thesis:
      "Calmer, editorial. Slate neutrals replace pure cool greys; primary shifts from saturated blue to a deep teal. Reads modern-restrained — works in long reading contexts (governance, blueprint editor).",
    surface: [
      { token: "--background", hex: "#F7F8F7", role: "App background" },
      { token: "--foreground", hex: "#111418", role: "Body text" },
      { token: "--card", hex: "#FFFFFF", role: "Surface" },
      { token: "--border", hex: "#E1E4E3", role: "Divider / outline" },
    ],
    accent: [
      { token: "--palette-1", hex: "#0F766E", role: "Primary teal" },
      { token: "--palette-2", hex: "#0891B2", role: "Cyan" },
      { token: "--palette-3", hex: "#7C3F66", role: "Plum" },
      { token: "--palette-4", hex: "#CA8A04", role: "Ochre" },
    ],
    semantic: [
      { token: "--color-icon-info", hex: "#0F766E", role: "Info" },
      { token: "--color-icon-success", hex: "#15803D", role: "Success" },
      { token: "--color-icon-warning", hex: "#CA8A04", role: "Warning" },
      { token: "--color-icon-danger", hex: "#B91C1C", role: "Danger" },
    ],
  },
  {
    id: "C",
    name: "Choco & Coffee",
    thesis:
      "Warm monochromatic. Espresso primary on cream surfaces. The 4-box stays inside the brown family (espresso / caramel / mocha / latte) for a tactile, hand-crafted feel — opposite of the generic SaaS blue.",
    surface: [
      { token: "--background", hex: "#FAF6F1", role: "App background (cream)" },
      { token: "--foreground", hex: "#2B1810", role: "Body text (espresso)" },
      { token: "--card", hex: "#FFFFFF", role: "Surface" },
      { token: "--border", hex: "#E5DBD0", role: "Divider / outline" },
    ],
    accent: [
      { token: "--palette-1", hex: "#3E2723", role: "Espresso primary" },
      { token: "--palette-2", hex: "#8B5A2B", role: "Caramel" },
      { token: "--palette-3", hex: "#6F4E37", role: "Mocha" },
      { token: "--palette-4", hex: "#C8A982", role: "Latte" },
    ],
    semantic: [
      { token: "--color-icon-info", hex: "#5C3317", role: "Info (cocoa)" },
      { token: "--color-icon-success", hex: "#3F5E3F", role: "Success (forest)" },
      { token: "--color-icon-warning", hex: "#C68642", role: "Warning (amber)" },
      { token: "--color-icon-danger", hex: "#7A2E2E", role: "Danger (oxblood)" },
    ],
  },
  {
    id: "D",
    name: "Cognac & Oatmeal",
    thesis:
      "Heritage warmth. Cognac primary (Pantone 2026-trend warm brown between camel and chocolate) on oatmeal-heather neutrals, with muted sage as the editorial accent. Expensive-looking without being loud.",
    surface: [
      { token: "--background", hex: "#F4EFE6", role: "App background (oatmeal)" },
      { token: "--foreground", hex: "#1F1B16", role: "Body text (ink)" },
      { token: "--card", hex: "#FFFFFF", role: "Surface" },
      { token: "--border", hex: "#DCD3C2", role: "Divider (heather)" },
    ],
    accent: [
      { token: "--palette-1", hex: "#A0522D", role: "Cognac primary" },
      { token: "--palette-2", hex: "#8FA28E", role: "Sage" },
      { token: "--palette-3", hex: "#B7654E", role: "Terracotta" },
      { token: "--palette-4", hex: "#9C7A4A", role: "Bronze" },
    ],
    semantic: [
      { token: "--color-icon-info", hex: "#5C7D74", role: "Info (slate-sage)" },
      { token: "--color-icon-success", hex: "#5F7A5F", role: "Success (sage)" },
      { token: "--color-icon-warning", hex: "#C68642", role: "Warning (amber)" },
      { token: "--color-icon-danger", hex: "#A4453C", role: "Danger (clay)" },
    ],
  },
  {
    id: "E",
    name: "Onyx & Champagne",
    thesis:
      "Luxury restraint. Onyx near-black as primary anchor on warm champagne surface, with a single emerald accent for energy. Chanel / Saint Laurent editorial template: black + one accent + warm ivory.",
    surface: [
      { token: "--background", hex: "#F7F2E7", role: "App background (champagne)" },
      { token: "--foreground", hex: "#14110F", role: "Body text (onyx)" },
      { token: "--card", hex: "#FFFFFF", role: "Surface" },
      { token: "--border", hex: "#E5DCC6", role: "Divider (champagne mid)" },
    ],
    accent: [
      { token: "--palette-1", hex: "#14110F", role: "Onyx primary" },
      { token: "--palette-2", hex: "#0E5340", role: "Emerald (single accent)" },
      { token: "--palette-3", hex: "#5C1F2C", role: "Oxblood" },
      { token: "--palette-4", hex: "#8B6F47", role: "Brass (matte)" },
    ],
    semantic: [
      { token: "--color-icon-info", hex: "#1F4E64", role: "Info (steel)" },
      { token: "--color-icon-success", hex: "#0E5340", role: "Success (emerald)" },
      { token: "--color-icon-warning", hex: "#A07C2F", role: "Warning (ochre)" },
      { token: "--color-icon-danger", hex: "#7A2E2E", role: "Danger (wine)" },
    ],
  },
];

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
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">1,284 positions</p>
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
        <p className="text-xs uppercase tracking-wider text-neutral-500">UXIX-0005 · Proposed · 5 candidates</p>
        <h1 className="text-3xl font-semibold tracking-tight">Brand primary palette</h1>
        <p className="max-w-2xl text-sm text-neutral-600">
          Five palette candidates on identical UI fixtures. Each row has the same data so the only
          variable is color. Product Owner picks; the chosen candidate is captured in{" "}
          <code>D:\ux-design-shared\governance\ADR-0005-brand-primary-palette.md</code> and propagated
          to <code>D:\ux-design-shared\ui\src\styles\tokens.css</code>.
        </p>
        <p className="text-xs text-neutral-500">
          <Link href="/showcase" className="underline">back to index</Link>
        </p>
      </header>

      <section aria-labelledby="candidates" className="space-y-3">
        <h2 id="candidates" className="sr-only">Candidates</h2>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {PALETTES.map((p) => (
            <PaletteCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <h2 className="text-base font-semibold tracking-tight text-amber-900">No-gradient rule (locked)</h2>
        <p className="mt-2 text-sm text-amber-900">
          Heuresys brand identity v1 forbids <strong>any</strong> gradient (CSS <code>linear-gradient</code>,{" "}
          <code>radial-gradient</code>, Tailwind <code>bg-gradient-*</code>, SVG <code>linearGradient</code>{" "}
          / <code>radialGradient</code>) regardless of theme, palette or page type. Surfaces are flat;
          depth comes from elevation tokens (shadows + borders), never from color transitions. Any
          showcase or production surface violating this rule must be flagged and fixed in a{" "}
          <code>fix(brand):</code> commit.
        </p>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-tight">How to decide</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-neutral-700">
          <li>View the 5 cards side-by-side. Surface + Primary action button is the fastest filter — does the brand mood read right?</li>
          <li>Verify contrast on the primary CTA against WCAG AA (4.5:1 minimum for text).</li>
          <li>Test on the Workforce KPI preview — does the value typography retain authority?</li>
          <li>Consider the 4-box accent: do the 4 colors still read as a coherent system at chart scale?</li>
          <li>Capture the choice via <code>prompts/DESIGN_DECISION_CAPTURE_PROMPT.md</code> → register update.</li>
        </ol>
      </section>
    </div>
  );
}
