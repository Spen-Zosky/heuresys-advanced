/**
 * apps/web/src/lib/agente/vista-tabella.ts — la vista di una tabella comandata dall'assistente
 * (piano `docs/piani/PIANO_assistente-nelle-interfacce_20261110.md`, blocco I1).
 *
 * Ripreso da mod-platform (`apps/area/app/offerte/vista-agente.ts`), reso comune a ogni tabella:
 * invece di una pagina alla volta, la vista vale per ogni `EntityTable`. Funzioni pure, provate da
 * `vista-tabella.test.ts`. Cambiano solo che cosa si vede, mai i dati; e dicono l'esito vero:
 * con la paginazione del server un comando vale per la sola pagina caricata, ed è «parziale».
 *
 * I nomi dei comandi sono quelli del catalogo del gateway (`apps/agent-gateway/src/comandi-vista.ts`),
 * che è la fonte: un nome che qui non c'è torna «rifiutata».
 */
import { isValidElement, type ReactNode } from "react";

export const COMANDI_TABELLA = ["tabella.cerca", "tabella.filtra", "tabella.ordina", "tabella.azzera"] as const;
export type ComandoTabella = (typeof COMANDI_TABELLA)[number];

export interface EsitoPagina {
  stato: "ok" | "parziale" | "rifiutata";
  dettaglio?: string;
}

export interface StatoVistaTabella {
  testo?: string;
  filtro?: { colonna: number; valore: string };
  ordine?: { colonna: number; verso: "crescente" | "decrescente" };
}

/** Il testo che un nodo React mostra: serve a cercare e ordinare su ciò che la persona vede. */
export function testoDi(nodo: ReactNode): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number" || typeof nodo === "bigint") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(testoDi).filter(Boolean).join(" ");
  if (isValidElement(nodo)) {
    const p = nodo.props as { children?: ReactNode; title?: unknown; "aria-label"?: unknown };
    const figli = testoDi(p.children);
    if (figli) return figli;
    if (typeof p["aria-label"] === "string") return p["aria-label"];
    if (typeof p.title === "string") return p.title;
    // Un componente senza figli dichiarati (es. <StatusPill value="ACTIVE" />): si prova con i valori semplici.
    return Object.entries(nodo.props as Record<string, unknown>)
      .filter(([k, v]) => k !== "className" && (typeof v === "string" || typeof v === "number"))
      .map(([, v]) => String(v))
      .join(" ");
  }
  return "";
}

const norm = (s: string) => s.toLocaleLowerCase("it").normalize("NFD").replace(/\p{M}/gu, "").trim();

/** La colonna dal nome detto dall'assistente: uguale, poi contenuta. Le colonne senza nome non contano. */
export function trovaColonna(nomi: readonly string[], cercato: string): number | undefined {
  const c = norm(cercato);
  if (!c) return undefined;
  const esatta = nomi.findIndex((n) => n && norm(n) === c);
  if (esatta >= 0) return esatta;
  const parziale = nomi.findIndex((n) => n && (norm(n).includes(c) || c.includes(norm(n))));
  return parziale >= 0 ? parziale : undefined;
}

/** Il valore per ordinare: un numero se il testo lo è (anche con le migliaia all'italiana), se no il testo. */
function chiave(s: string): string | number {
  const t = s.replace(/[\s€%]/gu, "");
  // «1.250» e «1.250,5» all'italiana; «80,5» con la virgola; «80.5» col punto.
  const n = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/u.test(t)
    ? Number(t.replace(/\./gu, "").replace(",", "."))
    : /^-?\d+(,\d+)?$/u.test(t)
      ? Number(t.replace(",", "."))
      : /^-?\d+(\.\d+)?$/u.test(t)
        ? Number(t)
        : Number.NaN;
  if (Number.isFinite(n)) return n;
  return norm(s);
}

