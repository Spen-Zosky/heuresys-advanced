/**
 * apps/api/test/e2e-drift-prefissi.test.ts — le due liste di prefissi non possono divergere.
 *
 * PERCHE'
 * -------
 * La definizione di «residuo di prova» e' UNA: i prefissi in
 * `apps/api/test/helpers/drift-check.ts`, che dichiara di essere «l'unico posto dove la
 * definizione di residuo e' scritta». Dal 2026-08-13 esiste pero' un secondo lettore —
 * `apps/web/tests/e2e/e2e-drift.ts`, l'assert dopo la suite Playwright — e i due vivono
 * in workspace distinti: `apps/web` gira dentro il transpiler di Playwright, non dentro
 * il build dell'API, quindi non puo' importare l'helper dell'altro workspace.
 *
 * Una copia va bene. Una copia che diverge IN SILENZIO no: chi aggiungesse una
 * convenzione nuova alla casa la vedrebbe applicata al lato API e non al lato E2E, e i
 * residui degli E2E — che sono proprio quelli che si perdono per mesi — sfuggirebbero.
 *
 * Questo test legge i DUE FILE e pretende che le liste coincidano, nell'ordine.
 * Non fa domande al database: e' un vincolo fra sorgenti, e va rosso appena si separano.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PREFISSI } from "./helpers/drift-check.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CASA = resolve(REPO, "apps/api/test/helpers/drift-check.ts");
const COPIA = resolve(REPO, "apps/web/tests/e2e/e2e-drift.ts");

/**
 * Estrae l'array letterale `export const PREFISSI = [...]` dal sorgente.
 *
 * Legge il TESTO invece di importare, di proposito: importare `e2e-drift.ts` da qui
 * tirerebbe dentro `node:child_process` e la risoluzione della connessione, cioe'
 * farebbe dipendere un vincolo fra sorgenti da un ambiente. Il testo basta e non mente.
 */
function leggiPrefissi(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const m = /export const PREFISSI\s*=\s*\[([^\]]*)\]/.exec(src);
  if (!m) throw new Error(`PREFISSI non trovati in ${file}`);
  // `JSON.parse` scioglie gli escape del letterale: nel sorgente `IT\\_SSE\\_%` sono due
  // barre, a runtime il valore ne ha una. Confrontare il testo grezzo farebbe passare
  // due file identicamente sbagliati — ed e' l'errore che il terzo test ha colto qui.
  return [...m[1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]!}"`) as string);
}

describe("la definizione di «residuo» e' una sola", () => {
  it("il lato E2E e il lato API usano gli stessi prefissi, nello stesso ordine", () => {
    const casa = leggiPrefissi(CASA);
    const copia = leggiPrefissi(COPIA);
    expect(copia).toEqual(casa);
  });

  it("cio' che il test legge dal testo e' cio' che il modulo esporta davvero", () => {
    // Senza questo, l'estrattore potrebbe leggere un array sbagliato (o un commento) e
    // il primo test sarebbe verde confrontando due letture entrambe errate.
    expect(leggiPrefissi(CASA)).toEqual([...PREFISSI]);
  });

  it("l'estrattore sa dire di NO", () => {
    expect(() => leggiPrefissi(resolve(REPO, "package.json"))).toThrow(/PREFISSI non trovati/);
  });
});
