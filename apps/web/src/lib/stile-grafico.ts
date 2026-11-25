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

/*
 * Giro di verifica del 25/11/2026 (classi P, rigiudizio delle schermate dei grafici): tre regole in
 * più, sempre in `EChartsCard` per tutti i grafici.
 *   - `scalaConValori`: la scala colori di una mappa di calore (visualMap continuo) era una barra
 *     sfumata senza numeri, e non diceva quanto vale il colore più scuro: agli estremi si scrivono
 *     il minimo e il massimo.
 *   - `nomeSottoEtichetteRuotate`: in /analytics/overtime il nome «Mese» dell'asse orizzontale stava
 *     a 28 px dall'asse, sopra le etichette dei mesi ruotate di 30 gradi; il suo posto si calcola
 *     dall'ingombro verticale dell'etichetta ruotata più lunga.
 *   - `etichetteStrette`: a 390 px le etichette di un asse verticale di categorie, larghe fino a
 *     300 px, prendevano tutto il grafico e le barre diventavano segni (org-network, overtime): su
 *     uno schermo stretto l'etichetta si ferma a `LARGHEZZA_ETICHETTA_STRETTA` e va a capo.
 */

/** La larghezza massima di un'etichetta di categoria sull'asse verticale, su uno schermo stretto. */
export const LARGHEZZA_ETICHETTA_STRETTA = 120;

/** Minimo e massimo scritti agli estremi della scala continua che la pagina lascia senza testo. */
export function scalaConValori<T>(option: T, numero: (v: number) => string): T {
  if (!oggetto(option) || !option.visualMap) return option;
  const o: Oggetto = { ...option };
  o.visualMap = ognuno(o.visualMap, (vm) => {
    if (vm.type === "piecewise" || vm.text !== undefined || vm.calculable === true) return vm;
    if (typeof vm.min !== "number" || typeof vm.max !== "number") return vm;
    // in ECharts text[0] sta all'estremo alto della scala, text[1] a quello basso
    return { ...vm, text: [numero(vm.max), numero(vm.min)], itemGap: typeof vm.itemGap === "number" ? vm.itemGap : 8 };
  });
  return o as T;
}

/**
 * Il nome dell'asse orizzontale sotto le etichette ruotate: `nameGap` almeno l'ingombro verticale
 * dell'etichetta più lunga più un respiro, e la griglia gli lascia il posto. `larghezza` stima (o
 * misura) un testo in pixel.
 */
export function nomeSottoEtichetteRuotate<T>(option: T, larghezza: (testo: string, corpo: number) => number): T {
  if (!oggetto(option) || !option.xAxis) return option;
  const o: Oggetto = { ...option };
  let serve = 0;
  o.xAxis = ognuno(o.xAxis, (a) => {
    const label = oggetto(a.axisLabel) ? a.axisLabel : {};
    const gradi = typeof label.rotate === "number" ? Math.abs(label.rotate) : 0;
    if (!gradi || typeof a.name !== "string" || !a.name || a.nameLocation !== "middle" || !Array.isArray(a.data)) return a;
    const corpo = typeof label.fontSize === "number" ? label.fontSize : 12;
    const piuLunga = Math.max(0, ...a.data.map((d) => larghezza(String(oggetto(d) && "value" in d ? d.value : (d ?? "")), corpo)));
    const r = (gradi * Math.PI) / 180;
    // l'etichetta ruotata occupa in altezza la sua lunghezza per il seno e il corpo per il coseno; 8 px di margine dall'asse
    const ingombro = Math.ceil(piuLunga * Math.sin(r) + corpo * Math.cos(r) + 8);
    const gap = Math.max(typeof a.nameGap === "number" ? a.nameGap : 0, ingombro + 12);
    // con containLabel il margine basso conta dal fondo delle etichette: serve solo ciò che il nome
    // sporge oltre (la sua distanza dall'asse più il corpo, meno l'ingombro), più un respiro
    serve = Math.max(serve, gap + corpo - ingombro + 8);
    return { ...a, nameGap: gap };
  });
  if (serve > 0) {
    const g: Oggetto = oggetto(o.grid) ? { ...o.grid } : {};
    if (typeof g.bottom !== "number" || g.bottom < serve) g.bottom = serve;
    o.grid = g;
  }
  return o as T;
}

/** Su uno schermo stretto le etichette di categoria dell'asse verticale non superano `massimo` px. */
export function etichetteStrette<T>(option: T, massimo = LARGHEZZA_ETICHETTA_STRETTA): T {
  if (!oggetto(option) || !option.yAxis) return option;
  const o: Oggetto = { ...option };
  o.yAxis = ognuno(o.yAxis, (a) => {
    if (a.type !== "category") return a;
    const label = oggetto(a.axisLabel) ? a.axisLabel : {};
    if (typeof label.width === "number" && label.width <= massimo) return a;
    return { ...a, axisLabel: { ...label, width: massimo, overflow: label.overflow ?? "break" } };
  });
  return o as T;
}
