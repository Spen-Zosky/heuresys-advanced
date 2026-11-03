/**
 * packages/shared/src/schemas/valore.ts — F0-3, il test del valore come misura.
 *
 * La SUPERFICIE è il punto da cui una persona o un agente ha agito: una pagina del web
 * o un agente. Viaggia in un'intestazione dichiarata dal client (`x-heuresys-superficie`)
 * e non è un'identità: CHI ha agito lo dice il token, mai questa intestazione. Serve a
 * distinguere una decisione presa usando Heuresys da un dato caricato da uno script.
 *
 * Forma: `pagina:/percorso/:id` oppure `agente:<codice>`. La pagina perde gli
 * identificativi (uuid e numeri diventano `:id`) perché la misura conta le pagine,
 * non le righe, e perché un percorso con un identificativo dentro è un dato personale
 * in più che il registro non deve conservare.
 */

export const SUPERFICIE_HEADER = "x-heuresys-superficie" as const;

export type SuperficieTipo = "pagina" | "agente";
export interface Superficie {
  tipo: SuperficieTipo;
  valore: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERO_RE = /^\d+$/;
const AGENTE_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MAX_PAGINA = 200;

/** Il percorso di una pagina senza query, frammento e identificativi; al più 200 caratteri. */
export function normalizzaPercorsoPagina(percorso: string): string {
  const senzaCoda = percorso.split(/[?#]/, 1)[0] ?? "";
  const segmenti = senzaCoda
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => (UUID_RE.test(s) || NUMERO_RE.test(s) ? ":id" : s));
  const normale = `/${segmenti.join("/")}`;
  return normale.length > MAX_PAGINA ? normale.slice(0, MAX_PAGINA) : normale;
}

/** Legge l'intestazione. Restituisce null per ogni forma che non sia esattamente pagina o agente. */
export function leggiSuperficie(grezza: string | string[] | undefined): Superficie | null {
  if (typeof grezza !== "string" || grezza.length === 0 || grezza.length > 300) return null;
  const due = grezza.indexOf(":");
  if (due < 0) return null;
  const tipo = grezza.slice(0, due);
  const valore = grezza.slice(due + 1);
  if (tipo === "pagina") {
    if (!valore.startsWith("/")) return null;
    return { tipo, valore: normalizzaPercorsoPagina(valore) };
  }
  if (tipo === "agente") {
    return AGENTE_RE.test(valore) ? { tipo, valore } : null;
  }
  return null;
}

/** Il valore dell'intestazione per una pagina del web. */
export function superficiePagina(percorso: string): string {
  return `pagina:${normalizzaPercorsoPagina(percorso)}`;
}
