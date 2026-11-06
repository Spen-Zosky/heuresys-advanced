/**
 * apps/web/src/lib/enum-labels.test.ts — F-2 del piano interfacce (L6, 2026-11-04).
 */
import { describe, it, expect } from "vitest";
import { codiceInParole } from "./enum-labels";

describe("F-2 — un codice senza etichetta si legge in parole", () => {
  it("i codici con il trattino basso diventano parole", () => {
    expect(codiceInParole("ZUCCHETTI_PAGHE")).toBe("Zucchetti paghe");
    expect(codiceInParole("MID_YEAR")).toBe("Mid year");
    expect(codiceInParole("fixed_term")).toBe("Fixed term");
  });

  it("le sigle e le parole normali restano come sono", () => {
    expect(codiceInParole("PDF")).toBe("PDF");
    expect(codiceInParole("ACTIVE")).toBe("ACTIVE");
    expect(codiceInParole("Banca regionale")).toBe("Banca regionale");
    expect(codiceInParole("en-GB")).toBe("en-GB");
  });
});
