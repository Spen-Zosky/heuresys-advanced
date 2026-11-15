import { describe, it, expect } from "vitest";
import { assiDerivati, letturaDelGrafico } from "./lettura-grafico";

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

describe("dispersione (C8)", () => {
  it("conta i punti per gruppo e scrive le medie", () => {
    const r = letturaDelGrafico({
      xAxis: { type: "value", name: "Punto medio" }, yAxis: { type: "value", name: "Ampiezza" },
      series: [
        { name: "Filiale A", type: "scatter", data: [[30000, 2000], [32000, 4000]] },
        { name: "Filiale B", type: "scatter", data: [[40000, 9000]] },
      ],
    }, "it-IT");
    expect(r?.frase).toContain("3 punti in 2 gruppi");
    expect(r?.frase).toContain("9.000 (Filiale B)");
    expect(r?.tabella.righe[0]).toEqual(["Filiale A", 2, 31000, 3000]);
  });
});

describe("lingua della lettura (S-06)", () => {
  const barre = { xAxis: { type: "category", data: ["Milano", "Roma", "Napoli"] }, yAxis: { type: "value" }, series: [{ type: "bar", data: [1200, 300, 4500.5] }] };
  it("in inglese la frase e la tabella sono in inglese", () => {
    const l = letturaDelGrafico(barre, "en-GB");
    expect(l?.frase).toBe("The highest value is 4,500.5 (Napoli), the lowest 300 (Roma); total 6,000.5 over 3 items.");
    expect(l?.tabella.titolo).toBe("See the chart numbers");
    expect(l?.tabella.colonne).toEqual(["Item", "Value"]);
  });
  it("la lettura italiana non è cambiata", () => {
    expect(letturaDelGrafico(barre, "it-IT")?.tabella.colonne).toEqual(["Voce", "Valore"]);
  });
  it("dispersione senza nomi d'asse: i nomi di ripiego seguono la lingua", () => {
    const o = { xAxis: {}, yAxis: {}, series: [{ type: "scatter", name: "A", data: [[1, 2], [3, 4]] }] };
    expect(letturaDelGrafico(o, "en-GB")?.tabella.colonne).toEqual(["Item", "Points", "Horizontal axis (average)", "Vertical axis (average)"]);
    expect(letturaDelGrafico(o, "it-IT")?.tabella.colonne).toEqual(["Voce", "Punti", "Asse orizzontale (media)", "Asse verticale (media)"]);
  });
});

describe("nomi degli assi (S-10)", () => {
  it("l'asse dei valori prende il nome della serie, quello delle categorie no", () => {
    const o = { xAxis: { type: "category", data: ["A"] }, yAxis: { type: "value" }, series: [{ type: "bar", name: "Persone", data: [1] }] };
    expect(assiDerivati(o, undefined)).toEqual({ y: "Persone" });
  });
  it("barre orizzontali: l'asse dei valori è x", () => {
    const o = { xAxis: { type: "value" }, yAxis: { type: "category", data: ["A"] }, series: [{ type: "bar", name: "Ore", data: [1] }] };
    expect(assiDerivati(o, undefined)).toEqual({ x: "Ore" });
  });
  it("un nome dichiarato o già scritto vince", () => {
    const o = { xAxis: { type: "value", name: "Mesi" }, yAxis: { type: "value" }, series: [{ type: "line", name: "Ore", data: [1] }] };
    expect(assiDerivati(o, { y: "Ore (h)" })).toEqual({ y: "Ore (h)" });
  });
  it("torte, mappe e alberi non hanno assi da nominare", () => {
    expect(assiDerivati({ series: [{ type: "pie", name: "X", data: [] }] }, undefined)).toEqual({});
  });
});
