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
 * strings (e.g. `var(--palette-1)`). ECharts paints to an HTML <canvas>, and
 * a canvas 2D context CANNOT resolve CSS custom properties (`var()` only works in
 * the CSSOM) — it discards the unparseable string and falls back to BLACK, which
 * is invisible on the dark theme. Rather than rewrite every page, the exported
 * `EChartsCard` is now a thin wrapper that resolves every `var(--x)` inside the
 * `option` to a concrete color (via getComputedStyle on the live <html>) before
 * handing it to the real chart, and re-resolves when the theme class flips.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { formati, localeDi } from "@/lib/format";
import { coloreDaVariabile, etichetteLeggibiliMappaDiCalore } from "@/lib/colori-grafico";
import { risolviVariabiliCss } from "@/lib/variabili-css-grafico";
import { assiDerivati, letturaDelGrafico, type ChartTable } from "@/lib/lettura-grafico";
import { testoCellaGrafico } from "@/lib/celle-tabella";
import { ALTEZZA_RIGA_ETICHETTA, altezzaGrafico, larghezzaStimata, type Misura } from "@/lib/altezza-grafico";
import { assiInteri, conStileDelTema, etichetteInColonna, etichetteStrette, nomeSottoEtichetteRuotate, nomiDegliAssiInVista, scalaConValori } from "@/lib/stile-grafico";

const RawEChartsCard = dynamic(
  // Subpath `/charts` isolates echarts so this lazy import does NOT drag the whole
  // @heuresys/ui barrel (mermaid/cytoscape/three/…) into one ~1.68MB chunk (#21).
  () => import("@heuresys/ui/charts").then((m) => ({ default: m.EChartsCard })),
  { ssr: false },
);

/** Ogni `var(--x)` dell'opzione portato al colore che il canvas di ECharts legge, dal tema attivo su
 *  `root` (la regola sta in lib/variabili-css-grafico.ts, provata senza browser). */
function resolveCssVars<T>(value: T, root: HTMLElement): T {
  const css = getComputedStyle(root);
  return risolviVariabiliCss(value, (name) => css.getPropertyValue(name));
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
  // S-08 (forense 15/11): il separatore delle migliaia sempre, come lib/format.ts («4.069», non «4069»).
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);
  return (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? nf.format(v) : String(v ?? ""));
}

function rendiLeggibile(option: RawProps["option"], locale: string, stretto = false): RawProps["option"] {
  const num = numeroLocale(locale);
  // K17 (24/11/2026): conteggi a tacche intere e nomi degli assi dentro il riquadro, per ogni grafico.
  // Giro del 25/11: la scala colori dice i suoi estremi, il nome dell'asse sta sotto le etichette
  // ruotate e, su uno schermo stretto, le etichette di categoria lasciano posto alle barre.
  const leggibile = nomeSottoEtichetteRuotate(scalaConValori(assiInteri(nomiDegliAssiInVista(option)), num), larghezzaStimata);
  const o = { ...((stretto ? etichetteStrette(leggibile) : leggibile) as Record<string, unknown>) };
  const asse = (a: unknown, verticale = false): unknown => {
    if (Array.isArray(a)) return a.map((x) => asse(x, verticale));
    if (!a || typeof a !== "object") return a;
    const ax = { ...(a as Record<string, unknown>) };
    const label = { ...((ax.axisLabel as Record<string, unknown>) ?? {}) };
    const tipo = ax.type ?? "value";
    if (tipo === "value" || tipo === "log") {
      if (label.formatter === undefined) label.formatter = num;
      // Classi Q (25/11): con le etichette lunghe accanto, l'asse dei valori di una barra orizzontale
      // resta stretto e le tacche si toccavano («120150180» in org-network): quelle che non ci stanno
      // si saltano, invece di sovrapporsi.
      if (label.hideOverlap === undefined) label.hideOverlap = true;
    } else if (tipo === "category") {
      if (label.width === undefined) label.width = 200;
      if (label.overflow === undefined) label.overflow = "break";
      // K17: sull'asse verticale ogni categoria scrive la sua etichetta (ECharts altrimenti ne salta
      // qualcuna quando si toccano) con un'interlinea nota, quella su cui altezzaGrafico fa il conto
      if (verticale) {
        if (label.interval === undefined) label.interval = 0;
        if (label.lineHeight === undefined) label.lineHeight = ALTEZZA_RIGA_ETICHETTA;
      }
    }
    ax.axisLabel = label;
    return ax;
  };
  if (o.xAxis) o.xAxis = asse(o.xAxis);
  if (o.yAxis) o.yAxis = asse(o.yAxis, true);
  // Giro del 25/11: anche il numero scritto su una barra o su un punto ha la forma della lingua
  // («12.639», non «12639»); la mappa di calore scrive già il suo, e un `formatter` della pagina resta.
  if (Array.isArray(o.series)) {
    o.series = (o.series as unknown[]).map((x) => {
      if (!x || typeof x !== "object") return x;
      const se = x as Record<string, unknown>;
      const lb = se.label as Record<string, unknown> | undefined;
      if (se.type === "heatmap" || !lb || lb.show !== true || lb.formatter !== undefined) return x;
      // solo valori semplici: in un dato a coppie la posizione del valore dipende dall'asse
      if ((se.data as unknown[] | undefined)?.some((d) => Array.isArray(d) || (d && typeof d === "object" && Array.isArray((d as { value?: unknown }).value)))) return x;
      return { ...se, label: { ...lb, formatter: (p: { value?: unknown }) => num(p.value) } };
    });
  }
  const serie = Array.isArray(o.series) ? (o.series as unknown[]).length : 0;
  if (o.legend && typeof o.legend === "object" && !Array.isArray(o.legend)) {
    const voci = Array.isArray((o.legend as Record<string, unknown>).data)
      ? ((o.legend as Record<string, unknown>).data as unknown[]).length
      : serie;
    const lg = o.legend as Record<string, unknown>;
    o.legend = { ...lg, type: "plain", bottom: 0, left: "center", itemGap: 14, textStyle: { ...((lg.textStyle as Record<string, unknown>) ?? {}), fontSize: 11 } };
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
  } else if (o.tooltip === undefined && serie > 0) {
    // Un grafico senza `tooltip` non dice niente al passaggio del mouse (C-DINAMICO del giro
    // del 15/11): il suggerimento per elemento, con i numeri nella forma della lingua, è il minimo.
    o.tooltip = { trigger: "item", valueFormatter: num };
  }
  return o as RawProps["option"];
}

