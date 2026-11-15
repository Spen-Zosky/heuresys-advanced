import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const BASE = path.resolve(__dirname, "..", "locales");
const LOCALI = ["it", "en"] as const;
const SUFFISSI_PLURALI = /_(zero|one|two|few|many|other)$/;

type Nodo = { [k: string]: string | Nodo };

/** Chiavi foglia con `{{count}}` che non hanno la sorella `<chiave>_one`. */
function senzaSingolare(nodo: Nodo, prefisso = ""): string[] {
  const mancanti: string[] = [];
  for (const [chiave, valore] of Object.entries(nodo)) {
    const percorso = prefisso ? `${prefisso}.${chiave}` : chiave;
    if (typeof valore === "object" && valore !== null) {
      mancanti.push(...senzaSingolare(valore, percorso));
    } else if (
      typeof valore === "string" &&
      valore.includes("{{count}}") &&
      !SUFFISSI_PLURALI.test(chiave) &&
      !(`${chiave}_one` in nodo)
    ) {
      mancanti.push(percorso);
    }
  }
  return mancanti;
}

describe("plurali nei dizionari: «1 richieste» non deve comparire", () => {
  for (const locale of LOCALI) {
    const cartella = path.join(BASE, locale);
    for (const file of fs.readdirSync(cartella).filter((f) => f.endsWith(".json"))) {
      it(`${locale}/${file}: ogni chiave con {{count}} ha la sorella _one`, () => {
        const dizionario = JSON.parse(fs.readFileSync(path.join(cartella, file), "utf8")) as Nodo;
        expect(senzaSingolare(dizionario)).toEqual([]);
      });
    }
  }
});
