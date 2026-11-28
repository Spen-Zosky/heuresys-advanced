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

/**
 * Il messaggio fisso, se il modello l'ha scritto da sé nella risposta (le istruzioni gli dicono di
 * ripeterlo quando tutto è fuori dalle autorizzazioni, e può farlo senza leggere niente: allora
 * nessuna lettura negata lo fa scattare). Il rifiuto deve passare sempre dall'evento dedicato,
 * non restare testo normale: la finestra lo mostra nel riquadro del rifiuto.
 */
export function rifiutoNelTesto(testo: string): string | null {
  const t = testo.replace(/\s+/g, " ");
  // Solo se la risposta è quasi tutta il messaggio fisso: una risposta con dati veri e una
  // frase di rifiuto in coda non va sostituita, perderebbe ciò che la persona può vedere.
  for (const m of [MESSAGGIO_NON_AUTORIZZATO, MESSAGGIO_NON_AUTORIZZATO_EN]) {
    if (t.includes(m) && t.replace(m, "").replace(/[\s«»"'.]/g, "").length <= 20) return m;
  }
  return null;
}

/**
 * ADR-0050 D5: una lettura per mandato di retribuzione o valutazioni che chiede una conferma
 * recente del secondo fattore. Non è un diniego: la persona può leggere, ma deve confermare,
 * e l'assistente non può farlo per lei (A-3). Il messaggio lo dice invece di «non autorizzato».
 */
export const MESSAGGIO_CONFERMA_RICHIESTA =
  "Per questi dati serve una conferma recente del tuo secondo fattore. Confermalo qui sotto, nella finestra dell'assistente (ti viene chiesto il codice), e poi ripeti la domanda.";

export const MESSAGGIO_CONFERMA_RICHIESTA_EN =
  "These data need a recent confirmation of your second factor. Confirm it below, in the assistant window (you will be asked for the code), and then ask again.";

export const MESSAGGIO_CONFERMA_PARZIALE =
  "Una parte di questi dati è rimasta fuori: serve una conferma recente del tuo secondo fattore. Confermalo qui sotto, nella finestra dell'assistente (ti viene chiesto il codice), e poi ripeti la domanda.";

export const MESSAGGIO_CONFERMA_PARZIALE_EN =
  "Part of these data was left out: a recent confirmation of your second factor is needed. Confirm it below, in the assistant window (you will be asked for the code), and then ask again.";

/** L'esito che il modello riceve al posto di una lettura che chiede la conferma del secondo fattore. */
export interface LetturaDaConfermare {
  esito: "CONFERMA_SECONDO_FATTORE";
  istruzione: string;
}

export function letturaDaConfermare(): LetturaDaConfermare {
  return {
    esito: "CONFERMA_SECONDO_FATTORE",
    istruzione:
      "La persona può vedere questi dati ma deve prima confermare il secondo fattore: la conferma la dà lei, con il suo codice, dal pulsante che la finestra dell'assistente le mostra. Non citarli e non stimarli. Non fermarti qui: fai comunque le altre letture che la domanda permette (per esempio le posizioni, le unità, le persone che puoi già leggere) e mostra tutto ciò che hai trovato; solo alla fine dille in una frase che per questi dati deve confermare con quel pulsante e ripetere la domanda. Non limitarti a chiederle di ripetere la richiesta; non dire che «si può fare solo dalla pagina» e non dire che non puoi aiutarla.",
  };
}

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
  private daConfermare = 0;

  riuscita(): void {
    this.riuscite += 1;
  }

  negata(): void {
    this.negate += 1;
  }

  /** ADR-0050 D5: una lettura che chiede la conferma del secondo fattore (non è un diniego). */
  daConfermareSecondoFattore(): void {
    this.daConfermare += 1;
  }

  conteggio(): { riuscite: number; negate: number; daConfermare: number } {
    return { riuscite: this.riuscite, negate: this.negate, daConfermare: this.daConfermare };
  }

  /** Vero se almeno una lettura del giro chiedeva la conferma del secondo fattore. */
  serveConferma(): boolean {
    return this.daConfermare > 0;
  }

  /**
   * Il messaggio sulla conferma quando nel giro altre letture sono riuscite: il testo del modello
   * resta, e il gateway ci aggiunge sotto questa frase (senza, la persona non saprebbe che una
   * parte dei dati è rimasta fuori). Se nessuna lettura è riuscita lo dice già `rifiuto()`.
   */
  notaConferma(lingua: "it" | "en" = "it"): string | null {
    if (this.daConfermare === 0 || this.riuscite === 0) return null;
    return lingua === "en" ? MESSAGGIO_CONFERMA_PARZIALE_EN : MESSAGGIO_CONFERMA_PARZIALE;
  }

  /**
   * Il messaggio fisso quando nessuna lettura del giro è riuscita: la conferma del secondo
   * fattore se almeno una la chiedeva (la persona può sbloccarla), altrimenti il diniego.
   */
  rifiuto(lingua: "it" | "en" = "it"): string | null {
    if (this.riuscite > 0) return null;
    if (this.daConfermare > 0) return lingua === "en" ? MESSAGGIO_CONFERMA_RICHIESTA_EN : MESSAGGIO_CONFERMA_RICHIESTA;
    return this.negate > 0 ? (lingua === "en" ? MESSAGGIO_NON_AUTORIZZATO_EN : MESSAGGIO_NON_AUTORIZZATO) : null;
  }
}
