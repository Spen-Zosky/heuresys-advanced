import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/*
 * K22 del giro forense del 23/11/2026: convenzioni di presentazione nei dizionari.
 *   - un numero davanti a un'unità contabile («1 giorni») passa da `count`, che sceglie il plurale;
 *   - un testo dell'interfaccia non deve sembrare il resto di una prova («(agenti, collaudo)»).
 */
const BASE = path.resolve(__dirname, "..", "locales");
type Nodo = { [k: string]: string | Nodo };

function foglie(nodo: Nodo, prefisso = ""): Array<[string, string]> {
  return Object.entries(nodo).flatMap(([k, v]) =>
    typeof v === "string" ? [[prefisso ? `${prefisso}.${k}` : k, v] as [string, string]] : foglie(v, prefisso ? `${prefisso}.${k}` : k));
}

const tutte = (["it", "en"] as const).flatMap((l) =>
  fs.readdirSync(path.join(BASE, l)).filter((f) => f.endsWith(".json")).flatMap((f) =>
    foglie(JSON.parse(fs.readFileSync(path.join(BASE, l, f), "utf8")) as Nodo).map(([k, v]) => ({ dove: `${l}/${f}:${k}`, k, v }))));

describe("K22: plurali e testi di presentazione nei dizionari", () => {
  it("un numero davanti a giorni, mesi, ore o anni passa da {{count}}", () => {
    const unita = /\{\{(?!count\}\})\w+\}\} (giorni|giorno|days|day|mesi|months|ore|hours|anni|years|settimane|weeks)\b/;
    const plurale = /_(zero|one|two|few|many|other)$/;
    expect(tutte.filter((x) => unita.test(x.v) && !plurale.test(x.k)).map((x) => x.dove)).toEqual([]);
  });

  it("nessun testo dell'interfaccia nomina il collaudo come se fosse un resto di prova", () => {
    expect(tutte.filter((x) => /\bcollaudo\)|\(agents, test\)/i.test(x.v)).map((x) => x.dove)).toEqual([]);
  });
});
