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

const RawEChartsCard = dynamic(
  () => import("@heuresys/ui").then((m) => ({ default: m.EChartsCard })),
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

type EChartsCardProps = ComponentProps<typeof RawEChartsCard>;

export function EChartsCard(props: EChartsCardProps) {
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
        : resolveCssVars(props.option, document.documentElement),
    // themeTick intentionally re-triggers resolution on theme switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.option, themeTick],
  );

  return <RawEChartsCard {...props} option={option} />;
}

export const MermaidDiagram = dynamic(
  () => import("@heuresys/ui").then((m) => ({ default: m.MermaidDiagram })),
  { ssr: false },
);
