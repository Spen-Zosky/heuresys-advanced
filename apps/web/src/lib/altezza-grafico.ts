/**
 * apps/web/src/lib/altezza-grafico.ts — K17 del controllo forense del 23/11/2026: l'altezza di un
 * grafico con l'asse verticale di categorie cresce con le righe e con le righe di testo delle
 * etichette.
 *
 * Il caso: in /analytics/skills la mappa «Copertura per unità e livello di padronanza» ha 37 unità
 * sull'asse verticale. La pagina dava 26 px per unità, ma `_charts-client.tsx` manda a capo le
 * etichette di categoria oltre la loro larghezza (`overflow: "break"`), e un nome su due righe ne
 * occupa più di 26: le etichette si sovrapponevano, ed ECharts ne nascondeva alcune. Lo stesso
 * accadeva in ogni grafico a barre orizzontali con molte unità (presenze, straordinari, retribuzioni,
 * organico), ciascuno con il suo conto a mano di pixel per riga.
 *
 * Qui il conto è uno solo, e si fa sull'opzione ECharts già resa leggibile: per ogni etichetta si
 * stimano le righe in cui va a capo alla larghezza dell'asse, la riga più alta dà il passo di tutte
 * (le bande di un asse di categorie sono uguali), e all'altezza della griglia si aggiungono i margini
 * che l'opzione dichiara. La larghezza del testo la misura il browser con lo stesso carattere di
 * ECharts (`misura`); senza browser (sul server, nelle prove) si stima in eccesso, 0,6 em per
 * carattere: meglio una riga di spazio in più che due etichette una sopra l'altra.
 */

/** Misura la larghezza in pixel di un testo al corpo dato. */
export type Misura = (testo: string, corpo: number) => number;

/** L'altezza di una riga di testo delle etichette di categoria; `_charts-client.tsx` la impone. */
export const ALTEZZA_RIGA_ETICHETTA = 16;
/** Lo spazio fra due etichette vicine, sopra e sotto. */
const RESPIRO = 8;
/** Il passo minimo di una categoria, anche con etichette di una riga. */
const PASSO_MINIMO = 24;
/** Le etichette dell'asse orizzontale, che con `containLabel` stanno dentro la griglia. */
const ETICHETTE_ASSE_X = 24;
/** I margini di ECharts quando la griglia non li dichiara in pixel. */
const MARGINE_PREDEFINITO = 60;

/** La larghezza stimata di un testo, in pixel: 0,6 em per carattere, in eccesso per il sans-serif. */
export function larghezzaStimata(testo: string, corpo = 12): number {
  return [...testo].length * corpo * 0.6;
}

/**
 * Le righe in cui ECharts manda a capo un'etichetta con `overflow: "break"` alla `larghezza` data:
 * le parole si accodano finché stanno, e una parola più larga della riga si spezza.
 */
export function righeEtichetta(testo: string, larghezza: number, misura: (s: string) => number = (s) => larghezzaStimata(s)): number {
  if (!(larghezza > 0)) return 1;
  let righe = 1;
  let riga = "";
  for (const parola of testo.split(/\s+/).filter(Boolean)) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (misura(prova) <= larghezza) { riga = prova; continue; }
    if (riga) { righe++; riga = ""; }
    // una parola più larga della riga si spezza a caratteri
    let pezzo = "";
    for (const c of parola) {
      if (pezzo && misura(pezzo + c) > larghezza) { righe++; pezzo = c; } else pezzo += c;
    }
    riga = pezzo;
  }
  return righe;
}

const numero = (v: unknown, altrimenti: number) => (typeof v === "number" && Number.isFinite(v) ? v : altrimenti);

/**
 * L'altezza che un grafico con l'asse verticale di categorie chiede perché ogni etichetta abbia la
 * sua riga senza toccare le vicine; mai meno di `minimo`. Un grafico senza asse verticale di
 * categorie (torte, linee, barre verticali) resta a `minimo`.
 */
export function altezzaGrafico(option: unknown, minimo: number, misura: Misura = larghezzaStimata): number {
  const o = (option ?? {}) as Record<string, unknown>;
  const y = o.yAxis;
  if (!y || typeof y !== "object" || Array.isArray(y)) return minimo;
  const asse = y as Record<string, unknown>;
  if (asse.type !== "category" || !Array.isArray(asse.data) || asse.data.length === 0) return minimo;
  const label = (asse.axisLabel ?? {}) as Record<string, unknown>;
  const corpo = numero(label.fontSize, 12);
  const altezzaRiga = numero(label.lineHeight, ALTEZZA_RIGA_ETICHETTA);
  const larghezza = label.overflow === "break" || label.overflow === "breakAll" ? numero(label.width, 0) : 0;
  const testi = (asse.data as unknown[]).map((d) => String(d && typeof d === "object" && "value" in d ? (d as { value: unknown }).value : (d ?? "")));
  const righe = Math.max(1, ...testi.map((t) => righeEtichetta(t, larghezza, (s) => misura(s, corpo))));
  const passo = Math.max(PASSO_MINIMO, righe * altezzaRiga + RESPIRO);
  const grid = (o.grid && typeof o.grid === "object" && !Array.isArray(o.grid) ? o.grid : {}) as Record<string, unknown>;
  const cornice = numero(grid.top, MARGINE_PREDEFINITO) + numero(grid.bottom, MARGINE_PREDEFINITO) + (o.xAxis ? ETICHETTE_ASSE_X : 0);
  return Math.max(minimo, Math.ceil(cornice + testi.length * passo));
}

/**
 * Le barre orizzontali, come `echartsPresets.bar` di @heuresys/ui ma con le categorie sull'asse
 * verticale: con molte categorie dai nomi lunghi (indicatori, gruppi ESCO) le barre verticali
 * mostravano un nome ogni tanto, e qui ogni nome ha la sua riga e `altezzaGrafico` le dà lo spazio.
 * Il primo elemento sta in cima (`inverse`), nell'ordine in cui la pagina lo passa.
 */
export function barreOrizzontali(dati: { y: string[]; series: { name: string; values: (number | null)[] }[] }) {
  return {
    tooltip: { trigger: "axis" as const, axisPointer: { type: "shadow" as const } },
    legend: {},
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    xAxis: { type: "value" as const },
    yAxis: { type: "category" as const, data: dati.y, inverse: true },
    series: dati.series.map((s) => ({ name: s.name, type: "bar" as const, data: s.values, barMaxWidth: 22 })),
  };
}
