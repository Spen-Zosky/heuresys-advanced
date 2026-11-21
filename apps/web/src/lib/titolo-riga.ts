/**
 * apps/web/src/lib/titolo-riga.ts — il titolo della scheda di una riga di tabella (EntityTable).
 *
 * Difetto visto dal vivo il 2026-11-21: in /processes la prima colonna è il numero d'ordine e la scheda
 * della riga si intitolava «0». Il titolo è la prima colonna con intestazione il cui valore è un nome.
 */
import type { ReactNode } from "react";

export interface ColonnaConTitolo<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
}

/** Il testo di una cella, per decidere se è un nome o solo un numero. */
export function testoCella(n: unknown, profondita = 0): string {
  if (n === null || n === undefined || n === false || n === true) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map((x) => testoCella(x, profondita + 1)).join("");
  if (profondita < 6 && typeof n === "object" && "props" in (n as object)) {
    const p = (n as { props?: { children?: unknown } }).props;
    return p && "children" in p ? testoCella(p.children, profondita + 1) : "";
  }
  return "";
}

/** Un numero d'ordine, un conteggio o un codice numerico non è il titolo di una riga («0», «12», «1.1»). */
const SOLO_NUMERO = /^\s*[#n°.]*\s*[\d.,/ -]+\s*$/i;

/**
 * Il titolo della scheda della riga: la prima colonna con intestazione il cui valore è un nome, non un
 * numero (in /processes la prima colonna è il numero d'ordine e la scheda si intitolava «0»).
 * Se tutte sono numeri, resta la prima.
 */
export function colonnaTitolo<T, C extends ColonnaConTitolo<T>>(colonne: C[], riga: T): C | undefined {
  const conIntestazione = colonne.filter((c) => c.header !== "");
  // Un componente che non espone il testo (per esempio un nome di persona) dà "": resta un candidato,
  // com'era prima; si salta solo una colonna che si legge e che è un numero.
  return conIntestazione.find((c) => !SOLO_NUMERO.test(testoCella(c.cell(riga)).trim())) ?? conIntestazione[0] ?? colonne[0];
}

