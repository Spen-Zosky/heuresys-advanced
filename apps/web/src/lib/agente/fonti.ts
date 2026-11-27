/**
 * apps/web/src/lib/agente/fonti.ts — le fonti cliccabili di una risposta dell'assistente (piano
 * AI-driven, voce F6c, criterio E13). Il modello chiude la risposta con un blocco ```fonti``` (un
 * array JSON); qui si legge e si controlla, perché ciò che arriva dal modello non è fidato:
 * una voce malformata si scarta, e un percorso si apre solo se è una pagina che la piattaforma
 * conosce (l'elenco generato delle pagine idonee), mai un indirizzo inventato o esterno.
 */
import { PAGINE_IDONEE_AGENTE } from "./pagine-idonee.generated";

export type TipoFonte = "dato" | "pagina" | "regola";

export interface Fonte {
  tipo: TipoFonte;
  titolo: string;
  dettaglio: string | null;
  /** Una pagina della piattaforma, già verificata; mai null per `pagina`. */
  percorso: string | null;
}

export const MAX_FONTI = 6;
const MAX_TITOLO = 120;
const MAX_DETTAGLIO = 600;

const RE_PAGINE = PAGINE_IDONEE_AGENTE.map(
  (r) => new RegExp("^" + r.split("/").map((s) => (/^\[.+\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/") + "/?$"),
);

/** Il percorso è una pagina interna e conosciuta (con o senza query e ancora). */
export function percorsoAmmesso(p: unknown): p is string {
  if (typeof p !== "string" || p.length > 300 || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return false;
  const base = p.split(/[?#]/)[0] ?? "";
  return RE_PAGINE.some((re) => re.test(base));
}

/** Da `language-fonti` al suo testo: l'elenco controllato, oppure null se non è leggibile. */
export function leggiFonti(testo: string): Fonte[] | null {
  let v: unknown;
  try {
    v = JSON.parse(testo);
  } catch {
    return null;
  }
  if (!Array.isArray(v)) return null;
  const out: Fonte[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const tipo = o.tipo;
    if (tipo !== "dato" && tipo !== "pagina" && tipo !== "regola") continue;
    const titolo = typeof o.titolo === "string" ? o.titolo.trim().slice(0, MAX_TITOLO) : "";
    if (!titolo) continue;
    const dettaglio = typeof o.dettaglio === "string" && o.dettaglio.trim() ? o.dettaglio.trim().slice(0, MAX_DETTAGLIO) : null;
    const percorso = tipo !== "regola" && percorsoAmmesso(o.percorso) ? o.percorso : null;
    if (tipo === "pagina" && !percorso) continue; // una pagina senza indirizzo verificato non porta da nessuna parte
    out.push({ tipo, titolo, dettaglio, percorso });
    if (out.length >= MAX_FONTI) break;
  }
  return out;
}
