import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { colonnaTitolo, testoCella } from "./titolo-riga";

type R = { n: number; nome: string; codice: string };
const col = (header: string, f: (r: R) => unknown) => ({ header, cell: (r: R) => f(r) as never });
const riga: R = { n: 0, nome: "Strategia e governance aziendale", codice: "1.1" };

describe("titolo della scheda della riga", () => {
  it("salta il numero d'ordine e prende il nome (/processes intitolava «0»)", () => {
    const c = [col("N.", (r) => createElement("span", null, r.n)), col("Processo", (r) => createElement("span", null, r.nome))];
    expect(colonnaTitolo(c, riga)?.header).toBe("Processo");
  });
  it("salta anche un codice fatto di soli numeri", () => {
    const c = [col("Codice", (r) => r.codice), col("Nome", (r) => r.nome)];
    expect(colonnaTitolo(c, riga)?.header).toBe("Nome");
  });
  it("senza nomi resta la prima colonna con intestazione", () => {
    const c = [col("", () => "x"), col("N.", (r) => r.n), col("Totale", () => 12)];
    expect(colonnaTitolo(c, riga)?.header).toBe("N.");
  });
  it("legge il testo dentro gli elementi annidati", () => {
    expect(testoCella(createElement("div", null, createElement("b", null, "Ciao"), " ", 3))).toBe("Ciao 3");
  });
});
