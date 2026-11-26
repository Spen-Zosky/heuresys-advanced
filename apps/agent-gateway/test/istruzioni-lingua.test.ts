import { describe, it, expect } from "vitest";
import { ISTRUZIONI_ASSISTENTE, istruzioniAssistente } from "../src/istruzioni.js";
import { MESSAGGIO_NON_AUTORIZZATO, MESSAGGIO_NON_AUTORIZZATO_EN, EsitiLetture } from "../src/omissis.js";

describe("la lingua dell'assistente segue quella della pagina", () => {
  it("in italiano le istruzioni restano quelle di sempre, senza nomi tecnici dei concetti", () => {
    expect(istruzioniAssistente()).toBe(ISTRUZIONI_ASSISTENTE);
    expect(istruzioniAssistente("it")).toBe(ISTRUZIONI_ASSISTENTE);
    expect(ISTRUZIONI_ASSISTENTE).toContain("kpi-definitions");
  });
  it("in inglese si aggiunge il blocco che chiede la risposta in inglese", () => {
    const en = istruzioniAssistente("en");
    expect(en).toContain("LINGUA DELLA PAGINA: INGLESE");
    expect(en).toContain(MESSAGGIO_NON_AUTORIZZATO_EN);
  });
  it("il rifiuto fisso segue la lingua", () => {
    const e = new EsitiLetture();
    e.negata();
    expect(e.rifiuto()).toBe(MESSAGGIO_NON_AUTORIZZATO);
    expect(e.rifiuto("en")).toBe(MESSAGGIO_NON_AUTORIZZATO_EN);
  });
});
