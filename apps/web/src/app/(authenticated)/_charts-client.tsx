"use client";

/**
 * apps/web/src/app/(authenticated)/_charts-client.tsx
 *
 * Client-only re-export of the heavy chart components from @heuresys/ui, each
 * wrapped in `next/dynamic({ ssr: false })`. `EChartsCard` pulls in echarts,
 * whose class-based init crashes Next's server-side prerender ("Class extends
 * value undefined" / CW-B59) and fails `next build`. The authenticated pages
 * are "use client", but a client component is still prerendered on the server
 * for the initial HTML — so rendering EChartsCard server-side would crash.
 * `dynamic(..., { ssr: false })` defers the barrel import to the client and
 * skips the server render, keeping the build safe.
 *
 * Import chart components from HERE (never from "@heuresys/ui" directly) inside
 * the (authenticated) chart pages. The `{ ssr: false }` must be an inline object
 * literal — the SWC plugin static-analyses it and rejects a hoisted variable.
 *
 * B-05 fix (audit S1006): the analytics pages encode brand colors as raw CSS-var
 * strings (e.g. `hsl(var(--palette-1))`). ECharts paints to an HTML <canvas>, and
 * a canvas 2D context CANNOT resolve CSS custom properties (`var()` only works in
 * the CSSOM) — it discards the unparseable string and falls back to BLACK, which
 * is invisible on the dark theme. Rather than rewrite every page, the exported
 * `EChartsCard` is now a thin wrapper that resolves every `var(--x)` inside the
 * `option` to a concrete color (via getComputedStyle on the live <html>) before
 * handing it to the real chart, and re-resolves when the theme class flips.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { localeDi } from "@/lib/format";

const RawEChartsCard = dynamic(
  // Subpath `/charts` isolates echarts so this lazy import does NOT drag the whole
  // @heuresys/ui barrel (mermaid/cytoscape/three/…) into one ~1.68MB chunk (#21).
  () => import("@heuresys/ui/charts").then((m) => ({ default: m.EChartsCard })),
  { ssr: false },
);

/** Recursively replace every `var(--name)` token in any string within `value`
 *  with its computed value read from `root`, so the echarts canvas gets concrete
 *  colors. Non-string leaves pass through unchanged. */
function resolveCssVars<T>(value: T, root: HTMLElement): T {
  if (typeof value === "string") {
    if (!value.includes("var(--")) return value;
    const get = (name: string) => getComputedStyle(root).getPropertyValue(name).trim() || "transparent";
    // 1) Unwrap color-function wrappers around a var. This app's design tokens are
    //    COMPLETE colors (hex, e.g. --palette-1: #2563EB), but the chart pages wrap
    //    them as `hsl(var(--palette-1))` → `hsl(#2563EB)`, which is INVALID CSS and
    //    paints black on the echarts canvas. Resolve straight to the hex.
    let out = value.replace(
      /(?:hsla?|rgba?)\(\s*var\((--[a-zA-Z0-9_-]+)\)\s*\)/g,
      (_m, name: string) => get(name),
    );
    // 2) Any remaining bare var(--x).
    out = out.replace(/var\((--[a-zA-Z0-9_-]+)\)/g, (_m, name: string) => get(name));
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveCssVars(item, root)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = resolveCssVars((value as Record<string, unknown>)[key], root);
    }
    return out as unknown as T;
  }
  return value;
}

type RawProps = ComponentProps<typeof RawEChartsCard>;

/**
 * C8 del piano interfaccia sistematica (2026-11-11): grafici leggibili per costruzione, non
 * pagina per pagina. Enzo: «grafici che non sono intellegibili» (legende che scorrono a pagine
 * sopra l'asse, numeri all'inglese «60,000», etichette tagliate). Su ogni opzione:
 *   - gli assi di valore scrivono i numeri nella forma della lingua («60.000»);
 *   - gli assi di categoria tengono l'etichetta intera fino a 200 px e la griglia la contiene;
 *   - la legenda sta sotto il grafico, va a capo invece di scorrere a pagine, e la griglia le
 *     lascia il posto che serve;
 *   - il riquadro al passaggio scrive i valori nella stessa forma.
 * Una pagina che ha già un `formatter` suo lo tiene.
 */
function numeroLocale(locale: string) {
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? nf.format(v) : String(v ?? ""));
}

