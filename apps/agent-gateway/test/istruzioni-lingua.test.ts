import { describe, it, expect } from "vitest";
import { ISTRUZIONI_ASSISTENTE, istruzioniAssistente, rigaLingua } from "../src/istruzioni.js";
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
  it("il perimetro viene dalle letture, e chi non si trova non è «inesistente» (batteria F6a)", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("non delimitano il perimetro");
    expect(ISTRUZIONI_ASSISTENTE).toContain("né che esiste né che non esiste");
    expect(ISTRUZIONI_ASSISTENTE).toContain("campo `nota`");
  });
  it("il rifiuto fisso segue la lingua", () => {
    const e = new EsitiLetture();
    e.negata();
    expect(e.rifiuto()).toBe(MESSAGGIO_NON_AUTORIZZATO);
    expect(e.rifiuto("en")).toBe(MESSAGGIO_NON_AUTORIZZATO_EN);
  });

  it("ogni domanda porta la sua lingua, anche dopo un cambio a metà conversazione", () => {
    expect(rigaLingua("en")).toContain("INGLESE");
    expect(rigaLingua("it")).toContain("ITALIANO");
    expect(istruzioniAssistente("en").startsWith("LINGUA DELLA PAGINA: INGLESE")).toBe(true);
  });

  it("27/11 — niente frase tecnica in apertura, e i collaboratori diretti sono la linea di riporto", () => {
    for (const l of ["it", "en"] as const) {
      const t = istruzioniAssistente(l);
      expect(t).toContain("Il concetto …");
      expect(t).toMatch(/LINEA DI RIPORTO|REPORTING LINE/);
    }
    expect(ISTRUZIONI_ASSISTENTE).toContain("non quelli delle sue squadre");
  });

  it("chiede il blocco delle fonti cliccabili, con i tre tipi, in entrambe le lingue (F6c)", () => {
    for (const l of ["it", "en"] as const) {
      const t = istruzioniAssistente(l);
      expect(t).toContain("```fonti```");
      for (const tipo of ["dato", "pagina", "regola"]) expect(t).toContain(tipo);
    }
    expect(istruzioniAssistente("en")).toContain("`titolo` and `dettaglio` are in English");
  });
});