/** Le righe come le vuole la vista: `celle(riga)` dà il testo di ogni colonna, nell'ordine dei nomi. */
export function applicaVista<T>(righe: readonly T[], celle: (r: T) => string[], stato: StatoVistaTabella): T[] {
  let fuori = [...righe];
  if (stato.testo) {
    const c = norm(stato.testo);
    fuori = fuori.filter((r) => celle(r).some((v) => norm(v).includes(c)));
  }
  if (stato.filtro) {
    const { colonna, valore } = stato.filtro;
    const c = norm(valore);
    fuori = fuori.filter((r) => norm(celle(r)[colonna] ?? "").includes(c));
  }
  if (stato.ordine) {
    const { colonna, verso } = stato.ordine;
    const segno = verso === "crescente" ? 1 : -1;
    fuori = fuori
      .map((r) => ({ r, k: chiave(celle(r)[colonna] ?? "") }))
      .sort((a, b) => {
        // ciò che manca va sempre in fondo, in qualunque verso
        if (a.k === "") return b.k === "" ? 0 : 1;
        if (b.k === "") return -1;
        return typeof a.k === "number" && typeof b.k === "number"
          ? (a.k - b.k) * segno
          : String(a.k).localeCompare(String(b.k), "it") * segno;
      })
      .map((x) => x.r);
  }
  return fuori;
}

export interface ContestoComando {
  /** I nomi delle colonne come li vede la persona. */
  colonne: readonly string[];
  /** Vero se le righe sono una pagina sola di un elenco più lungo, che sta sul server. */
  paginaServer: boolean;
  totale: number;
}

/**
 * Applica un comando allo stato della vista e dice l'esito vero. Non tocca le righe: il nuovo stato
 * passa da `applicaVista`. Con la paginazione del server l'esito è «parziale», e lo dice.
 */
export function eseguiComando(
  stato: StatoVistaTabella,
  nome: string,
  argomenti: Record<string, unknown>,
  ctx: ContestoComando,
): { stato: StatoVistaTabella; esito: EsitoPagina } {
  const rifiuta = (dettaglio: string) => ({ stato, esito: { stato: "rifiutata" as const, dettaglio } });
  const parziale = ctx.paginaServer
    ? { stato: "parziale" as const, dettaglio: `Vale solo per la pagina caricata: le righe sono ${ctx.totale} in tutto, e le altre stanno sul server.` }
    : { stato: "ok" as const };
  const colonnaDi = (v: unknown) => (typeof v === "string" ? trovaColonna(ctx.colonne, v) : undefined);

  switch (nome) {
    case "tabella.cerca": {
      if (typeof argomenti.testo !== "string" || !argomenti.testo.trim()) return rifiuta("Manca il testo da cercare.");
      return { stato: { ...stato, testo: argomenti.testo.trim() }, esito: parziale };
    }
    case "tabella.filtra": {
      const c = colonnaDi(argomenti.colonna);
      if (c === undefined) return rifiuta(`La tabella non ha la colonna «${String(argomenti.colonna)}». Colonne: ${ctx.colonne.filter(Boolean).join(", ")}.`);
      const v = argomenti.valore;
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") return rifiuta("Manca il valore del filtro.");
      return { stato: { ...stato, filtro: { colonna: c, valore: String(v) } }, esito: parziale };
    }
    case "tabella.ordina": {
      const c = colonnaDi(argomenti.colonna);
      if (c === undefined) return rifiuta(`La tabella non ha la colonna «${String(argomenti.colonna)}». Colonne: ${ctx.colonne.filter(Boolean).join(", ")}.`);
      const verso = argomenti.verso === "decrescente" ? "decrescente" : "crescente";
      return { stato: { ...stato, ordine: { colonna: c, verso } }, esito: parziale };
    }
    case "tabella.azzera":
      return { stato: {}, esito: { stato: "ok" } };
    default:
      return rifiuta("Questa tabella non sa eseguire il comando.");
  }
}

/** Vero se la vista è cambiata dall'assistente: la tabella lo mostra, con il modo di tornare indietro. */
export function vistaAttiva(s: StatoVistaTabella): boolean {
  return s.testo !== undefined || s.filtro !== undefined || s.ordine !== undefined;
}
