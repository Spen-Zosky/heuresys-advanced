/**
 * Ciò che la persona non può vedere non arriva al modello, e la risposta lo dice (richiesta di
 * Enzo del 2026-11-18, ADR-0050 D6 emendato, ADR-0040 R3).
 *
 * L'assistente legge con il perimetro della persona: l'API toglie già i campi che lei non vede
 * (`masked: [...]`, `apps/api/src/lib/scope/mask.ts`) e nega le letture fuori dal suo perimetro
 * (403). Qui quelle due forme diventano qualcosa che il modello sa riferire:
 *  - un campo mascherato torna al suo posto con il valore `{omissis}`, così la risposta lo mostra
 *    invece di tacerlo o di inventarlo;
 *  - una lettura negata torna come esito `NON_AUTORIZZATO`, e il conteggio delle letture del giro
 *    decide in modo deterministico, non il modello, se la domanda era tutta su dati vietati.
 *
 * Nessun dato in più: il gateway aggiunge segnaposto, mai valori.
 */

/** Il segnaposto che sostituisce un dato che la persona non può vedere. */
export const OMISSIS = "{omissis}";

/** Il messaggio fisso per una domanda interamente su dati che la persona non può vedere. */
export const MESSAGGIO_NON_AUTORIZZATO =
  "Non hai le autorizzazioni necessarie per la gestione di queste informazioni. Puoi inviare una richiesta all'Amministratore del Sistema.";

export const MESSAGGIO_NON_AUTORIZZATO_EN =
  "You do not have the necessary permissions to see this information. You can send a request to the System Administrator.";

/** L'esito che il modello riceve al posto di una lettura negata dall'API. */
export interface LetturaNegata {
  esito: "NON_AUTORIZZATO";
  istruzione: string;
}

export function letturaNegata(): LetturaNegata {
  return {
    esito: "NON_AUTORIZZATO",
    istruzione:
      "La persona non è autorizzata a vedere questi dati. Non citarli e non stimarli: dove servirebbero scrivi {omissis}.",
  };
}

/**
 * Rimette al loro posto i campi che l'API ha tolto, con il valore `{omissis}`. Una riga
 * mascherata porta `masked: ["campo", …]` (maskFields); il risultato non porta più `masked`.
 * Non muta l'originale; regge cicli e profondità.
 */
export function conOmissis(dati: unknown, visti: WeakSet<object> = new WeakSet()): unknown {
  if (dati === null || typeof dati !== "object") return dati;
  if (visti.has(dati)) return dati;
  visti.add(dati);
  if (Array.isArray(dati)) return dati.map((v) => conOmissis(v, visti));
  const obj = dati as Record<string, unknown>;
  const mascherati = Array.isArray(obj["masked"])
    ? (obj["masked"] as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)
    : null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "masked" && mascherati) continue;
    out[k] = conOmissis(v, visti);
  }
  if (mascherati) for (const campo of mascherati) out[campo] = OMISSIS;
  return out;
}

/**
 * Le letture di un giro: quante sono andate a buon fine e quante l'API ha negato. Se in un giro
 * c'è almeno una lettura negata e nessuna riuscita, la domanda era tutta su dati vietati e la
 * risposta è il messaggio fisso.
 */
export class EsitiLetture {
  private riuscite = 0;
  private negate = 0;

  riuscita(): void {
    this.riuscite += 1;
  }

  negata(): void {
    this.negate += 1;
  }

  conteggio(): { riuscite: number; negate: number } {
    return { riuscite: this.riuscite, negate: this.negate };
  }

  /** Il messaggio fisso quando tutto ciò che il giro ha cercato di leggere era vietato. */
  rifiuto(lingua: "it" | "en" = "it"): string | null {
    return this.negate > 0 && this.riuscite === 0 ? (lingua === "en" ? MESSAGGIO_NON_AUTORIZZATO_EN : MESSAGGIO_NON_AUTORIZZATO) : null;
  }
}
