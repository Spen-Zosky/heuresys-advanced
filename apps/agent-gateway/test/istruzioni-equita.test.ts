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
  it("dice quali letture portano il campo equita e che cosa scrivere quando manca", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("get_succession_readiness");
    expect(ISTRUZIONI_ASSISTENTE).toContain("Il controllo di equità non è stato eseguito su questa lettura");
  });
  it("una lettura da confermare non chiude la risposta: prima si mostra ciò che si è letto", () => {
    expect(ISTRUZIONI_ASSISTENTE).toContain("CONFERMA_SECONDO_FATTORE");
    expect(ISTRUZIONI_ASSISTENTE).toContain("Prima mostra tutto ciò che la domanda permette di leggere subito");
  });
  it("in inglese la dichiarazione resta, con il suo titolo inglese", () => {
    expect(istruzioniAssistente("en")).toContain("«Fairness check»");
  });
});
