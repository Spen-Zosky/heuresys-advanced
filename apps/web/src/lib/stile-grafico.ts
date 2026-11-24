/**
 * apps/web/src/lib/stile-grafico.ts — K17 del controllo forense del 23/11/2026, resto della classe
 * dopo #459: lo stile di ogni grafico ECharts è una regola sola, in `EChartsCard`, e non un conto
 * che ogni pagina rifà (o dimentica).
 *
 * Il caso, dal vivo il 24/11/2026. Le pagine di analytics scrivevano a mano i colori degli assi
 * (`AXIS_COLOR`, `GRID_COLOR`); le opzioni che non li scrivono (le barre orizzontali di kpi e
 * skills-group-share, il risultato di un sondaggio, i preset di @heuresys/ui) restavano ai colori
 * di ECharts: griglia quasi bianca piena ed etichette #6E7079, 3,6:1 sul fondo scuro. Nello stesso
 * giro, il nome «Media» del sondaggio stava in fondo all'asse ed era tagliato al bordo destro, e
 * l'asse dei conteggi di skills-group-share segnava 0,5 e 1,5.
 *
 * Tre regole pure, applicate a ogni opzione:
 *   - `conStileDelTema`: dove la pagina non dichiara un colore, testi degli assi, della legenda e
 *     della scala nel grigio tenue del tema e linee nel colore del bordo; e un testo che non arriva a
 *     4,5:1 sul fondo passa al primo piano del tema. Lavora su colori già risolti (esadecimali).
 *   - `assiInteri`: se tutti i valori delle serie sono interi, gli assi di valore non hanno tacche
 *     fra un intero e l'altro (`minInterval: 1`).
 *   - `nomiDegliAssiInVista`: il nome dell'asse orizzontale sta a metà, sotto le etichette, e la
 *     griglia gli lascia il posto; quello in cima a un asse verticale ha il posto sopra.
 * Una scelta esplicita della pagina (colore leggibile, `minInterval`, `nameLocation`) resta sua.
 */
import { contrasto, leggiColore, sopra } from "./colori-grafico";

/** I colori del tema attivo, già risolti. */
export type ColoriTema = { testo: string; testoTenue: string; bordo: string; fondo: string };

/** Il contrasto minimo di un testo sul fondo (WCAG 1.4.3, testo normale). */
export const CONTRASTO_MINIMO = 4.5;

type Oggetto = Record<string, unknown>;
const oggetto = (v: unknown): v is Oggetto => !!v && typeof v === "object" && !Array.isArray(v);
/** Applica `f` a un componente dell'opzione, che sia un oggetto o un elenco di oggetti. */
const ognuno = (v: unknown, f: (o: Oggetto) => Oggetto): unknown => (Array.isArray(v) ? v.map((x) => (oggetto(x) ? f(x) : x)) : oggetto(v) ? f(v) : v);

function testoLeggibile(colore: unknown, tema: ColoriTema): string {
  const scelto = typeof colore === "string" && colore ? colore : tema.testoTenue;
  const fondo = leggiColore(tema.fondo);
  const c = leggiColore(scelto);
  // un colore che non si legge (nome CSS, gradiente) resta com'è: meglio quello che uno inventato
  if (!fondo || !c) return scelto;
  if (contrasto(sopra(c, fondo), fondo) >= CONTRASTO_MINIMO) return scelto;
  const tenue = leggiColore(tema.testoTenue);
  return tenue && contrasto(tenue, fondo) >= CONTRASTO_MINIMO ? tema.testoTenue : tema.testo;
}

const conTesto = (stile: unknown, tema: ColoriTema): Oggetto => {
  const s = oggetto(stile) ? stile : {};
  return { ...s, color: testoLeggibile(s.color, tema) };
};
const conLinea = (parte: unknown, colore: string): Oggetto => {
  const p = oggetto(parte) ? parte : {};
  const linea = oggetto(p.lineStyle) ? p.lineStyle : {};
  return { ...p, lineStyle: { ...linea, color: typeof linea.color === "string" && linea.color ? linea.color : colore } };
};