function rendiLeggibile(option: RawProps["option"], locale: string): RawProps["option"] {
  const o = { ...(option as Record<string, unknown>) };
  const num = numeroLocale(locale);
  const asse = (a: unknown): unknown => {
    if (Array.isArray(a)) return a.map(asse);
    if (!a || typeof a !== "object") return a;
    const ax = { ...(a as Record<string, unknown>) };
    const label = { ...((ax.axisLabel as Record<string, unknown>) ?? {}) };
    const tipo = ax.type ?? "value";
    if (tipo === "value" || tipo === "log") {
      if (label.formatter === undefined) label.formatter = num;
    } else if (tipo === "category") {
      if (label.width === undefined) label.width = 200;
      if (label.overflow === undefined) label.overflow = "truncate";
    }
    ax.axisLabel = label;
    return ax;
  };
  if (o.xAxis) o.xAxis = asse(o.xAxis);
  if (o.yAxis) o.yAxis = asse(o.yAxis);
  const serie = Array.isArray(o.series) ? (o.series as unknown[]).length : 0;
  if (o.legend && typeof o.legend === "object" && !Array.isArray(o.legend)) {
    const voci = Array.isArray((o.legend as Record<string, unknown>).data)
      ? ((o.legend as Record<string, unknown>).data as unknown[]).length
      : serie;
    o.legend = { ...(o.legend as Record<string, unknown>), type: "plain", bottom: 0, left: "center", itemGap: 14, textStyle: { fontSize: 11 } };
    const righe = Math.max(1, Math.ceil(voci / 4));
    const g = (o.grid && typeof o.grid === "object" && !Array.isArray(o.grid) ? { ...(o.grid as Record<string, unknown>) } : {}) as Record<string, unknown>;
    const serve = 36 + righe * 20;
    if (typeof g.bottom !== "number" || g.bottom < serve) g.bottom = serve;
    g.containLabel = true;
    o.grid = g;
  } else if (o.grid && typeof o.grid === "object" && !Array.isArray(o.grid)) {
    o.grid = { ...(o.grid as Record<string, unknown>), containLabel: true };
  }
  if (o.tooltip && typeof o.tooltip === "object" && !Array.isArray(o.tooltip)) {
    const tt = o.tooltip as Record<string, unknown>;
    if (tt.valueFormatter === undefined && tt.formatter === undefined) o.tooltip = { ...tt, valueFormatter: num };
  }
  return o as RawProps["option"];
}

/**
 * V-11 del piano interfacce (2026-11-04): ogni grafico dice che cosa misurano i suoi assi
 * (nome e unita') e ha una tabella equivalente, leggibile da chi non vede il disegno e da un
 * agente. `assi` scrive `name` su xAxis e yAxis quando sono oggetti; `tabella` disegna sotto il
 * grafico una tabella apribile con gli stessi numeri.
 */
export interface ChartTable {
  titolo: string;
  colonne: string[];
  righe: Array<Array<string | number>>;
}
type EChartsCardProps = RawProps & {
  assi?: { x?: string; y?: string };
  tabella?: ChartTable;
  /** Lingua dei numeri della tabella. */
  lingua?: string;
};

function conNomiDegliAssi(option: RawProps["option"], assi: { x?: string; y?: string } | undefined): RawProps["option"] {
  if (!assi) return option;
  const o = { ...(option as Record<string, unknown>) };
  const metti = (k: "xAxis" | "yAxis", nome: string | undefined, verticale: boolean) => {
    const a = o[k];
    if (!nome || !a || typeof a !== "object" || Array.isArray(a)) return;
    o[k] = { ...(a as Record<string, unknown>), name: nome, nameLocation: "middle", nameGap: verticale ? 44 : 28 };
  };
  metti("xAxis", assi.x, false);
  metti("yAxis", assi.y, true);
  // Il nome dell'asse sta fuori dalla griglia: si lascia il posto, senza togliere margini piu' larghi.
  const g = o.grid;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const grid = { ...(g as Record<string, unknown>) };
    const almeno = (k: string, v: number) => {
      const cur = grid[k];
      if (typeof cur !== "number" || cur < v) grid[k] = v;
    };
    if (assi.x) almeno("bottom", 40);
    if (assi.y) almeno("left", 56);
    o.grid = grid;
  }
  return o as RawProps["option"];
}

function TabellaEquivalente({ tabella, lingua }: { tabella: ChartTable; lingua: string | undefined }) {
  const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString(lingua, { maximumFractionDigits: 2 }) : v);
  return (
    <details className="mt-3 text-sm" data-testid="chart-table">
      <summary className="cursor-pointer text-xs text-muted-foreground">{tabella.titolo}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">{tabella.titolo}</caption>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {tabella.colonne.map((c, i) => (
                <th key={i} scope="col" className={`px-2 py-1 ${i > 0 ? "text-right" : ""}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabella.righe.map((r, i) => (
              <tr key={i} className="border-b border-border/50">
                {r.map((v, j) => (
                  <td key={j} className={`px-2 py-1 ${j > 0 ? "text-right tabular-nums" : ""}`}>{fmt(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function EChartsCard({ assi, tabella, lingua, ...props }: EChartsCardProps) {
  const { i18n } = useTranslation();
  const locale = localeDi(lingua ?? i18n.language);
  // bump on theme (html.class) change so colors re-resolve when IT/dark toggles
  const [themeTick, setThemeTick] = useState(0);
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setThemeTick((t) => t + 1));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const option = useMemo(
    () =>
      typeof document === "undefined"
        ? props.option
        : resolveCssVars(rendiLeggibile(conNomiDegliAssi(props.option, assi), locale), document.documentElement),
    // themeTick intentionally re-triggers resolution on theme switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.option, themeTick, assi?.x, assi?.y, locale],
  );

  return (
    <>
      <RawEChartsCard {...props} option={option} />
      {tabella && <TabellaEquivalente tabella={tabella} lingua={locale} />}
    </>
  );
}

export const MermaidDiagram = dynamic(
  // Subpath `/markdown` isolates mermaid from the barrel (#21 perf chunk-split).
  () => import("@heuresys/ui/markdown").then((m) => ({ default: m.MermaidDiagram })),
  { ssr: false },
);
