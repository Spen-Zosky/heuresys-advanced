/**
 * apps/web/src/lib/enum-labels.test.ts — F-2 del piano interfacce (L6, 2026-11-04).
 */
import { describe, it, expect } from "vitest";
import { codiceInParole, sedeInParole } from "./enum-labels";

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

describe("ADR-0062 — il codice di sede si scrive nella lingua della pagina", () => {
  const en: Record<string, string> = { "organigramma.sede.filiale": "Branch {{n}}", "organigramma.sede.SEDE_CENTRALE": "Head office" };
  const t = (k: string, o?: Record<string, unknown>) =>
    en[k] !== undefined ? en[k]!.replace("{{n}}", String(o?.n ?? "")) : String(o?.defaultValue ?? k);

  it("una filiale numerata usa l'etichetta con il numero", () => {
    expect(sedeInParole("FILIALE_1", t)).toBe("Branch 1");
    expect(sedeInParole("FILIALE_17", t)).toBe("Branch 17");
  });

  it("un codice con etichetta la usa, uno senza cade in parole", () => {
    expect(sedeInParole("SEDE_CENTRALE", t)).toBe("Head office");
    expect(sedeInParole("CENTRO_OPERATIVO", t)).toBe("Centro operativo");
  });
});