/**
 * V-11 del piano interfacce (2026-11-04): ogni grafico dice che cosa misurano i suoi assi
 * (nome e unita') e ha una tabella equivalente, leggibile da chi non vede il disegno e da un
 * agente. `assi` scrive `name` su xAxis e yAxis quando sono oggetti; `tabella` disegna sotto il
 * grafico una tabella apribile con gli stessi numeri.
 */
export type { ChartTable };
type EChartsCardProps = RawProps & {
  assi?: { x?: string; y?: string };
  tabella?: ChartTable;
  /** Lingua dei numeri della tabella. */
  lingua?: string;
};

function conNomiDegliAssi(option: RawProps["option"], assiPagina: { x?: string; y?: string } | undefined): RawProps["option"] {
  const assi = assiDerivati(option, assiPagina);
  if (!assi.x && !assi.y) return option;
  const o = { ...(option as Record<string, unknown>) };
  // K17 (controllo forense del 23/11/2026): su un asse verticale di categorie (barre orizzontali)
  // le etichette sono lunghe e il nome dell'asse, messo a metà a 44 px, ci finiva sopra. Lì il
  // nome sta in cima all'asse, allineato alla colonna delle etichette.
  let nomeInCima = false;
  const metti = (k: "xAxis" | "yAxis", nome: string | undefined, verticale: boolean) => {
    const a = o[k];
    if (!nome || !a || typeof a !== "object" || Array.isArray(a)) return;
    const ax = a as Record<string, unknown>;
    if (verticale && ax.type === "category") {
      nomeInCima = true;
      o[k] = { ...ax, name: nome, nameLocation: "end", nameGap: 8, nameTextStyle: { ...((ax.nameTextStyle as Record<string, unknown>) ?? {}), align: "right" } };
      return;
    }
    o[k] = { ...ax, name: nome, nameLocation: "middle", nameGap: verticale ? 44 : 28 };
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
    if (assi.y && !nomeInCima) almeno("left", 56);
    if (nomeInCima) almeno("top", 28);
    o.grid = grid;
  }
  return o as RawProps["option"];
}

// K15 (controllo forense del 23/11/2026): un valore assente si scrive «—», mai una cella vuota; e
// la tabella si monta solo quando la si apre, perché chiusa le sue celle sono in pagina ma non si
// leggono, e a chi le controlla risultano tutte vuote.
function TabellaEquivalente({ tabella, lingua }: { tabella: ChartTable; lingua: string | undefined }) {
  const f = formati(lingua);
  const [aperta, setAperta] = useState(false);
  const fmt = (v: string | number | null | undefined) => testoCellaGrafico(v, (n) => f.numero(n, 2));
  return (
    <details className="mt-3 text-sm" data-testid="chart-table" onToggle={(e) => setAperta(e.currentTarget.open)}>
      <summary className="cursor-pointer text-xs text-muted-foreground">{tabella.titolo}</summary>
      {aperta ? (
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
      ) : null}
    </details>
  );
}

/** K17: il numero di ogni cella di una mappa di calore nel colore che si legge sulla cella, dal tema
 *  attivo. Il nero e il bianco puri restano fra i candidati perché sui toni medi della scala né il
 *  primo piano né il fondo del tema arrivano a 4,5:1, e uno dei due puri ci arriva sempre. */
