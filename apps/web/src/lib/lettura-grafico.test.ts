import { describe, it, expect } from "vitest";
import { letturaDelGrafico } from "./lettura-grafico";

describe("lettura del grafico (C8)", () => {
  it("barre con categorie: più alto, più basso, totale e tabella", () => {
    const l = letturaDelGrafico(
      { xAxis: { type: "category", data: ["Milano", "Roma", "Napoli"] }, yAxis: { type: "value" }, series: [{ type: "bar", data: [1200, 300, 4500.5] }] },
      "it-IT",
    );
    expect(l?.frase).toBe("Il valore più alto è 4.500,5 (Napoli), il più basso 300 (Roma); totale 6.000,5 su 3 voci.");
    expect(l?.tabella.righe).toEqual([["Milano", 1200], ["Roma", 300], ["Napoli", 4500.5]]);
  });
  it("torta con nomi nei dati", () => {
    const l = letturaDelGrafico({ series: [{ type: "pie", data: [{ name: "A", value: 2 }, { name: "B", value: 5 }] }] }, "it-IT");
    expect(l?.frase).toContain("5 (B)");
  });
  it("niente lettura dove non si può ricavare con certezza", () => {
    expect(letturaDelGrafico({ series: [{ type: "graph", data: [] }] }, "it-IT")).toBeNull();
    expect(letturaDelGrafico(null, "it-IT")).toBeNull();
  });
});
