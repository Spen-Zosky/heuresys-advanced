/**
 * Un elenco troppo grande per essere letto in un colpo solo (difetto visto dalla batteria F6a del
 * 2026-11-26: il rischio di uscita di 80 persone, con la spiegazione voce per voce di ciascuna, non
 * entrava nella risposta dello strumento, e l'API di quel percorso ignora filtri e pagine). Sopra il
 * tetto il gateway fa ciò che l'API non fa, sui soli dati già letti con il perimetro della persona:
 * applica i filtri che sono campi delle righe, toglie il dettaglio annidato e taglia a pagine,
 * dicendolo nella `nota`. Sotto il tetto la risposta non cambia.
 */

/** Il tetto, in caratteri del JSON: sta con margine sotto il limite di uscita di uno strumento. */
export const TETTO_ELENCO = 40_000;

type Query = Record<string, string | number | boolean>;
type Riga = Record<string, unknown>;

const lungo = (x: unknown) => JSON.stringify(x).length;
const semplice = (v: unknown) => v === null || ["string", "number", "boolean"].includes(typeof v);
const intero = (v: unknown): number | undefined => {
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
};

export function riduciElenco(dati: unknown, query: Query = {}, tetto = TETTO_ELENCO): unknown {
  if (!dati || typeof dati !== "object" || lungo(dati) <= tetto) return dati;
  const busta = dati as Record<string, unknown>;
  const tutte = busta["items"];
  if (!Array.isArray(tutte) || !tutte.every((r) => r && typeof r === "object" && !Array.isArray(r))) return dati;
  let righe = tutte as Riga[];
  const totale = typeof busta["total"] === "number" ? busta["total"] : righe.length;
  // L'API ha dato tutto: le pagine le fa il gateway. Ne ha dato una parte: le sta già facendo lei.
  const completo = righe.length >= totale;
  const note: string[] = [];

  const filtri = Object.entries(query).filter(
    ([k]) => k !== "limit" && k !== "offset" && righe.every((r) => k in r && semplice(r[k])),
  );
  if (completo && filtri.length) {
    righe = righe.filter((r) => filtri.every(([k, v]) => String(r[k]) === String(v)));
    note.push(`filtro applicato: ${filtri.map(([k, v]) => `${k}=${String(v)}`).join(", ")}`);
  }
  const filtrate = righe.length;

  const inizio = completo ? (intero(query["offset"]) ?? 0) : 0;
  const quante = completo ? (intero(query["limit"]) || filtrate) : filtrate;
  let pagina = righe.slice(inizio, inizio + quante);

  const conPagina = (p: Riga[]) => ({ ...busta, items: p });
  if (lungo(conPagina(pagina)) > tetto) {
    const tolti = new Set<string>();
    pagina = pagina.map((r) =>
      Object.fromEntries(
        Object.entries(r).filter(([k, v]) => {
          if (k === "masked" || semplice(v)) return true;
          tolti.add(k);
          return false;
        }),
      ),
    );
    if (tolti.size) note.push(`campi di dettaglio omessi (${[...tolti].join(", ")}): chiedi la singola riga per averli`);
  }
  while (pagina.length > 1 && lungo(conPagina(pagina)) > tetto) pagina = pagina.slice(0, Math.ceil(pagina.length / 2));

  const base = completo ? inizio : (intero(query["offset"]) ?? 0);
  const restano = (completo ? filtrate : totale) - base - pagina.length;
  note.push(
    restano > 0
      ? `elenco incompleto: ${pagina.length} righe, ne restano ${restano}; chiedi con offset=${base + pagina.length}`
      : "non restano altre righe dopo queste",
  );
  return { ...busta, items: pagina, total: completo ? filtrate : totale, nota: note.join(". ") };
}
