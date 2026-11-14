/**
 * apps/agent-gateway/src/misura-tempi.ts — piano dell'assistente nelle interfacce, blocco I6 (L8).
 *
 * Le tappe di un giro, lette dallo stream SSE com'è arrivato alla finestra: quanto si aspetta il
 * primo segno di vita, il primo comando della vista, la prima frase dell'assistente, il primo
 * strumento e la fine. Funzione pura: riceve i blocchi con l'istante d'arrivo (millisecondi
 * dall'invio) e non sa niente della rete; la usa `scripts/misura-tempi.ts`, che misura dal vivo.
 */

export interface BloccoArrivato {
  /** Millisecondi dall'invio della richiesta. */
  ms: number;
  /** Il blocco SSE intero, «event: x\ndata: {...}». */
  testo: string;
}

export interface Tappe {
  primoByte: number | null;
  primoComando: number | null;
  primoStrumento: number | null;
  primoTesto: number | null;
  fine: number | null;
  /** Come è finito il giro: done, error, limit, oppure null se lo stream si è chiuso prima. */
  esito: "done" | "error" | "limit" | null;
  comandi: number;
  strumenti: number;
}

function leggi(testo: string): { evento: string; dati: unknown } {
  let evento = "message";
  const righe: string[] = [];
  for (const r of testo.split("\n")) {
    if (r.startsWith("event:")) evento = r.slice(6).trim();
    else if (r.startsWith("data:")) righe.push(r.slice(5).trimStart());
  }
  let dati: unknown = null;
  try {
    dati = JSON.parse(righe.join("\n"));
  } catch {
    dati = null;
  }
  return { evento, dati };
}

/** I blocchi di contenuto di un messaggio dell'assistente dell'SDK, o nessuno. */
function contenuti(dati: unknown): Array<{ type?: unknown; text?: unknown }> {
  if (!dati || typeof dati !== "object") return [];
  const e = dati as { type?: unknown; message?: { content?: unknown } };
  if (e.type !== "assistant" || !Array.isArray(e.message?.content)) return [];
  return e.message.content as Array<{ type?: unknown; text?: unknown }>;
}

export function tappe(blocchi: readonly BloccoArrivato[]): Tappe {
  const t: Tappe = {
    primoByte: blocchi[0]?.ms ?? null,
    primoComando: null,
    primoStrumento: null,
    primoTesto: null,
    fine: null,
    esito: null,
    comandi: 0,
    strumenti: 0,
  };
  for (const b of blocchi) {
    const { evento, dati } = leggi(b.testo);
    if (evento === "page_command") {
      t.comandi++;
      t.primoComando ??= b.ms;
    } else if (evento === "done" || evento === "error" || evento === "limit") {
      // Il primo che arriva decide: dopo un error o un limit il gateway manda comunque done.
      if (t.esito === null) {
        t.esito = evento;
        t.fine = b.ms;
      }
    } else if (evento === "message") {
      for (const c of contenuti(dati)) {
        if (c.type === "text" && typeof c.text === "string" && c.text.trim()) t.primoTesto ??= b.ms;
        if (c.type === "tool_use") {
          t.strumenti++;
          t.primoStrumento ??= b.ms;
        }
      }
    }
  }
  return t;
}

/** Mediana di valori non nulli; null se non ce n'è nessuno. */
export function mediana(valori: ReadonlyArray<number | null>): number | null {
  const v = valori.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[m]! : Math.round((v[m - 1]! + v[m]!) / 2);
}
