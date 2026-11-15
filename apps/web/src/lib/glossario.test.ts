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

describe("glossario nella lingua della pagina (S-06, S-07)", () => {
  it("in inglese una colonna «Priority» trova la sua voce, in inglese", () => {
    const s = spiegazioneDi("Priority", "en-GB");
    expect(s?.termine).toBe("Priority");
    expect(s?.testo).toMatch(/^How soon the request must be decided/);
    expect(spiegazioneDi("Priorità", "en-GB")).toBeUndefined();
  });
  it("in italiano «Priority» non è nel glossario", () => {
    expect(spiegazioneDi("Priority", "it-IT")).toBeUndefined();
    expect(spiegazioneDi("Priorità", "it-IT")?.testo).toMatch(/^Quanto presto/);
  });
  it("le sigle sono quelle di sempre, spiegate nella lingua", () => {
    expect(spiegazioneDi("KPI", "en")?.esteso).toBe("Key performance indicator");
    expect(spiegazioneDi("KPI", "it")?.esteso).toBe("Indicatore chiave di prestazione");
  });
  it("S-07: «flight-risk» ha una voce, con più forme e in tutte e due le lingue", () => {
    expect(spiegazioneDi("Flight-risk", "it")?.testo).toMatch(/lasci l'azienda/);
    expect(spiegazioneDi("Flight risk", "en")?.testo).toMatch(/leaves the company/);
    expect(spiegazioneDi("Scope", "en")).toBeDefined();
    expect(spiegazioneDi("Workflow", "it")).toBeDefined();
  });
});
