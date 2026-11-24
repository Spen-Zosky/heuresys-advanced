/**
 * apps/web/src/lib/colori-grafico.ts — colori per il disegno dei grafici (canvas di ECharts).
 *
 * Il canvas non risolve `var(--x)` e non capisce `hsl(#2563EB / 0.12)`: i token del design
 * sono colori completi (esadecimali) e le pagine li avvolgevano come `hsl(var(--palette-1) / 0.12)`
 * per ottenere la tinta chiara della scala. Il risultato era un colore non valido, e la scala
 * delle mappe di calore (giro del 16/11, G-GRAFICO) non si vedeva. Qui l'esadecimale si
 * porta a `rgba(r, g, b, a)`, che il canvas legge.
 */

/** `#rgb` o `#rrggbb` + trasparenza (0-1, oppure «12%») → `rgba(...)`; null se non è un esadecimale. */
export function esadecimaleConAlfa(esadecimale: string, alfa: string | number): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(esadecimale.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  let a = typeof alfa === "number" ? alfa : alfa.trim().endsWith("%") ? parseFloat(alfa) / 100 : parseFloat(alfa);
  if (!Number.isFinite(a)) return null;
  a = Math.min(1, Math.max(0, a));
  return `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${a})`;
}

/**
 * K17 del controllo forense del 23/11/2026: nelle mappe di calore di /analytics/skills e
 * /analytics/skills-by-category il numero di ogni cella era scritto in grigio, lo stesso per
 * tutte le celle, e sulle celle chiare (e su quelle piene in tema scuro) non si leggeva. Il colore
 * di una cella dipende dal suo valore e dal tema, quindi la scelta del testo si fa cella per cella,
 * sui colori già risolti: fra i testi candidati (il primo piano e il fondo del tema) vince quello
 * con il contrasto più alto sul colore che la cella avrà davvero.
 */
type Rgba = { r: number; g: number; b: number; a: number };

/** Una trasparenza scritta come «0.12» o «12%» → 0-1; null se non si legge. */
function leggiAlfa(alfa: string | number): number | null {
  const a = typeof alfa === "number" ? alfa : alfa.trim().endsWith("%") ? parseFloat(alfa) / 100 : parseFloat(alfa);
  return Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : null;
}

/**
 * K17, tema chiaro (giro del 24/11/2026): `applyPalette` di @heuresys/ui scrive in linea le
 * `--palette-1..4` come terne HSL nude («222 80% 50%», alla maniera di shadcn), mentre il foglio di
 * stile le dà in esadecimale; in tema scuro vince `.dark … !important`, in chiaro resta la terna.
 * Qui si legge la terna in tutte le forme che CSS ammette: con o senza «deg», con spazi o virgole,
 * con la trasparenza dopo «/».
 */
const TERNA_HSL = /^(-?[0-9.]+)(?:deg)?\s*[\s,]\s*([0-9.]+)%\s*[\s,]\s*([0-9.]+)%\s*(?:[/,]\s*([0-9.]+%?))?$/i;

function daHsl(h: number, s: number, l: number, a: number): Rgba {
  const [ss, ll] = [s / 100, l / 100];
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => ll - ss * Math.min(ll, 1 - ll) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  // l'arrotondamento a sei cifre toglie l'errore della virgola mobile (0,1 × 255 = 25,4999…), come fa il browser
  const c = (n: number) => Math.round(Number((f(n) * 255).toFixed(6)));
  return { r: c(0), g: c(8), b: c(4), a };
}

function leggiHsl(corpo: string): Rgba | null {
  const m = TERNA_HSL.exec(corpo.trim());
  if (!m) return null;
  const h = ((Number(m[1]) % 360) + 360) % 360;
  const a = m[4] === undefined ? 1 : leggiAlfa(m[4]);
  if (a === null) return null;
  return daHsl(h, Math.min(100, Number(m[2])), Math.min(100, Number(m[3])), a);
}

/** `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`, `hsl(...)` o `hsla(...)`, nelle forme con virgole e in
 *  quelle con spazi e «/ alfa» → componenti; null se il colore non si legge. */
export function leggiColore(colore: string): Rgba | null {
  const s = colore.trim();
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (h) {
    let x = h[1]!;
    if (x.length === 3) x = x.split("").map((c) => c + c).join("");
    const n = (i: number) => parseInt(x.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: 1 };
  }
  const f = /^rgba?\(\s*([0-9.]+)\s*[\s,]\s*([0-9.]+)\s*[\s,]\s*([0-9.]+)\s*(?:[/,]\s*([0-9.]+%?)\s*)?\)$/i.exec(s);
  if (f) {
    const a = f[4] === undefined ? 1 : leggiAlfa(f[4]);
    return a === null ? null : { r: Number(f[1]), g: Number(f[2]), b: Number(f[3]), a };
  }
  const hsl = /^hsla?\((.*)\)$/i.exec(s);
  return hsl ? leggiHsl(hsl[1]!) : null;
}

