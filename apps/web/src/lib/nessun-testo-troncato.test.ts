/**
 * Regola di Enzo: nessun testo troncato nell'interfaccia (revisione frontend, passo D1).
 * Il testo va a capo; non si usano `truncate` né `line-clamp-*` nei componenti, e i grafici
 * non tagliano le etichette degli assi (`overflow: "break"`, mai `"truncate"`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function file(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? file(p) : /\.(tsx?|css)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe("nessun testo troncato", () => {
  const radice = join(__dirname, "..");
  const vietati = /className="[^"]*\b(truncate|line-clamp-\d|text-ellipsis)\b|overflow:\s*"truncate"|overflow\s*=\s*"truncate"/;
  it("nessun componente taglia il testo", () => {
    const colpe = file(radice).filter((p) => vietati.test(readFileSync(p, "utf8")));
    expect(colpe).toEqual([]);
  });
});
