/**
 * apps/web/src/lib/navigazione-area.ts — la matematica dell'area navigabile degli organigrammi.
 *
 * Piano docs/piani/PIANO_organigrammi-navigazione_20261115.md (N1). Pura, senza DOM, provata da
 * `navigazione-area.test.ts`. Lo stato è una trasformazione: il contenuto (largo `nw`, alto `nh`
 * alla scala 1) si disegna spostato di (x, y) e scalato di `s`.
 */

export interface Vista {
  s: number;
  x: number;
  y: number;
}

export const SCALA_MIN = 0.1;
export const SCALA_MAX = 4;
export const PASSO_ZOOM = 1.2;
const MARGINE = 12;
/** La scala sotto cui il testo dei diagrammi di processo e di progetto non si legge più: il fit non scende oltre. */
export const SCALA_MIN_LEGGIBILE = 0.7;
/**
 * La scala a cui si aprono i diagrammi di processo (flusso a corsie, fasi, grafo): 1, cioè il testo alla
 * sua misura vera, mai sotto i 12 px. Alla scala 0.7 il testo del flusso arrivava a 7 px e il disegno,
 * contenuto principale della scheda, non si leggeva (classe N1 del giro di verifica del 25/11/2026).
 * Se il disegno non sta nell'area si apre ancorato in alto a sinistra e si scorre trascinando, o si
 * rimpicciolisce con − e la rotella.
 */
export const SCALA_APERTURA_PROCESSO = 1;

/**
 * Il fit: tutto il contenuto dentro l'area, centrato, mai ingrandito oltre la scala 1.
 * Con `scalaMin` il fit non scende sotto quella scala: se il contenuto non ci sta, si apre alla scala
 * minima ancorato in alto a sinistra (nel lato che sborda) e si scorre trascinando.
 */
export function adatta(larghezzaArea: number, altezzaArea: number, nw: number, nh: number, scalaMin = SCALA_MIN): Vista {
  if (nw <= 0 || nh <= 0 || larghezzaArea <= 0 || altezzaArea <= 0) return { s: 1, x: 0, y: 0 };
  const s = Math.max(scalaMin, Math.min(1, (larghezzaArea - 2 * MARGINE) / nw, (altezzaArea - 2 * MARGINE) / nh));
  const x = nw * s + 2 * MARGINE > larghezzaArea ? MARGINE : (larghezzaArea - nw * s) / 2;
  const y = nh * s + 2 * MARGINE > altezzaArea ? MARGINE : (altezzaArea - nh * s) / 2;
  return { s, x, y };
}

/** Zoom di un fattore tenendo fermo il punto (cx, cy) dell'area: quello sotto il mouse resta sotto il mouse. */
export function zoomIntorno(v: Vista, fattore: number, cx: number, cy: number): Vista {
  const s = Math.max(SCALA_MIN, Math.min(SCALA_MAX, v.s * fattore));
  const k = s / v.s;
  return { s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
}

/**
 * L'altezza dell'area: quella del contenuto adattato alla larghezza, fra un minimo leggibile e il
 * massimo dato (una frazione dello schermo). Un organigramma piccolo non lascia un vuoto alto
 * mezzo schermo; uno grande non spinge la pagina oltre lo schermo.
 */
export function altezzaArea(larghezzaArea: number, nw: number, nh: number, massimo: number, minimo = 240, scalaMin = SCALA_MIN): number {
  if (nw <= 0 || nh <= 0) return minimo;
  const s = Math.max(scalaMin, Math.min(1, (larghezzaArea - 2 * MARGINE) / nw));
  return Math.round(Math.max(Math.min(minimo, massimo), Math.min(massimo, nh * s + 2 * MARGINE)));
}
