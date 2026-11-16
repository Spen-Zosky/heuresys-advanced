import { describe, it, expect } from "vitest";
import { esadecimaleConAlfa } from "./colori-grafico";

describe("esadecimaleConAlfa", () => {
  it("porta #rrggbb e #rgb a rgba con la trasparenza data", () => {
    expect(esadecimaleConAlfa("#2563EB", 0.12)).toBe("rgba(37, 99, 235, 0.12)");
    expect(esadecimaleConAlfa("#fff", "0.5")).toBe("rgba(255, 255, 255, 0.5)");
    expect(esadecimaleConAlfa("#000000", "12%")).toBe("rgba(0, 0, 0, 0.12)");
  });
  it("rifiuta ciò che non è un esadecimale o una trasparenza leggibile", () => {
    expect(esadecimaleConAlfa("transparent", 0.1)).toBeNull();
    expect(esadecimaleConAlfa("hsl(1 2% 3%)", 0.1)).toBeNull();
    expect(esadecimaleConAlfa("#2563EB", "x")).toBeNull();
  });
});