/** Testi e linee di assi, legenda e scala nei colori del tema, dove la pagina non li dichiara. */
export function conStileDelTema<T>(option: T, tema: ColoriTema): T {
  if (!oggetto(option)) return option;
  const o: Oggetto = { ...option };
  const asse = (a: Oggetto): Oggetto => ({
    ...a,
    axisLabel: conTesto(a.axisLabel, tema),
    nameTextStyle: conTesto(a.nameTextStyle, tema),
    axisLine: conLinea(a.axisLine, tema.bordo),
    axisTick: conLinea(a.axisTick, tema.bordo),
    splitLine: conLinea(a.splitLine, tema.bordo),
  });
  if (o.xAxis) o.xAxis = ognuno(o.xAxis, asse);
  if (o.yAxis) o.yAxis = ognuno(o.yAxis, asse);
  const conTestoStile = (x: Oggetto): Oggetto => ({ ...x, textStyle: conTesto(x.textStyle, tema) });
  if (o.legend) o.legend = ognuno(o.legend, conTestoStile);
  if (o.visualMap) o.visualMap = ognuno(o.visualMap, conTestoStile);
  return o as T;
}

/** I numeri delle serie: valori semplici, coppie `[x, y]` e oggetti `{ value }`. */
function numeriDelleSerie(series: unknown): number[] {
  const out: number[] = [];
  const voce = (d: unknown) => {
    const v = oggetto(d) ? d.value : d;
    for (const x of Array.isArray(v) ? v : [v]) if (typeof x === "number" && Number.isFinite(x)) out.push(x);
  };
  for (const s of Array.isArray(series) ? series : series ? [series] : []) {
    if (oggetto(s) && Array.isArray(s.data)) s.data.forEach(voce);
  }
  return out;
}

/** Se tutti i valori sono interi (conteggi), gli assi di valore hanno tacche intere. */
export function assiInteri<T>(option: T): T {
  if (!oggetto(option)) return option;
  const numeri = numeriDelleSerie(option.series);
  if (numeri.length === 0 || !numeri.every(Number.isInteger)) return option;
  const o: Oggetto = { ...option };
  const asse = (a: Oggetto): Oggetto => ((a.type ?? "value") === "value" && a.minInterval === undefined ? { ...a, minInterval: 1 } : a);
  if (o.xAxis) o.xAxis = ognuno(o.xAxis, asse);
  if (o.yAxis) o.yAxis = ognuno(o.yAxis, asse);
  return o as T;
}

/** Il nome di un asse che la pagina scrive senza dire dove: dentro il riquadro, con il suo posto. */
export function nomiDegliAssiInVista<T>(option: T): T {
  if (!oggetto(option)) return option;
  const o: Oggetto = { ...option };
  let sotto = false;
  let sopraAsse = false;
  if (o.xAxis) {
    o.xAxis = ognuno(o.xAxis, (a) => {
      if (typeof a.name !== "string" || !a.name || a.nameLocation !== undefined) return a;
      sotto = true;
      return { ...a, nameLocation: "middle", nameGap: typeof a.nameGap === "number" ? a.nameGap : 28 };
    });
  }
  if (o.yAxis) {
    ognuno(o.yAxis, (a) => {
      if (typeof a.name === "string" && a.name && (a.nameLocation === undefined || a.nameLocation === "end")) sopraAsse = true;
      return a;
    });
  }
  if ((sotto || sopraAsse) && oggetto(o.grid)) {
    const g: Oggetto = { ...o.grid };
    // un margine non dichiarato vale 60 px in ECharts, e basta; uno in percentuale resta della pagina
    const almeno = (k: string, v: number) => {
      if (typeof g[k] === "number" && (g[k] as number) < v) g[k] = v;
    };
    if (sotto) almeno("bottom", 40);
    if (sopraAsse) almeno("top", 28);
    o.grid = g;
  }
  return o as T;
}
