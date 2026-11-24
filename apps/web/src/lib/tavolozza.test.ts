import { describe, expect, it } from "vitest";
import { CHIAVE_COPIA_TAVOLOZZA, dimenticaCopiaTavolozza } from "./tavolozza";

describe("tavolozza: solo quella standard", () => {
  it("la copia lasciata dal vecchio selettore si toglie, il resto no", () => {
    const m = new Map<string, string>([[CHIAVE_COPIA_TAVOLOZZA, "2"], ["altro", "resta"]]);
    dimenticaCopiaTavolozza({ removeItem: (k) => void m.delete(k) });
    expect(m.has(CHIAVE_COPIA_TAVOLOZZA)).toBe(false);
    expect(m.get("altro")).toBe("resta");
  });

  it("senza archivio (lato server o modalità privata) non si rompe niente", () => {
    expect(() => dimenticaCopiaTavolozza(null)).not.toThrow();
    expect(() => dimenticaCopiaTavolozza({ removeItem: () => { throw new Error("bloccato"); } })).not.toThrow();
  });
});
