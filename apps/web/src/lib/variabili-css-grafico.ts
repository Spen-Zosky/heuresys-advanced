/**
 * apps/web/src/lib/variabili-css-grafico.ts — i `var(--x)` di un'opzione ECharts portati a colori
 * concreti, perché il canvas di ECharts non risolve le variabili CSS (B-05, audit S1006).
 *
 * Funzione pura: chi la chiama passa `leggi`, che dà il valore calcolato di una variabile (in pagina
 * `getComputedStyle(document.documentElement).getPropertyValue`). Così si prova senza browser.
 */
import { coloreDaVariabile } from "./colori-grafico";

/** Il valore calcolato di una variabile CSS, già ripulito dagli spazi ai bordi. */
export type LeggiVariabile = (nome: string) => string;

/** Sostituisce, in ogni stringa dentro `value`, ogni `var(--x)` con il colore che il canvas legge. */
export function risolviVariabiliCss<T>(value: T, leggi: LeggiVariabile): T {
  if (typeof value === "string") {
    if (!value.includes("var(--")) return value;
    const get = (name: string) => leggi(name).trim() || "transparent";
    // La variabile può essere un colore completo (l'esadecimale del foglio di stile) o una terna HSL
    // nuda («222 80% 50%», le `--palette-*` che `applyPalette` scrive in linea in tema chiaro):
    // `coloreDaVariabile` porta l'una e l'altra a un colore che il canvas legge (K17, 24/11/2026).
    // 1) `hsl(var(--x))` e simili.
    let out = value.replace(
      /(?:hsla?|rgba?)\(\s*var\((--[a-zA-Z0-9_-]+)\)\s*\)/g,
      (_m, name: string) => coloreDaVariabile(get(name)),
    );
    // 1b) `hsl(var(--x) / 0.12)`: la tinta chiara della scala di una mappa di calore.
    out = out.replace(
      /(?:hsla?|rgba?)\(\s*var\((--[a-zA-Z0-9_-]+)\)\s*\/\s*([0-9.]+%?)\s*\)/g,
      (_m, name: string, alfa: string) => coloreDaVariabile(get(name), alfa),
    );
    // 2) Ogni `var(--x)` rimasto.
    out = out.replace(/var\((--[a-zA-Z0-9_-]+)\)/g, (_m, name: string) => coloreDaVariabile(get(name)));
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => risolviVariabiliCss(item, leggi)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = risolviVariabiliCss((value as Record<string, unknown>)[key], leggi);
    }
    return out as unknown as T;
  }
  return value;
}
