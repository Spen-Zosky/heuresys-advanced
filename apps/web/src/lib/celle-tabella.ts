/**
 * apps/web/src/lib/celle-tabella.ts — il segno delle celle vuote (classe K15 del controllo forense
 * del 23/11/2026) e la lettura di qualche codice tecnico (classe K19).
 *
 * Una cella vuota senza segno non dice se il dato manca, se non c'è niente da fare o se la pagina
 * non ha finito di caricare: chi legge non lo può sapere. Qui stanno le regole pure, provate in
 * `celle-tabella.test.ts`; i componenti le usano invece di decidere ciascuno a modo suo.
 */
import { VUOTO } from "./format";

/** Una cella è vuota quando non porta niente: assente, stringa vuota, il trattino, o un elemento
 *  che contiene soltanto uno di questi. */
export function cellaVuota(n: unknown, profondita = 0): boolean {
  if (n === null || n === undefined || n === false || n === "") return true;
  if (typeof n === "string") return /^\s*(—|–|-|n\/d)?\s*$/i.test(n);
  if (Array.isArray(n)) return n.every((x) => cellaVuota(x, profondita + 1));
  if (profondita < 3 && typeof n === "object" && "props" in (n as object)) {
    const p = (n as { props?: { children?: unknown } }).props;
    if (p && "children" in p && typeof (n as { type?: unknown }).type === "string") return cellaVuota(p.children, profondita + 1);
  }
  return false;
}

/**
 * Una colonna che non porta niente in nessuna delle righe in vista esce dalla tabella. Vale anche
 * per la colonna dei comandi (intestazione vuota): se chi guarda non ha il permesso di usarli, ogni
 * sua cella è vuota e la colonna intera è un buco senza spiegazione.
 */
export function colonnaVuotaOvunque(celle: readonly unknown[]): boolean {
  return celle.length > 0 && celle.every((c) => cellaVuota(c));
}

/** Il testo di una cella della tabella equivalente di un grafico: il numero nella lingua della
 *  pagina, e il segno «—» quando il valore manca, mai una cella vuota. */
export function testoCellaGrafico(v: string | number | null | undefined, numero: (n: number) => string): string {
  if (v === null || v === undefined) return VUOTO;
  if (typeof v === "number") return Number.isFinite(v) ? numero(v) : VUOTO;
  return v.trim() === "" ? VUOTO : v;
}

/** Il numero di versione di un modello di calcolo dal suo codice («flight-risk-v2» → 2), così la
 *  pagina dice «versione 2» invece del codice tecnico. Null se il codice non porta una versione. */
export function versioneModello(codice: string | null | undefined): number | null {
  const m = codice?.trim().match(/(?:^|[-_ ])v(\d+)$/i);
  return m ? Number(m[1]) : null;
}