function conEtichetteLeggibili(option: RawProps["option"], root: HTMLElement): RawProps["option"] {
  const css = getComputedStyle(root);
  const v = (n: string) => coloreDaVariabile(css.getPropertyValue(n));
  return etichetteLeggibiliMappaDiCalore(option, { fondo: v("--card"), testi: [v("--foreground"), v("--background"), "#000000", "#FFFFFF"] });
}

/** K17 (24/11/2026): testi e linee di assi, legenda e scala nei colori del tema attivo, dove la pagina
 *  non li dichiara, e ogni testo ad almeno 4,5:1 sul fondo del riquadro (`bg-background`). */
function conColoriDelTema(option: RawProps["option"], root: HTMLElement): RawProps["option"] {
  const css = getComputedStyle(root);
  const v = (n: string) => coloreDaVariabile(css.getPropertyValue(n));
  return conStileDelTema(option, { testo: v("--foreground"), testoTenue: v("--muted-foreground"), bordo: v("--border"), fondo: v("--background") });
}

/** K17: la larghezza di un'etichetta misurata dal browser con il carattere di ECharts (sans-serif),
 *  una sola tela per tutta la pagina; null dove non c'è una tela. */
let misuraCondivisa: Misura | null | undefined;
function misuraDelBrowser(): Misura | null {
  if (misuraCondivisa === undefined) {
    const ctx = document.createElement("canvas").getContext("2d");
    misuraCondivisa = ctx
      ? (testo: string, corpo: number) => {
          ctx.font = `${corpo}px sans-serif`;
          return ctx.measureText(testo).width;
        }
      : null;
  }
  return misuraCondivisa;
}
const senzaIscrizione = () => () => {};

/** Giro del 25/11: sotto sm (640 px) lo schermo è stretto e le etichette di categoria si accorciano. */
const SCHERMO_STRETTO = "(max-width: 639px)";
const iscriviStretto = (avvisa: () => void) => {
  const mq = window.matchMedia(SCHERMO_STRETTO);
  mq.addEventListener("change", avvisa);
  return () => mq.removeEventListener("change", avvisa);
};
const leggiStretto = () => window.matchMedia(SCHERMO_STRETTO).matches;

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

  const stretto = useSyncExternalStore(iscriviStretto, leggiStretto, () => false);
  // Classi Q (25/11): la larghezza vera del riquadro, per dare a ogni categoria dell'asse orizzontale
  // il suo posto (etichetteInColonna); finché non è misurata l'opzione resta com'è.
  const contenitore = useRef<HTMLDivElement | null>(null);
  const [larghezza, setLarghezza] = useState<number | null>(null);
  useEffect(() => {
    const el = contenitore.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const leggi = () => setLarghezza((prima) => {
      const ora = Math.round(el.getBoundingClientRect().width);
      return ora > 0 && ora !== prima ? ora : prima;
    });
    leggi();
    const ro = new ResizeObserver(leggi);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const opzione = useMemo(() => etichetteInColonna(props.option, larghezza, stretto, larghezzaStimata), [props.option, larghezza, stretto]);
  const option = useMemo(
    () =>
      typeof document === "undefined"
        ? props.option
        : conEtichetteLeggibili(conColoriDelTema(resolveCssVars(rendiLeggibile(conNomiDegliAssi(opzione, assi), locale, stretto), document.documentElement), document.documentElement), document.documentElement),
    // themeTick intentionally re-triggers resolution on theme switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opzione, themeTick, assi?.x, assi?.y, locale, stretto],
  );

  // K17: l'altezza data dalla pagina è il minimo; un asse verticale di categorie la fa crescere
  // con le righe e con le righe di testo delle etichette. Le etichette si misurano nel browser con il
  // carattere di ECharts; durante l'idratazione vale la stima del server (la terza funzione di
  // useSyncExternalStore), così il primo disegno coincide e la misura vera arriva subito dopo.
  const misura = useSyncExternalStore(senzaIscrizione, misuraDelBrowser, () => null);
  const altezza = useMemo(
    () => (typeof props.height === "number" ? altezzaGrafico(rendiLeggibile(conNomiDegliAssi(opzione, assi), locale, stretto), props.height, misura ?? undefined) : props.height),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opzione, props.height, assi?.x, assi?.y, locale, misura, stretto],
  );

  const lettura = useMemo(() => letturaDelGrafico(props.option, locale), [props.option, locale]);
  return (
    <>
      <div ref={contenitore} className="min-w-0" data-grafico-riquadro>
        <RawEChartsCard {...props} height={altezza} option={option} />
      </div>
      {lettura ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground" data-grafico-lettura>{lettura.frase}</p>
      ) : null}
      {tabella ? <TabellaEquivalente tabella={tabella} lingua={locale} /> : lettura ? <TabellaEquivalente tabella={lettura.tabella} lingua={locale} /> : null}
    </>
  );
}

export const MermaidDiagram = dynamic(
  // Subpath `/markdown` isolates mermaid from the barrel (#21 perf chunk-split).
  () => import("@heuresys/ui/markdown").then((m) => ({ default: m.MermaidDiagram })),
  { ssr: false },
);
