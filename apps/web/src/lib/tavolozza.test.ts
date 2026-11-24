import { describe, expect, it } from "vitest";
import {
  CHIAVE_COPIA_TAVOLOZZA,
  applicaTavolozzaDellaPersona,
  dimenticaCopiaTavolozza,
  ripristinaTavolozzaStandard,
} from "./tavolozza";

function stileFinto() {
  const m = new Map<string, string>();
  return {
    m,
    setProperty: (k: string, v: string) => void m.set(k, v),
    removeProperty: (k: string) => {
      const v = m.get(k) ?? "";
      m.delete(k);
      return v;
    },
  };
}

describe("tavolozza per persona", () => {
  it("senza scelta non lascia variabili in linea: vale la tavolozza standard del design system", () => {
    const stile = stileFinto();
    stile.setProperty("--palette-1", "#E83030"); // residuo di un'altra persona
    applicaTavolozzaDellaPersona(undefined, stile, () => {
      throw new Error("non deve applicare niente");
    });
    expect(stile.m.size).toBe(0);
  });

  it("«Equilibrata» è la standard: toglie le variabili invece di scriverle", () => {
    const stile = stileFinto();
    stile.setProperty("--palette-2", "#F67023");
    applicaTavolozzaDellaPersona("balanced", stile, () => {
      throw new Error("non deve applicare niente");
    });
    expect(stile.m.size).toBe(0);
  });

  it("una scelta diversa si applica con l'indice giusto, e poi il ripristino la toglie", () => {
    const stile = stileFinto();
    const viste: number[] = [];
    applicaTavolozzaDellaPersona("warm-sunset", stile, (i) => {
      viste.push(i);
      stile.setProperty("--palette-1", "#E83030");
    });
    expect(viste).toEqual([2]);
    ripristinaTavolozzaStandard(stile);
    expect(stile.m.size).toBe(0);
  });

  it("la copia nel localStorage condiviso si toglie", () => {
    const m = new Map<string, string>([[CHIAVE_COPIA_TAVOLOZZA, "2"], ["altro", "resta"]]);
    dimenticaCopiaTavolozza({ removeItem: (k) => void m.delete(k) });
    expect(m.has(CHIAVE_COPIA_TAVOLOZZA)).toBe(false);
    expect(m.get("altro")).toBe("resta");
  });

  it("senza archivio (lato server o modalità privata) non si rompe niente", () => {
    expect(() => dimenticaCopiaTavolozza(null)).not.toThrow();
    expect(() =>
      dimenticaCopiaTavolozza({ removeItem: () => { throw new Error("bloccato"); } }),
    ).not.toThrow();
  });
});
