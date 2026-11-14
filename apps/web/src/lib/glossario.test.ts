import { describe, it, expect } from "vitest";
import { spiegazioneDi, sigleIn } from "./glossario";

describe("glossario (C13)", () => {
  it("riconosce sigle, concetti e titoli composti", () => {
    expect(spiegazioneDi("KPI")?.esteso).toBe("Indicatore chiave di prestazione");
    expect(spiegazioneDi("Criticità")?.termine).toBe("Criticità");
    expect(spiegazioneDi("Posizioni scoperte")?.termine).toBe("scoperte");
    expect(spiegazioneDi("Copertura CCNL")?.termine).toBe("copertura");
    expect(spiegazioneDi("Nome")).toBeUndefined();
  });
  it("trova le sigle in un testo", () => {
    expect(sigleIn("Analisi VRIO e KPI del CCNL")).toEqual(["VRIO", "KPI", "CCNL"]);
  });
});
