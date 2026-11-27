import { describe, it, expect } from "vitest";
import { ISTRUZIONI_ASSISTENTE, istruzioniAssistente } from "../src/istruzioni.js";

// E12 (F6b): ogni proposta sulle persone porta il perché e il controllo di equità dichiarato.
describe("l'assistente dichiara il controllo di equità sulle proposte che riguardano persone", () => {
  it("le istruzioni chiedono il perché, la dichiarazione e il rifiuto di raccomandare sotto soglia", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("«Controllo di equità»");
    expect(ISTRUZIONI_ASSISTENTE).toContain("spiega sempre il perché");
    expect(ISTRUZIONI_ASSISTENTE).toContain("non presentare la proposta come raccomandazione");
    expect(ISTRUZIONI_ASSISTENTE).toContain("campo equita");
  });
  it("in inglese la dichiarazione resta, con il suo titolo inglese", () => {
    expect(istruzioniAssistente("en")).toContain("«Fairness check»");
  });
});