const esa = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();

/**
 * Il valore calcolato di una variabile CSS portato a un colore che il canvas di ECharts legge, con la
 * trasparenza `alfa` se data (la tinta chiara della scala, `hsl(var(--x) / 0.12)`).
 *   - terna HSL nuda → `#RRGGBB`, o `rgba(...)` se c'è una trasparenza;
 *   - colore completo leggibile (esadecimale, rgb, hsl) → com'è, o `rgba(...)` con la trasparenza;
 *   - altro (oklch, un nome CSS) → com'è: meglio quello che un colore inventato.
 */
export function coloreDaVariabile(valore: string, alfa?: string): string {
  const v = valore.trim();
  const terna = leggiHsl(v);
  const c = terna ?? leggiColore(v);
  if (!c) return v;
  const a = alfa === undefined ? c.a : leggiAlfa(alfa);
  if (a === null) return v;
  if (!terna && alfa === undefined) return v;
  return a === 1 ? `#${esa(c.r)}${esa(c.g)}${esa(c.b)}` : `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${a})`;
}

const lineare = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminanza = (c: Rgba) => 0.2126 * lineare(c.r) + 0.7152 * lineare(c.g) + 0.0722 * lineare(c.b);

/** Rapporto di contrasto WCAG fra due colori opachi. */
export function contrasto(a: Rgba, b: Rgba): number {
  const [la, lb] = [luminanza(a), luminanza(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Il colore semitrasparente `c` posato su `fondo` (opaco). */
export function sopra(c: Rgba, fondo: Rgba): Rgba {
  const m = (x: number, y: number) => x * c.a + y * (1 - c.a);
  return { r: m(c.r, fondo.r), g: m(c.g, fondo.g), b: m(c.b, fondo.b), a: 1 };
}

/** Il colore della scala al punto `t` (0-1), interpolato fra le tappe come fa visualMap. */
function allaScala(tappe: Rgba[], t: number): Rgba {
  if (tappe.length === 1) return tappe[0]!;
  const p = Math.min(1, Math.max(0, t)) * (tappe.length - 1);
  const i = Math.min(tappe.length - 2, Math.floor(p));
  const f = p - i;
  const [a, b] = [tappe[i]!, tappe[i + 1]!];
  const m = (x: number, y: number) => x + (y - x) * f;
  return { r: m(a.r, b.r), g: m(a.g, b.g), b: m(a.b, b.b), a: m(a.a, b.a) };
}

/**
 * Su un'opzione ECharts già risolta (niente `var(--x)`), dà a ogni cella di una mappa di calore
 * il colore di testo più leggibile sul colore della cella. Se la scala o i colori non si leggono,
 * l'opzione resta com'è: meglio il grigio di prima che un colore inventato.
 */
export function etichetteLeggibiliMappaDiCalore<T>(option: T, colori: { fondo: string; testi: string[] }): T {
  const o = option as Record<string, unknown>;
  const fondo = leggiColore(colori.fondo);
  const testi = colori.testi.map((t) => ({ t, c: leggiColore(t) })).filter((x): x is { t: string; c: Rgba } => x.c !== null && x.c.a === 1);
  const vm = (Array.isArray(o.visualMap) ? o.visualMap[0] : o.visualMap) as Record<string, unknown> | undefined;
  const scala = (vm?.inRange as Record<string, unknown> | undefined)?.color;
  if (!fondo || testi.length === 0 || !vm || !Array.isArray(scala) || typeof vm.min !== "number" || typeof vm.max !== "number") return option;
  const tappe = scala.map((c) => (typeof c === "string" ? leggiColore(c) : null));
  if (tappe.length === 0 || tappe.some((c) => c === null)) return option;
  const [min, max] = [vm.min, vm.max];
  const serie = Array.isArray(o.series) ? o.series : o.series ? [o.series] : [];
  const nuove = serie.map((s) => {
    const se = s as Record<string, unknown>;
    if (se.type !== "heatmap" || !Array.isArray(se.data)) return s;
    const data = se.data.map((d) => {
      const voce = (Array.isArray(d) ? { value: d } : d) as Record<string, unknown>;
      const v = Array.isArray(voce.value) ? voce.value[2] : undefined;
      if (typeof v !== "number" || !Number.isFinite(v)) return d;
      const cella = sopra(allaScala(tappe as Rgba[], max > min ? (v - min) / (max - min) : 1), fondo);
      const migliore = testi.reduce((a, b) => (contrasto(b.c, cella) > contrasto(a.c, cella) ? b : a));
      return { ...voce, label: { ...((voce.label as Record<string, unknown>) ?? {}), color: migliore.t } };
    });
    return { ...se, data };
  });
  return { ...o, series: Array.isArray(o.series) ? nuove : nuove[0] } as T;
}
