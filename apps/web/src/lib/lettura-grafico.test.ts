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

describe("lettura di mappe di calore e alberi (C8)", () => {
  it("mappa di calore", () => {
    const r = letturaDelGrafico({ xAxis: { data: ["A", "B"] }, yAxis: { data: ["Uno", "Due"] }, series: [{ type: "heatmap", data: [[0, 0, 5], [1, 0, 1], [0, 1, 9]] }] }, "it-IT");
    expect(r?.frase).toContain("9 (Due · A)");
    expect(r?.tabella.righe[0]).toEqual(["Uno", 5, 1]);
  });
  it("albero", () => {
    const r = letturaDelGrafico({ series: [{ type: "tree", data: [{ name: "Banca", children: [{ name: "Filiale" }] }] }] }, "it-IT");
    expect(r?.frase).toMatch(/^2 elementi; in testa: Banca, Filiale\./);
  });
});
