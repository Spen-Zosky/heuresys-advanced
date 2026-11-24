/**
 * apps/web/src/lib/criterio-faccetta.ts — il criterio di una faccetta come si mostra nella pagina
 * (classe K08 del controllo forense del 23/11/2026).
 *
 * Le migrazioni 000510-000512 scrivono il criterio delle proposte dell'agente con un marcatore in
 * testa, «Proposta dell'agente (000511)», che le migrazioni stesse cercano con LIKE; una verifica
 * dal vivo ha scritto «Verifica dal vivo del rilascio del passo 2 dell'ADR-0061». Il numero interno
 * non dice niente a chi legge, e che la faccetta sia proposta dall'agente lo dice già la colonna
 * Stato. Decisione di Enzo del 24/11/2026: il dato resta com'è, la pagina toglie il prefisso.
 *
 * I prefissi sono un elenco chiuso: un criterio scritto da una persona non si tocca mai.
 */
import { VUOTO } from "./format";

const PREFISSI_INTERNI: readonly RegExp[] = [
  /^Proposta dell['’]agente \(\d{4,}\)/,
  /^Verifica dal vivo del rilascio del passo \d+ dell['’]ADR-\d+/,
];

/** Il criterio senza il prefisso con il numero interno, con la prima lettera maiuscola; «—» se
 *  manca o se, tolto il prefisso, non resta un testo. */
export function criterioDaMostrare(criterio: string | null | undefined): string {
  const testo = (criterio ?? "").trim();
  const prefisso = PREFISSI_INTERNI.find((r) => r.test(testo));
  if (!prefisso) return testo === "" ? VUOTO : testo;
  const resto = testo.replace(prefisso, "").replace(/^[\s:,;.–—-]+/, "");
  // resta solo una data o della punteggiatura: non è un criterio
  if (!/\p{L}/u.test(resto)) return VUOTO;
  return resto.charAt(0).toLocaleUpperCase("it") + resto.slice(1);
}
